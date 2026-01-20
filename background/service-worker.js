// Service Worker for Slop Blocker - Handles blocking logic

import {
  getRules,
  getSettings,
  getStats,
  recordBlockAttempt,
  recordTimeSpent,
  recordSlippageAndResetStreak,
  incrementStreak,
  setBypass,
  getActiveBypass,
  clearBypass,
  isDomainBypassed,
  toggleEnabled,
} from '../utils/storage.js';
import { getTodayKey } from '../utils/helpers.js';
import {
  matchesRule,
  extractDomain,
  isWithinSchedule,
} from '../utils/patterns.js';

// Dynamic rule ID counter (start high to avoid conflicts)
let ruleIdCounter = 1000;

// Store last blocked info per tab
const lastBlockedByTab = new Map();

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Slop Blocker installed');
  await incrementStreak();
  await updateBlockingRules();
  setupScheduleAlarm();
});

// Update streak on startup
chrome.runtime.onStartup.addListener(async () => {
  await incrementStreak();
  await updateBlockingRules();
  setupScheduleAlarm();
});

// Setup periodic alarm to update time-based blocking rules
function setupScheduleAlarm() {
  // Create alarm to fire every minute for time-based schedule checks
  chrome.alarms.create('updateScheduledRules', { periodInMinutes: 1 });
}

// Listen for alarm to update time-based rules, streak, and bypass expiry
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateScheduledRules') {
    await incrementStreak(); // Increment streak once per day

    // Check for expired bypass and update rules accordingly
    const bypass = await getActiveBypass();
    if (bypass && Date.now() > bypass.expiry) {
      await clearBypass();
      console.log('Bypass expired, re-enabling blocking');
    }

    await updateBlockingRules();
  }
});

// Listen for rule matches to capture blocked URL info
// This fires when declarativeNetRequest blocks/redirects a request
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const url = info.request.url;
    const domain = extractDomain(url);
    const tabId = info.request.tabId;
    console.log('Blocked (debug):', domain, 'tab:', tabId);

    // Store for later retrieval by blocked page
    if (tabId > 0) {
      lastBlockedByTab.set(tabId, { url, domain, timestamp: Date.now() });
    }
  });
}

// Also listen for navigation events to capture blocked URLs
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only main frame

  const settings = await getSettings();
  if (!settings.enabled) return;

  const rules = await getRules();
  const matchedRule = rules.find(
    (rule) => matchesRule(details.url, rule) && isWithinSchedule(rule),
  );

  if (matchedRule) {
    const domain = extractDomain(details.url);
    console.log('Capturing blocked URL:', domain, 'tab:', details.tabId);
    lastBlockedByTab.set(details.tabId, {
      url: details.url,
      domain,
      timestamp: Date.now(),
    });
  }
});

// Clean up old entries when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  lastBlockedByTab.delete(tabId);
});

// Listen for messages from popup and options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

// Message handlers map
const messageHandlers = {
  GET_RULES: () => getRules(),
  GET_SETTINGS: () => getSettings(),

  async UPDATE_RULES() {
    await updateBlockingRules();
    return { success: true };
  },

  async TOGGLE_ENABLED() {
    const settings = await toggleEnabled();
    await updateBlockingRules();
    return settings;
  },

  async RECORD_BLOCK({ domain }) {
    if (!domain) return { success: false };
    await recordBlockAttempt(domain);
    return { success: true };
  },

  GET_LAST_BLOCKED(_, sender) {
    const tabId = sender.tab?.id;
    if (!tabId || !lastBlockedByTab.has(tabId)) return null;
    const info = lastBlockedByTab.get(tabId);
    return Date.now() - info.timestamp < 30000 ? info : null;
  },

  async CHECK_SITE({ url, domain }) {
    const rules = await getRules();
    const isBypassed = await isDomainBypassed(domain);
    const isBlocked =
      !isBypassed &&
      rules.some((rule) => matchesRule(url, rule) && isWithinSchedule(rule));
    return { isBlocked, domain, isBypassed };
  },

  async TEMPORARY_BYPASS({ domain, originalUrl }) {
    if (!domain) return { success: false };
    const result = await recordSlippageAndResetStreak(domain);
    const bypass = await setBypass(domain, 5);
    await updateBlockingRules();
    return {
      success: true,
      ...result,
      bypassExpiry: bypass.expiry,
      redirectUrl: originalUrl || `https://${domain}`,
    };
  },

  async RECORD_TIME({ domain, url, seconds, isBlocked }) {
    if (!domain || seconds <= 0 || !isBlocked) {
      return { success: false };
    }
    const rules = await getRules();
    const stillBlocked = rules.some(
      (rule) =>
        matchesRule(url || `https://${domain}`, rule) && isWithinSchedule(rule),
    );
    if (!stillBlocked) return { success: false, stillBlocked: false };
    await recordTimeSpent(domain, seconds);
    return { success: true, stillBlocked: true };
  },

  async GET_STATS() {
    await incrementStreak();
    const stats = await getStats();
    return { stats, today: getTodayKey() };
  },
};

async function handleMessage(message, sender) {
  const handler = messageHandlers[message.type];
  if (!handler) {
    console.warn('Unknown message type:', message.type);
    return null;
  }
  return handler(message, sender);
}

// Check if a rule should be skipped due to active bypass
function shouldSkipForBypass(rule, bypassDomain) {
  if (!bypassDomain) return false;
  const ruleDomain = rule.pattern.replace(/^\*\./, '').toLowerCase();
  return ruleDomain === bypassDomain || bypassDomain.endsWith('.' + ruleDomain);
}

// Build a declarativeNetRequest rule from our stored rule
function buildBlockingRule(rule, ruleId) {
  const baseAction = {
    type: 'redirect',
    redirect: { extensionPath: '/pages/blocked/blocked.html' },
  };

  // Regex rules use regexFilter
  if (rule.type === 'regex') {
    return {
      id: ruleId,
      priority: 1,
      action: baseAction,
      condition: {
        regexFilter: rule.pattern,
        resourceTypes: ['main_frame'],
      },
    };
  }

  // Domain and URL rules use urlFilter
  const urlFilter =
    rule.type === 'domain'
      ? `||${rule.pattern.replace(/^\*\./, '')}`
      : rule.pattern;

  return {
    id: ruleId,
    priority: 1,
    action: baseAction,
    condition: {
      urlFilter,
      resourceTypes: ['main_frame'],
    },
  };
}

// Update the declarativeNetRequest rules based on stored rules
async function updateBlockingRules() {
  const settings = await getSettings();
  const rules = await getRules();
  const bypass = await getActiveBypass();

  // Remove all existing dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  if (existingRules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((r) => r.id),
    });
  }

  if (!settings.enabled) {
    console.log('Blocking disabled');
    return;
  }

  // Determine active bypass domain
  const activeBypassDomain =
    bypass && Date.now() < bypass.expiry ? bypass.domain.toLowerCase() : null;

  if (activeBypassDomain) {
    console.log(
      `Bypass active for ${activeBypassDomain} until ${new Date(bypass.expiry).toLocaleTimeString()}`,
    );
  }

  // Filter and build rules
  const enabledRules = rules.filter(
    (r) =>
      r.enabled &&
      isWithinSchedule(r) &&
      !shouldSkipForBypass(r, activeBypassDomain),
  );

  const newRules = enabledRules.map((rule, index) =>
    buildBlockingRule(rule, ruleIdCounter + index),
  );

  // Add new rules
  if (newRules.length > 0) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules,
      });
      console.log(`Added ${newRules.length} blocking rules`);
    } catch (e) {
      console.error('Error adding rules:', e);
    }
  }

  ruleIdCounter += newRules.length;
}

// Export for testing
export { updateBlockingRules };

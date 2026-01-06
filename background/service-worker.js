// Service Worker for Slop Blocker - Handles blocking logic

import {
  getRules,
  getSettings,
  recordBlockAttempt,
  recordTimeSpent,
  updateStreak,
} from '../utils/storage.js';
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
  await updateStreak();
  await updateBlockingRules();
  setupScheduleAlarm();
});

// Update streak on startup
chrome.runtime.onStartup.addListener(async () => {
  await updateStreak();
  await updateBlockingRules();
  setupScheduleAlarm();
});

// Setup periodic alarm to update time-based blocking rules
function setupScheduleAlarm() {
  // Create alarm to fire every minute for time-based schedule checks
  chrome.alarms.create('updateScheduledRules', { periodInMinutes: 1 });
}

// Listen for alarm to update time-based rules and streak
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateScheduledRules') {
    await updateStreak(); // Update streak daily
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
    (rule) => matchesRule(details.url, rule) && isWithinSchedule(rule)
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

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_RULES':
      return await getRules();

    case 'GET_SETTINGS':
      return await getSettings();

    case 'UPDATE_RULES':
      await updateBlockingRules();
      return { success: true };

    case 'TOGGLE_ENABLED':
      const { toggleEnabled } = await import('../utils/storage.js');
      const settings = await toggleEnabled();
      await updateBlockingRules();
      return settings;

    case 'RECORD_BLOCK':
      if (message.domain) {
        await recordBlockAttempt(message.domain);
        return { success: true };
      }
      return { success: false };

    case 'GET_LAST_BLOCKED':
      // Get the blocked info for the sender's tab
      const tabId = sender.tab?.id;
      if (tabId && lastBlockedByTab.has(tabId)) {
        const info = lastBlockedByTab.get(tabId);
        // Only return if recent (within 30 seconds)
        if (Date.now() - info.timestamp < 30000) {
          return info;
        }
      }
      return null;

    case 'CHECK_SITE':
      // Check if the domain/URL is in the block list and within schedule
      const checkRules = await getRules();
      const isBlocked = checkRules.some(
        (rule) => matchesRule(message.url, rule) && isWithinSchedule(rule)
      );
      return { isBlocked, domain: message.domain };

    case 'RECORD_TIME':
      // Record time spent on a site (blocked or unblocked)
      if (message.domain && message.seconds > 0) {
        await recordTimeSpent(
          message.domain,
          message.seconds,
          message.isBlocked || false
        );
        return { success: true };
      }
      return { success: false };

    case 'GET_STATS':
      // Update streak first, then return current stats
      await updateStreak();
      const { getStats: fetchStats, getTodayKey: getToday } = await import(
        '../utils/storage.js'
      );
      const currentStats = await fetchStats();
      const todayKey = getToday();
      return { stats: currentStats, today: todayKey };

    default:
      console.warn('Unknown message type:', message.type);
      return null;
  }
}

// Update the declarativeNetRequest rules based on stored rules
async function updateBlockingRules() {
  const settings = await getSettings();
  const rules = await getRules();

  // Get existing dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map((r) => r.id);

  // Remove all existing rules
  if (existingRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
    });
  }

  // If blocking is disabled, don't add new rules
  if (!settings.enabled) {
    console.log('Blocking disabled');
    return;
  }

  // Create new rules for enabled block rules that are within their schedule
  const enabledRules = rules.filter((r) => r.enabled && isWithinSchedule(r));
  const newRules = enabledRules.map((rule, index) => {
    const ruleId = ruleIdCounter + index;

    // Build URL filter based on rule type
    let urlFilter;
    if (rule.type === 'domain') {
      // Remove leading wildcard for urlFilter format
      const domain = rule.pattern.replace(/^\*\./, '');
      urlFilter = `||${domain}`;
    } else if (rule.type === 'url') {
      urlFilter = rule.pattern;
    } else {
      // For regex, use regexFilter instead
      return {
        id: ruleId,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            extensionPath: '/pages/blocked/blocked.html',
          },
        },
        condition: {
          regexFilter: rule.pattern,
          resourceTypes: ['main_frame'],
        },
      };
    }

    return {
      id: ruleId,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: '/pages/blocked/blocked.html',
        },
      },
      condition: {
        urlFilter: urlFilter,
        resourceTypes: ['main_frame'],
      },
    };
  });

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

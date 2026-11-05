// Service Worker for Slop Blocker - Handles blocking logic
//
// Enforcement has two layers that share one matcher (utils/patterns.js):
//
// 1. declarativeNetRequest: redirects matching top-level page loads to the
//    blocked page before the site even starts loading. The original URL is
//    carried in the blocked page's #hash.
// 2. Tab watcher (this file + content/tracker.js): catches everything DNR
//    can't see — single-page-app navigations (YouTube, Reddit, X...), pages
//    restored from back/forward cache, tabs that were already open when a
//    rule was added / a schedule started / a bypass expired, and rules whose
//    regex RE2 can't compile.

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
  toggleEnabled,
  STORAGE_KEYS,
} from '../utils/storage.js';
import { getTodayKey } from '../utils/helpers.js';
import {
  matchesRule,
  extractDomain,
  isWithinSchedule,
  ruleToRegexSource,
} from '../utils/patterns.js';

const BLOCKED_PAGE = chrome.runtime.getURL('pages/blocked/blocked.html');
const TICK_ALARM = 'updateScheduledRules';
const BYPASS_ALARM = 'bypassExpiry';

// ============ State ============

let stateCache = null;
// Rule ids that could not be installed into DNR; enforced via webNavigation.
let jsOnlyRuleIds = new Set();

async function getState() {
  if (!stateCache) {
    const [settings, rules, bypass] = await Promise.all([
      getSettings(),
      getRules(),
      getActiveBypass(),
    ]);
    stateCache = { settings, rules, bypass };
  }
  return stateCache;
}

function bypassedRuleIds(state, now = Date.now()) {
  const bypass = state.bypass;
  if (!bypass || now >= bypass.expiry) return new Set();
  if (Array.isArray(bypass.ruleIds)) return new Set(bypass.ruleIds);
  // Legacy bypass format ({ domain, expiry }): derive the rules from the domain.
  const probe = bypass.url || `https://${bypass.domain}/`;
  return new Set(
    state.rules.filter((r) => matchesRule(probe, r)).map((r) => r.id),
  );
}

/** Rules that are switched on and inside their schedule right now. */
function activeRules(state) {
  if (!state.settings.enabled) return [];
  return state.rules.filter((r) => r.enabled !== false && isWithinSchedule(r));
}

/**
 * Decide what to do with a URL.
 * matched:  active rules that match (the site counts as "slop" right now)
 * blocking: matched rules that are not suspended by a bypass
 */
function evaluate(url, state) {
  if (!isWebUrl(url)) return { matched: [], blocking: [], blocked: false };
  const matched = activeRules(state).filter((r) => matchesRule(url, r));
  const bypassed = bypassedRuleIds(state);
  const blocking = matched.filter((r) => !bypassed.has(r.id));
  return { matched, blocking, blocked: blocking.length > 0 };
}

function isWebUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function blockedPageUrl(originalUrl) {
  return `${BLOCKED_PAGE}#${originalUrl}`;
}

// ============ Tab enforcement ============

const recentRedirects = new Map(); // tabId -> { url, time }

async function redirectTab(tabId, url, { preferInPage = true } = {}) {
  if (tabId == null || tabId < 0) return;

  const last = recentRedirects.get(tabId);
  if (last && last.url === url && Date.now() - last.time < 1500) return;
  recentRedirects.set(tabId, { url, time: Date.now() });

  const target = blockedPageUrl(url);

  // Prefer letting the content script do location.replace(): it swaps the
  // current history entry, so "Back" doesn't bounce into the blocked site.
  if (preferInPage) {
    try {
      const res = await chrome.tabs.sendMessage(
        tabId,
        { type: 'SB_REDIRECT', target },
        { frameId: 0 },
      );
      if (res?.ok) return;
    } catch {
      // No (live) content script in this tab — fall through.
    }
  }

  try {
    await chrome.tabs.update(tabId, { url: target });
  } catch (e) {
    console.warn('Could not redirect tab', tabId, e?.message);
  }
}

async function enforceTab(tabId, url, opts) {
  if (!isWebUrl(url)) return;
  const state = await getState();
  if (evaluate(url, state).blocked) {
    await redirectTab(tabId, url, opts);
  }
}

async function sweepTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }
  await Promise.all(
    tabs.map((tab) => enforceTab(tab.id, tab.pendingUrl || tab.url)),
  );
}

// Cross-document navigations: DNR should already have redirected these. If a
// page commits on a blocked URL anyway (DNR missed it, site service worker,
// rule installed a moment late), kick it out.
chrome.webNavigation.onCommitted.addListener((d) => {
  if (d.frameId === 0) enforceTab(d.tabId, d.url);
});

// Single-page-app navigations (pushState/replaceState) and #hash changes.
chrome.webNavigation.onHistoryStateUpdated.addListener((d) => {
  if (d.frameId === 0) enforceTab(d.tabId, d.url);
});
chrome.webNavigation.onReferenceFragmentUpdated.addListener((d) => {
  if (d.frameId === 0) enforceTab(d.tabId, d.url);
});

// Rules DNR couldn't take (e.g. regex features RE2 lacks): stop the load early.
chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0 || !isWebUrl(d.url)) return;
  await ready;
  if (jsOnlyRuleIds.size === 0) return;
  const { blocking } = evaluate(d.url, await getState());
  if (blocking.some((r) => jsOnlyRuleIds.has(r.id))) {
    redirectTab(d.tabId, d.url, { preferInPage: false });
  }
});

// Catch-all for any URL change (bfcache restores, prerender activation, etc).
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) enforceTab(tabId, changeInfo.url);
});

chrome.tabs.onReplaced.addListener(async (addedTabId) => {
  try {
    const tab = await chrome.tabs.get(addedTabId);
    enforceTab(tab.id, tab.url);
  } catch {
    // tab vanished
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    enforceTab(tab.id, tab.pendingUrl || tab.url);
  } catch {
    // tab vanished
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  recentRedirects.delete(tabId);
});

// ============ declarativeNetRequest sync ============

function buildDnrRule(rule, id) {
  const regexFilter = ruleToRegexSource(rule);
  if (!regexFilter) return null;
  return {
    id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { regexSubstitution: `${BLOCKED_PAGE}#\\0` },
    },
    condition: {
      regexFilter,
      isUrlFilterCaseSensitive: false,
      resourceTypes: ['main_frame'],
    },
  };
}

async function isRegexOk(regex) {
  try {
    const res = await chrome.declarativeNetRequest.isRegexSupported({
      regex,
      isCaseSensitive: false,
      requireCapturing: true,
    });
    return res.isSupported;
  } catch {
    return false;
  }
}

function dnrSignature(r) {
  return JSON.stringify([
    r.id,
    r.condition.regexFilter,
    r.action.redirect?.regexSubstitution,
  ]);
}

async function syncDnr(state) {
  const bypassed = bypassedRuleIds(state);
  const rules = activeRules(state).filter((r) => !bypassed.has(r.id));

  const jsOnly = new Set();
  const desired = [];
  for (const rule of rules) {
    const dnr = buildDnrRule(rule, desired.length + 1);
    if (dnr && (await isRegexOk(dnr.condition.regexFilter))) {
      desired.push({ rule, dnr });
    } else {
      jsOnly.add(rule.id);
    }
  }

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const same =
    existing.length === desired.length &&
    existing
      .map(dnrSignature)
      .sort()
      .join('|') ===
      desired
        .map((d) => dnrSignature(d.dnr))
        .sort()
        .join('|');

  if (!same) {
    const removeRuleIds = existing.map((r) => r.id);
    try {
      // One atomic call: there is never a moment with no rules installed.
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: desired.map((d) => d.dnr),
      });
    } catch (e) {
      // One bad rule makes the whole batch fail. Install rules individually so
      // a single broken rule can't disable all blocking.
      console.warn('Batch DNR update failed, installing one by one:', e);
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
      for (const { rule, dnr } of desired) {
        try {
          await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [dnr],
          });
        } catch (err) {
          console.warn('Rule falls back to JS enforcement:', rule.pattern, err);
          jsOnly.add(rule.id);
        }
      }
    }
  }

  jsOnlyRuleIds = jsOnly;
}

// ============ Refresh (serialized) ============

let refreshQueue = Promise.resolve();

/** Re-read state, resync DNR, and kick blocked sites out of open tabs. */
function refresh({ sweep = true } = {}) {
  const run = refreshQueue.then(async () => {
    stateCache = null;
    const state = await getState();

    // Expire the bypass here as well as via its alarm.
    if (state.bypass && Date.now() >= state.bypass.expiry) {
      await clearBypass();
      stateCache = null;
      return; // storage.onChanged will schedule another refresh
    }

    await syncDnr(state);
    if (sweep) await sweepTabs();
  });
  refreshQueue = run.catch((e) => console.error('Refresh failed:', e));
  return run;
}

// Any change to rules / settings / bypass — from any page — re-applies blocking.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const keys = [STORAGE_KEYS.RULES, STORAGE_KEYS.SETTINGS, STORAGE_KEYS.BYPASS];
  if (keys.some((k) => k in changes)) {
    stateCache = null;
    refresh();
  }
});

// ============ Lifecycle & alarms ============

async function ensureAlarms() {
  const tick = await chrome.alarms.get(TICK_ALARM);
  if (!tick) chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });

  const { bypass } = await getState();
  if (bypass && bypass.expiry > Date.now()) {
    const alarm = await chrome.alarms.get(BYPASS_ALARM);
    if (!alarm) chrome.alarms.create(BYPASS_ALARM, { when: bypass.expiry });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await incrementStreak();
  await refresh();
});

chrome.runtime.onStartup.addListener(async () => {
  await incrementStreak();
  await refresh();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TICK_ALARM) {
    await incrementStreak();
    // Schedules start/stop on minute boundaries: resync and sweep open tabs.
    await refresh();
  } else if (alarm.name === BYPASS_ALARM) {
    await clearBypass(); // triggers refresh via storage.onChanged
  }
});

// Runs every time the service worker wakes up.
const ready = refresh({ sweep: false }).catch(() => {});
ensureAlarms();

// ============ Messages ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message?.type];
  if (!handler) return false;
  Promise.resolve(handler(message, sender))
    .then(sendResponse)
    .catch((e) => {
      console.error('Message handler failed:', message.type, e);
      sendResponse(null);
    });
  return true; // async response
});

const messageHandlers = {
  GET_RULES: () => getRules(),
  GET_SETTINGS: () => getSettings(),

  async UPDATE_RULES() {
    await refresh();
    return { success: true };
  },

  async TOGGLE_ENABLED() {
    const settings = await toggleEnabled();
    await refresh();
    return settings;
  },

  async RECORD_BLOCK({ domain }) {
    if (!domain) return { success: false };
    await recordBlockAttempt(domain);
    return { success: true };
  },

  // Used by the content script on every page load / SPA navigation.
  async CHECK_URL({ url }) {
    await ready;
    const { matched, blocked } = evaluate(url, await getState());
    return {
      blocked,
      tracked: matched.length > 0,
      domain: extractDomain(url),
      target: blocked ? blockedPageUrl(url) : null,
    };
  },

  async TEMPORARY_BYPASS({ url, domain }) {
    const originalUrl = isWebUrl(url) ? url : domain ? `https://${domain}/` : null;
    if (!originalUrl) return { success: false };

    const state = await getState();
    const ruleIds = activeRules(state)
      .filter((r) => matchesRule(originalUrl, r))
      .map((r) => r.id);
    const bypassDomain = extractDomain(originalUrl);

    const result = await recordSlippageAndResetStreak(bypassDomain);
    const bypass = await setBypass(
      { domain: bypassDomain, url: originalUrl, ruleIds },
      5,
    );
    chrome.alarms.create(BYPASS_ALARM, { when: bypass.expiry });
    await refresh({ sweep: false }); // DNR must be updated before we navigate

    return {
      success: true,
      ...result,
      bypassExpiry: bypass.expiry,
      redirectUrl: originalUrl,
    };
  },

  async RECORD_TIME({ url, seconds }) {
    if (!isWebUrl(url) || !(seconds > 0)) return { success: false };
    const { matched } = evaluate(url, await getState());
    if (matched.length === 0) return { success: false, tracked: false };
    // Cap a single report so a sleeping laptop can't add hours at once.
    await recordTimeSpent(extractDomain(url).replace(/^www\./, ''), Math.min(seconds, 60));
    return { success: true, tracked: true };
  },

  async GET_STATS() {
    await incrementStreak();
    const stats = await getStats();
    return { stats, today: getTodayKey() };
  },
};

// Storage utility for Chrome extension
import { generateId, getTodayKey } from './helpers.js';
const STORAGE_KEYS = {
  RULES: 'blockRules',
  STATS: 'statistics',
  SETTINGS: 'settings',
  BYPASS: 'activeBypass',
};

// Default data structures
const DEFAULT_STATS = {
  daily: {},
  streaks: { current: 0, longest: 0, lastIncrementDate: null },
  totalBlockAttempts: 0,
  timeSpent: {},
  slippages: [],
};

const DEFAULT_SETTINGS = {
  enabled: true,
  showMotivation: true,
};

// ============ Core Storage Functions ============

async function getStorageData(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key]));
  });
}

async function setStorageData(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// ============ Rules ============

export async function getRules() {
  return (await getStorageData(STORAGE_KEYS.RULES)) || [];
}

export async function saveRules(rules) {
  await setStorageData(STORAGE_KEYS.RULES, rules);
}

export async function addRule(rule) {
  const rules = await getRules();
  const newRule = {
    id: generateId(),
    pattern: rule.pattern,
    type: rule.type || 'domain',
    enabled: true,
    createdAt: Date.now(),
    schedule: rule.schedule || null,
    ...rule,
  };
  rules.push(newRule);
  await saveRules(rules);
  return newRule;
}

export async function updateRule(id, updates) {
  const rules = await getRules();
  const index = rules.findIndex((r) => r.id === id);
  if (index === -1) return null;

  rules[index] = { ...rules[index], ...updates };
  await saveRules(rules);
  return rules[index];
}

export async function deleteRule(id) {
  const rules = await getRules();
  await saveRules(rules.filter((r) => r.id !== id));
}

// ============ Statistics ============

export async function getStats() {
  const stats = await getStorageData(STORAGE_KEYS.STATS);
  return { ...structuredClone(DEFAULT_STATS), ...stats };
}

export async function saveStats(stats) {
  await setStorageData(STORAGE_KEYS.STATS, stats);
}

// Stats are read-modify-write; serialize mutations so concurrent messages
// (time tracking from several tabs, block records) don't overwrite each other.
let statsQueue = Promise.resolve();
function withStatsLock(fn) {
  const run = statsQueue.then(fn);
  statsQueue = run.catch(() => {});
  return run;
}

/**
 * Get or initialize today's stats
 */
function ensureTodayStats(stats) {
  const today = getTodayKey();
  if (!stats.daily[today]) {
    stats.daily[today] = {
      blockAttempts: 0,
      sitesAttempted: {},
      timeSpent: {},
    };
  }
  return stats.daily[today];
}

export function recordBlockAttempt(domain) {
  return withStatsLock(async () => {
  const stats = await getStats();
  const todayStats = ensureTodayStats(stats);

  todayStats.blockAttempts++;
  todayStats.sitesAttempted[domain] =
    (todayStats.sitesAttempted[domain] || 0) + 1;
  stats.totalBlockAttempts++;

  await saveStats(stats);
  return stats;
  });
}

export function recordTimeSpent(domain, seconds) {
  return withStatsLock(async () => {
  const stats = await getStats();
  const todayStats = ensureTodayStats(stats);

  // Initialize timeSpent objects if needed
  if (!todayStats.timeSpent) todayStats.timeSpent = {};
  if (!stats.timeSpent) stats.timeSpent = {};

  // Add time
  todayStats.timeSpent[domain] = (todayStats.timeSpent[domain] || 0) + seconds;
  stats.timeSpent[domain] = (stats.timeSpent[domain] || 0) + seconds;

  await saveStats(stats);
  return stats;
  });
}

export function recordSlippageAndResetStreak(domain) {
  return withStatsLock(async () => {
  const stats = await getStats();
  ensureTodayStats(stats);

  if (!stats.slippages) stats.slippages = [];

  const streakBroken = stats.streaks.current;

  stats.slippages.push({
    timestamp: Date.now(),
    domain,
    streakBroken,
  });

  // Update longest before resetting
  if (streakBroken > stats.streaks.longest) {
    stats.streaks.longest = streakBroken;
  }

  stats.streaks.current = 0;

  await saveStats(stats);
  return { slippageRecorded: true, streakBroken };
  });
}

export function incrementStreak() {
  return withStatsLock(async () => {
  const stats = await getStats();
  const today = getTodayKey();

  if (stats.streaks.lastIncrementDate !== today) {
    stats.streaks.current++;
    stats.streaks.lastIncrementDate = today;

    if (stats.streaks.current > stats.streaks.longest) {
      stats.streaks.longest = stats.streaks.current;
    }

    await saveStats(stats);
  }

  return stats;
  });
}

// ============ Settings ============

export async function getSettings() {
  const settings = await getStorageData(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings) {
  await setStorageData(STORAGE_KEYS.SETTINGS, settings);
}

export async function toggleEnabled() {
  const settings = await getSettings();
  settings.enabled = !settings.enabled;
  await saveSettings(settings);
  return settings;
}

// ============ Bypass ============

/**
 * Active bypass shape: { domain, url, ruleIds: string[], expiry }
 * `ruleIds` are the rules that matched the bypassed URL; only those rules are
 * suspended until `expiry`.
 */
export async function getActiveBypass() {
  return (await getStorageData(STORAGE_KEYS.BYPASS)) || null;
}

export async function setBypass({ domain, url, ruleIds }, durationMinutes = 5) {
  const bypass = {
    domain,
    url,
    ruleIds,
    expiry: Date.now() + durationMinutes * 60 * 1000,
  };
  await setStorageData(STORAGE_KEYS.BYPASS, bypass);
  return bypass;
}

export async function clearBypass() {
  await setStorageData(STORAGE_KEYS.BYPASS, null);
}

export { STORAGE_KEYS };

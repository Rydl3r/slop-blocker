// Storage utility for Chrome extension

const STORAGE_KEYS = {
  RULES: 'blockRules',
  STATS: 'statistics',
  SETTINGS: 'settings',
};

// Default data structures
const DEFAULT_RULES = [];

const DEFAULT_STATS = {
  daily: {},
  streaks: {
    current: 0,
    longest: 0,
    lastCleanDate: null,
  },
  totalBlockAttempts: 0,
  timeSpent: {}, // domain -> total seconds spent (blocked sites)
  slippages: [], // Array of { timestamp, domain, streakBroken } records
};

const DEFAULT_SETTINGS = {
  enabled: true,
  showMotivation: true,
};

// Get data from storage
export async function getStorageData(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key]);
    });
  });
}

// Set data in storage
export async function setStorageData(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// Get all block rules
export async function getRules() {
  const rules = await getStorageData(STORAGE_KEYS.RULES);
  return rules || DEFAULT_RULES;
}

// Save all block rules
export async function saveRules(rules) {
  await setStorageData(STORAGE_KEYS.RULES, rules);
}

// Add a new block rule
export async function addRule(rule) {
  const rules = await getRules();
  const newRule = {
    id: generateId(),
    pattern: rule.pattern,
    type: rule.type || 'domain',
    enabled: true,
    createdAt: Date.now(),
    schedule: rule.schedule || null, // Time-based blocking schedule
    ...rule,
  };
  rules.push(newRule);
  await saveRules(rules);
  return newRule;
}

// Update an existing rule
export async function updateRule(id, updates) {
  const rules = await getRules();
  const index = rules.findIndex((r) => r.id === id);
  if (index !== -1) {
    rules[index] = { ...rules[index], ...updates };
    await saveRules(rules);
    return rules[index];
  }
  return null;
}

// Delete a rule
export async function deleteRule(id) {
  const rules = await getRules();
  const filtered = rules.filter((r) => r.id !== id);
  await saveRules(filtered);
}

// Toggle rule enabled state
export async function toggleRule(id) {
  const rules = await getRules();
  const rule = rules.find((r) => r.id === id);
  if (rule) {
    rule.enabled = !rule.enabled;
    await saveRules(rules);
    return rule;
  }
  return null;
}

// Get statistics
export async function getStats() {
  const stats = await getStorageData(STORAGE_KEYS.STATS);
  return stats || DEFAULT_STATS;
}

// Save statistics
export async function saveStats(stats) {
  await setStorageData(STORAGE_KEYS.STATS, stats);
}

// Record a block attempt
export async function recordBlockAttempt(domain) {
  const stats = await getStats();
  const today = getTodayKey();

  // Initialize today's stats if needed
  if (!stats.daily[today]) {
    stats.daily[today] = {
      blockAttempts: 0,
      sitesAttempted: {},
      timeSpent: {},
    };
  }

  // Increment counters
  stats.daily[today].blockAttempts++;
  stats.daily[today].sitesAttempted[domain] =
    (stats.daily[today].sitesAttempted[domain] || 0) + 1;
  stats.totalBlockAttempts++;

  await saveStats(stats);
  return stats;
}

// Record time spent on a blocked domain
export async function recordTimeSpent(domain, seconds) {
  const stats = await getStats();
  const today = getTodayKey();

  // Initialize today's stats if needed
  if (!stats.daily[today]) {
    stats.daily[today] = {
      blockAttempts: 0,
      sitesAttempted: {},
      timeSpent: {},
    };
  }

  // Initialize timeSpent if needed
  if (!stats.daily[today].timeSpent) {
    stats.daily[today].timeSpent = {};
  }
  if (!stats.timeSpent) {
    stats.timeSpent = {};
  }

  // Add time to blocked sites
  stats.daily[today].timeSpent[domain] =
    (stats.daily[today].timeSpent[domain] || 0) + seconds;
  stats.timeSpent[domain] = (stats.timeSpent[domain] || 0) + seconds;

  await saveStats(stats);
  return stats;
}

// Record a slippage and reset streak - ONLY called when user presses bypass button
export async function recordSlippageAndResetStreak(domain) {
  const stats = await getStats();
  const today = getTodayKey();

  // Initialize today's stats if needed
  if (!stats.daily[today]) {
    stats.daily[today] = {
      blockAttempts: 0,
      sitesAttempted: {},
      timeSpent: {},
    };
  }

  // Record the slippage
  if (!stats.slippages) {
    stats.slippages = [];
  }

  // Record how many days were lost
  const streakBroken = stats.streaks.current;

  stats.slippages.push({
    timestamp: Date.now(),
    domain: domain,
    streakBroken: streakBroken,
  });

  // Reset streak to 0
  stats.streaks.current = 0;

  // Update longest streak if needed (in case it wasn't updated)
  if (streakBroken > stats.streaks.longest) {
    stats.streaks.longest = streakBroken;
  }

  await saveStats(stats);
  return { slippageRecorded: true, streakBroken: streakBroken };
}

// Get total time spent today on tracked sites
export async function getTodayTimeSpent() {
  const stats = await getStats();
  const today = getTodayKey();
  const todayStats = stats.daily[today];

  if (!todayStats?.timeSpent) return 0;

  return Object.values(todayStats.timeSpent).reduce((a, b) => a + b, 0);
}

// Increment streak by 1 - called once per day
export async function incrementStreak() {
  const stats = await getStats();
  const today = getTodayKey();

  // Only increment once per day
  if (stats.streaks.lastIncrementDate !== today) {
    stats.streaks.current += 1;
    stats.streaks.lastIncrementDate = today;

    // Update longest streak if current exceeds it
    if (stats.streaks.current > stats.streaks.longest) {
      stats.streaks.longest = stats.streaks.current;
    }

    await saveStats(stats);
  }

  return stats;
}

// Get settings
export async function getSettings() {
  const settings = await getStorageData(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

// Save settings
export async function saveSettings(settings) {
  await setStorageData(STORAGE_KEYS.SETTINGS, settings);
}

// Toggle global enabled state
export async function toggleEnabled() {
  const settings = await getSettings();
  settings.enabled = !settings.enabled;
  await saveSettings(settings);
  return settings;
}

// Utility functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

// Bypass storage functions
const BYPASS_KEY = 'activeBypass';

// Get active bypass info (domain -> expiry timestamp)
export async function getActiveBypass() {
  const data = await getStorageData(BYPASS_KEY);
  return data || null;
}

// Set a bypass for a domain (5 minutes)
export async function setBypass(domain, durationMinutes = 5) {
  const expiry = Date.now() + durationMinutes * 60 * 1000;
  const bypass = { domain, expiry };
  await setStorageData(BYPASS_KEY, bypass);
  return bypass;
}

// Clear bypass
export async function clearBypass() {
  await setStorageData(BYPASS_KEY, null);
}

// Check if a domain is currently bypassed
export async function isdomainBypassed(domain) {
  const bypass = await getActiveBypass();
  if (!bypass) return false;

  // Check if bypass is expired
  if (Date.now() > bypass.expiry) {
    await clearBypass();
    return false;
  }

  // Check if domain matches (exact or subdomain)
  const bypassDomain = bypass.domain.toLowerCase();
  const checkDomain = domain.toLowerCase();
  return (
    checkDomain === bypassDomain || checkDomain.endsWith('.' + bypassDomain)
  );
}

export { STORAGE_KEYS, getTodayKey };

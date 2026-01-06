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
  timeSpentUnblocked: {}, // domain -> total seconds spent (unblocked sites)
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

// Record time spent on a tracked domain
export async function recordTimeSpent(domain, seconds, isBlocked = true) {
  const stats = await getStats();
  const today = getTodayKey();

  // Initialize today's stats if needed
  if (!stats.daily[today]) {
    stats.daily[today] = {
      blockAttempts: 0,
      sitesAttempted: {},
      timeSpent: {},
      timeSpentUnblocked: {},
      visitedBlockedSite: false,
    };
  }

  // Initialize timeSpent objects if needed
  if (!stats.daily[today].timeSpent) {
    stats.daily[today].timeSpent = {};
  }
  if (!stats.daily[today].timeSpentUnblocked) {
    stats.daily[today].timeSpentUnblocked = {};
  }
  if (!stats.timeSpent) {
    stats.timeSpent = {};
  }
  if (!stats.timeSpentUnblocked) {
    stats.timeSpentUnblocked = {};
  }

  // Add time to appropriate category
  if (isBlocked) {
    stats.daily[today].timeSpent[domain] =
      (stats.daily[today].timeSpent[domain] || 0) + seconds;
    stats.timeSpent[domain] = (stats.timeSpent[domain] || 0) + seconds;

    // Mark that user visited a blocked site today - this breaks the streak
    if (!stats.daily[today].visitedBlockedSite) {
      stats.daily[today].visitedBlockedSite = true;
      // Reset current streak immediately
      stats.streaks.current = 0;
    }
  } else {
    stats.daily[today].timeSpentUnblocked[domain] =
      (stats.daily[today].timeSpentUnblocked[domain] || 0) + seconds;
    stats.timeSpentUnblocked[domain] =
      (stats.timeSpentUnblocked[domain] || 0) + seconds;
  }

  await saveStats(stats);
  return stats;
}

// Get total time spent today on tracked sites
export async function getTodayTimeSpent() {
  const stats = await getStats();
  const today = getTodayKey();
  const todayStats = stats.daily[today];

  if (!todayStats?.timeSpent) return 0;

  return Object.values(todayStats.timeSpent).reduce((a, b) => a + b, 0);
}

// Update streak (call this daily or on extension load)
export async function updateStreak() {
  const stats = await getStats();
  const today = getTodayKey();

  // If we haven't updated streak for today yet
  if (stats.streaks.lastCleanDate !== today) {
    // Calculate streak by counting consecutive clean days backwards
    let streak = 0;
    let checkDate = new Date();

    // Start from yesterday (today isn't over yet)
    checkDate.setDate(checkDate.getDate() - 1);

    // Count consecutive clean days
    while (true) {
      const dateKey = checkDate.toISOString().split('T')[0];
      const dayStats = stats.daily[dateKey];

      // If no data for this day, check if it's before we started tracking
      if (!dayStats) {
        // If we have no data and streak is 0, this might be a new install
        // or days before tracking started - stop counting
        break;
      }

      // If the day had a blocked site visit, streak is broken
      if (dayStats.visitedBlockedSite) {
        break;
      }

      // Day was clean, increment streak
      streak++;

      // Move to previous day
      checkDate.setDate(checkDate.getDate() - 1);

      // Safety limit - don't go back more than 365 days
      if (streak > 365) break;
    }

    stats.streaks.current = streak;
    stats.streaks.lastCleanDate = today;

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

export { STORAGE_KEYS, getTodayKey };

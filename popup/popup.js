import {
  getStats,
  getRules,
  getSettings,
  saveSettings,
} from '../utils/storage.js';
import { getTodayKey } from '../utils/helpers.js';

// DOM Elements
const mainToggle = document.getElementById('mainToggle');
const statusText = document.getElementById('statusText');
const todayBlocksEl = document.getElementById('todayBlocks');
const streakEl = document.getElementById('streak');
const rulesCountEl = document.getElementById('rulesCount');
const openSettingsLink = document.getElementById('openSettings');
const openStatsLink = document.getElementById('openStats');

// Initialize
async function init() {
  await loadData();
  setupEventListeners();
}

// Load all data
async function loadData() {
  // Load settings
  const settings = await getSettings();
  mainToggle.checked = settings.enabled;
  updateStatusText(settings.enabled);

  // Load stats
  const stats = await getStats();
  const today = getTodayKey();
  const todayStats = stats.daily[today] || { blockAttempts: 0 };

  todayBlocksEl.textContent = todayStats.blockAttempts;
  streakEl.textContent = stats.streaks.current || 0;

  // Load rules count
  const rules = await getRules();
  const enabledRules = rules.filter((r) => r.enabled);
  rulesCountEl.textContent = enabledRules.length;
}

// Update status text
function updateStatusText(enabled) {
  statusText.textContent = enabled ? 'Active' : 'Disabled';
  statusText.classList.toggle('disabled', !enabled);
}

// Setup event listeners
function setupEventListeners() {
  // Main toggle
  mainToggle.addEventListener('change', async () => {
    const settings = await getSettings();
    settings.enabled = mainToggle.checked;
    await saveSettings(settings);
    updateStatusText(settings.enabled);

    // Notify background to update rules
    chrome.runtime.sendMessage({ type: 'UPDATE_RULES' });
  });

  // Open settings in new tab
  openSettingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('pages/admin/admin.html'),
    });
  });

  // Open stats in new tab
  openStatsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('pages/stats/stats.html'),
    });
  });
}

// Initialize on load
init();

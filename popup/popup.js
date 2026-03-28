import {
  getStats,
  getRules,
  getSettings,
  saveSettings,
} from '../utils/storage.js';
import { getTodayKey } from '../utils/helpers.js';
import { getProgressState } from '../utils/constants.js';

// DOM Elements
const mainToggle = document.getElementById('mainToggle');
const statusText = document.getElementById('statusText');
const todayBlocksEl = document.getElementById('todayBlocks');
const streakEl = document.getElementById('streak');
const popupProgressBadgeEl = document.getElementById('popupProgressBadge');
const popupProgressTitleEl = document.getElementById('popupProgressTitle');
const popupProgressFillEl = document.getElementById('popupProgressFill');
const popupProgressMilestoneEl = document.getElementById(
  'popupProgressMilestone',
);
const rulesCountEl = document.getElementById('rulesCount');
const openSettingsLink = document.getElementById('openSettings');
const openStatsLink = document.getElementById('openStats');

// Initialize
async function init() {
  // Incognito permission state changes what guidance we show in the popup.
  await checkIncognitoAccess();
  await loadData();
  setupEventListeners();
}

// Show a warning banner if running in incognito without extension access
async function checkIncognitoAccess() {
  const currentWindow = await chrome.windows.getCurrent();
  if (!currentWindow.incognito) return;

  const hasAccess = await chrome.extension.isAllowedIncognitoAccess();
  if (hasAccess) return;

  const warning = document.getElementById('incognitoWarning');
  warning.style.display = 'block';

  document
    .getElementById('openExtensionsPage')
    .addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({
        url: 'chrome://extensions/?id=' + chrome.runtime.id,
      });
    });
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
  const streak = stats.streaks.current || 0;
  streakEl.textContent = streak;
  renderProgression(streak);

  // Load rules count
  const rules = await getRules();
  const enabledRules = rules.filter((r) => r.enabled);
  rulesCountEl.textContent = enabledRules.length;
}

function renderProgression(streak) {
  const state = getProgressState(streak);
  // The same progression model is shared across popup, blocked page, and stats.
  popupProgressBadgeEl.textContent = state.badge;
  popupProgressTitleEl.textContent = state.title;
  popupProgressFillEl.style.width = `${Math.round(state.progress * 100)}%`;
  popupProgressMilestoneEl.textContent =
    state.daysToNext == null || state.daysToNext === 0
      ? 'Milestone reached today.'
      : `Next milestone in ${state.daysToNext} day${state.daysToNext === 1 ? '' : 's'}`;
  document.documentElement.style.setProperty('--progress-accent', state.accent);
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

    // Dynamic DNR rules must be rebuilt whenever global enabled state changes.
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

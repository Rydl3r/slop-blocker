import { getRandomQuote } from '../../utils/quotes.js';
import { getStats } from '../../utils/storage.js';
import { formatTime, getTodayKey } from '../../utils/helpers.js';
import { getRandomTip, getProgressState } from '../../utils/constants.js';

// Display random quote
const quote = getRandomQuote();
document.getElementById('quoteText').textContent = `"${quote.text}"`;
document.getElementById('quoteAuthor').textContent = quote.author;

// Display random tip
document.getElementById('tipText').textContent = getRandomTip();

// Update progress ring
function updateProgressRing(streak) {
  const ring = document.getElementById('progressRing');
  const circumference = 2 * Math.PI * 54; // r=54
  const progressState = getProgressState(streak);

  // Calculate progress within current progression stage
  const progress = progressState.progress;
  const offset = circumference * (1 - progress);

  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = progressState.accent;
  document.documentElement.style.setProperty(
    '--progress-accent',
    progressState.accent,
  );

  // Update value
  document.getElementById('streakValue').textContent = streak;
  document.getElementById('stageBadge').textContent = progressState.badge;
  document.getElementById('stageTitle').textContent = progressState.title;

  // Update message based on streak
  document.getElementById('progressMessage').textContent =
    progressState.message;

  const milestoneText =
    progressState.daysToNext == null || progressState.daysToNext === 0
      ? 'Milestone reached today.'
      : `Next milestone in ${progressState.daysToNext} day${progressState.daysToNext === 1 ? '' : 's'}`;
  document.getElementById('progressMilestone').textContent = milestoneText;
}

// Get the blocked domain info from background script
async function getBlockedInfo() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_LAST_BLOCKED' }, (response) => {
      resolve(response);
    });
  });
}

// Record this block attempt via background script
async function recordBlock(domain) {
  if (domain) {
    // Use a short time bucket so reload loops do not inflate block metrics.
    const blockKey = `blocked_${domain}_${Date.now().toString().slice(0, -4)}`; // ~10 second window
    if (!sessionStorage.getItem(blockKey)) {
      sessionStorage.setItem(blockKey, 'true');
      await chrome.runtime.sendMessage({ type: 'RECORD_BLOCK', domain });
    }
  }
}

// Store the blocked info for use by bypass button
let currentBlockedInfo = null;

// Load and display stats
async function loadStats() {
  try {
    // Get blocked info from background
    const blockedInfo = await getBlockedInfo();
    currentBlockedInfo = blockedInfo;
    const blockedDomain = blockedInfo?.domain || 'This site';

    // Display blocked domain
    document.getElementById('blockedDomain').textContent =
      `${blockedDomain} has been blocked`;

    // Record the block
    await recordBlock(blockedDomain);

    const stats = await getStats();
    const today = getTodayKey();

    // Today's stats
    const todayStats = stats.daily[today] || {
      blockAttempts: 0,
      timeSpent: {},
    };
    document.getElementById('todayAttempts').textContent =
      todayStats.blockAttempts;

    // Time wasted on blocked sites today
    const timeWasted = Object.values(todayStats.timeSpent || {}).reduce(
      (a, b) => a + b,
      0,
    );
    document.getElementById('timeWasted').textContent = formatTime(timeWasted);

    // Update progress ring with streak
    const streak = stats.streaks.current || 0;
    updateProgressRing(streak);
  } catch (e) {
    console.error('Error loading stats:', e);
  }
}

loadStats();

// Go back button
document.getElementById('goBack').addEventListener('click', () => {
  // Try to go back, or close the tab
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
});

// Temporary bypass button
document
  .getElementById('temporaryBypass')
  .addEventListener('click', async () => {
    const domain = currentBlockedInfo?.domain;
    const originalUrl = currentBlockedInfo?.url;

    if (!domain) {
      alert('Could not determine the blocked domain. Please try again.');
      return;
    }

    // Confirm with the user
    const confirmed = confirm(
      `Are you sure you want to temporarily disable blocking for ${domain}?\n\n` +
        `This will:\n` +
        `• Reset your current streak to 0\n` +
        `• Record a slippage\n` +
        `• Allow access for 5 minutes\n\n` +
        `You will regret this. Are you sure?`,
    );

    if (!confirmed) return;

    try {
      // Background owns bypass persistence and rule regeneration.
      const result = await chrome.runtime.sendMessage({
        type: 'TEMPORARY_BYPASS',
        domain: domain,
        originalUrl: originalUrl,
      });

      if (result?.success) {
        // Redirect to the original URL
        const redirectUrl =
          result.redirectUrl || originalUrl || `https://${domain}`;
        window.location.href = redirectUrl;
      } else {
        alert('Failed to enable bypass. Please try again.');
      }
    } catch (e) {
      console.error('Error enabling bypass:', e);
      alert('An error occurred. Please try again.');
    }
  });

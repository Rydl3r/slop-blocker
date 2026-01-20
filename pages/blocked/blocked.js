import { getRandomQuote } from '../../utils/quotes.js';
import { getStats, getTodayKey } from '../../utils/storage.js';

// Motivational tips
const tips = [
  'Take 3 deep breaths before deciding what to do next.',
  "What's one small task you could accomplish right now?",
  'Stand up and stretch for 30 seconds - your body will thank you.',
  'Consider: Is there something more meaningful you could be doing?',
  'Remember your goals. Every moment is a choice.',
  'Try the 2-minute rule: If something takes less than 2 minutes, do it now.',
  'Your future self is watching. Make them proud.',
  "Progress, not perfection. What's one step forward you can take?",
  'Boredom is often a sign you need to challenge yourself.',
  'The urge will pass. Give it 5 minutes.',
  'What would you do if you weren’t afraid of failing?',
  'Focus on what you can control right now.',
  'Remember why you started this journey.',
  'Small consistent actions lead to big changes over time.',
  'Take a moment to visualize your success.',
  'Celebrate small wins - they add up!',
  'Ask yourself: Is this activity aligned with my values?',
  'Try the Pomodoro technique: 25 minutes focused work, 5 minutes break.',
  'Disconnect to reconnect - take a short walk outside.',
  'Reflect on your progress so far. You’re doing great!',
];

// Progress messages based on streak
const progressMessages = [
  { min: 0, max: 0, message: 'Start your journey today!' },
  { min: 1, max: 2, message: 'Great start! Keep building momentum.' },
  { min: 3, max: 6, message: "You're building a habit!" },
  { min: 7, max: 13, message: 'One week strong! 💪' },
  { min: 14, max: 29, message: "Two weeks! You're crushing it!" },
  { min: 30, max: 59, message: 'A full month! Incredible discipline!' },
  { min: 60, max: Infinity, message: "You're unstoppable! 🏆" },
];

// Display random quote
const quote = getRandomQuote();
document.getElementById('quoteText').textContent = `"${quote.text}"`;
document.getElementById('quoteAuthor').textContent = quote.author;

// Display random tip
const tipText = tips[Math.floor(Math.random() * tips.length)];
document.getElementById('tipText').textContent = tipText;

// Format seconds to readable time
function formatTime(seconds) {
  if (!seconds || seconds < 60) return '0m';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Update progress ring
function updateProgressRing(streak) {
  const ring = document.getElementById('progressRing');
  const circumference = 2 * Math.PI * 54; // r=54

  // Calculate progress (max out at 30 days for visual purposes)
  const progress = Math.min(streak / 30, 1);
  const offset = circumference * (1 - progress);

  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = offset;

  // Update value
  document.getElementById('streakValue').textContent = streak;

  // Update message based on streak
  const messageObj = progressMessages.find(
    (p) => streak >= p.min && streak <= p.max,
  );
  document.getElementById('progressMessage').textContent =
    messageObj?.message || 'Keep going!';
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
    // Use sessionStorage to prevent double-counting on refresh
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
      // Send message to background to enable bypass
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

// Content script for time tracking on ALL websites
// Tracks time spent and reports to background whether site is blocked or not

let startTime = null;
let currentDomain = null;
let trackingInterval = null;
let isTracking = false;
let isBlockedSite = false;

// Get the current domain
function getCurrentDomain() {
  return window.location.hostname.replace(/^www\./, '');
}

// Check if media (audio/video) is currently playing on the page
function isMediaPlaying() {
  // Check all video elements
  const videos = document.querySelectorAll('video');
  for (const video of videos) {
    if (!video.paused && !video.ended && video.readyState > 2) {
      return true;
    }
  }

  // Check all audio elements
  const audios = document.querySelectorAll('audio');
  for (const audio of audios) {
    if (!audio.paused && !audio.ended && audio.readyState > 2) {
      return true;
    }
  }

  return false;
}

// Start tracking time
function startTracking(domain, blocked) {
  if (isTracking) return;

  currentDomain = domain;
  isBlockedSite = blocked;
  startTime = Date.now();
  isTracking = true;

  // Send time updates every 30 seconds
  trackingInterval = setInterval(() => {
    sendTimeUpdate();
  }, 30000);

  console.log(
    '[Slop Blocker] Started tracking:',
    domain,
    blocked ? '(blocked)' : '(unblocked)'
  );
}

// Send time update to background
function sendTimeUpdate() {
  if (!isTracking || !startTime) return;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  if (elapsed > 0) {
    try {
      chrome.runtime.sendMessage({
        type: 'RECORD_TIME',
        domain: currentDomain,
        seconds: elapsed,
        isBlocked: isBlockedSite,
      });
    } catch (e) {
      // Extension context invalidated - stop tracking
      console.log('[Slop Blocker] Extension reloaded, stopping tracker');
      stopTracking();
      return;
    }
    // Reset start time for next interval
    startTime = Date.now();
  }
}

// Stop tracking and send final update
function stopTracking() {
  if (!isTracking) return;

  sendTimeUpdate();

  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }

  isTracking = false;
  startTime = null;
  console.log('[Slop Blocker] Stopped tracking:', currentDomain);
}

// Check if we should continue tracking (visibility or media playing)
function shouldContinueTracking() {
  // Continue if page is visible OR media is playing
  return !document.hidden || isMediaPlaying();
}

// Check and update tracking state
async function checkAndStartTracking() {
  const domain = getCurrentDomain();

  // Skip extension pages
  if (domain.includes('chrome-extension') || domain === '') {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_SITE',
      url: window.location.href,
      domain: domain,
    });

    // Always track, just mark whether it's a blocked site or not
    startTracking(domain, response?.isBlocked || false);
  } catch (e) {
    // Extension context may be invalidated, still track as unblocked
    startTracking(domain, false);
  }
}

// Handle visibility changes (tab switching, minimizing)
document.addEventListener('visibilitychange', () => {
  if (shouldContinueTracking()) {
    if (!isTracking) {
      checkAndStartTracking();
    }
  } else {
    stopTracking();
  }
});

// Periodically check for media state changes (every 5 seconds)
setInterval(() => {
  if (document.hidden && isMediaPlaying() && !isTracking) {
    // Tab is hidden but media started playing - resume tracking
    checkAndStartTracking();
  } else if (document.hidden && !isMediaPlaying() && isTracking) {
    // Tab is hidden and media stopped - stop tracking
    stopTracking();
  }
}, 5000);

// Handle page unload
window.addEventListener('beforeunload', () => {
  stopTracking();
});

// Start tracking when script loads (track ALL sites)
checkAndStartTracking();

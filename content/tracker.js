// Content script for time tracking on ALL websites
// Tracks time spent and reports to background whether site is blocked or not

let startTime = null;
let currentDomain = null;
let trackingInterval = null;
let isTracking = false;
let isBlockedSite = false;
let isCheckingMedia = false;
let isCheckingTracking = false;

// Get the current domain
function getCurrentDomain() {
  return window.location.hostname.replace(/^www\./, '');
}

// Check if media (audio/video) is currently playing on the page
function isMediaPlaying() {
  // Guard against recursive calls (YouTube's patched DOM can cause this)
  if (isCheckingMedia) return false;
  isCheckingMedia = true;

  try {
    // Check all video elements
    const videos = document.getElementsByTagName('video');
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      if (video && !video.paused && !video.ended && video.readyState > 2) {
        return true;
      }
    }

    // Check all audio elements
    const audios = document.getElementsByTagName('audio');
    for (let i = 0; i < audios.length; i++) {
      const audio = audios[i];
      if (audio && !audio.paused && !audio.ended && audio.readyState > 2) {
        return true;
      }
    }

    return false;
  } catch (e) {
    return false;
  } finally {
    isCheckingMedia = false;
  }
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
}

// Safe message sending that avoids stack overflow on sites like YouTube
let isSendingMessage = false;

function safeSendMessage(message, callback) {
  if (isSendingMessage) return;
  if (!chrome.runtime?.id) return; // Extension context invalidated

  isSendingMessage = true;
  queueMicrotask(() => {
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage(message, callback);
      }
    } catch (e) {
      // Silently fail - extension may have been reloaded
    } finally {
      isSendingMessage = false;
    }
  });
}

// Send time update to background
function sendTimeUpdate() {
  if (!isTracking || !startTime) return;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  if (elapsed > 0) {
    safeSendMessage({
      type: 'RECORD_TIME',
      domain: currentDomain,
      seconds: elapsed,
      isBlocked: isBlockedSite,
    });

    // Reset start time for next interval
    startTime = Date.now();
  }
}

// Stop tracking and send final update
function stopTracking() {
  if (!isTracking) return;

  // Set isTracking to false first to prevent recursive calls
  // (sendTimeUpdate may call stopTracking if extension context is invalidated)
  isTracking = false;

  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }

  sendTimeUpdate();

  startTime = null;
}

// Check if we should continue tracking (visibility or media playing)
function shouldContinueTracking() {
  // Continue if page is visible OR media is playing
  return !document.hidden || isMediaPlaying();
}

// Check and update tracking state
function checkAndStartTracking() {
  // Guard against recursive/concurrent calls
  if (isCheckingTracking || isTracking) return;
  if (!chrome.runtime?.id) return; // Extension context invalidated

  isCheckingTracking = true;

  const domain = getCurrentDomain();

  // Skip extension pages
  if (domain.includes('chrome-extension') || domain === '') {
    isCheckingTracking = false;
    return;
  }

  safeSendMessage(
    {
      type: 'CHECK_SITE',
      url: window.location.href,
      domain: domain,
    },
    (response) => {
      isCheckingTracking = false;
      // Always track, just mark whether it's a blocked site or not
      startTracking(domain, response?.isBlocked || false);
    }
  );

  // Fallback: reset flag after timeout in case callback never fires
  setTimeout(() => {
    if (isCheckingTracking) {
      isCheckingTracking = false;
      startTracking(domain, false);
    }
  }, 1000);
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
let mediaCheckInterval = null;

function startMediaCheck() {
  if (mediaCheckInterval) return; // Prevent duplicate intervals

  mediaCheckInterval = setInterval(() => {
    if (document.hidden && isMediaPlaying() && !isTracking) {
      // Tab is hidden but media started playing - resume tracking
      checkAndStartTracking();
    } else if (document.hidden && !isMediaPlaying() && isTracking) {
      // Tab is hidden and media stopped - stop tracking
      stopTracking();
    }
  }, 5000);
}

function stopMediaCheck() {
  if (mediaCheckInterval) {
    clearInterval(mediaCheckInterval);
    mediaCheckInterval = null;
  }
}

// Start the media check on script load
startMediaCheck();

// Handle page unload
window.addEventListener('beforeunload', () => {
  stopMediaCheck();
  stopTracking();
});

// Start tracking when script loads (track ALL sites)
checkAndStartTracking();

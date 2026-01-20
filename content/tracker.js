// Content script for time tracking on BLOCKED websites only
// Tracks time spent on blocked sites that user manages to access

// State
let startTime = null;
let currentDomain = null;
let trackingInterval = null;
let isTracking = false;
let isCheckingMedia = false;
let isCheckingTracking = false;
let mediaCheckInterval = null;

// Message queue for safe communication with background
const messageQueue = [];
let isProcessingQueue = false;

// ============ Utility Functions ============

function getCurrentDomain() {
  return window.location.hostname.replace(/^www\./, '');
}

function isExtensionValid() {
  return Boolean(chrome.runtime?.id);
}

function isMediaPlaying() {
  if (isCheckingMedia) return false;
  isCheckingMedia = true;

  try {
    const checkMedia = (elements) => {
      for (const el of elements) {
        if (el && !el.paused && !el.ended && el.readyState > 2) return true;
      }
      return false;
    };

    return (
      checkMedia(document.getElementsByTagName('video')) ||
      checkMedia(document.getElementsByTagName('audio'))
    );
  } catch {
    return false;
  } finally {
    isCheckingMedia = false;
  }
}

// ============ Message Queue ============

function safeSendMessage(message, callback) {
  if (!isExtensionValid()) return;
  messageQueue.push({ message, callback });
  processMessageQueue();
}

function processMessageQueue() {
  if (isProcessingQueue || messageQueue.length === 0 || !isExtensionValid()) {
    return;
  }

  isProcessingQueue = true;
  const { message, callback } = messageQueue.shift();

  queueMicrotask(() => {
    try {
      if (isExtensionValid()) {
        chrome.runtime.sendMessage(message, (response) => {
          callback?.(response);
          isProcessingQueue = false;
          processMessageQueue();
        });
      } else {
        isProcessingQueue = false;
        processMessageQueue();
      }
    } catch {
      isProcessingQueue = false;
      processMessageQueue();
    }
  });
}

// ============ Tracking Functions ============

function startTracking(domain) {
  if (isTracking) return;

  currentDomain = domain;
  startTime = Date.now();
  isTracking = true;

  trackingInterval = setInterval(sendTimeUpdate, 5000);
}

function stopTracking() {
  if (!isTracking) return;

  isTracking = false;

  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }

  sendTimeUpdate();
  startTime = null;
}

function sendTimeUpdate() {
  if (!isTracking || !startTime) return;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  if (elapsed <= 0) return;

  safeSendMessage(
    {
      type: 'RECORD_TIME',
      domain: currentDomain,
      url: window.location.href,
      seconds: elapsed,
      isBlocked: true,
    },
    (response) => {
      if (response?.stillBlocked === false) {
        stopTracking();
      }
    },
  );

  startTime = Date.now();
}

function checkAndStartTracking() {
  if (isCheckingTracking || isTracking || !isExtensionValid()) return;

  const domain = getCurrentDomain();
  if (domain.includes('chrome-extension') || !domain) return;

  isCheckingTracking = true;

  safeSendMessage(
    { type: 'CHECK_SITE', url: window.location.href, domain },
    (response) => {
      isCheckingTracking = false;
      if (response?.isBlocked) {
        startTracking(domain);
      }
    },
  );

  // Fallback timeout
  setTimeout(() => {
    isCheckingTracking = false;
  }, 1000);
}

// ============ Event Handlers ============

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setTimeout(() => {
      if (document.hidden && !isMediaPlaying() && isTracking) {
        stopTracking();
      }
    }, 500);
  } else if (!isTracking) {
    checkAndStartTracking();
  }
});

function startMediaCheck() {
  if (mediaCheckInterval) return;

  mediaCheckInterval = setInterval(() => {
    if (document.hidden) {
      if (isMediaPlaying() && !isTracking) {
        checkAndStartTracking();
      } else if (!isMediaPlaying() && isTracking) {
        stopTracking();
      }
    }
  }, 2000);
}

function cleanup() {
  if (mediaCheckInterval) {
    clearInterval(mediaCheckInterval);
    mediaCheckInterval = null;
  }
  stopTracking();
}

window.addEventListener('beforeunload', cleanup);

// ============ Initialize ============

startMediaCheck();
checkAndStartTracking();

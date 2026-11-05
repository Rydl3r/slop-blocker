// Content script: last-line enforcement + time tracking.
//
// Enforcement: on every load, back/forward-cache restore, tab focus and
// in-page (SPA) URL change, ask the background whether this URL is blocked and
// leave for the blocked page if so. The background also redirects tabs on its
// own; this script makes the redirect replace the history entry and covers
// cases where background events are missed.
//
// Tracking: while a URL matches a blocking rule but is allowed (temporary
// bypass), count the time the page is visible or playing media.

(() => {
  if (window.top !== window) return;

  const FLUSH_EVERY_MS = 5000;
  const MAX_GAP_MS = 5000; // ignore gaps (sleep, throttling) longer than this

  let alive = true;
  let lastHref = location.href;
  let tracked = false;
  let pendingMs = 0;
  let lastTick = Date.now();
  let lastFlush = Date.now();
  let leaving = false;
  const timers = [];

  function extensionAlive() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  function shutdown() {
    alive = false;
    timers.forEach(clearInterval);
  }

  function send(message) {
    if (!alive || !extensionAlive()) {
      shutdown();
      return Promise.resolve(null);
    }
    return chrome.runtime.sendMessage(message).catch(() => null);
  }

  function leaveTo(target) {
    if (leaving || !target) return;
    leaving = true;
    flush();
    location.replace(target);
  }

  async function check() {
    if (leaving) return;
    const url = location.href;
    const res = await send({ type: 'CHECK_URL', url });
    if (!res || url !== location.href) return;
    if (res.blocked) {
      leaveTo(res.target);
      return;
    }
    if (tracked !== res.tracked) {
      flush();
      tracked = res.tracked;
    }
  }

  // ---- time tracking ----

  function mediaPlaying() {
    try {
      for (const el of document.querySelectorAll('video, audio')) {
        if (!el.paused && !el.ended && el.readyState > 2) return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  function flush() {
    const seconds = Math.floor(pendingMs / 1000);
    lastFlush = Date.now();
    if (seconds <= 0) return;
    pendingMs -= seconds * 1000;
    send({ type: 'RECORD_TIME', url: location.href, seconds }).then((res) => {
      if (res && res.tracked === false) tracked = false;
    });
  }

  function tick() {
    const now = Date.now();
    const gap = now - lastTick;
    lastTick = now;

    if (location.href !== lastHref) {
      lastHref = location.href;
      check();
    }

    if (tracked && gap <= MAX_GAP_MS && (!document.hidden || mediaPlaying())) {
      pendingMs += gap;
    }
    if (now - lastFlush >= FLUSH_EVERY_MS) flush();
  }

  // ---- wiring ----

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'SB_REDIRECT') {
      leaveTo(msg.target);
      sendResponse({ ok: true });
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
    else check();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      leaving = false;
      lastTick = Date.now();
      check();
    }
  });
  window.addEventListener('popstate', () => check());
  window.addEventListener('hashchange', () => check());
  window.addEventListener('pagehide', () => flush());

  timers.push(setInterval(tick, 1000));
  check();
})();

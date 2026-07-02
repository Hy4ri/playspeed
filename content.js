// PlaySpeed — Content Script
// Forces all <video> and <audio> elements to user-configured playback speed,
// unless the current hostname is in the exclusion list.

// --- State ---
let currentSpeed = 1.0;
let excludedHostnames = [];
let liveOverride = false;
let ytLiveFromPageData = false; // Set by injected page bridge for YouTube

// Guard against re-entrant ratechange loops
let reapplying = false;

// --- Exclusion check ---
function isExcluded() {
  const hostname = window.location.hostname;
  return excludedHostnames.some((pattern) => {
    return hostname === pattern || hostname.endsWith('.' + pattern);
  });
}

// --- Live Stream Detection ---
function isLiveStream(video) {
  try {
    if (video && video.duration === Infinity) return true;
    if (location.hostname.includes('youtube.com')) {
      // Use page data from injected bridge (crosses isolated world boundary)
      if (ytLiveFromPageData) return true;

      const liveBadge = document.querySelector('.ytp-live-badge');
      if (liveBadge && liveBadge.offsetParent !== null) return true;
      const pageData = document.querySelector('ytd-watch-flexy[is-live-stream], ytd-watch-flexy[live-stream]');
      if (pageData) return true;
      if (location.pathname.includes('/live')) return true;
    }
    if (location.hostname.includes('twitch.tv') && location.pathname !== '/' && !location.pathname.startsWith('/videos/') && !location.pathname.startsWith('/clips/')) return true;
  } catch (e) {}
  return false;
}

function anyVideoIsLive() {
  try {
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      if (isLiveStream(video)) return true;
    }
  } catch (e) {}
  return false;
}

// --- YouTube Page Data Bridge ---
// Chrome content scripts run in an isolated world and cannot directly access
// page-level JavaScript variables like ytInitialPlayerResponse.
// We inject a <script> tag (with src pointing to our extension file) that
// reads it and signals via a custom DOM event, which DOES cross the
// isolated-world boundary. An external file is required because YouTube's
// Content Security Policy blocks inline script execution.

// Listen for bridge data posted from the page (MAIN world) script
// postMessage reliably crosses the isolated world boundary.
window.addEventListener('message', (e) => {
  // Only trust messages from the same page's MAIN world script
  if (e.origin !== window.location.origin) return;
  if (e.data && e.data.type === 'playspeed-yt-live') {
    ytLiveFromPageData = e.data.isLive || false;
    applySpeedToAll(); // Re-apply now that we have live data
  }
});

function setupYouTubeBridge() {
  if (!location.hostname.includes('youtube.com')) return;

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('yt-bridge.js');
  script.onload = () => {
    script.remove();
    // Bridge just executed, but its postMessage is queued and won't be processed
    // until after onload returns. The message handler (below) re-applies speed
    // with correct live data, so there's nothing to do here.
  };
  script.onerror = () => { script.remove(); };
  document.documentElement.appendChild(script);
}

// --- Speed application ---
function applySpeedToMedia(media) {
  if (isExcluded()) return;

  // Only apply to <video> and <audio> elements
  if (media.nodeName !== 'VIDEO' && media.nodeName !== 'AUDIO') return;

  let targetSpeed = currentSpeed;

  // For live streams, default to 1.0x unless user has toggled liveOverride
  if (media.nodeName === 'VIDEO' && isLiveStream(media) && !liveOverride) {
    targetSpeed = 1.0;
  }

  const drift = Math.abs(media.playbackRate - targetSpeed);
  if (drift > 0.02) {
    media.playbackRate = targetSpeed;
  }
}

function applySpeedToAll() {
  if (isExcluded()) return;
  document.querySelectorAll('video, audio').forEach(applySpeedToMedia);
}

// --- MutationObserver: catch dynamically added media elements ---
const observer = new MutationObserver((mutations) => {
  if (isExcluded()) return;

  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      // Element itself is a media element
      if (node.nodeName === 'VIDEO' || node.nodeName === 'AUDIO') {
        applySpeedToMedia(node);
        continue;
      }
      // Check subtree for media elements
      if (node.querySelectorAll) {
        node.querySelectorAll('video, audio').forEach(applySpeedToMedia);
      }
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// --- ratechange event: re-apply if site or user overrides speed ---
document.addEventListener(
  'ratechange',
  (e) => {
    if (isExcluded() || reapplying) return;
    const target = e.target;
    if (target.nodeName === 'VIDEO' || target.nodeName === 'AUDIO') {
      reapplying = true;
      // Respect live detection: live videos default to 1.0x unless overridden
      let targetSpeed = currentSpeed;
      if (target.nodeName === 'VIDEO' && isLiveStream(target) && !liveOverride) {
        targetSpeed = 1.0;
      }
      target.playbackRate = targetSpeed;
      reapplying = false;
    }
  },
  true // capture phase
);

// --- Listen for messages from the popup ---
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'speedChanged') {
    currentSpeed = message.speed;
    applySpeedToAll();
    sendResponse({ ok: true });
  }
  if (message.type === 'updateExclusions') {
    excludedHostnames = message.exclusions;
    applySpeedToAll();
    sendResponse({ ok: true });
  }
  if (message.type === 'getState') {
    sendResponse({ speed: currentSpeed, excluded: isExcluded() });
  }
  if (message.type === 'liveOverrideChanged') {
    liveOverride = message.enabled;
    chrome.storage.local.set({ liveOverride });
    applySpeedToAll();
    sendResponse({ ok: true });
  }
  if (message.type === 'getLiveStatus') {
    sendResponse({ isLive: anyVideoIsLive(), liveOverride, speed: currentSpeed });
  }
  // Return true for async response (though we're sync here it's good practice)
  return true;
});

// --- Load settings from storage and listen for changes ---
function loadSettings() {
  chrome.storage.local.get(['speed', 'exclusions', 'liveOverride'], (result) => {
    if (result.speed !== undefined) currentSpeed = result.speed;
    if (result.exclusions !== undefined) excludedHostnames = result.exclusions;
    if (result.liveOverride !== undefined) liveOverride = result.liveOverride;
    applySpeedToAll();
  });
}

// Initial load
setupYouTubeBridge();
loadSettings();

// React to storage changes from other contexts (e.g., options page)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  let changed = false;
  if (changes.speed) {
    currentSpeed = changes.speed.newValue;
    changed = true;
  }
  if (changes.exclusions) {
    excludedHostnames = changes.exclusions.newValue;
    changed = true;
  }
  if (changes.liveOverride) {
    liveOverride = changes.liveOverride.newValue;
    changed = true;
  }
  if (changed) {
    applySpeedToAll();
  }
});

// --- Handle SPA navigation (pushState / replaceState) ---
// The content script persists across SPA navigations.
// hostname stays the same, so exclusion logic works.
// New media elements are caught by MutationObserver.
// Re-apply on popstate / pushState just in case:
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    // Re-inject YouTube bridge for SPA navigations (e.g., clicking a live stream from search)
    ytLiveFromPageData = false;
    setupYouTubeBridge();
    applySpeedToAll();
  }
});
urlObserver.observe(document, { subtree: true, childList: true });

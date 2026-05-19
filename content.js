// PlaySpeed — Content Script
// Forces all <video> and <audio> elements to user-configured playback speed,
// unless the current hostname is in the exclusion list.

// --- State ---
let currentSpeed = 1.0;
let excludedHostnames = [];

// Guard against re-entrant ratechange loops
let reapplying = false;

// --- Exclusion check ---
function isExcluded() {
  const hostname = window.location.hostname;
  return excludedHostnames.some((pattern) => {
    return hostname === pattern || hostname.endsWith('.' + pattern);
  });
}

// --- Speed application ---
function applySpeedToMedia(media) {
  if (isExcluded()) return;

  // Only apply to <video> and <audio> elements
  if (media.nodeName !== 'VIDEO' && media.nodeName !== 'AUDIO') return;

  const drift = Math.abs(media.playbackRate - currentSpeed);
  if (drift > 0.02) {
    media.playbackRate = currentSpeed;
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
      target.playbackRate = currentSpeed;
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
  // Return true for async response (though we're sync here it's good practice)
  return true;
});

// --- Load settings from storage and listen for changes ---
function loadSettings() {
  chrome.storage.local.get(['speed', 'exclusions'], (result) => {
    if (result.speed !== undefined) currentSpeed = result.speed;
    if (result.exclusions !== undefined) excludedHostnames = result.exclusions;
    applySpeedToAll();
  });
}

// Initial load
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
    applySpeedToAll();
  }
});
urlObserver.observe(document, { subtree: true, childList: true });

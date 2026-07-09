// PlaySpeed — Content Script
// Forces all <video> and <audio> elements to user-configured playback speed,
// unless the current hostname is in the exclusion list.

(() => {
  'use strict';

  // --- State ---
  let currentSpeed = 1.0;
  let excludedHostnames = [];
  let liveOverride = false;
  let ytLiveFromPageData = false; // Set by injected page bridge for YouTube
  let settingsLoaded = false;
  let settingsApplyPending = false;

  // Per-instance token used to authenticate postMessage from yt-bridge.
  // Without this, any page script could spoof `playspeed-yt-live` messages.
  const BRIDGE_TOKEN = 'ps-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);

  // Cache for isLiveStream results per media element, invalidated on
  // durationchange / loadedmetadata so we don't run querySelector on every call.
  let liveCache = new WeakMap();

  // --- Exclusion check ---
  function isExcluded() {
    try {
      const hostname = window.location.hostname;
      return excludedHostnames.some((pattern) => {
        return hostname === pattern || hostname.endsWith('.' + pattern);
      });
    } catch (e) {
      console.warn('[PlaySpeed] isExcluded error:', e);
      return false;
    }
  }

  // --- Live Stream Detection ---
  function isLiveStream(video) {
    if (!video) return false;

    const cached = liveCache.get(video);
    if (cached !== undefined) return cached;

    let result = false;
    try {
      if (video.duration === Infinity) {
        // Most reliable signal across sites, but not perfect (some sites use
        // Infinity for non-live content). Combined with site-specific checks.
        result = true;
      }
      if (!result && location.hostname.includes('youtube.com')) {
        // Use page data from injected bridge (crosses isolated world boundary)
        if (ytLiveFromPageData) {
          result = true;
        } else {
          const liveBadge = video.closest('ytd-watch-flexy')?.querySelector('.ytp-live-badge');
          if (liveBadge && liveBadge.offsetParent !== null) result = true;
          const pageData = document.querySelector('ytd-watch-flexy[is-live-stream], ytd-watch-flexy[live-stream]');
          if (pageData) result = true;
          if (location.pathname.includes('/live')) result = true;
        }
      }
      if (!result && location.hostname.includes('twitch.tv')) {
        // Only treat as live when actually on a channel page (not /directory,
        // /following, /settings, /subscriptions, /videos/, /clips/, etc.).
        // Channel pages match /<channel-name> with no second path segment.
        const path = location.pathname;
        const parts = path.split('/').filter(Boolean);
        const isChannelPage = parts.length === 1 ||
          (parts.length >= 2 && !['videos', 'clips', 'directory', 'following',
            'settings', 'subscriptions', 'search', 'p', 'wallet', 'drops',
            'friends', 'inventory', 'collections', 'edit', 'dashboard',
            'jobs', 'browse'].includes(parts[0]));
        if (isChannelPage) {
          // Best-effort DOM check — Twitch renders a live indicator when on air.
          const liveIndicator = document.querySelector(
            '.live-indicator-container .tw-channel-status-text--live, ' +
            'p[data-test-selector="live-status-text"]'
          );
          if (liveIndicator) result = true;
        }
      }
    } catch (e) {
      console.warn('[PlaySpeed] isLiveStream error:', e);
    }

    liveCache.set(video, result);
    return result;
  }

  function anyVideoIsLive() {
    try {
      const videos = document.querySelectorAll('video');
      for (const video of videos) {
        if (isLiveStream(video)) return true;
      }
    } catch (e) {
      console.warn('[PlaySpeed] anyVideoIsLive error:', e);
    }
    return false;
  }

  // --- YouTube Page Data Bridge ---
  // Chrome content scripts run in an isolated world and cannot directly access
  // page-level JavaScript variables like ytInitialPlayerResponse.
  // We inject a <script> tag (with src pointing to our extension file) that
  // reads it and signals via postMessage, which DOES cross the
  // isolated-world boundary. An external file is required because YouTube's
  // Content Security Policy blocks inline script execution.

  // Listen for bridge data posted from the page (MAIN world) script
  window.addEventListener('message', (e) => {
    // Only trust messages from the same page's MAIN world script
    if (e.origin !== window.location.origin) return;
    if (!e.data || e.data.type !== 'playspeed-yt-live') return;
    // Auth token: prevents spoofing by third-party page scripts
    if (e.data.token !== BRIDGE_TOKEN) return;
    ytLiveFromPageData = !!e.data.isLive;
    applySpeedToAll();
  });

  function setupYouTubeBridge() {
    try {
      if (!location.hostname.includes('youtube.com')) return;
    } catch (e) {
      return;
    }

    // Defer injection until document.documentElement exists (it always does
    // at document_idle, but be defensive).
    const root = document.documentElement;
    if (!root) return;

    const script = document.createElement('script');
    // Pass the auth token via URL query string AND dataset — the bridge reads
    // both, falling back gracefully. URL is the most reliable for
    // dynamically-inserted external scripts (document.currentScript can be
    // unreliable in some engines).
    const bridgeUrl = chrome.runtime.getURL('yt-bridge.js');
    script.src = bridgeUrl + '?t=' + encodeURIComponent(BRIDGE_TOKEN);
    script.dataset.psToken = BRIDGE_TOKEN;
    script.onload = () => {
      script.remove();
    };
    script.onerror = () => {
      script.remove();
      console.warn('[PlaySpeed] yt-bridge.js failed to load — YouTube live detection may be unreliable (CSP?).');
    };
    root.appendChild(script);
  }

  // --- Speed application ---
  function applySpeedToMedia(media) {
    if (isExcluded()) return;
    if (!media || (media.nodeName !== 'VIDEO' && media.nodeName !== 'AUDIO')) return;

    let targetSpeed = currentSpeed;

    // For live streams, default to 1.0x unless user has toggled liveOverride
    if (media.nodeName === 'VIDEO' && isLiveStream(media) && !liveOverride) {
      targetSpeed = 1.0;
    }

    try {
      const drift = Math.abs(media.playbackRate - targetSpeed);
      if (drift > 0.02) {
        media.playbackRate = targetSpeed;
      }
    } catch (e) {
      // Some media elements throw on playbackRate if not yet loaded or out of range
      console.warn('[PlaySpeed] applySpeedToMedia error:', e);
    }
  }

  // YouTube-specific retry: YouTube's player initializes asynchronously and
  // may reset playbackRate to 1.0 AFTER our initial application (during
  // player init, when src is set, or when playback starts). We schedule a
  // few re-applications with increasing delays to catch these resets.
  // This is the key fix for "YouTube videos don't respect the default speed
  // on page load — I have to open the popup and click again."
  const reapplyRetries = new WeakSet();
  function scheduleYouTubeRetries(media) {
    if (reapplyRetries.has(media)) return;
    reapplyRetries.add(media);
    const delays = [250, 750, 1500, 3000];
    for (const delay of delays) {
      setTimeout(() => {
        // Only re-apply if the media element is still in the DOM
        if (media.isConnected) {
          liveCache.delete(media);
          applySpeedToMedia(media);
        }
      }, delay);
    }
    // Allow re-scheduling after 5s in case of SPA navigation
    setTimeout(() => { reapplyRetries.delete(media); }, 5000);
  }

  function applySpeedToAll() {
    if (isExcluded()) return;
    try {
      document.querySelectorAll('video, audio').forEach(applySpeedToMedia);
    } catch (e) {
      console.warn('[PlaySpeed] applySpeedToAll error:', e);
    }
  }

  // --- MutationObserver: catch dynamically added media elements ---
  // Scope to body (when available) or documentElement to reduce noise.
  const observer = new MutationObserver((mutations) => {
    if (isExcluded()) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) continue;
        // Element itself is a media element
        if (node.nodeName === 'VIDEO' || node.nodeName === 'AUDIO') {
          applySpeedToMedia(node);
          // On YouTube, schedule retries to catch player-init rate resets
          if (node.nodeName === 'VIDEO' && location.hostname.includes('youtube.com')) {
            scheduleYouTubeRetries(node);
          }
          continue;
        }
        // Check subtree for media elements
        if (node.querySelectorAll) {
          try {
            const mediaEls = node.querySelectorAll('video, audio');
            mediaEls.forEach((media) => {
              applySpeedToMedia(media);
              if (media.nodeName === 'VIDEO' && location.hostname.includes('youtube.com')) {
                scheduleYouTubeRetries(media);
              }
            });
          } catch (e) {
            // Some non-Element nodes can sneak in; ignore.
          }
        }
      }
    }
  });

  function startObserver() {
    const target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }
  startObserver();

  // --- ratechange event: re-apply if site or user overrides speed ---
  // Use the same drift check as applySpeedToMedia to avoid loops and
  // to be tolerant of async ratechange dispatch.
  document.addEventListener(
    'ratechange',
    (e) => {
      if (isExcluded()) return;
      const target = e.target;
      if (!target || (target.nodeName !== 'VIDEO' && target.nodeName !== 'AUDIO')) return;

      let targetSpeed = currentSpeed;
      if (target.nodeName === 'VIDEO' && isLiveStream(target) && !liveOverride) {
        targetSpeed = 1.0;
      }

      try {
        const drift = Math.abs(target.playbackRate - targetSpeed);
        if (drift > 0.02) {
          target.playbackRate = targetSpeed;
        }
      } catch (err) {
        // ignore
      }
    },
    true // capture phase
  );

  // When media metadata loads or duration changes, invalidate the live cache
  // AND re-apply speed. This is critical for YouTube, which uses MediaSource
  // Extensions — the <video>.duration is temporarily Infinity during initial
  // load (before MSE attaches the real duration), causing isLiveStream() to
  // falsely return true and cap speed at 1.0x. Once the real duration arrives
  // (durationchange fires), we must re-evaluate and apply the correct speed.
  function reapplyOnMediaEvent(e) {
    const t = e.target;
    if (!t || (t.nodeName !== 'VIDEO' && t.nodeName !== 'AUDIO')) return;
    liveCache.delete(t);
    applySpeedToMedia(t);
  }
  document.addEventListener('loadedmetadata', reapplyOnMediaEvent, true);
  document.addEventListener('durationchange', reapplyOnMediaEvent, true);
  // Also re-apply on play/playing/canplay — YouTube's player may reset
  // playbackRate when playback starts, after our initial application.
  document.addEventListener('play', reapplyOnMediaEvent, true);
  document.addEventListener('playing', reapplyOnMediaEvent, true);
  document.addEventListener('canplay', reapplyOnMediaEvent, true);

  // --- Listen for messages from the popup ---
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    if (message.type === 'speedChanged') {
      currentSpeed = message.speed;
      applySpeedToAll();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === 'updateExclusions') {
      excludedHostnames = Array.isArray(message.exclusions) ? message.exclusions : [];
      applySpeedToAll();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === 'getState') {
      sendResponse({ speed: currentSpeed, excluded: isExcluded() });
      return false;
    }
    if (message.type === 'liveOverrideChanged') {
      liveOverride = !!message.enabled;
      // Do NOT write to storage here — popup is the single writer to avoid races.
      applySpeedToAll();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === 'getLiveStatus') {
      sendResponse({ isLive: anyVideoIsLive(), liveOverride, speed: currentSpeed });
      return false;
    }
    // Unrecognized message type — return false so Chrome closes the channel
    // without expecting an async sendResponse.
    return false;
  });

  // --- Load settings from storage and listen for changes ---
  function loadSettings() {
    chrome.storage.local.get(['speed', 'exclusions', 'liveOverride'], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[PlaySpeed] storage.local.get error:', chrome.runtime.lastError);
      } else {
        if (result.speed !== undefined) currentSpeed = result.speed;
        if (Array.isArray(result.exclusions)) excludedHostnames = result.exclusions;
        if (result.liveOverride !== undefined) liveOverride = result.liveOverride;
      }
      settingsLoaded = true;
      applySpeedToAll();

      // On YouTube, schedule retries for any existing videos — the player
      // may not have finished initializing when we first apply speed.
      if (location.hostname.includes('youtube.com')) {
        try {
          document.querySelectorAll('video').forEach(scheduleYouTubeRetries);
        } catch (e) {}
      }

      // Now that settings are loaded it's safe to inject the YouTube bridge.
      if (settingsApplyPending) {
        settingsApplyPending = false;
        setupYouTubeBridge();
      }
    });
  }

  // --- SPA navigation handling ---
  // Use yt-navigate-finish (YouTube-specific canonical event) and
  // popstate + history.pushState/replaceState patching instead of an
  // expensive MutationObserver on the whole document.
  let lastUrl = location.href;

  function onUrlChange() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    ytLiveFromPageData = false;
    liveCache = new WeakMap(); // invalidate all cached live checks
    setupYouTubeBridge();
    applySpeedToAll();

    // On YouTube SPA navigation, the <video> element is often reused for the
    // new video. Schedule retries to catch the new video's player init.
    if (location.hostname.includes('youtube.com')) {
      try {
        document.querySelectorAll('video').forEach(scheduleYouTubeRetries);
      } catch (e) {}
    }
  }

  // Patch history methods to catch pushState/replaceState (the only way to
  // detect SPA navigations that don't fire popstate).
  try {
    const wrap = (key) => {
      const orig = history[key];
      history[key] = function (...args) {
        const ret = orig.apply(this, args);
        // Defer so the new URL is settled before we read location.href
        setTimeout(onUrlChange, 0);
        return ret;
      };
    };
    wrap('pushState');
    wrap('replaceState');
  } catch (e) {
    console.warn('[PlaySpeed] history patch failed:', e);
  }
  window.addEventListener('popstate', onUrlChange);
  // YouTube's canonical SPA navigation event
  window.addEventListener('yt-navigate-finish', onUrlChange);
  // Fallback: poll location.href every 1s in case the above miss something.
  setInterval(onUrlChange, 1000);

  // Initial load: settings FIRST, then bridge (avoids race where bridge
  // fires applySpeedToAll with default currentSpeed=1.0).
  loadSettings();
  // Bridge setup happens after settings load (inside loadSettings callback).
  // But we also need to ensure bridge runs even if storage is slow — schedule
  // it as a deferred fallback only after settings have been attempted.
  settingsApplyPending = true;

  // React to storage changes from other contexts (e.g., options page or popup)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    let changed = false;
    if (changes.speed) {
      currentSpeed = changes.speed.newValue;
      changed = true;
    }
    if (changes.exclusions) {
      excludedHostnames = Array.isArray(changes.exclusions.newValue)
        ? changes.exclusions.newValue
        : [];
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
})();

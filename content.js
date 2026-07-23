// PlaySpeed — Content Script
// Forces all <video> and <audio> elements to user-configured playback speed,
// unless the current hostname is in the exclusion list.

(() => {
  'use strict';

  // --- State ---
  let currentSpeed = 1.0;
  let excludedHostnames = [];
  let ytVideoId = '';
  let ytIsLive = false;
  let ytIsPremiere = false;
  let userChangedSpeedOnLive = false;
  let settingsLoaded = false;
  let settingsApplyPending = false;

  let bridgeIntervalId = null;
  let urlPollIntervalId = null;

  function isContextInvalidated() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime) return true;
      const id = chrome.runtime.id;
      if (!id) return true;
      chrome.runtime.getURL(''); // test call
      return false;
    } catch (e) {
      return true;
    }
  }

  function cleanupContext() {
    if (bridgeIntervalId) {
      clearInterval(bridgeIntervalId);
      bridgeIntervalId = null;
    }
    if (urlPollIntervalId) {
      clearInterval(urlPollIntervalId);
      urlPollIntervalId = null;
    }
    try {
      observer.disconnect();
    } catch (e) {}
    try {
      if (typeof ytPlayerObserver !== 'undefined' && ytPlayerObserver) {
        ytPlayerObserver.disconnect();
      }
    } catch (e) {}
  }

  // Token to verify messages from yt-bridge.js
  const BRIDGE_TOKEN = 'ps-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);

  // Cache for isLiveStream results per media element.
  let liveCache = new WeakMap();
  const LIVE_CACHE_TTL_MS = 3000;

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

    // Check cache
    const cached = liveCache.get(video);
    if (cached !== undefined) {
      if (!Array.isArray(cached)) return cached;
      if (Date.now() < cached[1]) return cached[0];
    }

    let result = false;
    try {
      if (location.hostname.includes('youtube.com')) {
        if (ytIsLive) {
          result = true;
        } else if (ytIsPremiere && video.duration === Infinity) {
          result = true;
        } else {
          const player = video.closest('.html5-video-player') || document.getElementById('movie_player');
          if (player && player.classList.contains('ytp-live')) {
            result = true;
          }
          if (!result) {
            const liveBadge = (player || document).querySelector('.ytp-live-badge');
            if (liveBadge && liveBadge.offsetParent !== null && window.getComputedStyle(liveBadge).display !== 'none') {
              result = true;
            }
          }
          if (!result) {
            const pageData = document.querySelector('ytd-watch-flexy[is-live-stream], ytd-watch-flexy[live-stream]');
            if (pageData) result = true;
          }
        }
      } else if (location.hostname.includes('twitch.tv')) {
        const path = location.pathname;
        const parts = path.split('/').filter(Boolean);
        const isChannelPage = parts.length === 1 ||
          (parts.length >= 2 && !['videos', 'clips', 'directory', 'following',
            'settings', 'subscriptions', 'search', 'p', 'wallet', 'drops',
            'friends', 'inventory', 'collections', 'edit', 'dashboard',
            'jobs', 'browse'].includes(parts[0]));
        if (isChannelPage) {
          const liveIndicator = document.querySelector(
            '.live-indicator-container .tw-channel-status-text--live, ' +
            'p[data-test-selector="live-status-text"]'
          );
          if (liveIndicator) result = true;
        }
      }

      if (!result && video.duration === Infinity && video.readyState >= 2) {
        result = true;
      }
    } catch (e) {
      console.warn('[PlaySpeed] isLiveStream error:', e);
    }

    if (location.hostname.includes('youtube.com')) {
      liveCache.set(video, [result, Date.now() + LIVE_CACHE_TTL_MS]);
    } else {
      liveCache.set(video, result);
    }
    return result;
  }

  function getStreamInfo() {
    try {
      const videos = document.querySelectorAll('video');
      for (const video of videos) {
        if (isLiveStream(video)) {
          let streamType = 'live';
          if (location.hostname.includes('youtube.com') && ytIsPremiere) {
            streamType = 'premiere';
          }
          return { isLive: true, isPremiere: ytIsPremiere, streamType };
        }
      }
    } catch (e) {
      console.warn('[PlaySpeed] getStreamInfo error:', e);
    }
    return { isLive: false, isPremiere: false, streamType: null };
  }

  // --- Listen for bridge data posted from MAIN world script ---
  window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin) return;
    if (!e.data || e.data.type !== 'playspeed-yt-live') return;
    if (e.data.token !== BRIDGE_TOKEN) return;

    const newVideoId = e.data.videoId || '';
    const newIsLive = !!e.data.isLive;
    const newIsPremiere = !!e.data.isPremiere;

    let stateChanged = false;
    if (newVideoId && newVideoId !== ytVideoId) {
      ytVideoId = newVideoId;
      userChangedSpeedOnLive = false; // Reset speed override for new video
      stateChanged = true;
    }
    if (newIsLive !== ytIsLive || newIsPremiere !== ytIsPremiere) {
      ytIsLive = newIsLive;
      ytIsPremiere = newIsPremiere;
      stateChanged = true;
    }

    if (stateChanged) {
      liveCache = new WeakMap();
      applySpeedToAll();
    }
  });

  function setupYouTubeBridge() {
    try {
      if (!location.hostname.includes('youtube.com')) return;
      if (isContextInvalidated()) {
        cleanupContext();
        return;
      }

      const root = document.documentElement;
      if (!root) return;

      const script = document.createElement('script');
      const bridgeUrl = chrome.runtime.getURL('yt-bridge.js');
      script.src = bridgeUrl + '?t=' + encodeURIComponent(BRIDGE_TOKEN);
      script.dataset.psToken = BRIDGE_TOKEN;
      script.onload = () => script.remove();
      script.onerror = () => {
        script.remove();
        console.warn('[PlaySpeed] yt-bridge.js failed to load.');
      };
      root.appendChild(script);
    } catch (e) {
      console.warn('[PlaySpeed] setupYouTubeBridge error:', e);
      if (isContextInvalidated()) {
        cleanupContext();
      }
    }
  }

  function scheduleYouTubeBridgeRetries() {
    if (!location.hostname.includes('youtube.com')) return;
    const delays = [500, 1500, 3000];
    for (const delay of delays) {
      setTimeout(() => {
        if (isContextInvalidated()) {
          cleanupContext();
          return;
        }
        setupYouTubeBridge();
      }, delay);
    }
    if (!bridgeIntervalId) {
      bridgeIntervalId = setInterval(() => {
        if (isContextInvalidated()) {
          cleanupContext();
          return;
        }
        if (location.hostname.includes('youtube.com')) {
          setupYouTubeBridge();
        }
      }, 5000);
    }
  }

  // --- Speed application ---
  function applySpeedToMedia(media) {
    if (isExcluded()) return;
    if (!media || (media.nodeName !== 'VIDEO' && media.nodeName !== 'AUDIO')) return;

    let targetSpeed = currentSpeed;

    // For live streams, default to 1.0x unless user has explicitly changed speed for this video
    if (media.nodeName === 'VIDEO' && isLiveStream(media) && !userChangedSpeedOnLive) {
      targetSpeed = 1.0;
    }

    try {
      const drift = Math.abs(media.playbackRate - targetSpeed);
      if (drift > 0.02) {
        media.playbackRate = targetSpeed;
      }
    } catch (e) {
      console.warn('[PlaySpeed] applySpeedToMedia error:', e);
    }
  }

  const reapplyRetries = new WeakSet();
  function scheduleYouTubeRetries(media) {
    if (reapplyRetries.has(media)) return;
    reapplyRetries.add(media);
    const delays = [250, 750, 1500, 3000];
    for (const delay of delays) {
      setTimeout(() => {
        if (media.isConnected) {
          liveCache.delete(media);
          applySpeedToMedia(media);
        }
      }, delay);
    }
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

  // --- MutationObserver ---
  const observer = new MutationObserver((mutations) => {
    if (isExcluded()) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.nodeName === 'VIDEO' || node.nodeName === 'AUDIO') {
          applySpeedToMedia(node);
          if (node.nodeName === 'VIDEO' && location.hostname.includes('youtube.com')) {
            scheduleYouTubeRetries(node);
          }
          continue;
        }
        if (node.querySelectorAll) {
          try {
            const mediaEls = node.querySelectorAll('video, audio');
            mediaEls.forEach((media) => {
              applySpeedToMedia(media);
              if (media.nodeName === 'VIDEO' && location.hostname.includes('youtube.com')) {
                scheduleYouTubeRetries(media);
              }
            });
          } catch (e) {}
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

  // --- YouTube player attribute observer ---
  const ytPlayerObserver = new MutationObserver((mutations) => {
    let needsReapply = false;
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' &&
          (mutation.attributeName === 'is-live-stream' ||
           mutation.attributeName === 'live-stream')) {
        needsReapply = true;
      }
    }
    if (needsReapply) {
      liveCache = new WeakMap();
      applySpeedToAll();
    }
  });

  function startYouTubePlayerObserver() {
    if (!location.hostname.includes('youtube.com')) return;
    const tryStart = () => {
      const watchFlexy = document.querySelector('ytd-watch-flexy');
      if (watchFlexy) {
        ytPlayerObserver.observe(watchFlexy, {
          attributes: true,
          attributeFilter: ['is-live-stream', 'live-stream'],
        });
      } else {
        setTimeout(tryStart, 1000);
      }
    };
    tryStart();
  }
  startYouTubePlayerObserver();

  // --- ratechange event ---
  document.addEventListener(
    'ratechange',
    (e) => {
      if (isExcluded()) return;
      const target = e.target;
      if (!target || (target.nodeName !== 'VIDEO' && target.nodeName !== 'AUDIO')) return;

      let targetSpeed = currentSpeed;
      if (target.nodeName === 'VIDEO' && isLiveStream(target) && !userChangedSpeedOnLive) {
        targetSpeed = 1.0;
      }

      try {
        const drift = Math.abs(target.playbackRate - targetSpeed);
        if (drift > 0.02) {
          target.playbackRate = targetSpeed;
        }
      } catch (err) {}
    },
    true
  );

  function reapplyOnMediaEvent(e) {
    const t = e.target;
    if (!t || (t.nodeName !== 'VIDEO' && t.nodeName !== 'AUDIO')) return;
    liveCache.delete(t);
    applySpeedToMedia(t);
  }
  document.addEventListener('loadedmetadata', reapplyOnMediaEvent, true);
  document.addEventListener('durationchange', reapplyOnMediaEvent, true);
  document.addEventListener('play', reapplyOnMediaEvent, true);
  document.addEventListener('playing', reapplyOnMediaEvent, true);
  document.addEventListener('canplay', reapplyOnMediaEvent, true);

  // --- Listen for messages from the popup ---
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    if (message.type === 'speedChanged') {
      currentSpeed = message.speed;
      if (location.hostname.includes('youtube.com') && ytIsLive) {
        userChangedSpeedOnLive = true;
      }
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
    if (message.type === 'getLiveStatus' || message.type === 'refreshLiveStatus') {
      liveCache = new WeakMap();
      setupYouTubeBridge();
      const info = getStreamInfo();
      const effectiveSpeed = (info.isLive && !userChangedSpeedOnLive) ? 1.0 : currentSpeed;
      sendResponse({
        isLive: info.isLive,
        isPremiere: info.isPremiere,
        streamType: info.streamType,
        userChangedSpeed: userChangedSpeedOnLive,
        speed: currentSpeed,
        effectiveSpeed: effectiveSpeed
      });
      return false;
    }
    return false;
  });

  // --- Load settings from storage ---
  function loadSettings() {
    chrome.storage.local.get(['speed', 'exclusions'], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[PlaySpeed] storage.local.get error:', chrome.runtime.lastError);
      } else {
        if (result.speed !== undefined) currentSpeed = result.speed;
      }
      settingsLoaded = true;
      applySpeedToAll();

      if (location.hostname.includes('youtube.com')) {
        try {
          document.querySelectorAll('video').forEach(scheduleYouTubeRetries);
        } catch (e) {}
        scheduleYouTubeBridgeRetries();
      }

      if (settingsApplyPending) {
        settingsApplyPending = false;
        setupYouTubeBridge();
      }
    });
  }

  // --- SPA navigation handling ---
  let lastUrl = location.href;

  function onUrlChange() {
    if (isContextInvalidated()) {
      cleanupContext();
      return;
    }
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    ytVideoId = '';
    ytIsLive = false;
    ytIsPremiere = false;
    userChangedSpeedOnLive = false;
    liveCache = new WeakMap();
    setupYouTubeBridge();
    applySpeedToAll();

    if (location.hostname.includes('youtube.com')) {
      try {
        document.querySelectorAll('video').forEach(scheduleYouTubeRetries);
      } catch (e) {}
      scheduleYouTubeBridgeRetries();
      startYouTubePlayerObserver();
    }
  }

  try {
    const wrap = (key) => {
      const orig = history[key];
      history[key] = function (...args) {
        const ret = orig.apply(this, args);
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
  window.addEventListener('yt-navigate-finish', onUrlChange);

  urlPollIntervalId = setInterval(() => {
    if (isContextInvalidated()) {
      cleanupContext();
      return;
    }
    onUrlChange();
  }, 1000);

  loadSettings();
  settingsApplyPending = true;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (isContextInvalidated()) {
      cleanupContext();
      return;
    }
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
    if (changed) {
      applySpeedToAll();
    }
  });
})();

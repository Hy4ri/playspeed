// PlaySpeed — Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const speedDisplay = document.getElementById('speed-display');
  const btnDecrease = document.getElementById('btn-decrease');
  const btnIncrease = document.getElementById('btn-increase');
  const fixedButtons = document.querySelectorAll('.fixed-speed-btn');
  const btnExclude = document.getElementById('btn-exclude');
  const optionsLink = document.getElementById('options-link');
  // Live section elements
  const liveSection = document.getElementById('live-section');
  const liveLabel = document.getElementById('live-label');
  const liveNowSpeed = document.getElementById('live-now-speed');
  const liveHint = document.getElementById('live-hint');
  const btnLiveOverride = document.getElementById('btn-live-override');
  const btnLiveOverrideText = btnLiveOverride.querySelector('.btn-live-override-text');

  let currentSpeed = 1.0;
  let exclusions = [];
  let currentHostname = '';
  let isLive = false;
  let isPremiere = false;
  let streamType = null;
  let liveOverride = false;
  let activeTabId = null;
  let liveRefreshInterval = null;

  function formatSpeed(speed) {
    // Drop trailing zeros for cleaner display (1.00 -> 1, 1.50 -> 1.5, 1.75 -> 1.75)
    const rounded = Math.round(speed * 100) / 100;
    return Number(rounded.toFixed(2)).toString() + 'x';
  }

  // --- Load settings ---
  chrome.storage.local.get('speed', (result) => {
    if (chrome.runtime.lastError) {
      console.warn('[PlaySpeed] storage.get speed:', chrome.runtime.lastError);
    }
    currentSpeed = (typeof result.speed === 'number') ? result.speed : 1.0;
    updateDisplay();
    updateActiveSpeedButton();
    updateLiveUI();
  });

  // --- Get hostname and exclusion state ---
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.warn('[PlaySpeed] tabs.query:', chrome.runtime.lastError);
      btnExclude.style.display = 'none';
      return;
    }
    const tab = tabs[0];
    if (!tab || !tab.url) {
      btnExclude.style.display = 'none';
      return;
    }

    let url;
    try {
      url = new URL(tab.url);
    } catch {
      btnExclude.style.display = 'none';
      return;
    }

    // Only show exclude button on http(s) pages
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      btnExclude.style.display = 'none';
      return;
    }

    currentHostname = url.hostname;
    // Strip www. prefix for broad subdomain coverage
    if (currentHostname.startsWith('www.')) {
      currentHostname = currentHostname.slice(4);
    }

    activeTabId = tab.id;

    chrome.storage.local.get('exclusions', (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[PlaySpeed] storage.get exclusions:', chrome.runtime.lastError);
      }
      exclusions = Array.isArray(result.exclusions) ? result.exclusions : [];
      updateExcludeButton();
    });

    // Initial live status query
    refreshLiveStatus();

    // Periodically refresh live status while popup is open.
    // Premieres can transition VOD → live → VOD; we want to catch these.
    liveRefreshInterval = setInterval(refreshLiveStatus, 2000);
  });

  // Query content script for fresh live status. Sends 'refreshLiveStatus'
  // so the content script re-injects the bridge and invalidates its cache.
  function refreshLiveStatus() {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'refreshLiveStatus' })
      .then((response) => {
        if (!response) {
          // Fall back to getLiveStatus if refreshLiveStatus not supported
          return chrome.tabs.sendMessage(activeTabId, { type: 'getLiveStatus' });
        }
        return response;
      })
      .then((response) => {
        if (!response) return;
        const wasLive = isLive;
        isLive = !!response.isLive;
        isPremiere = !!response.isPremiere;
        streamType = response.streamType || null;
        liveOverride = !!response.liveOverride;
        if (wasLive !== isLive) {
          // Live status changed — update UI immediately
          updateLiveUI();
        } else {
          // Just refresh the labels (speed may have changed)
          updateLiveLabels();
        }
      })
      .catch(() => {
        // Content script not available
        if (isLive) {
          isLive = false;
          updateLiveUI();
        }
      });
  }

  // Cleanup interval when popup closes
  window.addEventListener('beforeunload', () => {
    if (liveRefreshInterval) clearInterval(liveRefreshInterval);
  });

  // --- Storage change listener ---
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.liveOverride) {
      liveOverride = !!changes.liveOverride.newValue;
      updateLiveUI();
    }
    if (changes.speed) {
      currentSpeed = changes.speed.newValue;
      updateDisplay();
      updateActiveSpeedButton();
      updateLiveUI();
    }
    if (changes.exclusions) {
      exclusions = Array.isArray(changes.exclusions.newValue) ? changes.exclusions.newValue : [];
      updateExcludeButton();
    }
  });

  function isCurrentlyExcluded() {
    return exclusions.some((pattern) => {
      return currentHostname === pattern || currentHostname.endsWith('.' + pattern);
    });
  }

  function updateExcludeButton() {
    if (!currentHostname) {
      btnExclude.style.display = 'none';
      return;
    }
    btnExclude.style.display = '';
    const excluded = isCurrentlyExcluded();
    btnExclude.textContent = excluded ? 'Remove ' + currentHostname : 'Exclude ' + currentHostname;
    btnExclude.className = 'btn-exclude ' + (excluded ? 'remove' : 'add');
  }

  function updateLiveUI() {
    if (!isLive) {
      liveSection.classList.remove('is-live');
      return;
    }
    liveSection.classList.add('is-live');
    updateLiveLabels();
  }

  function updateLiveLabels() {
    if (!isLive) return;

    // Header label
    if (streamType === 'premiere' || isPremiere) {
      liveLabel.textContent = 'Premiere (live phase)';
    } else {
      liveLabel.textContent = 'Live stream detected';
    }

    // "Now" speed display
    const nowSpeed = liveOverride ? currentSpeed : 1.0;
    liveNowSpeed.textContent = formatSpeed(nowSpeed);
    liveNowSpeed.classList.toggle('overridden', liveOverride);

    // Button text and state
    if (liveOverride) {
      btnLiveOverrideText.textContent = 'Revert to 1x';
      btnLiveOverride.classList.add('active');
      btnLiveOverride.setAttribute('aria-pressed', 'true');
      liveHint.textContent = 'Override is on — your speed is applied to this live stream.';
    } else {
      btnLiveOverrideText.textContent = 'Override to ' + formatSpeed(currentSpeed);
      btnLiveOverride.classList.remove('active');
      btnLiveOverride.setAttribute('aria-pressed', 'false');
      liveHint.textContent = 'Live streams default to 1x to keep you in sync. Click override to apply your speed.';
    }
  }

  btnExclude.addEventListener('click', () => {
    const excluded = isCurrentlyExcluded();

    if (excluded) {
      // Remove any pattern that matches this hostname
      exclusions = exclusions.filter((pattern) => {
        return !(currentHostname === pattern || currentHostname.endsWith('.' + pattern));
      });
    } else {
      // Add the current hostname
      if (!exclusions.includes(currentHostname)) {
        exclusions.push(currentHostname);
      }
    }

    chrome.storage.local.set({ exclusions }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[PlaySpeed] storage.set exclusions:', chrome.runtime.lastError);
      }
      // Notify content script to re-evaluate immediately. Storage.onChanged
      // will also fire, but the message gives near-instant feedback.
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) return;
        const tab = tabs[0];
        if (!tab || !tab.id) return;
        chrome.tabs
          .sendMessage(tab.id, { type: 'updateExclusions', exclusions })
          .catch(() => {});
      });
      updateExcludeButton();
    });
  });

  // --- Display ---
  function updateDisplay() {
    speedDisplay.textContent = formatSpeed(currentSpeed);
  }

  // --- Active speed button ---
  function updateActiveSpeedButton() {
    fixedButtons.forEach((btn) => {
      const speed = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', Math.abs(speed - currentSpeed) < 0.01);
    });
  }

  // --- Apply new speed ---
  function setSpeed(newSpeed) {
    // Clamp between 0.1 and 16
    currentSpeed = Math.max(0.1, Math.min(16, newSpeed));
    // Round to 2 decimal places
    currentSpeed = Math.round(currentSpeed * 100) / 100;
    updateDisplay();
    updateActiveSpeedButton();

    // Persist to storage — content script will react via storage.onChanged.
    chrome.storage.local.set({ speed: currentSpeed });

    // Also send a direct message for immediate feedback (no storage round-trip).
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return;
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      chrome.tabs
        .sendMessage(tab.id, { type: 'speedChanged', speed: currentSpeed })
        .catch(() => {
          /* content script not available (chrome:// pages, etc.) */
        });
    });

    // Refresh live UI (the status text shows current speed when override is active)
    updateLiveUI();
  }

  // --- Live override handler ---
  btnLiveOverride.addEventListener('click', () => {
    liveOverride = !liveOverride;

    // Persist to storage (popup is the single writer for liveOverride)
    chrome.storage.local.set({ liveOverride });

    // Notify the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return;
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      chrome.tabs
        .sendMessage(tab.id, { type: 'liveOverrideChanged', enabled: liveOverride })
        .catch(() => {
          /* content script not available */
        });
    });

    updateLiveUI();
  });

  // --- Event handlers ---
  btnDecrease.addEventListener('click', () => setSpeed(currentSpeed - 0.25));
  btnIncrease.addEventListener('click', () => setSpeed(currentSpeed + 0.25));

  fixedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      setSpeed(speed);
    });
  });

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', (e) => {
    // Ignore if focus is in the exclude input (if any) — none currently, but defensive.
    if (e.target && e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case 'ArrowUp':
      case '+':
      case '=':
        e.preventDefault();
        setSpeed(currentSpeed + 0.25);
        break;
      case 'ArrowDown':
      case '-':
      case '_':
        e.preventDefault();
        setSpeed(currentSpeed - 0.25);
        break;
      case 'ArrowRight':
        e.preventDefault();
        setSpeed(currentSpeed + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setSpeed(currentSpeed - 1);
        break;
      case '0':
        e.preventDefault();
        setSpeed(1);
        break;
      // 'o' or 'O' to toggle live override
      case 'o':
      case 'O':
        if (isLive) {
          e.preventDefault();
          btnLiveOverride.click();
        }
        break;
      default:
        break;
    }
  });

  // Open options page
  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});

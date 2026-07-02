// PlaySpeed — Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const speedDisplay = document.getElementById('speed-display');
  const btnDecrease = document.getElementById('btn-decrease');
  const btnIncrease = document.getElementById('btn-increase');
  const fixedButtons = document.querySelectorAll('.fixed-speed-btn');
  const btnExclude = document.getElementById('btn-exclude');
  const optionsLink = document.getElementById('options-link');
  const btnLiveOverride = document.getElementById('btn-live-override');
  const liveSection = document.getElementById('live-section');
  const liveStatus = document.getElementById('live-status');

  let currentSpeed = 1.0;
  let exclusions = [];
  let currentHostname = '';
  let settingsLoaded = false;
  let isLive = false;
  let liveOverride = false;

  // --- Load settings ---
  chrome.storage.local.get('speed', (result) => {
    currentSpeed = result.speed ?? 1.0;
    settingsLoaded = true;
    speedDisplay.classList.remove('loading');
    updateDisplay();
    updateActiveSpeedButton();
  });

  // --- Get hostname and exclusion state ---
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) {
      btnExclude.style.display = 'none';
      return;
    }
    try {
      const url = new URL(tabs[0].url);
      currentHostname = url.hostname;
      // Strip www. prefix for broad subdomain coverage
      if (currentHostname.startsWith('www.')) {
        currentHostname = currentHostname.slice(4);
      }
    } catch {
      btnExclude.style.display = 'none';
      return;
    }

    chrome.storage.local.get('exclusions', (result) => {
      exclusions = result.exclusions || [];
      updateExcludeButton();
    });

    // Query content script for live status
    chrome.tabs.sendMessage(tabs[0].id, { type: 'getLiveStatus' })
      .then((response) => {
        isLive = response.isLive || false;
        liveOverride = response.liveOverride || false;
        updateLiveUI();
      })
      .catch(() => {});
  });

  // Note: liveOverride is NOT loaded from storage here — the content script
  // response (above) is authoritative since it reflects the active tab's state.
  // currentSpeed is intentionally NOT sourced from this response — it creates
  // a race where the response can overwrite the user's speed choice if they
  // click a button before the round-trip completes.

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
      liveSection.style.display = 'none';
      return;
    }
    liveSection.style.display = 'block';
    if (liveOverride) {
      liveStatus.textContent = 'Live: ' + currentSpeed.toFixed(2) + 'x';
      btnLiveOverride.textContent = 'Revert';
      btnLiveOverride.classList.add('active');
    } else {
      liveStatus.textContent = 'Live: 1.00x';
      btnLiveOverride.textContent = 'Override';
      btnLiveOverride.classList.remove('active');
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
      // Notify content script to re-evaluate immediately
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs
            .sendMessage(tabs[0].id, { type: 'updateExclusions', exclusions })
            .catch(() => {});
        }
      });
      updateExcludeButton();
    });
  });

  // --- Display ---
  function updateDisplay() {
    speedDisplay.textContent = currentSpeed.toFixed(2) + 'x';
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

    // Persist to storage
    chrome.storage.local.set({ speed: currentSpeed });

    // Notify the active tab's content script immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs
        .sendMessage(tabs[0].id, { type: 'speedChanged', speed: currentSpeed })
        .catch(() => {
          /* content script not available */
        });
    });

    // Refresh live UI (the status text shows current speed when override is active)
    updateLiveUI();
  }

  // --- Live override handler ---
  btnLiveOverride.addEventListener('click', () => {
    liveOverride = !liveOverride;

    // Persist to storage
    chrome.storage.local.set({ liveOverride });

    // Notify the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs
        .sendMessage(tabs[0].id, { type: 'liveOverrideChanged', enabled: liveOverride })
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

  // Open options page
  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});

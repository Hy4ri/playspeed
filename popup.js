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

  let currentSpeed = 1.0;
  let exclusions = [];
  let currentHostname = '';
  let isLive = false;
  let isPremiere = false;
  let streamType = null;
  let userChangedSpeed = false;
  let effectiveSpeed = 1.0;
  let activeTabId = null;
  let liveRefreshInterval = null;

  function formatSpeed(speed) {
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

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      btnExclude.style.display = 'none';
      return;
    }

    currentHostname = url.hostname;
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

    refreshLiveStatus();
    liveRefreshInterval = setInterval(refreshLiveStatus, 1500);
  });

  function refreshLiveStatus() {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'refreshLiveStatus' })
      .then((response) => {
        if (!response) {
          return chrome.tabs.sendMessage(activeTabId, { type: 'getLiveStatus' });
        }
        return response;
      })
      .then((response) => {
        if (!response) return;
        isLive = !!response.isLive;
        isPremiere = !!response.isPremiere;
        streamType = response.streamType || null;
        userChangedSpeed = !!response.userChangedSpeed;
        effectiveSpeed = typeof response.effectiveSpeed === 'number' ? response.effectiveSpeed : 1.0;
        updateLiveUI();
      })
      .catch(() => {
        if (isLive) {
          isLive = false;
          updateLiveUI();
        }
      });
  }

  window.addEventListener('beforeunload', () => {
    if (liveRefreshInterval) clearInterval(liveRefreshInterval);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
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

    if (streamType === 'premiere' || isPremiere) {
      liveLabel.textContent = 'Premiere (live phase)';
    } else {
      liveLabel.textContent = 'Live stream detected';
    }

    liveNowSpeed.textContent = formatSpeed(effectiveSpeed);
    liveNowSpeed.classList.toggle('overridden', userChangedSpeed);

    if (userChangedSpeed) {
      liveHint.textContent = 'Speed adjusted for live stream.';
    } else {
      liveHint.textContent = 'Live streams default to 1x speed. Adjust speed above to change.';
    }
  }

  btnExclude.addEventListener('click', () => {
    const excluded = isCurrentlyExcluded();

    if (excluded) {
      exclusions = exclusions.filter((pattern) => {
        return !(currentHostname === pattern || currentHostname.endsWith('.' + pattern));
      });
    } else {
      if (!exclusions.includes(currentHostname)) {
        exclusions.push(currentHostname);
      }
    }

    chrome.storage.local.set({ exclusions }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[PlaySpeed] storage.set exclusions:', chrome.runtime.lastError);
      }
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

  function updateDisplay() {
    speedDisplay.textContent = formatSpeed(currentSpeed);
  }

  function updateActiveSpeedButton() {
    fixedButtons.forEach((btn) => {
      const speed = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', Math.abs(speed - currentSpeed) < 0.01);
    });
  }

  function setSpeed(newSpeed) {
    currentSpeed = Math.max(0.1, Math.min(16, newSpeed));
    currentSpeed = Math.round(currentSpeed * 100) / 100;
    updateDisplay();
    updateActiveSpeedButton();

    chrome.storage.local.set({ speed: currentSpeed });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return;
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      chrome.tabs
        .sendMessage(tab.id, { type: 'speedChanged', speed: currentSpeed })
        .catch(() => {});
    });

    userChangedSpeed = true;
    effectiveSpeed = currentSpeed;
    updateLiveUI();
  }

  btnDecrease.addEventListener('click', () => setSpeed(currentSpeed - 0.25));
  btnIncrease.addEventListener('click', () => setSpeed(currentSpeed + 0.25));

  fixedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      setSpeed(speed);
    });
  });

  document.addEventListener('keydown', (e) => {
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
      default:
        break;
    }
  });

  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});

// PlaySpeed — Options Page Script

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('exclusion-input');
  const btnAdd = document.getElementById('btn-add');
  const btnClearAll = document.getElementById('btn-clear-all');
  const list = document.getElementById('exclusion-list');
  const emptyMsg = document.getElementById('empty-msg');
  const errorMsg = document.getElementById('error-msg');

  let exclusions = [];

  // Hostname validation: 1-253 chars, allowed chars [a-z0-9.-], must contain
  // at least one dot (unless it's "localhost"), no leading/trailing dot or
  // dash, no double dots. Strips common prefixes like "https://" and "www.".
  function normalizeAndValidate(raw) {
    let value = raw.trim().toLowerCase();

    // Strip scheme if user pasted a URL
    value = value.replace(/^[a-z]+:\/\//, '');
    // Strip path / query / hash
    const slashIdx = value.indexOf('/');
    if (slashIdx !== -1) value = value.slice(0, slashIdx);
    const qIdx = value.indexOf('?');
    if (qIdx !== -1) value = value.slice(0, qIdx);
    const hIdx = value.indexOf('#');
    if (hIdx !== -1) value = value.slice(0, hIdx);
    // Strip port
    const colonIdx = value.indexOf(':');
    if (colonIdx !== -1) value = value.slice(0, colonIdx);

    // Strip "www." prefix for broad subdomain coverage (matches popup behavior)
    if (value.startsWith('www.')) {
      value = value.slice(4);
    }

    if (!value) {
      return { ok: false, error: 'Enter a hostname (e.g. example.com)' };
    }

    if (value === 'localhost') {
      return { ok: true, value };
    }

    if (value.length > 253) {
      return { ok: false, error: 'Hostname is too long' };
    }

    if (!/^[a-z0-9.-]+$/.test(value)) {
      return { ok: false, error: 'Only letters, numbers, dots, and hyphens are allowed' };
    }

    if (!value.includes('.')) {
      return { ok: false, error: 'Enter a valid hostname (e.g. example.com)' };
    }

    if (value.startsWith('.') || value.endsWith('.')) {
      return { ok: false, error: 'Hostname cannot start or end with a dot' };
    }

    if (value.startsWith('-') || value.endsWith('-')) {
      return { ok: false, error: 'Hostname cannot start or end with a hyphen' };
    }

    if (value.includes('..')) {
      return { ok: false, error: 'Hostname cannot contain consecutive dots' };
    }

    // Each label must be 1-63 chars
    const labels = value.split('.');
    for (const label of labels) {
      if (!label || label.length > 63) {
        return { ok: false, error: 'Each hostname part must be 1-63 characters' };
      }
      if (label.startsWith('-') || label.endsWith('-')) {
        return { ok: false, error: 'Hostname parts cannot start or end with a hyphen' };
      }
    }

    return { ok: true, value };
  }

  // --- Load exclusions from storage ---
  function loadExclusions() {
    chrome.storage.local.get('exclusions', (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[PlaySpeed] storage.get:', chrome.runtime.lastError);
      }
      exclusions = Array.isArray(result.exclusions) ? result.exclusions : [];
      renderList();
    });
  }

  // --- Render the exclusion list ---
  function renderList() {
    list.innerHTML = '';

    if (exclusions.length === 0) {
      emptyMsg.style.display = 'block';
      btnClearAll.style.display = 'none';
      return;
    }
    emptyMsg.style.display = 'none';
    btnClearAll.style.display = '';

    // Sort alphabetically for predictable display
    const sorted = [...exclusions].sort((a, b) => a.localeCompare(b));

    sorted.forEach((pattern) => {
      const index = exclusions.indexOf(pattern);

      const li = document.createElement('li');
      li.className = 'exclusion-item';

      const label = document.createElement('span');
      label.className = 'exclusion-label';
      label.textContent = pattern;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.title = 'Remove ' + pattern;
      removeBtn.setAttribute('aria-label', 'Remove ' + pattern);
      removeBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
        '<path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>';
      removeBtn.addEventListener('click', () => {
        const i = exclusions.indexOf(pattern);
        if (i !== -1) {
          exclusions.splice(i, 1);
          saveExclusions();
        }
      });

      li.appendChild(label);
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  }

  // --- Save exclusions to storage ---
  function saveExclusions() {
    chrome.storage.local.set({ exclusions }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[PlaySpeed] storage.set:', chrome.runtime.lastError);
      }
      renderList();
    });
  }

  // --- Clear error state ---
  function clearError() {
    errorMsg.textContent = '';
    input.classList.remove('error');
    input.placeholder = 'e.g. youtube.com';
  }

  // --- Add a new exclusion ---
  function addExclusion() {
    const result = normalizeAndValidate(input.value);
    if (!result.ok) {
      errorMsg.textContent = result.error;
      input.classList.add('error');
      return;
    }

    if (exclusions.includes(result.value)) {
      errorMsg.textContent = '"' + result.value + '" is already in the list';
      input.classList.add('error');
      return;
    }

    clearError();
    exclusions.push(result.value);
    saveExclusions();
    input.value = '';
    input.focus();
  }

  // --- Event listeners ---
  btnAdd.addEventListener('click', addExclusion);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addExclusion();
    }
  });

  // Clear error when the user types
  input.addEventListener('input', clearError);

  // Clear all handler
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (exclusions.length === 0) return;
      if (!confirm('Remove all ' + exclusions.length + ' exclusion(s)?')) return;
      exclusions = [];
      saveExclusions();
    });
  }

  // --- Live sync: update list when storage changes from elsewhere ---
  // (e.g., the popup's "Exclude this site" button)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.exclusions) {
      exclusions = Array.isArray(changes.exclusions.newValue) ? changes.exclusions.newValue : [];
      renderList();
    }
  });

  // --- Initial load ---
  loadExclusions();
});

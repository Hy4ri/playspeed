// PlaySpeed — Options Page Script

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('exclusion-input');
  const btnAdd = document.getElementById('btn-add');
  const list = document.getElementById('exclusion-list');
  const emptyMsg = document.getElementById('empty-msg');
  const errorMsg = document.getElementById('error-msg');

  let exclusions = [];

  // --- Load exclusions from storage ---
  function loadExclusions() {
    chrome.storage.local.get('exclusions', (result) => {
      exclusions = result.exclusions || [];
      renderList();
    });
  }

  // --- Render the exclusion list ---
  function renderList() {
    list.innerHTML = '';

    if (exclusions.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    exclusions.forEach((pattern, index) => {
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
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none">' +
        '<path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>';
      removeBtn.addEventListener('click', () => {
        exclusions.splice(index, 1);
        saveExclusions();
      });

      li.appendChild(label);
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  }

  // --- Save exclusions to storage ---
  function saveExclusions() {
    chrome.storage.local.set({ exclusions }, () => {
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
    const value = input.value.trim().toLowerCase();
    if (!value) return;

    // Basic validation: must contain at least one dot (like a hostname)
    if (!value.includes('.') && value !== 'localhost') {
      errorMsg.textContent = 'Enter a valid hostname (e.g. example.com)';
      input.classList.add('error');
      return;
    }

    if (exclusions.includes(value)) {
      errorMsg.textContent = '"' + value + '" is already in the list';
      input.classList.add('error');
      return;
    }

    clearError();
    exclusions.push(value);
    saveExclusions();
    input.value = '';
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

  // --- Initial load ---
  loadExclusions();
});

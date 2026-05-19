// PlaySpeed — Options Page Script

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('exclusion-input');
  const btnAdd = document.getElementById('btn-add');
  const list = document.getElementById('exclusion-list');
  const emptyMsg = document.getElementById('empty-msg');

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
      removeBtn.textContent = '✕';
      removeBtn.title = `Remove ${pattern}`;
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

  // --- Add a new exclusion ---
  function addExclusion() {
    const value = input.value.trim().toLowerCase();
    if (!value) return;

    // Basic validation: must contain at least one dot (like a hostname)
    if (!value.includes('.') && value !== 'localhost') {
      input.value = '';
      input.placeholder = 'Enter a valid hostname (e.g. example.com)';
      return;
    }

    if (!exclusions.includes(value)) {
      exclusions.push(value);
      saveExclusions();
    }

    input.value = '';
    input.placeholder = 'e.g. youtube.com';
  }

  // --- Event listeners ---
  btnAdd.addEventListener('click', addExclusion);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addExclusion();
    }
  });

  // --- Initial load ---
  loadExclusions();
});

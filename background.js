// PlaySpeed — Background Service Worker
// Initializes default settings on install and migrates settings on update.

chrome.runtime.onInstalled.addListener((details) => {
  if (chrome.runtime.lastError) {
    console.warn('[PlaySpeed] onInstalled error:', chrome.runtime.lastError);
    return;
  }

  // Seed defaults for any missing keys. We always run this on install AND
  // update so new keys (e.g., liveOverride added in v1.5) get a sane default
  // for users updating from an older version, without overwriting existing
  // user values.
  chrome.storage.local.get(['speed', 'exclusions', 'liveOverride'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('[PlaySpeed] storage.get error:', chrome.runtime.lastError);
      return;
    }
    const patch = {};
    if (result.speed === undefined) patch.speed = 1.0;
    if (!Array.isArray(result.exclusions)) patch.exclusions = [];
    if (result.liveOverride === undefined) patch.liveOverride = false;

    // Coerce invalid types defensively
    if (typeof result.speed !== 'number' || !isFinite(result.speed)) {
      patch.speed = 1.0;
    }
    if (typeof result.liveOverride !== 'boolean') {
      patch.liveOverride = false;
    }

    if (Object.keys(patch).length > 0) {
      chrome.storage.local.set(patch, () => {
        if (chrome.runtime.lastError) {
          console.warn('[PlaySpeed] storage.set error:', chrome.runtime.lastError);
        }
      });
    }
  });
});

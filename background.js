// PlaySpeed — Background Service Worker
// Initializes default settings on first install.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      speed: 1.0,
      exclusions: []
    });
  }
});

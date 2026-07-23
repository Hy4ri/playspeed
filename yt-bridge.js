// PlaySpeed — YouTube Page Data & Player Bridge
// Injected as an external <script> to run in the page's MAIN world.
// Reads YouTube player API data (#movie_player) and communicates via postMessage.

(function() {
  var token = '';
  try {
    var currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
      var qIdx = currentScript.src.indexOf('?');
      if (qIdx !== -1) {
        var params = new URLSearchParams(currentScript.src.slice(qIdx + 1));
        token = params.get('t') || '';
      }
    }
    if (!token && currentScript && currentScript.dataset) {
      token = currentScript.dataset.psToken || '';
    }
  } catch (e) {}

  function sendLiveStatus() {
    var isLive = false;
    var isPremiere = false;
    var videoId = '';

    try {
      var mp = document.getElementById('movie_player');
      if (mp) {
        if (typeof mp.getVideoData === 'function') {
          var vd = mp.getVideoData();
          if (vd && vd.video_id) {
            videoId = vd.video_id;
            isLive = !!(vd.isLive || vd.isWindowedLive);
            isPremiere = !!vd.isPremiere;
          }
        }
        if (!videoId && typeof mp.getPlayerResponse === 'function') {
          var pr = mp.getPlayerResponse();
          if (pr && pr.videoDetails && pr.videoDetails.videoId) {
            var vdDetails = pr.videoDetails;
            videoId = vdDetails.videoId;
            isLive = !!(vdDetails.isLive || vdDetails.isLiveDvrEnabled);
            isPremiere = !!vdDetails.isPremiere;
          }
        }
      }

      if (!isLive) {
        var flexy = document.querySelector('ytd-watch-flexy');
        if (flexy) {
          if (!videoId) videoId = flexy.getAttribute('video-id') || '';
          if (flexy.hasAttribute('is-live-stream') || flexy.hasAttribute('live-stream')) {
            isLive = true;
          }
        }
        var liveBadge = document.querySelector('.ytp-live-badge');
        if (liveBadge && liveBadge.offsetParent !== null && window.getComputedStyle(liveBadge).display !== 'none') {
          isLive = true;
        }
        if (mp && mp.classList.contains('ytp-live')) {
          isLive = true;
        }
      }
    } catch (e) {}

    try {
      window.postMessage(
        {
          type: 'playspeed-yt-live',
          isLive: !!isLive,
          isPremiere: !!isPremiere,
          videoId: videoId || '',
          token: token
        },
        window.location.origin
      );
    } catch (e) {}
  }

  // Initial check
  sendLiveStatus();

  // Listen for YouTube SPA navigation & state events
  window.addEventListener('yt-navigate-finish', sendLiveStatus);
  window.addEventListener('popstate', sendLiveStatus);

  // Poll every 1s to catch dynamic transitions (e.g., premiere going live or player init)
  setInterval(sendLiveStatus, 1000);
})();
// PlaySpeed — YouTube Page Data Bridge
// Injected as an external <script> to run in the page's MAIN world.
// Reads ytInitialPlayerResponse (inaccessible from content script's isolated world)
// and communicates via postMessage (reliably crosses the boundary).

(function() {
  try {
    var data = window.ytInitialPlayerResponse;
    // Only check videoDetails.isLive / isLiveDvrEnabled — these are
    // the authoritative live indicators. The liveStreamability property
    // can appear on non-live videos (false positives), so we skip it.
    var isLive = !!(data && data.videoDetails && (
      data.videoDetails.isLive === true || data.videoDetails.isLiveDvrEnabled === true
    ));
    window.postMessage({ type: 'playspeed-yt-live', isLive: isLive }, '*');
  } catch(e) {
    window.postMessage({ type: 'playspeed-yt-live', isLive: false }, '*');
  }
})();

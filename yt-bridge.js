// PlaySpeed — YouTube Page Data Bridge
// Injected as an external <script> to run in the page's MAIN world.
// Reads ytInitialPlayerResponse (inaccessible from content script's isolated world)
// and communicates via postMessage (reliably crosses the boundary).

(function() {
  // The content script sets the auth token via a URL query string (?t=...)
  // and also via a data-ps-token attribute on the <script> element. We read
  // both and echo whichever we find back in the postMessage so the content
  // script can verify the message came from our bridge and not from a
  // third-party page script.
  var token = '';
  try {
    // Method 1: URL query string (most reliable for dynamically-inserted
    // external scripts)
    var currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
      var qIdx = currentScript.src.indexOf('?');
      if (qIdx !== -1) {
        var params = new URLSearchParams(currentScript.src.slice(qIdx + 1));
        token = params.get('t') || '';
      }
    }
    // Method 2: data attribute fallback
    if (!token && currentScript && currentScript.dataset) {
      token = currentScript.dataset.psToken || '';
    }
  } catch (e) {}

  function send(isLive) {
    // Use window.location.origin as the targetOrigin instead of '*' — this
    // prevents the message from leaking to a parent/child frame if the page
    // is ever embedded.
    try {
      window.postMessage(
        { type: 'playspeed-yt-live', isLive: !!isLive, token: token },
        window.location.origin
      );
    } catch (e) {}
  }

  try {
    var data = window.ytInitialPlayerResponse;
    // Only check videoDetails.isLive / isLiveDvrEnabled — these are
    // the authoritative live indicators. The liveStreamability property
    // can appear on non-live videos (false positives), so we skip it.
    var isLive = !!(data && data.videoDetails && (
      data.videoDetails.isLive === true || data.videoDetails.isLiveDvrEnabled === true
    ));
    send(isLive);
  } catch(e) {
    send(false);
  }
})();

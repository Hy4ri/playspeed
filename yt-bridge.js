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

  function send(isLive, isPremiere) {
    try {
      window.postMessage(
        {
          type: 'playspeed-yt-live',
          isLive: !!isLive,
          isPremiere: !!isPremiere,
          token: token
        },
        window.location.origin
      );
    } catch (e) {}
  }

  try {
    var data = window.ytInitialPlayerResponse;
    if (!data || !data.videoDetails) {
      send(false, false);
      return;
    }

    var vd = data.videoDetails;
    // isLive: stream is currently broadcasting
    // isLiveDvrEnabled: live DVR (can seek behind live edge)
    // isPremiere: scheduled premiere — starts as VOD countdown, becomes live
    //             at scheduled time, then becomes VOD again after ending.
    var isLive = !!(vd.isLive === true || vd.isLiveDvrEnabled === true);
    var isPremiere = !!vd.isPremiere;

    // Premiere that has gone live: treat as live so speed is capped.
    // We can detect this via the playability status or duration.
    if (isPremiere && !isLive) {
      // Check if the premiere is currently in its live phase by looking at
      // the streamingData — premieres in live phase have live stream data.
      try {
        if (data.streamingData && data.streamingData.dashManifestUrl) {
          // DASH manifest with "live" in the URL indicates live phase
          var dashUrl = data.streamingData.dashManifestUrl;
          if (dashUrl.indexOf('/manifest/') !== -1 &&
              (dashUrl.indexOf('live') !== -1 || dashUrl.indexOf('oc=') !== -1)) {
            isLive = true;
          }
        }
      } catch (e) {}
    }

    send(isLive, isPremiere);
  } catch(e) {
    send(false, false);
  }
})();
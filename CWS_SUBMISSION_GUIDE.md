# Chrome Web Store Submission Guide — PlaySpeed

---

## Privacy Practices Tab — Justification Texts

Copy and paste the following into each field on the **Privacy Practices** tab of the Chrome Web Store Developer Dashboard.

> **Tip:** Run `bash package.sh` to generate `playspeed-v<version>.zip` (the version is read automatically from `manifest.json`, so the filename always matches the version Chrome Web Store will display).

---

### Single Purpose Description

> PlaySpeed allows users to control and enforce a consistent playback speed on all HTML `<video>` and `<audio>` elements across any website. The extension also detects live streams and, by default, leaves them at 1x speed so users do not skip past real-time content, with an optional override.

---

### Permission Justifications

#### `storage`

> PlaySpeed uses the `storage` permission to save three user preferences locally via `chrome.storage.local`: (1) the selected playback speed (e.g., 1.5x), (2) an optional list of hostnames to exclude from speed control, and (3) a boolean toggle (`liveOverride`) controlling whether the chosen speed is applied to live streams. These settings persist across browser sessions so users don't need to reconfigure the extension every time they open a new tab. No data is ever transmitted off the device.

#### `activeTab`

> PlaySpeed uses the `activeTab` permission to communicate with the content script running in the user's currently active tab. When the user changes the speed in the popup, `activeTab` allows the popup to send a message (`chrome.tabs.sendMessage`) to the content script so it can immediately apply the new speed. It also allows the popup to read the active tab's URL via `chrome.tabs.query` in order to determine the current hostname for the "Exclude this site" feature.

#### `<all_urls>` (Host Permission)

> PlaySpeed requires `<all_urls>` host permission to inject its content script (`content.js`) into every webpage the user visits. This is necessary because video and audio elements can appear on any site — including streaming platforms, social media, educational sites, news articles, and embedded players in iframes. The content script detects `<video>` and `<audio>` elements and enforces the user's chosen playback speed. Without `<all_urls>`, the extension would only work on a pre-approved list of sites, defeating its core purpose of universal speed control.

#### Web-Accessible Resources (`yt-bridge.js`)

> `yt-bridge.js` is declared as a web-accessible resource so that `content.js` can inject it into YouTube pages as a `<script src="chrome-extension://...">` tag. The bridge runs in the page's MAIN world (where it can read the page-level `ytInitialPlayerResponse` variable that is invisible to the content script's isolated world) and posts the video's live status back to the content script via `postMessage`. An auth token verified on the receiving end prevents spoofing by third-party page scripts. The bridge is restricted to `*://*.youtube.com/*` and `*://*.youtu.be/*` to minimize fingerprinting surface. No user data is read, stored, or transmitted — only the boolean live status of the current video.

---

### Remote Code

> **Does your extension use remote code?** No
>
> PlaySpeed does not execute, load, or evaluate any remote code. All JavaScript, HTML, and CSS files are bundled statically with the extension. No `eval()`, `Function()`, `setTimeout`/`setInterval` with string arguments, or dynamically fetched scripts are used. The extension has no network requests for code execution. The web-accessible resource `yt-bridge.js` is bundled with the extension and is not fetched from a remote server.

---

### Data Usage Certification

> Check the box: **"My extension complies with the Chrome Web Store Developer Program Policies"**

---

## Store Listing Tab — Fields

### Short Description (max 132 chars)
> Force any HTML video or audio to play at your chosen speed. Exclude specific sites.

### Detailed Description
> (See `STORE_DESCRIPTION.md` for the full detailed description)

### Category
> Productivity

### Language
> English

---

## Privacy Policy URL

Host the `PRIVACY_POLICY.md` file somewhere publicly accessible and link it here.

**Options:**
- **GitHub raw URL:** Push the repo and use `https://raw.githubusercontent.com/Hy4ri/playspeed/main/PRIVACY_POLICY.md`
- **GitHub Pages:** Create a simple site
- **Your own website:** Host it anywhere accessible

---

## Submission Checklist

- [ ] Run `bash package.sh` to generate `playspeed-v<version>.zip` (version is read from `manifest.json`)
- [ ] Verify the script printed `OK: all manifest-referenced files packaged.` — if any files were missing the script will exit non-zero and refuse to produce a ZIP
- [ ] Upload the ZIP to the Developer Dashboard
- [ ] Paste the **Single Purpose Description** (see above)
- [ ] Paste all **Permission Justifications**, including the **Web-Accessible Resources** justification (see above)
- [ ] Paste the **Remote Code** declaration (see above)
- [ ] Add at least 1 screenshot (1280×800 recommended)
- [ ] Add a **Privacy Policy URL** pointing to the hosted PRIVACY_POLICY.md
- [ ] Certify data usage compliance by checking the box
- [ ] Submit for review

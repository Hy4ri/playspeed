# Chrome Web Store Submission Guide — PlaySpeed

---

## Privacy Practices Tab — Justification Texts

Copy and paste the following into each field on the **Privacy Practices** tab of the Chrome Web Store Developer Dashboard.

---

### Single Purpose Description

> PlaySpeed allows users to control and enforce a consistent playback speed on all HTML `<video>` and `<audio>` elements across any website.

---

### Permission Justifications

#### `storage`

> PlaySpeed uses the `storage` permission to save two user preferences locally via `chrome.storage.local`: the selected playback speed (e.g., 1.5x) and an optional list of hostnames to exclude from speed control. These settings persist across browser sessions so users don't need to reconfigure the extension every time they open a new tab.

#### `activeTab`

> PlaySpeed uses the `activeTab` permission to communicate with the content script running in the user's currently active tab. When the user changes the speed in the popup, `activeTab` allows the popup to send a message (`chrome.tabs.sendMessage`) to the content script so it can immediately apply the new speed. It also allows the popup to read the active tab's URL via `chrome.tabs.query` in order to determine the current hostname for the "Exclude this site" feature.

#### `<all_urls>` (Host Permission)

> PlaySpeed requires `<all_urls>` host permission to inject its content script (`content.js`) into every webpage the user visits. This is necessary because video and audio elements can appear on any site — including streaming platforms, social media, educational sites, news articles, and embedded players in iframes. The content script detects `<video>` and `<audio>` elements and enforces the user's chosen playback speed. Without `<all_urls>`, the extension would only work on a pre-approved list of sites, defeating its core purpose of universal speed control.

---

### Remote Code

> **Does your extension use remote code?** No
>
> PlaySpeed does not execute, load, or evaluate any remote code. All JavaScript, HTML, and CSS files are bundled statically with the extension. No `eval()`, `Function()`, `setTimeout`/`setInterval` with string arguments, or dynamically fetched scripts are used. The extension has no network requests for code execution.

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

- [ ] Run `bash package.sh` to generate `playspeed-v1.4.3.zip`
- [ ] Upload the ZIP to the Developer Dashboard
- [ ] Paste the **Single Purpose Description** (see above)
- [ ] Paste all **Permission Justifications** (see above)
- [ ] Paste the **Remote Code** declaration (see above)
- [ ] Add at least 1 screenshot (1280×800 recommended)
- [ ] Add a **Privacy Policy URL** pointing to the hosted PRIVACY_POLICY.md
- [ ] Certify data usage compliance by checking the box
- [ ] Submit for review

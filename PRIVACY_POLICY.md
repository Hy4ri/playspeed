# Privacy Policy for PlaySpeed

**Last updated:** July 10, 2026

## Overview

PlaySpeed is a Chrome extension that lets users control the playback speed of HTML video and audio elements on any webpage. This privacy policy explains what data PlaySpeed does and does not collect.

## Data Collection

**PlaySpeed does NOT collect, store, transmit, or share any personal data.**

Specifically, PlaySpeed:

- **Does NOT** collect personal information (name, email, address, etc.)
- **Does NOT** track browsing history or visited websites
- **Does NOT** use analytics, cookies, or tracking pixels
- **Does NOT** transmit any data to remote servers
- **Does NOT** make any network requests at all
- **Does NOT** display advertisements
- **Does NOT** sell or share any user data

## Local Storage

PlaySpeed uses the `chrome.storage.local` API to store three settings locally on your device:

1. **Playback speed preference** — the speed value you last selected (e.g., `1.5`)
2. **Exclusion list** — hostnames you have chosen to exclude from speed control
3. **Live-stream override** — a boolean toggle controlling whether your chosen speed is applied to live streams

These settings never leave your browser. They are stored locally and used solely to persist your preferences across browser sessions.

## Permissions Explained

PlaySpeed requires the following permissions:

| Permission | Purpose |
|---|---|
| `storage` | Save your speed preference, exclusion list, and live-override toggle locally |
| `activeTab` | Communicate with the content script in the active tab |
| `<all_urls>` (host permission) | Run the content script on every webpage so video and audio elements can be detected and speed-controlled. No page content is read, collected, or transmitted. |

## YouTube Live Detection (Web-Accessible Resource)

To accurately detect whether the current YouTube video is a live stream, PlaySpeed injects a small bundled script (`yt-bridge.js`) into YouTube pages only. This script runs in the page's MAIN world, reads the page's existing `ytInitialPlayerResponse` JavaScript variable, and posts the video's live status (a single boolean) back to the content script via `postMessage`.

- This script is bundled with the extension — it is **not** fetched from a remote server.
- It is restricted to `youtube.com` and `youtu.be` only — it cannot be loaded by any other website.
- An authentication token verified on the receiving end prevents spoofing by third-party page scripts.
- No page content, watch history, account information, or any other data is read, stored, or transmitted. Only the boolean live status of the current video is used.

## Third-Party Services

PlaySpeed does **not** use any third-party services, analytics providers, or external APIs.

## Children's Privacy

PlaySpeed does not knowingly collect any personal information from children under the age of 13.

## Changes to This Policy

If this privacy policy is updated, the "Last updated" date at the top will reflect the change. Users are encouraged to review this policy periodically.

## Contact

If you have questions or concerns about this privacy policy, please contact:

**Hy4ri**  
GitHub: https://github.com/Hy4ri/playspeed  
Email: hy4ri@users.noreply.github.com

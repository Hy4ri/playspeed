# Privacy Policy for PlaySpeed

**Last updated:** May 19, 2026

## Overview

PlaySpeed is a Chrome extension that lets users control the playback speed of HTML video and audio elements on any webpage. This privacy policy explains what data PlaySpeed does and does not collect.

## Data Collection

**PlaySpeed does NOT collect, store, transmit, or share any personal data.**

Specifically, PlaySpeed:

- **Does NOT** collect personal information (name, email, address, etc.)
- **Does NOT** track browsing history or visited websites
- **Does NOT** use analytics, cookies, or tracking pixels
- **Does NOT** transmit any data to remote servers
- **Does NOT** display advertisements
- **Does NOT** sell or share any user data

## Local Storage

PlaySpeed uses the `chrome.storage.local` API to store two settings locally on your device:

1. **Playback speed preference** — the speed value you last selected (e.g., `1.5`)
2. **Exclusion list** — hostnames you have chosen to exclude from speed control

These settings never leave your browser. They are stored locally and used solely to persist your preferences across browser sessions.

## Permissions Explained

PlaySpeed requires the following permissions:

| Permission | Purpose |
|---|---|
| `storage` | Save your speed preference and exclusion list locally |
| `activeTab` | Communicate with the content script in the active tab |
| `<all_urls>` (host permission) | Run the content script on every webpage so video and audio elements can be detected and speed-controlled. No page content is read, collected, or transmitted. |

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

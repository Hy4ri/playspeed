# PlaySpeed

A Chrome extension that forces all HTML video and audio players to play at your chosen speed.

## Features

- Set playback speed from **0.25x to 16x**
- Preset speed buttons (0.25, 0.5, 0.75, 1, 1.5, 1.75, 2, 2.5)
- Fine-tune with **+ / −** buttons (steps of 0.25)
- **Exclude specific sites** from speed control
- Works on dynamically loaded media (SPAs, infinite scroll)
- Settings persist across tabs and browser sessions

## Usage

1. Click the PlaySpeed icon in the toolbar.
2. Select a preset speed or use **+ / −** to adjust.
3. Speed applies instantly to all videos and audio on the current page.

### Excluding a site

- Click **Exclude this site** in the popup to stop PlaySpeed on the current domain.
- Manage all exclusions by clicking **Exclusions...** at the bottom of the popup.

## Installation

### From source (developer mode)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `playspeed` folder.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (Manifest V3) |
| `background.js` | Service worker — sets default settings on install |
| `content.js` | Injected into pages — applies speed to media elements |
| `popup.html` / `popup.js` / `popup.css` | Popup UI for speed control |
| `options.html` / `options.js` / `options.css` | Options page for managing exclusions |
| `icons/` | Extension icons (16, 32, 48, 128 px) |

## How it works

- A content script (`content.js`) runs on every page and watches for `<video>` and `<audio>` elements.
- When the speed changes in the popup, a message is sent to the content script to update all media elements.
- A `MutationObserver` catches dynamically added media (SPA navigations, infinite scroll).
- A `ratechange` event listener re-applies the speed if a website or user interaction overrides it.
- Excluded hostnames are stored in `chrome.storage.local` and checked before applying speed.

## License

MIT

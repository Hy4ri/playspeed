# PlaySpeed

A Chrome extension that forces all HTML video and audio players to play at your chosen speed.

## Features

- Set playback speed from **0.1x to 16x** (fine-tune with +/− buttons in 0.25 steps)
- Preset speed buttons (0.25, 0.5, 0.75, 1, 1.5, 1.75, 2, 2.5)
- **Live stream detection** — automatically caps speed at 1x on live streams, with an optional override toggle
- **Exclude specific sites** from speed control
- Works on dynamically loaded media (SPAs, infinite scroll, client-side navigation)
- **Override-resistant** — re-applies your speed if a website script attempts to change it
- Settings persist across tabs and browser sessions
- Dark and light themes (follows the OS preference)
- Keyboard shortcuts in the popup: ArrowUp/ArrowDown = ±0.25, ArrowLeft/ArrowRight = ±1, `0` = reset to 1x

## Usage

1. Click the PlaySpeed icon in the toolbar.
2. Select a preset speed or use **+ / −** to adjust.
3. Speed applies instantly to all videos and audio on the current page.

### Excluding a site

- Click **Exclude this site** in the popup to stop PlaySpeed on the current domain.
- Manage all exclusions by clicking **Exclusions…** at the bottom of the popup.

### Live streams

When PlaySpeed detects that the active tab is playing a live stream (YouTube and Twitch supported), it shows a small **Live** indicator in the popup. By default it leaves live streams at 1x so you don't skip past real-time content. Click **Override** in the popup to apply your chosen speed to live streams anyway.

## Installation

### From source (developer mode)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `playspeed` folder.

### Package for the Chrome Web Store

```bash
bash package.sh
```

This produces `playspeed-v{version}.zip` in the project root, ready to upload to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (Manifest V3) |
| `background.js` | Service worker — seeds default settings on install, migrates settings on update |
| `content.js` | Injected into pages — applies speed to media elements, detects live streams |
| `yt-bridge.js` | Web-accessible script injected into YouTube pages to read `ytInitialPlayerResponse` (live status) from the page's MAIN world |
| `popup.html` / `popup.js` / `popup.css` | Popup UI for speed control |
| `options.html` / `options.js` / `options.css` | Options page for managing exclusions |
| `package.sh` | Build script — produces a CWS-uploadable ZIP |
| `icons/` | Extension icons (16, 32, 48, 128 px) |
| `scripts/icon.svg` | Source SVG used to render the PNG icons |

## How it works

- A content script (`content.js`) runs on every page and watches for `<video>` and `<audio>` elements.
- When the speed changes in the popup, a message is sent to the content script to update all media elements. The content script also reacts to `chrome.storage.onChanged` so changes from other extension contexts (options page, other tabs) propagate.
- A `MutationObserver` catches dynamically added media (SPA navigations, infinite scroll).
- A `ratechange` event listener re-applies the speed if a website or user interaction overrides it. The listener uses a drift check (only rewrites when the rate differs from the target by more than 0.02) to avoid feedback loops.
- SPA navigation is detected via `popstate`, `history.pushState`/`replaceState` patching, and YouTube's `yt-navigate-finish` event (with a 1s polling fallback).
- **Live detection**: `video.duration === Infinity` is the primary signal, supplemented by site-specific signals. On YouTube, a small web-accessible script (`yt-bridge.js`) is injected into the page's MAIN world to read `ytInitialPlayerResponse.videoDetails.isLive` and post it back to the content script via `postMessage`. An auth token guards against spoofing by third-party page scripts.
- Excluded hostnames are stored in `chrome.storage.local` and checked before applying speed.

## Storage

PlaySpeed stores three settings locally in `chrome.storage.local`:

| Key | Type | Description |
|---|---|---|
| `speed` | number | The chosen playback speed (default `1.0`) |
| `exclusions` | string[] | List of hostnames to skip (default `[]`) |
| `liveOverride` | boolean | Whether to apply the chosen speed to live streams (default `false`) |

Nothing is ever transmitted off the device.

## Privacy

PlaySpeed does not collect, store, or transmit any personal data. See [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) for the full policy.

## License

MIT — see [`LICENSE`](LICENSE).

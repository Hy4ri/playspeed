# Chrome Web Store Listing — PlaySpeed

---

## Short Description (max 132 characters)

Force any HTML video or audio player to play at your chosen speed. Exclude specific sites.

---

## Detailed Description

PlaySpeed gives you full control over HTML5 video and audio playback speed on any website. Whether you want to speed through lectures at 2x, slow down tutorials to 0.5x, or push media to 16x, PlaySpeed makes it instant.

### Features

- **Adjustable speed 0.1x–16x** — fine-tune with +/- 0.25-step buttons (keyboard shortcuts also supported)
- **Preset buttons** — one-click speeds: 0.25, 0.5, 0.75, 1, 1.5, 1.75, 2, 2.5
- **Live stream detection** — automatically caps speed at 1x on live streams (YouTube, Twitch) so you don't skip past real-time content; an in-popup Override toggle lets you push past 1x on demand
- **Site exclusions** — exclude specific hostnames so PlaySpeed leaves them alone; manage them in a dedicated options page or with one click from the popup
- **Works everywhere** — applies to all `<video>` and `<audio>` elements on any page, including iframes
- **Dynamic content** — detects media added after page load (SPAs, infinite scroll, client-side navigation)
- **Override-resistant** — re-applies your speed if a website script attempts to change it
- **Persistent settings** — your speed preference, exclusion list, and live-override preference are saved across sessions
- **Light & dark themes** — matches your OS appearance
- **No tracking, no ads, no network requests** — your settings never leave your browser

### How to use

1. Click the PlaySpeed icon in the Chrome toolbar
2. Select a preset speed or use the +/- buttons to fine-tune
3. Speed applies instantly to all videos and audio on the current page

To exclude a site, open the popup and click "Exclude this site." Manage all exclusions on the dedicated options page (link at the bottom of the popup).

### Keyboard shortcuts (in popup)

- **↑ / ↓** — adjust speed by 0.25
- **← / →** — adjust speed by 1
- **0** — reset to 1x

### Permissions

PlaySpeed uses only the permissions it needs:

- **storage** — saves your speed preference, exclusion list, and live-override toggle locally
- **activeTab** — communicates with the content script on the current page
- **<all_urls>** — injects a content script to detect and control media elements on all web pages. No page content is collected or transmitted.

### Privacy

PlaySpeed does not collect, store, or transmit any personal data. All settings are stored locally in your browser. No analytics, no tracking, no third-party services, no network requests.

---

## Category

Productivity

---

## Language

English (en)

---

## Support

https://github.com/Hy4ri/playspeed

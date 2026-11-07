# YT Clean Feed

A Firefox extension (desktop and Android) that cleans up YouTube without replacing it. You stay signed in to your real account, and your subscriptions and recommendations work as usual.

## What it does

- **Hides creator posts** (community/backstage posts) from the feed.
- **Flags likely AI-generated videos** using a channel blocklist and keywords in titles. Flagged videos are dimmed with a red badge, or hidden entirely.

Shorts hiding is intentionally left out; use a dedicated extension for that.

## Settings (for now)

Edit the top of `content.js`:

- `MODE`: `"dim"` or `"hide"`
- `BLOCKED_CHANNELS`: lowercase channel names to always flag
- `AI_WORDS`: regex of telltale phrases

A proper settings page is planned.

## Try it on desktop Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `manifest.json`.
3. Visit youtube.com (or m.youtube.com).

## Install on Firefox for Android

1. Zip the files in this folder, with `manifest.json` at the root of the zip.
2. Upload the zip to [addons.mozilla.org](https://addons.mozilla.org/developers/) as **unlisted**. Mozilla signs it, and it stays private.
3. Open the signed `.xpi` link on your phone in Firefox and install it.

To test without signing, use Firefox Nightly with a custom add-on collection, or `web-ext run -t firefox-android` over USB.

## Caveats

YouTube renames its page elements often. If posts start showing up again, inspect one with Firefox remote debugging and update `POST_SELECTORS` in `content.js`.

## Roadmap

- Settings page (dim/hide toggle, blocklist editor)
- Detect YouTube's "altered or synthetic content" label
- Scan comments for AI mentions via the YouTube Data API, with caching

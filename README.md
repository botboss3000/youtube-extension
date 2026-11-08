# YT Clean Feed

A Firefox extension (desktop and Android) that cleans up YouTube without replacing it. You stay signed in to your real account, and your subscriptions and recommendations work as usual.

## What it does

- **Hides creator posts** (community/backstage posts) from the feed.
- **Flags likely AI-generated videos** using a channel blocklist and keywords in titles. Flagged videos are dimmed with a red badge, or hidden entirely.

Shorts hiding is intentionally left out; use a dedicated extension for that.

## Settings

Open the settings page from the extension's toolbar button, or from **Add-ons → YT Clean Feed → Settings** (on Android: **⋮ menu → Extensions → YT Clean Feed**). Changes save automatically and apply to open YouTube tabs right away.

- **Hide creator posts**: on/off
- **Flagged videos**: dim with a badge showing the reason, or hide completely
- **Blocked channels**: one name per line, always flagged
- **AI keywords**: one phrase per line, case-insensitive; spaces also match hyphens

Defaults live in `defaults.js`.

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

YouTube renames its page elements often. If posts start showing up again, inspect one with Firefox remote debugging and update `POST_SELECTORS` / `VIDEO_SELECTORS` in `content.js`.

## Roadmap

- Detect YouTube's "altered or synthetic content" label
- Scan comments for AI mentions via the YouTube Data API, with caching

# YT Clean Feed

A Firefox extension (desktop and Android) that cleans up YouTube without replacing it. You stay signed in to your real account, and your subscriptions and recommendations work as usual.

## What it does

- **Hides creator posts** (community/backstage posts) from the feed.
- **Flags videos whose comments call them AI.** For each video in your feed it reads the top 100 comments through the YouTube Data API and counts how many match phrases like "ai slop" or "ai voice". Once enough do (3 by default), the video is dimmed with a red badge, or hidden.
- **Blocked channels**: videos from channels you list are always flagged, with no API needed.

Shorts hiding is intentionally left out; use a dedicated extension for that.

## Settings

Open the settings page from the extension's toolbar button, or from **Add-ons → YT Clean Feed → Settings** (on Android: **⋮ menu → Extensions → YT Clean Feed**). Changes save automatically and apply to open YouTube tabs right away.

- **Hide creator posts**: on/off
- **Flagged videos**: dim with a badge showing the reason, or hide completely
- **YouTube Data API key**: needed for the comment scanner (see below)
- **Threshold**: how many top comments must mention AI before a video is flagged
- **AI phrases in comments**: one per line, case-insensitive; spaces also match hyphens
- **Blocked channels**: one name per line

Defaults live in `defaults.js`.

## Getting an API key

1. In the [Google Cloud Console](https://console.cloud.google.com/), pick or create a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Edit the key: under **API restrictions** choose **Restrict key → YouTube Data API v3**. Leave **Application restrictions** set to **None**; website or Android-app restrictions block requests from the extension.
5. Paste the key into the extension's settings page. It is stored only in the extension's local storage on that device.

### Quota

The free quota is 10,000 units a day (resets at midnight Pacific). Each video check costs 1 unit, however many comments come back, and results are cached for a week, so normal browsing uses a small fraction. The settings page shows today's usage. If the quota runs out, checks pause and resume automatically.

### Privacy

The video IDs in your feed are sent to Google's API along with your key. Nothing else leaves your device, and no account sign-in is involved.

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
- Weigh comments by likes, and ignore ones that deny it ("this isn't AI")

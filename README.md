# YT Clean Feed

A Firefox extension (desktop and Android) that cleans up YouTube without replacing it. You stay signed in to your real account, and your subscriptions and recommendations work as usual.

## What it does

- **Hides creator posts** (community/backstage posts) from the feed.
- **Flags videos whose comments call them AI.** For each video in your feed it reads the top 100 comments through the YouTube Data API and counts how many match phrases like "ai slop" or "ai voice". Once enough do (3 by default), the video is dimmed with a red badge, or hidden.
- **Mark as AI**: a button on each video's page flags it on your device for good. It can also open the comment box and fill in your comment (default "AI slop."); you tap Post yourself.
- **Blocked channels**: videos from channels you list are always flagged, with no API needed.

Shorts hiding is intentionally left out; use a dedicated extension for that.

## Settings

Open the settings page from the extension's toolbar button, or from **Add-ons → YT Clean Feed → Settings** (on Android: **⋮ menu → Extensions → YT Clean Feed**). Changes save automatically and apply to open YouTube tabs right away.

- **Hide creator posts**: on/off
- **Flagged videos**: dim with a badge showing the reason, or hide completely
- **YouTube Data API key**: needed for the comment scanner (see below)
- **Threshold**: how many top comments must mention AI before a video is flagged
- **Re-check after N days**: blank (default) means a clean video is checked once; set a number to re-check clean results after that many days. Flagged videos are never re-checked, and clean videos with fewer than 20 comments get one automatic re-check after 3 days.
- **Mark as AI**: whether to fill in a comment, the comment text, and an optional sign-off line
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

The free quota is 10,000 units a day (resets at midnight Pacific). Each video check costs 1 unit, however many comments come back, and each result is saved (by default for good), so normal browsing uses a small fraction. The settings page shows today's usage. If the quota runs out, checks pause and resume automatically.

### Privacy

The video IDs in your feed are sent to Google's API along with your key. Nothing else leaves your device, and no account sign-in is involved. Because of this, Firefox lists "browsing activity" as data the extension shares when you install it. Requires Firefox 140+ on desktop or 142+ on Android.

## Try it on desktop Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `manifest.json`.
3. Visit youtube.com (or m.youtube.com).

## Install (desktop or Android)

Open the `.xpi` link from the [latest release](https://github.com/botboss3000/youtube-extension/releases/latest) in Firefox and accept the prompts. On Android, if tapping the link only downloads the file, enable **Settings → About Firefox → tap the logo 5 times**, then use **Settings → Install extension from file**.

Installed copies update themselves: Firefox checks `updates.json` (linked from `update_url` in the manifest) about once a day.

## Releasing a new version

1. Bump `version` in `manifest.json` and commit to `main`.
2. Push a matching tag, e.g. `git tag v0.6 && git push origin v0.6`.
3. The **Sign and release** workflow lints, signs the extension with Mozilla (unlisted), attaches the signed `.xpi` to a GitHub release, and adds it to `updates.json`.

The workflow needs two repository secrets, from [addons.mozilla.org API keys](https://addons.mozilla.org/developers/addon/api/key/):

- `AMO_JWT_ISSUER`: the "JWT issuer"
- `AMO_JWT_SECRET`: the "JWT secret"

## Caveats

YouTube renames its page elements often. If posts start showing up again, inspect one with Firefox remote debugging and update `POST_SELECTORS` / `VIDEO_SELECTORS` in `content.js`.

## Roadmap

- Detect YouTube's "altered or synthetic content" label
- Weigh comments by likes, and ignore ones that deny it ("this isn't AI")

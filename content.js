// YT Clean Feed: hides creator posts and flags videos whose comments call them AI.
// Settings come from browser.storage (edited on the options page).

const POST_SELECTORS = [
  "ytm-backstage-post-thread-renderer",
  "ytm-post-renderer",
  "ytd-backstage-post-thread-renderer",
  "ytd-post-renderer"
];
const VIDEO_SELECTORS = [
  "ytm-video-with-context-renderer",
  "ytm-compact-video-renderer",
  "ytm-rich-item-renderer",
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer"
].join(",");

let settings = { ...YCF_DEFAULTS };

// Mode and post hiding are pure CSS keyed off <html> attributes,
// so changing them in settings takes effect instantly.
const style = document.createElement("style");
style.textContent = `
  html[data-ycf-posts="on"] .ycf-post { display: none !important; }
  [data-ycf-flag] { position: relative; }
  html[data-ycf-mode="dim"] [data-ycf-flag] > * { opacity: 0.3; }
  html[data-ycf-mode="hide"] [data-ycf-flag] { display: none !important; }
  /* Badge is drawn with CSS so its text never ends up in innerText. */
  [data-ycf-flag]::after {
    content: "Flagged: " attr(data-ycf-flag);
    position: absolute; top: 4px; left: 4px; z-index: 9;
    background: #c00; color: #fff; font: 600 11px/1.4 sans-serif;
    padding: 2px 6px; border-radius: 4px; pointer-events: none;
  }
`;
(document.head || document.documentElement).appendChild(style);

function applySettings(s) {
  settings = { ...YCF_DEFAULTS, ...s };
  const root = document.documentElement;
  root.dataset.ycfPosts = settings.hidePosts ? "on" : "off";
  root.dataset.ycfMode = settings.mode;
}

function clearFlags() {
  document.querySelectorAll("[data-ycf-flag]").forEach(el => delete el.dataset.ycfFlag);
  document.querySelectorAll("[data-ycf-sig]").forEach(el => delete el.dataset.ycfSig);
}

function videoIdOf(el) {
  for (const a of el.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    let m = href.match(/[?&]v=([\w-]{11})/) || href.match(/\/shorts\/([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

function blockedChannel(text) {
  const t = text.toLowerCase();
  return settings.blockedChannels.some(c => c && t.includes(c.toLowerCase()));
}

function setFlag(el, reason) {
  if (reason) el.dataset.ycfFlag = reason;
  else delete el.dataset.ycfFlag;
}

function scan() {
  document.querySelectorAll(POST_SELECTORS.join(",")).forEach(el => {
    const target = el.closest("ytm-rich-section-renderer, ytd-rich-section-renderer") || el;
    target.classList.add("ycf-post");
  });

  document.querySelectorAll(VIDEO_SELECTORS).forEach(el => {
    // Skip nested matches (e.g. a video renderer inside a rich item).
    if (el.parentElement && el.parentElement.closest(VIDEO_SELECTORS)) return;
    const id = videoIdOf(el);
    const text = el.innerText || "";
    // YouTube reuses elements while scrolling, so re-check when the content changes.
    const sig = (id || "") + "|" + text.slice(0, 200);
    if (el.dataset.ycfSig === sig) return;
    el.dataset.ycfSig = sig;
    setFlag(el, null);

    if (blockedChannel(text)) { setFlag(el, "blocked channel"); return; }
    if (!id || !settings.apiKey.trim()) return;

    browser.runtime.sendMessage({ type: "check", videoId: id }).then(r => {
      if (el.dataset.ycfSig !== sig || !r || r.skip) return; // element was recycled meanwhile
      if (r.m >= settings.minMatches) {
        setFlag(el, r.m === 1 ? "1 comment mentions AI" : `${r.m} comments mention AI`);
      }
    }).catch(() => {});
  });
}

let pending = false;
function scheduleScan() {
  if (pending) return;
  pending = true;
  setTimeout(() => { pending = false; scan(); }, 250);
}

browser.storage.local.get(YCF_DEFAULTS).then(s => {
  applySettings(s);
  scan();
  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
});

const RESCAN_KEYS = ["blockedChannels", "apiKey", "minMatches", "commentPhrases"];
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const next = { ...settings };
  let relevant = false;
  for (const k in changes) {
    if (k in YCF_DEFAULTS) { next[k] = changes[k].newValue; relevant = true; }
  }
  if (!relevant) return;
  applySettings(next);
  if (RESCAN_KEYS.some(k => k in changes)) { clearFlags(); scan(); }
});

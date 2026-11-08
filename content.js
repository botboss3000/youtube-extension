// YT Clean Feed: hides creator posts and flags likely AI videos.
// Settings come from browser.storage (edited on the options page).

const POST_SELECTORS = [
  "ytm-backstage-post-thread-renderer",
  "ytm-post-renderer",
  "ytd-backstage-post-thread-renderer",
  "ytd-post-renderer"
];
const VIDEO_SELECTORS = [
  "ytm-video-with-context-renderer",
  "ytm-rich-item-renderer",
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer"
];

let settings = { ...YCF_DEFAULTS };
let keywordRe = null;

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

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "ai generated" also matches "AI-generated" and "ai  generated".
function buildKeywordRe(words) {
  const parts = words
    .map(w => w.trim().toLowerCase())
    .filter(Boolean)
    .map(w => escapeRe(w).replace(/[\s-]+/g, "[\\s-]+"));
  if (!parts.length) return null;
  return new RegExp(`(?<![a-z0-9])(${parts.join("|")})(?![a-z0-9])`, "i");
}

function applySettings(s) {
  settings = { ...YCF_DEFAULTS, ...s };
  keywordRe = buildKeywordRe(settings.aiKeywords);
  const root = document.documentElement;
  root.dataset.ycfPosts = settings.hidePosts ? "on" : "off";
  root.dataset.ycfMode = settings.mode;
}

function clearFlags() {
  document.querySelectorAll("[data-ycf-flag]").forEach(el => {
    delete el.dataset.ycfFlag;
  });
  document.querySelectorAll("[data-ycf-sig]").forEach(el => delete el.dataset.ycfSig);
}

function reasonFor(text) {
  const t = text.toLowerCase();
  const ch = settings.blockedChannels.find(c => c && t.includes(c.toLowerCase()));
  if (ch) return "blocked channel";
  const m = keywordRe && t.match(keywordRe);
  if (m) return `AI keyword: "${m[1]}"`;
  return null;
}

function scan() {
  document.querySelectorAll(POST_SELECTORS.join(",")).forEach(el => {
    const target = el.closest("ytm-rich-section-renderer, ytd-rich-section-renderer") || el;
    target.classList.add("ycf-post");
  });

  document.querySelectorAll(VIDEO_SELECTORS.join(",")).forEach(el => {
    // Skip nested matches (e.g. a video renderer inside a rich item).
    if (el.parentElement && el.parentElement.closest(VIDEO_SELECTORS.join(","))) return;
    const text = el.innerText || "";
    // YouTube reuses elements while scrolling, so re-check when the text changes.
    const sig = text.slice(0, 300);
    if (el.dataset.ycfSig === sig) return;
    el.dataset.ycfSig = sig;

    const reason = reasonFor(text);
    if (reason) el.dataset.ycfFlag = reason;
    else delete el.dataset.ycfFlag;
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

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const next = { ...settings };
  for (const k in changes) next[k] = changes[k].newValue;
  const listsChanged = "blockedChannels" in changes || "aiKeywords" in changes;
  applySettings(next);
  if (listsChanged) { clearFlags(); scan(); }
});

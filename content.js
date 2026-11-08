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
  #ycf-mark {
    position: fixed; right: 12px; bottom: 80px; z-index: 2147483000;
    padding: 10px 16px; border: 0; border-radius: 999px;
    background: #c00; color: #fff; font: 600 14px/1 sans-serif;
    box-shadow: 0 2px 10px rgba(0,0,0,.35); cursor: pointer;
  }
  #ycf-mark.on { background: #333; }
  #ycf-toast {
    position: fixed; left: 50%; bottom: 136px; z-index: 2147483001;
    transform: translateX(-50%) translateY(12px); opacity: 0;
    max-width: calc(100vw - 32px); padding: 10px 14px; border-radius: 10px;
    background: #222; color: #fff; font: 14px/1.35 sans-serif; text-align: center;
    box-shadow: 0 2px 10px rgba(0,0,0,.35); pointer-events: none;
    transition: opacity .2s, transform .2s;
  }
  #ycf-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
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

// ---- Mark as AI (watch page) ----

function watchVideoId() {
  const m = location.pathname === "/watch" ? new URLSearchParams(location.search).get("v")
    : (location.pathname.match(/^\/shorts\/([\w-]{11})/) || [])[1];
  return m && /^[\w-]{11}$/.test(m) ? m : null;
}

function toast(msg) {
  let t = document.getElementById("ycf-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "ycf-toast";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3500);
}

const wait = ms => new Promise(r => setTimeout(r, ms));

const EDITOR_SELECTORS = [
  "ytm-comment-simplebox-renderer textarea",
  "ytm-comment-simplebox-renderer [contenteditable='true']",
  "#contenteditable-root[contenteditable='true']",
  "textarea[placeholder*='comment' i]",
  "[contenteditable='true'][aria-label*='comment' i]"
].join(",");
// Later steps first: once the panel is open, tap "Add a comment", not the header again.
const OPENER_SELECTORS = [
  "ytm-comment-simplebox-renderer button",           // mobile: "Add a comment..."
  ".comment-simplebox-renderer-collapsed-message",
  "[aria-label*='Add a comment' i]",
  "ytd-comment-simplebox-renderer #simplebox-placeholder", // desktop
  "ytm-comments-entry-point-header-renderer"         // mobile: opens the comments panel
];

function insertText(editor, text) {
  editor.focus();
  // execCommand fires the input events YouTube's own code listens for.
  if (document.execCommand && document.execCommand("insertText", false, text)) return;
  if ("value" in editor) editor.value = text; else editor.textContent = text;
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
}

// Best effort: open YouTube's comment box and type the text. The user taps Post.
async function fillComment(text) {
  const comments = document.querySelector("ytd-comments#comments");
  if (comments) { comments.scrollIntoView({ block: "start" }); await wait(800); }
  for (let attempt = 0; attempt < 8; attempt++) {
    const editor = document.querySelector(EDITOR_SELECTORS);
    if (editor) { insertText(editor, text); return true; }
    const opener = OPENER_SELECTORS.map(s => document.querySelector(s)).find(Boolean);
    if (opener) { opener.scrollIntoView({ block: "center" }); opener.click(); }
    await wait(500);
  }
  return false;
}

function commentToPost() {
  return [settings.commentText.trim(), settings.signOff.trim()].filter(Boolean).join("\n");
}

async function onMarkTap() {
  const id = watchVideoId();
  if (!id) return;
  const willComment = !settings.marked[id] && settings.markComment && commentToPost();
  const copying = willComment ? navigator.clipboard.writeText(commentToPost()).then(() => true, () => false) : null;
  const marked = { ...settings.marked };
  if (marked[id]) {
    delete marked[id];
    await browser.storage.local.set({ marked });
    toast("Unmarked.");
    return;
  }
  marked[id] = Date.now();
  await browser.storage.local.set({ marked });
  if (!willComment) { toast("Marked as AI."); return; }
  const copied = await Promise.race([copying, wait(1000).then(() => false)]);
  const filled = await fillComment(commentToPost());
  if (filled) toast("Marked as AI. Comment is filled in; tap Post to send it.");
  else if (copied) toast("Marked as AI. Comment copied; paste it in the comments and tap Post.");
  else toast("Marked as AI. Couldn't open the comment box.");
}

function updateWatchButton() {
  const id = watchVideoId();
  let btn = document.getElementById("ycf-mark");
  if (!id) { if (btn) btn.remove(); return; }
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "ycf-mark";
    btn.type = "button";
    btn.addEventListener("click", onMarkTap);
    document.body.appendChild(btn);
  }
  const isMarked = !!settings.marked[id];
  const label = isMarked ? "✓ Marked as AI" : "Mark as AI";
  if (btn.textContent !== label) btn.textContent = label;
  btn.classList.toggle("on", isMarked);
  btn.setAttribute("aria-pressed", String(isMarked));
}

function scan() {
  updateWatchButton();
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

    if (id && settings.marked[id]) { setFlag(el, "marked by you"); return; }
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

const RESCAN_KEYS = ["blockedChannels", "apiKey", "minMatches", "commentPhrases", "marked"];
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
  else updateWatchButton();
});

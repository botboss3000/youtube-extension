const MODE = "dim"; // "dim" or "hide"
const BLOCKED_CHANNELS = ["example ai channel"];
const AI_WORDS = /\b(ai[- ]generated|ai voice|made with ai|sora|midjourney)\b/i;

const POST_SELECTORS = [
  "ytm-backstage-post-thread-renderer",
  "ytm-post-renderer",
  "ytd-backstage-post-thread-renderer",
  "ytd-post-renderer"
];
const VIDEO_SELECTORS = [
  "ytm-video-with-context-renderer",
  "ytm-rich-item-renderer",
  "ytd-rich-item-renderer"
];

function flag(el, reason) {
  if (el.dataset.ycf) return;
  el.dataset.ycf = reason;
  if (MODE === "hide") { el.style.display = "none"; return; }
  el.style.opacity = "0.3";
  el.style.position = "relative";
  const badge = document.createElement("div");
  badge.textContent = "Flagged: " + reason;
  badge.style.cssText = "position:absolute;top:4px;left:4px;background:#c00;color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;z-index:9";
  el.appendChild(badge);
}

function scan() {
  document.querySelectorAll(POST_SELECTORS.join(",")).forEach(el => {
    (el.closest("ytm-rich-section-renderer, ytd-rich-section-renderer") || el).style.display = "none";
  });
  document.querySelectorAll(VIDEO_SELECTORS.join(",")).forEach(el => {
    if (el.dataset.ycf) return;
    const text = el.innerText.toLowerCase();
    if (BLOCKED_CHANNELS.some(c => text.includes(c))) flag(el, "blocked channel");
    else if (AI_WORDS.test(text)) flag(el, "AI keywords");
  });
}

new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
scan();

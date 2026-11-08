const $ = id => document.getElementById(id);
const statusEl = $("status");
const HOSTS = { origins: ["*://m.youtube.com/*", "*://www.youtube.com/*", "https://www.googleapis.com/*"] };

const toLines = arr => (arr || []).join("\n");
const fromLines = text => [...new Set(text.split("\n").map(s => s.trim()).filter(Boolean))];

let statusTimer;
function showStatus(msg) {
  statusEl.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.textContent = ""; }, 1500);
}

async function save(partial) {
  await browser.storage.local.set(partial);
  showStatus("Saved");
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function render(s) {
  $("hidePosts").checked = s.hidePosts;
  document.querySelector(`input[name="mode"][value="${s.mode}"]`).checked = true;
  $("apiKey").value = s.apiKey;
  $("minMatches").value = s.minMatches;
  $("recheckDays").value = s.recheckDays > 0 ? s.recheckDays : "";
  $("commentPhrases").value = toLines(s.commentPhrases);
  $("markComment").checked = s.markComment;
  $("commentText").value = s.commentText;
  $("signOff").value = s.signOff;
  renderMarked(s.marked);
  $("blockedChannels").value = toLines(s.blockedChannels);
}

function renderMarked(marked) {
  const n = Object.keys(marked || {}).length;
  $("markedCount").textContent = n ? `You've marked ${n.toLocaleString()} video${n === 1 ? "" : "s"}.` : "";
  $("clearMarks").hidden = !n;
}

function renderError(e) {
  const box = $("errorBox");
  box.hidden = !e;
  box.textContent = e ? e.msg : "";
}

async function refreshUsage() {
  try {
    const st = await browser.runtime.sendMessage({ type: "stats" });
    $("usage").textContent =
      `Used today: ${st.usedToday.toLocaleString()} of ${YCF_DAILY_QUOTA.toLocaleString()} units · ` +
      `${st.cached.toLocaleString()} videos saved`;
  } catch { $("usage").textContent = ""; }
}

async function refreshPerms() {
  try { $("permBox").hidden = await browser.permissions.contains(HOSTS); } catch { $("permBox").hidden = true; }
}

browser.storage.local.get({ ...YCF_DEFAULTS, lastError: null }).then(s => {
  render(s);
  renderError(s.lastError);
});
refreshUsage();
refreshPerms();
setInterval(refreshUsage, 5000);

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if ("lastError" in changes) renderError(changes.lastError.newValue);
  if ("marked" in changes) renderMarked(changes.marked.newValue);
});

$("hidePosts").addEventListener("change", e => save({ hidePosts: e.target.checked }));
document.querySelectorAll('input[name="mode"]').forEach(r =>
  r.addEventListener("change", e => save({ mode: e.target.value }))
);

const saveKey = () => save({ apiKey: $("apiKey").value.trim() });
$("apiKey").addEventListener("input", debounce(saveKey, 800));
$("apiKey").addEventListener("blur", saveKey);
$("toggleKey").addEventListener("click", () => {
  const input = $("apiKey");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("toggleKey").textContent = show ? "Hide" : "Show";
});

$("minMatches").addEventListener("change", e => {
  const v = parseInt(e.target.value, 10);
  const n = Number.isNaN(v) ? YCF_DEFAULTS.minMatches : Math.min(50, Math.max(1, v));
  e.target.value = n;
  save({ minMatches: n });
});

$("recheckDays").addEventListener("change", e => {
  const v = parseInt(e.target.value, 10);
  const n = Number.isNaN(v) || v <= 0 ? 0 : Math.min(3650, v);
  e.target.value = n > 0 ? n : "";
  save({ recheckDays: n });
});

for (const key of ["commentPhrases", "blockedChannels"]) {
  const el = $(key);
  let last = null;
  const saveList = () => {
    const val = fromLines(el.value);
    const json = JSON.stringify(val);
    if (json === last) return; // avoid needless cache clears
    last = json;
    save({ [key]: val });
  };
  browser.storage.local.get({ [key]: YCF_DEFAULTS[key] }).then(s => { last = JSON.stringify(s[key]); });
  el.addEventListener("input", debounce(saveList, 800));
  el.addEventListener("blur", saveList);
}

$("markComment").addEventListener("change", e => save({ markComment: e.target.checked }));
for (const key of ["commentText", "signOff"]) {
  const el = $(key);
  const saveText = () => save({ [key]: el.value.trim() });
  el.addEventListener("input", debounce(saveText, 800));
  el.addEventListener("blur", saveText);
}

$("clearMarks").addEventListener("click", async () => {
  if (!confirm("Remove all videos you marked as AI?")) return;
  await save({ marked: {} });
});

$("resetPhrases").addEventListener("click", () => {
  $("commentPhrases").value = toLines(YCF_DEFAULTS.commentPhrases);
  $("commentPhrases").dispatchEvent(new Event("blur"));
});

$("clearCache").addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "clearCache" });
  showStatus("Cleared");
  refreshUsage();
});

$("grantPerm").addEventListener("click", async () => {
  await browser.permissions.request(HOSTS);
  refreshPerms();
});

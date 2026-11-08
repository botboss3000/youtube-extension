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
  $("commentPhrases").value = toLines(s.commentPhrases);
  $("blockedChannels").value = toLines(s.blockedChannels);
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
  if (area === "local" && "lastError" in changes) renderError(changes.lastError.newValue);
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

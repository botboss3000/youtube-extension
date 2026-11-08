const $ = id => document.getElementById(id);
const statusEl = $("status");

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

function render(s) {
  $("hidePosts").checked = s.hidePosts;
  document.querySelector(`input[name="mode"][value="${s.mode}"]`).checked = true;
  $("blockedChannels").value = toLines(s.blockedChannels);
  $("aiKeywords").value = toLines(s.aiKeywords);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

browser.storage.local.get(YCF_DEFAULTS).then(render);

$("hidePosts").addEventListener("change", e => save({ hidePosts: e.target.checked }));

document.querySelectorAll('input[name="mode"]').forEach(r =>
  r.addEventListener("change", e => save({ mode: e.target.value }))
);

for (const key of ["blockedChannels", "aiKeywords"]) {
  const el = $(key);
  const saveList = () => save({ [key]: fromLines(el.value) });
  el.addEventListener("input", debounce(saveList, 600));
  el.addEventListener("blur", saveList);
}

$("resetKeywords").addEventListener("click", () => {
  $("aiKeywords").value = toLines(YCF_DEFAULTS.aiKeywords);
  save({ aiKeywords: YCF_DEFAULTS.aiKeywords });
});

// YT Clean Feed background: fetches top comments via the YouTube Data API,
// counts how many mention AI, and caches the result per video.

const API = "https://www.googleapis.com/youtube/v3/commentThreads";
const DAY = 24 * 3600 * 1000;
// Results with any AI mentions are kept forever. Clean results are capped so
// storage stays small; the oldest clean ones are dropped first.
const CLEAN_MAX = 50000;
// A clean result based on only a few comments gets one more look later,
// since AI call-outs often arrive after the first check.
const FEW_COMMENTS = 20;
const EARLY_RECHECK_DAYS = 3;
const CONCURRENCY = 3;

let cache = null;      // { videoId: { m: matches, n: comments, t: timestamp, off?: true } }
let usage = null;      // { day: "YYYY-MM-DD" (Pacific), count }
let saveTimer = null;
let pausedUntil = 0;
let active = 0;
const queue = [];
const inflight = new Map();

// The API quota resets at midnight Pacific time.
function pacificDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

async function load() {
  if (cache && usage) return;
  const s = await browser.storage.local.get({ cache: {}, usage: { day: "", count: 0 } });
  cache = cache || s.cache;
  usage = usage || s.usage;
}

let recheckDays = YCF_DEFAULTS.recheckDays;
let minMatches = YCF_DEFAULTS.minMatches;
browser.storage.local.get({ recheckDays, minMatches }).then(s => {
  recheckDays = s.recheckDays;
  minMatches = s.minMatches;
});

// Flagged results never expire. Clean ones are re-checked once early if they
// were based on few comments, and after `recheckDays` if the user set one.
function stale(entry) {
  if (entry.off) return recheckDays > 0 && Date.now() - entry.t > recheckDays * DAY;
  if (entry.m >= minMatches) return false;
  const age = Date.now() - entry.t;
  if (!entry.rc && entry.n < FEW_COMMENTS && age > EARLY_RECHECK_DAYS * DAY) return true;
  return recheckDays > 0 && age > recheckDays * DAY;
}

function prune() {
  const entries = Object.entries(cache);
  const mentioned = entries.filter(([, v]) => v.m > 0);
  const clean = entries.filter(([, v]) => !(v.m > 0)).sort((a, b) => b[1].t - a[1].t).slice(0, CLEAN_MAX);
  cache = Object.fromEntries([...mentioned, ...clean]);
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    prune();
    browser.storage.local.set({ cache, usage });
  }, 1500);
}

function countUnit() {
  const day = pacificDay();
  if (usage.day !== day) usage = { day, count: 0 };
  usage.count++;
}

function setError(msg) {
  browser.storage.local.set({ lastError: msg ? { msg, t: Date.now() } : null });
}

class StopError extends Error {}

async function fetchComments(videoId, apiKey) {
  const url = `${API}?part=snippet&maxResults=100&order=relevance&textFormat=plainText` +
    `&videoId=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  countUnit();
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    return (body.items || []).map(i => i.snippet.topLevelComment.snippet.textDisplay || "");
  }
  const reason = body.error?.errors?.[0]?.reason || "";
  if (reason === "commentsDisabled" || reason === "videoNotFound" || res.status === 404) return null;
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "rateLimitExceeded") {
    pausedUntil = Date.now() + 3600 * 1000;
    setError("Daily API quota used up. Comment checks are paused for an hour.");
    throw new StopError(reason);
  }
  if (res.status === 400 || res.status === 403) {
    pausedUntil = Date.now() + 10 * 60 * 1000;
    setError("API key problem: " + (body.error?.message || reason || res.status) +
      " Check the key in settings; retrying in 10 minutes.");
    throw new StopError(reason);
  }
  throw new Error(reason || String(res.status));
}

async function runCheck(videoId) {
  const s = await browser.storage.local.get({ apiKey: YCF_DEFAULTS.apiKey, commentPhrases: YCF_DEFAULTS.commentPhrases });
  const texts = await fetchComments(videoId, s.apiKey.trim());
  const re = ycfBuildPhraseRe(s.commentPhrases);
  const entry = texts === null
    ? { m: 0, n: 0, off: true, t: Date.now() }
    : { m: re ? texts.filter(t => re.test(t)).length : 0, n: texts.length, t: Date.now() };
  if (cache[videoId]) entry.rc = true; // this was a re-check
  cache[videoId] = entry;
  setError(null);
  persist();
  return entry;
}

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const { videoId, resolve } = queue.shift();
    active++;
    runCheck(videoId)
      .then(resolve, err => resolve({ skip: err instanceof StopError ? "stopped" : "error" }))
      .finally(() => { active--; inflight.delete(videoId); pump(); });
  }
}

async function check(videoId) {
  await load();
  const hit = cache[videoId];
  if (hit && !stale(hit)) return hit;
  const { apiKey } = await browser.storage.local.get({ apiKey: "" });
  if (!apiKey.trim()) return { skip: "nokey" };
  if (Date.now() < pausedUntil) return { skip: "paused" };
  if (inflight.has(videoId)) return inflight.get(videoId);
  const p = new Promise(resolve => queue.push({ videoId, resolve }));
  inflight.set(videoId, p);
  pump();
  return p;
}

async function stats() {
  await load();
  const today = usage.day === pacificDay() ? usage.count : 0;
  return { usedToday: today, cached: Object.keys(cache).length };
}

browser.runtime.onMessage.addListener(msg => {
  if (msg?.type === "check" && typeof msg.videoId === "string") return check(msg.videoId);
  if (msg?.type === "stats") return stats();
  if (msg?.type === "clearCache") {
    cache = {};
    persist();
    return Promise.resolve(true);
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // Cached counts depend on the phrase list, so start over when it changes.
  if ("commentPhrases" in changes && cache) { cache = {}; persist(); }
  if ("apiKey" in changes) { pausedUntil = 0; setError(null); }
  if ("recheckDays" in changes) recheckDays = changes.recheckDays.newValue || 0;
  if ("minMatches" in changes) minMatches = changes.minMatches.newValue || YCF_DEFAULTS.minMatches;
});

browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.remove("aiKeywords"); // title-keyword setting from v0.2
});

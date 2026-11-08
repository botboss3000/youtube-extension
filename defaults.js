// Shared defaults and helpers, loaded by content, background and options scripts.
const YCF_DEFAULTS = {
  hidePosts: true,
  mode: "dim", // "dim" or "hide"
  blockedChannels: [],
  apiKey: "",
  minMatches: 3, // flag when at least this many top comments mention AI
  recheckDays: 0, // re-check a clean video's comments after this many days; 0 = never
  marked: {}, // { videoId: timestamp } videos you marked as AI yourself; never expire
  markComment: true, // fill in a comment when marking a video
  commentText: "AI slop.",
  signOff: "", // optional extra line added under the comment
  commentPhrases: [
    "ai slop",
    "ai generated",
    "made with ai",
    "this is ai",
    "it's ai",
    "its ai",
    "is this ai",
    "ai voice",
    "ai narrator",
    "ai narration",
    "ai video",
    "ai channel",
    "ai garbage",
    "ai content",
    "ai art",
    "ai script",
    "chatgpt script",
    "written by chatgpt",
    "made with sora",
    "veo 3"
  ]
};

const YCF_DAILY_QUOTA = 10000;

function ycfEscapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "ai generated" also matches "AI-generated"; "it's" also matches "it’s".
function ycfBuildPhraseRe(phrases) {
  const parts = (phrases || [])
    .map(p => p.trim().toLowerCase())
    .filter(Boolean)
    .map(p => ycfEscapeRe(p).replace(/[\s-]+/g, "[\\s-]+").replace(/'/g, "['’]?"));
  if (!parts.length) return null;
  return new RegExp(`(?<![a-z0-9])(${parts.join("|")})(?![a-z0-9])`, "i");
}

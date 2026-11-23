/**
 * RAY Connect Bonanza: backend (Google Apps Script)
 * ---------------------------------------------------------------------------
 * This script lives inside a Google Sheet that you own. It:
 *   • checks that people are signed in with a work Google account
 *   • saves star ratings and judges' scores into the Sheet
 *   • publishes submitted games to the GitHub repository
 *
 * Setup steps are in backend/SETUP.md. You shouldn't need to edit this file:
 * all settings live in Project Settings → Script properties.
 * ---------------------------------------------------------------------------
 */

const TABS = {
  submissions: ["Timestamp", "Email", "Name", "Slug", "Title", "Authors", "AI used", "Blurb", "Emoji", "Version"],
  ratings: ["Updated", "Email", "Slug", "Stars"],
  judging: ["Updated", "Email", "Slug", "Silliness", "Playability", "Originality", "Presentation", "Wildcard", "Weighted total"]
};
const RUBRIC_MULTIPLIERS = [8, 4, 4, 2, 2];
const MAX_GAME_BYTES = 3 * 1024 * 1024;
const MAX_THUMB_BYTES = 1024 * 1024;

class UserError extends Error {
  constructor(message, code) { super(message); this.code = code || "user"; }
}

/* =========================== Entry points =========================== */

function doGet(e) {
  return respond(() => {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "stats") return { ok: true, ratings: ratingStats() };
    return { ok: true, message: "The RAY Connect Bonanza backend is running." };
  });
}

function doPost(e) {
  return respond(() => {
    let data;
    try { data = JSON.parse(e.postData.contents); } catch (err) { throw new UserError("The request was garbled. Please refresh and try again."); }
    const user = verifyUser(data.idToken);
    switch (data.action) {
      case "me": return me(user);
      case "rate": return rate(user, data);
      case "submit": return submit(user, data);
      case "judge": return judge(user, data);
      case "results": return results(user);
      default: throw new UserError("Unknown action.");
    }
  });
}

function respond(fn) {
  let out;
  try {
    out = fn();
  } catch (err) {
    if (!(err instanceof UserError)) console.error(err && err.stack || err);
    out = { ok: false, code: err.code || "server", error: err instanceof UserError ? err.message : "Something went wrong on our side. Please try again in a minute." };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* =========================== Settings =========================== */

function settings() {
  const p = PropertiesService.getScriptProperties().getProperties();
  const list = s => String(s || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  return {
    token: p.GITHUB_TOKEN || "",
    repo: (p.GITHUB_REPO || "").trim(),
    branch: (p.GITHUB_BRANCH || "main").trim(),
    clientId: (p.GOOGLE_CLIENT_ID || "").trim(),
    domains: list(p.ALLOWED_DOMAINS),
    judges: list(p.JUDGE_EMAILS),
    admins: list(p.ADMIN_EMAILS)
  };
}

// Reads the deadline and winners switch from the live config.js, so there's one source of truth.
function siteConfig() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("siteConfig");
  if (hit) return JSON.parse(hit);
  const text = githubGet("config.js").text;
  const pick = re => { const m = text.match(re); return m ? m[1] : null; };
  const cfg = {
    deadline: Date.parse(pick(/deadline:\s*"([^"]+)"/) || ""),
    winnersAnnounced: pick(/winnersAnnounced:\s*(true|false)/) === "true",
    minRatings: Number(pick(/minRatingsForPeoplesChoice:\s*(\d+)/) || 5)
  };
  cache.put("siteConfig", JSON.stringify(cfg), 120);
  return cfg;
}

/* =========================== Sign-in =========================== */

function verifyUser(idToken) {
  if (!idToken) throw new UserError("Please sign in first.", "auth");
  const s = settings();
  const cache = CacheService.getScriptCache();
  const key = "tok_" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new UserError("Your sign-in has expired. Please sign in again.", "auth");
  const t = JSON.parse(res.getContentText());
  if (t.aud !== s.clientId) throw new UserError("This sign-in isn't for this site. Please sign in again.", "auth");
  if (String(t.email_verified) !== "true") throw new UserError("Your Google email address isn't verified.", "auth");
  const email = String(t.email).toLowerCase();
  const domain = email.split("@")[1];
  if (s.domains.length && s.domains.indexOf(domain) === -1) {
    throw new UserError("Please sign in with your work Google account (" + s.domains.map(d => "@" + d).join(" or ") + ").", "auth");
  }
  const user = {
    email: email,
    name: t.name || email.split("@")[0],
    givenName: t.given_name || (t.name || "").split(" ")[0] || email.split("@")[0],
    isJudge: s.judges.indexOf(email) !== -1,
    isAdmin: s.admins.indexOf(email) !== -1
  };
  const ttl = Math.max(60, Math.min(21600, Number(t.exp) - Math.floor(Date.now() / 1000) - 30));
  cache.put(key, JSON.stringify(user), ttl);
  return user;
}

/* =========================== Actions =========================== */

function me(user) {
  const myRatings = {};
  rows("ratings").forEach(r => { if (r.Email === user.email) myRatings[r.Slug] = Number(r.Stars); });
  const mine = {};
  rows("submissions").forEach(r => {
    if (r.Email === user.email) mine[r.Slug] = { slug: r.Slug, title: r.Title, authors: String(r.Authors).split(" & "), llm: r["AI used"], blurb: r.Blurb, emoji: r.Emoji };
  });
  const out = { ok: true, user: user, myRatings: myRatings, mySubmissions: Object.keys(mine).map(k => mine[k]) };
  if (user.isJudge) {
    out.myScores = {};
    rows("judging").forEach(r => {
      if (r.Email === user.email) out.myScores[r.Slug] = [r.Silliness, r.Playability, r.Originality, r.Presentation, r.Wildcard].map(Number);
    });
  }
  return out;
}

function rate(user, data) {
  const stars = Number(data.stars);
  if (!(stars >= 1 && stars <= 5 && Math.round(stars) === stars)) throw new UserError("Pick between 1 and 5 stars.");
  if (siteConfig().winnersAnnounced) throw new UserError("Voting has closed: the winners have been announced.");
  const game = findGame(data.slug);
  if (game.excludeFromJudging) throw new UserError("This is an example game, so it can't be rated.");
  if (isOwner(user, game)) throw new UserError("Nice try! You can't rate your own game.");
  withLock(() => upsert("ratings", user.email, game.slug, [new Date(), user.email, game.slug, stars]));
  CacheService.getScriptCache().remove("stats");
  return { ok: true, stars: stars, stats: ratingStats()[game.slug] };
}

function judge(user, data) {
  if (!user.isJudge) throw new UserError("Only judges can score games.");
  const game = findGame(data.slug);
  if (game.excludeFromJudging) throw new UserError("This is an example game, so it isn't judged.");
  if (isOwner(user, game)) throw new UserError("Judges don't score their own game. The other judges' average counts instead.");
  const scores = (data.scores || []).map(Number);
  if (scores.length !== 5 || scores.some(s => !(s >= 1 && s <= 5 && Math.round(s) === s))) throw new UserError("Every criterion needs a score from 1 to 5.");
  const total = scores.reduce((sum, s, i) => sum + s * RUBRIC_MULTIPLIERS[i], 0);
  withLock(() => upsert("judging", user.email, game.slug, [new Date(), user.email, game.slug].concat(scores, [total])));
  return { ok: true, total: total };
}

function results(user) {
  if (!user.isJudge && !user.isAdmin) throw new UserError("Only judges and organisers can see the results.");
  return { ok: true, judges: judgeRanking(), stars: starRanking() };
}

/* =========================== Submissions =========================== */

function submit(user, d) {
  const cfg = siteConfig();
  if (Date.now() > cfg.deadline && !user.isAdmin) throw new UserError("Submissions have closed. The deadline has passed.");

  const clean = (v, max, label, required) => {
    const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    if (required && !s) throw new UserError("Please fill in the " + label + ".");
    if (s.length > max) throw new UserError("The " + label + " is too long (" + s.length + " characters, max " + max + ").");
    return s;
  };
  const title = clean(d.title, 60, "game title", true);
  const blurb = clean(d.blurb, 100, "one-line description", true);
  const llm = clean(d.llm, 30, "AI used", true);
  const emoji = clean(d.emoji, 12, "emoji", false) || "🎮";
  const authors = (Array.isArray(d.authors) ? d.authors : []).map(a => clean(a, 40, "name", false)).filter(Boolean);
  if (!authors.length) throw new UserError("Please add your name.");
  if (authors.length > 2) throw new UserError("Teams can have at most two people.");

  const html = String(d.html || "");
  const htmlBytes = Utilities.newBlob(html).getBytes();
  if (!html.trim()) throw new UserError("Please choose your game's .html file.");
  if (htmlBytes.length > MAX_GAME_BYTES) throw new UserError("Your game file is over 3 MB. Ask your AI to make it smaller (no embedded images or sounds).");
  if (!/<html|<!doctype|<script|<canvas|<body/i.test(html)) throw new UserError("That file doesn't look like an HTML game. Make sure you saved the whole code as a .html file.");

  let thumb = null;
  if (d.thumbnail) {
    const m = String(d.thumbnail).match(/^data:image\/(png|jpeg);base64,(.+)$/);
    if (!m) throw new UserError("The thumbnail must be a PNG or JPG image.");
    const bytes = Utilities.base64Decode(m[2]);
    if (bytes.length > MAX_THUMB_BYTES) throw new UserError("The thumbnail is over 1 MB. Try a smaller screenshot.");
    thumb = { bytes: bytes, ext: m[1] === "png" ? "png" : "jpg" };
  }

  const slug = (slugify(authors[0].split(" ")[0]) + "-" + slugify(title)).slice(0, 60).replace(/-+$/, "");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new UserError("Please use letters or numbers in your name and title.");

  return withLock(() => {
    const manifest = githubGet("games.json");
    const games = JSON.parse(manifest.text);
    const index = games.findIndex(g => g.slug === slug);
    const existing = index === -1 ? null : games[index];
    if (existing && !isOwner(user, existing) && !user.isAdmin) {
      throw new UserError("There's already a game called \"" + existing.title + "\" by " + existing.authors.join(" & ") + ". Please pick a different title.");
    }

    const file = "games/" + slug + ".html";
    githubPut(file, htmlBytes, (existing ? "Update " : "Add ") + title + " by " + authors.join(" & "));
    let thumbnail = existing && existing.thumbnail;
    if (thumb) {
      thumbnail = "games/thumbs/" + slug + "." + thumb.ext;
      githubPut(thumbnail, thumb.bytes, "Thumbnail for " + title);
    }

    const entry = {
      slug: slug, title: title, authors: authors, llm: llm, file: file, blurb: blurb, emoji: emoji,
      added: existing && existing.added || Utilities.formatDate(new Date(), "Etc/GMT", "yyyy-MM-dd"),
      award: existing ? existing.award || null : null
    };
    if (thumbnail) entry.thumbnail = thumbnail;
    if (existing) games[index] = entry; else games.push(entry);
    githubPut("games.json", Utilities.newBlob(JSON.stringify(games, null, 2) + "\n").getBytes(),
      (existing ? "Update " : "List ") + title + " in the gallery", manifest.sha);
    CacheService.getScriptCache().remove("games");

    const version = rows("submissions").filter(r => r.Slug === slug).length + 1;
    sheet("submissions").appendRow([new Date(), user.email, user.name, slug, title, authors.join(" & "), llm, blurb, emoji, version]);
    return { ok: true, slug: slug, updated: !!existing };
  });
}

/* =========================== Rankings =========================== */

function ratingStats() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("stats");
  if (hit) return JSON.parse(hit);
  const agg = {};
  rows("ratings").forEach(r => {
    const a = agg[r.Slug] || (agg[r.Slug] = { sum: 0, count: 0 });
    a.sum += Number(r.Stars); a.count++;
  });
  const out = {};
  Object.keys(agg).forEach(k => { out[k] = { avg: Math.round(agg[k].sum / agg[k].count * 100) / 100, count: agg[k].count }; });
  cache.put("stats", JSON.stringify(out), 30);
  return out;
}

function starRanking() {
  const stats = ratingStats();
  const min = siteConfig().minRatings;
  return games().filter(g => !g.excludeFromJudging).map(g => {
    const s = stats[g.slug] || { avg: 0, count: 0 };
    return { slug: g.slug, title: g.title, avg: s.avg, count: s.count, qualifies: s.count >= min };
  }).sort((a, b) => (b.qualifies - a.qualifies) || (b.avg - a.avg) || (b.count - a.count));
}

function judgeRanking() {
  const per = {};
  rows("judging").forEach(r => {
    const p = per[r.Slug] || (per[r.Slug] = { totals: [], silly: [], judges: [] });
    p.totals.push(Number(r["Weighted total"])); p.silly.push(Number(r.Silliness)); p.judges.push(r.Email);
  });
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const list = games().filter(g => !g.excludeFromJudging).map(g => {
    const p = per[g.slug] || { totals: [], silly: [], judges: [] };
    return { slug: g.slug, title: g.title, avg: Math.round(avg(p.totals) * 10) / 10, sillyAvg: Math.round(avg(p.silly) * 100) / 100, judged: p.judges.length };
  }).sort((a, b) => (b.avg - a.avg) || (b.sillyAvg - a.sillyAvg));
  list.forEach((e, i) => {
    const same = o => o && o.avg === e.avg && o.sillyAvg === e.sillyAvg && e.judged > 0;
    e.tied = same(list[i - 1]) || same(list[i + 1]);
  });
  return list;
}

/* =========================== Sheet menu (for the organiser) =========================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Bonanza")
    .addItem("Refresh leaderboards", "refreshLeaderboards")
    .addItem("Check setup", "setup")
    .addToUi();
}

function refreshLeaderboards() {
  const ss = SpreadsheetApp.getActive();
  const tab = ss.getSheetByName("Leaderboard") || ss.insertSheet("Leaderboard");
  tab.clear();
  const j = judgeRanking(), s = starRanking();
  const rowsOut = [["Judges' ranking (Grand champion & Runner-up)", "", "", "", ""], ["Rank", "Game", "Average /100", "Silliness avg", "Judges scored"]];
  j.forEach((e, i) => rowsOut.push([i + 1, e.title + (e.tied ? "  (TIED: judges discuss)" : ""), e.avg, e.sillyAvg, e.judged]));
  rowsOut.push(["", "", "", "", ""], ["People's choice (star ratings)", "", "", "", ""], ["Rank", "Game", "Average stars", "Ratings", "Qualifies?"]);
  s.forEach((e, i) => rowsOut.push([i + 1, e.title, e.avg, e.count, e.qualifies ? "Yes" : "Needs " + siteConfig().minRatings + " ratings"]));
  tab.getRange(1, 1, rowsOut.length, 5).setValues(rowsOut);
  tab.getRange("A1").setFontWeight("bold");
  tab.getRange(j.length + 4, 1).setFontWeight("bold");
  tab.autoResizeColumns(1, 5);
  ss.setActiveSheet(tab);
}

// Run this once from the editor (select "setup", click Run). It checks every setting.
function setup() {
  const s = settings();
  const report = [];
  Object.keys(TABS).forEach(sheet);
  report.push("✅ Sheet tabs are ready.");
  report.push(s.clientId ? "✅ GOOGLE_CLIENT_ID is set." : "❌ GOOGLE_CLIENT_ID is missing (SETUP step 4).");
  report.push(s.domains.length ? "✅ Only these email domains can sign in: " + s.domains.join(", ") : "⚠️ ALLOWED_DOMAINS is empty: ANY Google account could sign in.");
  report.push(s.judges.length ? "✅ Judges: " + s.judges.join(", ") : "⚠️ JUDGE_EMAILS is empty: nobody can score as a judge yet.");
  try {
    const g = JSON.parse(githubGet("games.json").text);
    report.push("✅ GitHub works: found " + g.length + " game(s) in " + s.repo + ".");
    const cfg = siteConfig();
    report.push("✅ Deadline read from config.js: " + new Date(cfg.deadline));
  } catch (err) {
    report.push("❌ GitHub problem: " + err.message);
  }
  const text = report.join("\n");
  console.log(text);
  try { SpreadsheetApp.getUi().alert("Bonanza setup check", text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* run from editor */ }
  return text;
}

/* =========================== Helpers =========================== */

function games() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("games");
  if (hit) return JSON.parse(hit);
  const list = JSON.parse(githubGet("games.json").text);
  cache.put("games", JSON.stringify(list), 60);
  return list;
}

function findGame(slug) {
  let g = games().filter(x => x.slug === slug)[0];
  if (!g) {
    CacheService.getScriptCache().remove("games");
    g = games().filter(x => x.slug === slug)[0];
  }
  if (!g) throw new UserError("We couldn't find that game. It may still be uploading; try again in a minute.");
  return g;
}

function isOwner(user, game) {
  return rows("submissions").some(r => r.Slug === game.slug && r.Email === user.email);
}

function slugify(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new UserError("Lots of people are submitting right now. Please try again in a moment.");
  try { return fn(); } finally { lock.releaseLock(); }
}

function sheet(name) {
  const ss = SpreadsheetApp.getActive();
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  let sh = ss.getSheetByName(title);
  if (!sh) {
    sh = ss.insertSheet(title);
    sh.appendRow(TABS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, TABS[name].length).setFontWeight("bold");
  }
  return sh;
}

function rows(name) {
  const values = sheet(name).getDataRange().getValues();
  const head = values.shift();
  return values.map(v => { const o = {}; head.forEach((h, i) => o[h] = v[i]); return o; });
}

// Replace the row for this email + slug, or add one.
function upsert(name, email, slug, row) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][1] === email && values[i][2] === slug) {
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

/* ---------- GitHub ---------- */

function github(method, path, body) {
  const s = settings();
  if (!s.token || !s.repo) throw new Error("GITHUB_TOKEN or GITHUB_REPO isn't set (SETUP step 3).");
  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + s.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  };
  if (body) { options.contentType = "application/json"; options.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch("https://api.github.com/repos/" + s.repo + path, options);
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code === 401) throw new Error("GitHub rejected the token. It may have expired: make a new one (SETUP step 3).");
  if (code === 403 && /rate limit/i.test(text)) throw new UserError("GitHub is busy. Please try again in a few minutes.");
  return { code: code, data: text ? JSON.parse(text) : {} };
}

function githubGet(path) {
  const s = settings();
  const r = github("get", "/contents/" + encodeURI(path) + "?ref=" + encodeURIComponent(s.branch));
  if (r.code === 404) throw new Error("Couldn't find " + path + " in " + s.repo + ". Check GITHUB_REPO, and that the token can access that repository.");
  if (r.code !== 200) throw new Error("GitHub error " + r.code + " reading " + path + ".");
  const text = r.data.content ? Utilities.newBlob(Utilities.base64Decode(r.data.content.replace(/\n/g, ""))).getDataAsString("UTF-8") : "";
  return { sha: r.data.sha, text: text };
}

function githubPut(path, bytes, message, sha) {
  const s = settings();
  if (sha === undefined) {
    const head = github("get", "/contents/" + encodeURI(path) + "?ref=" + encodeURIComponent(s.branch));
    sha = head.code === 200 ? head.data.sha : null;
  }
  const body = { message: message, content: Utilities.base64Encode(bytes), branch: s.branch };
  if (sha) body.sha = sha;
  const r = github("put", "/contents/" + encodeURI(path), body);
  if (r.code === 409 || r.code === 422) throw new UserError("Someone else was submitting at the same moment. Please press Submit again.");
  if (r.code !== 200 && r.code !== 201) throw new Error("GitHub error " + r.code + " saving " + path + ": " + (r.data.message || ""));
  return r.data;
}

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
  ratings: ["Updated", "Rater", "Email", "Game", "Creator", "Stars", "Version rated", "Slug"],
  judging: ["Updated", "Judge", "Email", "Game", "Creator", "Silliness", "Playability", "Originality", "Presentation", "Wildcard", "Weighted total", "Slug"],
  removed: ["Removed at", "Removed by", "From tab", "Row"]
};
const RUBRIC_MULTIPLIERS = [8, 4, 4, 2, 2];
const MAX_GAME_BYTES = 3 * 1024 * 1024;
const MAX_THUMB_BYTES = 1024 * 1024;
const MAX_PHOTO_BYTES = 512 * 1024;
const SESSION_SECONDS = 6 * 60 * 60; // how long people stay signed in (6 hours is the maximum)

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
      case "me": return me(user, data.idToken);
      case "signout": endSession(data.idToken); return { ok: true };
      case "rate": return rate(user, data);
      case "submit": return submit(user, data);
      case "judge": return judge(user, data);
      case "results": return results(user);
      case "delete": return deleteGame(user, data);
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

// Accepts either a Google sign-in token or a session pass from startSession().
function verifyUser(idToken) {
  if (!idToken) throw new UserError("Please sign in first.", "auth");
  const s = settings();
  const cache = CacheService.getScriptCache();
  if (isSession(idToken)) {
    const saved = cache.get("sess_" + idToken);
    if (!saved) throw new UserError("Your sign-in has expired. Please sign in again.", "auth");
    return withRoles(JSON.parse(saved), s);
  }
  const key = "tok_" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  const hit = cache.get(key);
  if (hit) return withRoles(JSON.parse(hit), s);

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
    givenName: t.given_name || (t.name || "").split(" ")[0] || email.split("@")[0]
  };
  const ttl = Math.max(60, Math.min(21600, Number(t.exp) - Math.floor(Date.now() / 1000) - 30));
  cache.put(key, JSON.stringify(user), ttl);
  return withRoles(user, s);
}

// Judge/admin status is looked up fresh every time, so settings changes apply immediately.
function withRoles(user, s) {
  user.isJudge = s.judges.indexOf(user.email) !== -1;
  user.isAdmin = s.admins.indexOf(user.email) !== -1;
  return user;
}

function isSession(token) { return /^s_[a-f0-9]{64}$/.test(String(token)); }

// After a Google sign-in, hand out a session pass so people stay signed in across pages.
function startSession(user) {
  const token = "s_" + (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  const saved = { email: user.email, name: user.name, givenName: user.givenName };
  CacheService.getScriptCache().put("sess_" + token, JSON.stringify(saved), SESSION_SECONDS);
  return { token: token, expires: Date.now() + (SESSION_SECONDS - 60) * 1000 };
}

function endSession(token) {
  if (isSession(token)) CacheService.getScriptCache().remove("sess_" + token);
}

/* =========================== Actions =========================== */

function me(user, token) {
  const myRatings = {}, myRatedVersions = {};
  rows("ratings").forEach(r => {
    if (r.Email !== user.email) return;
    myRatings[r.Slug] = Number(r.Stars);
    myRatedVersions[r.Slug] = Number(r["Version rated"]) || 1;
  });
  const mine = {};
  rows("submissions").forEach(r => {
    if (r.Email === user.email) mine[r.Slug] = { slug: r.Slug, title: r.Title, authors: String(r.Authors).split(" & "), llm: r["AI used"], blurb: r.Blurb, emoji: r.Emoji };
  });
  const out = { ok: true, user: user, myRatings: myRatings, myRatedVersions: myRatedVersions, mySubmissions: Object.keys(mine).map(k => mine[k]) };
  if (!isSession(token)) out.session = startSession(user);
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
  const version = Number(game.version) || 1;
  withLock(() => upsert("ratings", {
    Updated: new Date(), Rater: user.name, Email: user.email, Game: game.title, Creator: (game.authors || []).join(" & "),
    Stars: stars, "Version rated": version, Slug: game.slug
  }));
  CacheService.getScriptCache().remove("stats");
  return { ok: true, stars: stars, version: version, stats: ratingStats()[game.slug] };
}

function judge(user, data) {
  if (!user.isJudge) throw new UserError("Only judges can score games.");
  const game = findGame(data.slug);
  if (game.excludeFromJudging) throw new UserError("This is an example game, so it isn't judged.");
  if (isOwner(user, game)) throw new UserError("Judges don't score their own game. The other judges' average counts instead.");
  const scores = (data.scores || []).map(Number);
  if (scores.length !== 5 || scores.some(s => !(s >= 1 && s <= 5 && Math.round(s) === s))) throw new UserError("Every criterion needs a score from 1 to 5.");
  const total = scores.reduce((sum, s, i) => sum + s * RUBRIC_MULTIPLIERS[i], 0);
  withLock(() => upsert("judging", {
    Updated: new Date(), Judge: user.name, Email: user.email, Game: game.title, Creator: (game.authors || []).join(" & "),
    Silliness: scores[0], Playability: scores[1], Originality: scores[2], Presentation: scores[3], Wildcard: scores[4],
    "Weighted total": total, Slug: game.slug
  }));
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

  let photo = null;
  if (d.photo) {
    const m = String(d.photo).match(/^data:image\/jpeg;base64,(.+)$/);
    if (!m) throw new UserError("Your photo must be a JPG image.");
    photo = Utilities.base64Decode(m[1]);
    if (photo.length > MAX_PHOTO_BYTES) throw new UserError("Your photo is too large. Try a smaller one.");
  }

  const slug = (slugify(authors[0].split(" ")[0]) + "-" + slugify(title)).slice(0, 60).replace(/-+$/, "");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new UserError("Please use letters or numbers in your name and title.");

  return withLock(() => {
    const today = Utilities.formatDate(new Date(), "Etc/GMT", "yyyy-MM-dd");
    const result = commitGames(games => {
      const index = games.findIndex(g => g.slug === slug);
      const existing = index === -1 ? null : games[index];
      if (existing && !isOwner(user, existing) && !user.isAdmin) {
        throw new UserError("There's already a game called \"" + existing.title + "\" by " + existing.authors.join(" & ") + ". Please pick a different title.");
      }
      const file = "games/" + slug + ".html";
      const files = [{ path: file, bytes: htmlBytes }];
      let thumbnail = existing && existing.thumbnail;
      if (thumb) {
        thumbnail = "games/thumbs/" + slug + "." + thumb.ext;
        files.push({ path: thumbnail, bytes: thumb.bytes });
      }
      let photoPath = existing && existing.photo;
      if (photo) {
        photoPath = "games/photos/" + slug + ".jpg";
        files.push({ path: photoPath, bytes: photo });
      }
      const version = existing ? (Number(existing.version) || 1) + 1 : 1;
      const entry = {
        slug: slug, title: title, authors: authors, llm: llm, file: file, blurb: blurb, emoji: emoji,
        added: existing && existing.added || today, version: version,
        award: existing ? existing.award || null : null
      };
      if (existing) entry.updated = today;
      if (thumbnail) entry.thumbnail = thumbnail;
      if (photoPath) entry.photo = photoPath;
      if (existing) games[index] = entry; else games.push(entry);
      return {
        files: files,
        message: (existing ? "Update " + title + " to v" + version : "Add " + title) + " by " + authors.join(" & "),
        result: { slug: slug, updated: !!existing, version: version }
      };
    });
    sheet("submissions").appendRow([new Date(), user.email, user.name, slug, title, authors.join(" & "), llm, blurb, emoji, result.version]);
    return Object.assign({ ok: true }, result);
  });
}

/* =========================== Removing a game (admins) =========================== */

function deleteGame(user, data) {
  if (!user.isAdmin) throw new UserError("Only organisers can remove games.");
  const slug = String(data.slug || "");
  return withLock(() => {
    const result = commitGames(games => {
      const index = games.findIndex(g => g.slug === slug);
      if (index === -1) throw new UserError("That game has already been removed.");
      const g = games.splice(index, 1)[0];
      const files = [g.file, g.thumbnail, g.photo]
        .filter(p => p && String(p).indexOf("games/") === 0)
        .map(p => ({ path: p, remove: true }));
      return { files: files, message: "Remove " + g.title + " from the gallery", result: { title: g.title } };
    });
    // Move its ratings, judges' scores and submission history to the "Removed" tab,
    // so standings stay clean and a future game with the same name starts fresh.
    const moved = ["ratings", "judging", "submissions"].reduce((n, tab) => n + archiveRows(tab, slug, user.email), 0);
    CacheService.getScriptCache().remove("stats");
    return { ok: true, title: result.title, archived: moved };
  });
}

function archiveRows(name, slug, by) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  const col = values[0].indexOf("Slug");
  const removed = sheet("removed");
  let count = 0;
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][col] !== slug) continue;
    removed.appendRow([new Date(), by, name, JSON.stringify(values[i])]);
    sh.deleteRow(i + 1);
    count++;
  }
  return count;
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
    return { slug: g.slug, title: g.title, creator: (g.authors || []).join(" & "), avg: s.avg, count: s.count, qualifies: s.count >= min, short: Math.max(0, min - s.count) };
  }).sort((a, b) => (b.qualifies - a.qualifies) || (b.avg - a.avg) || (b.count - a.count));
}

function judgeRanking() {
  const per = {};
  rows("judging").forEach(r => {
    const p = per[r.Slug] || (per[r.Slug] = { totals: [], silly: [], judges: [], byJudge: {} });
    p.totals.push(Number(r["Weighted total"])); p.silly.push(Number(r.Silliness)); p.judges.push(r.Email);
    p.byJudge[r.Email] = Number(r["Weighted total"]);
  });
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const list = games().filter(g => !g.excludeFromJudging).map(g => {
    const p = per[g.slug] || { totals: [], silly: [], judges: [], byJudge: {} };
    return { slug: g.slug, title: g.title, creator: (g.authors || []).join(" & "), avg: Math.round(avg(p.totals) * 10) / 10, sillyAvg: Math.round(avg(p.silly) * 100) / 100, judged: p.judges.length, byJudge: p.byJudge };
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

// Rebuilds the two leaderboard tabs. Runs automatically every 10 minutes (see setup),
// and from the Bonanza menu.
function refreshLeaderboards() {
  const ss = SpreadsheetApp.getActive();
  const old = ss.getSheetByName("Leaderboard");
  if (old) ss.deleteSheet(old); // replaced by the two tabs below
  const stamp = "Updated " + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "d MMM, HH:mm") + ". Refreshes every 10 minutes.";

  // Judges' leaderboard: one column per judge with their total out of 100.
  const judgeEmails = settings().judges;
  const judgeNames = {};
  rows("judging").forEach(r => { if (r.Judge) judgeNames[r.Email] = r.Judge; });
  const nameOf = e => judgeNames[e] || nameFromEmail(e);
  const j = judgeRanking();
  const jHead = ["Rank", "Game", "Average total /100", "Average silliness /5"].concat(judgeEmails.map(e => nameOf(e) + " /100"), ["Note"]);
  const jRows = j.map((e, i) => [i + 1, e.title, e.judged ? e.avg : "", e.judged ? e.sillyAvg : ""]
    .concat(judgeEmails.map(em => e.byJudge[em] !== undefined ? e.byJudge[em] : ""),
      [e.tied ? "Tied: judges discuss" : (e.judged ? "" : "Not scored yet")]));
  writeBoard(ss, "Judges' leaderboard", jHead, jRows, stamp, { 3: "0.0", 4: "0.00" });

  // People's choice: star ratings.
  const min = siteConfig().minRatings;
  const pHead = ["Rank", "Game", "Creator", "Average stars /5", "Ratings", "Qualifies (" + min + "+ ratings)"];
  const pRows = starRanking().map((e, i) => [i + 1, e.title, e.creator, e.count ? e.avg : "", e.count, e.qualifies ? "Yes" : "No: needs " + e.short + " more"]);
  writeBoard(ss, "People's choice", pHead, pRows, stamp, { 4: "0.00" });
}

function writeBoard(ss, title, head, data, stamp, formats) {
  const tab = ss.getSheetByName(title) || ss.insertSheet(title);
  tab.clear();
  const all = [head].concat(data);
  tab.getRange(1, 1, all.length, head.length).setValues(all);
  tab.getRange(1, 1, 1, head.length).setFontWeight("bold").setBackground("#f3f1ee");
  tab.setFrozenRows(1);
  Object.keys(formats || {}).forEach(col => { if (data.length) tab.getRange(2, Number(col), data.length, 1).setNumberFormat(formats[col]); });
  tab.getRange(1, 1).setNote(stamp);
  tab.autoResizeColumns(1, head.length);
}

// "jadon.naiken@getray.ai" -> "Jadon Naiken" (used when we don't have a proper name)
function nameFromEmail(email) {
  return String(email || "").split("@")[0].split(/[._-]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function ensureAutoRefresh() {
  const exists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "refreshLeaderboards");
  if (!exists) ScriptApp.newTrigger("refreshLeaderboards").timeBased().everyMinutes(10).create();
}

// Run this once from the editor (select "setup", click Run). It checks every setting.
function setup() {
  const s = settings();
  const report = [];
  Object.keys(TABS).forEach(sheet);
  report.push("✅ Sheet tabs are ready.");
  try {
    ensureAutoRefresh();
    refreshLeaderboards();
    report.push("✅ Leaderboards refresh automatically every 10 minutes.");
  } catch (err) {
    report.push("⚠️ Couldn't set up the automatic leaderboard refresh: " + err.message);
  }
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
  } else if (!headersChecked[name]) {
    migrateTab(sh, name);
  }
  headersChecked[name] = true;
  return sh;
}
const headersChecked = {};

// If a tab still has an older column layout, rewrite it in the new one.
// Rows are matched by column name, so no data is lost; missing names are filled in.
function migrateTab(sh, name) {
  const want = TABS[name];
  const values = sh.getDataRange().getValues();
  const have = values[0].map(String);
  if (want.every((h, i) => have[i] === h)) return;
  const byGame = {};
  try { games().forEach(g => { byGame[g.slug] = g; }); } catch (e) { /* GitHub unavailable: fill what we can */ }
  const people = {};
  if (name !== "submissions") rows("submissions").forEach(r => { if (r.Name) people[r.Email] = r.Name; });
  const rowsOut = values.slice(1).map(v => {
    const o = {};
    have.forEach((h, i) => { o[h] = v[i]; });
    const g = byGame[o.Slug] || {};
    if (!o.Game) o.Game = g.title || o.Slug;
    if (!o.Creator) o.Creator = (g.authors || []).join(" & ");
    const person = people[o.Email] || nameFromEmail(o.Email);
    if (name === "ratings" && !o.Rater) o.Rater = person;
    if (name === "judging" && !o.Judge) o.Judge = person;
    return want.map(h => o[h] === undefined ? "" : o[h]);
  });
  sh.clear();
  const all = [want].concat(rowsOut);
  sh.getRange(1, 1, all.length, want.length).setValues(all);
  sh.getRange(1, 1, 1, want.length).setFontWeight("bold");
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, want.length);
}

function rows(name) {
  const values = sheet(name).getDataRange().getValues();
  const head = values.shift();
  return values.map(v => { const o = {}; head.forEach((h, i) => o[h] = v[i]); return o; });
}

// Replace the row for this person + game, or add one. `record` is keyed by column name.
function upsert(name, record) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  const head = values[0];
  const row = head.map(h => record[h] === undefined ? "" : record[h]);
  const e = head.indexOf("Email"), sl = head.indexOf("Slug");
  for (let i = 1; i < values.length; i++) {
    if (values[i][e] === record.Email && values[i][sl] === record.Slug) {
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

function githubGet(path, ref) {
  const s = settings();
  const r = github("get", "/contents/" + encodeURI(path) + "?ref=" + encodeURIComponent(ref || s.branch));
  if (r.code === 404) throw new Error("Couldn't find " + path + " in " + s.repo + ". Check GITHUB_REPO, and that the token can access that repository.");
  if (r.code !== 200) throw new Error("GitHub error " + r.code + " reading " + path + ".");
  const text = r.data.content ? Utilities.newBlob(Utilities.base64Decode(r.data.content.replace(/\n/g, ""))).getDataAsString("UTF-8") : "";
  return { sha: r.data.sha, text: text };
}

// Publishes all changes for one action as a SINGLE commit, so GitHub Pages rebuilds once
// (Pages allows about 10 rebuilds an hour). `change(games)` edits the games list in place
// and returns { files: [{ path, bytes } | { path, remove: true }], message, result }.
function commitGames(change) {
  const s = settings();
  const ok = (r, what) => { if (r.code < 200 || r.code > 299) throw new Error("GitHub error " + r.code + " " + what + ": " + (r.data.message || "")); return r.data; };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const headSha = ok(github("get", "/git/ref/heads/" + s.branch), "reading the branch").object.sha;
    const baseTree = ok(github("get", "/git/commits/" + headSha), "reading the latest commit").tree.sha;
    const games = JSON.parse(githubGet("games.json", headSha).text);
    const plan = change(games);

    let existing = null;
    const tree = [];
    plan.files.forEach(f => {
      if (f.remove) {
        existing = existing || treePaths(baseTree);
        if (existing[f.path]) tree.push({ path: f.path, mode: "100644", type: "blob", sha: null });
        return;
      }
      const blob = ok(github("post", "/git/blobs", { content: Utilities.base64Encode(f.bytes), encoding: "base64" }), "uploading " + f.path);
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    });
    const manifest = ok(github("post", "/git/blobs", { content: Utilities.base64Encode(Utilities.newBlob(JSON.stringify(games, null, 2) + "\n").getBytes()), encoding: "base64" }), "uploading games.json");
    tree.push({ path: "games.json", mode: "100644", type: "blob", sha: manifest.sha });

    const newTree = ok(github("post", "/git/trees", { base_tree: baseTree, tree: tree }), "building the change");
    const commit = ok(github("post", "/git/commits", { message: plan.message, tree: newTree.sha, parents: [headSha] }), "saving the change");
    const update = github("patch", "/git/refs/heads/" + s.branch, { sha: commit.sha, force: false });
    if (update.code === 200) {
      CacheService.getScriptCache().remove("games");
      return plan.result;
    }
    if (update.code !== 409 && update.code !== 422) ok(update, "publishing");
    Utilities.sleep(800 * attempt); // someone else published at the same moment: start again on top of theirs
  }
  throw new UserError("Lots of people are publishing right now. Please press the button again.");
}

function treePaths(treeSha) {
  const r = github("get", "/git/trees/" + treeSha + "?recursive=1");
  const out = {};
  (r.data.tree || []).forEach(t => { out[t.path] = true; });
  return out;
}

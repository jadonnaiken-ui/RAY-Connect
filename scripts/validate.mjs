// Checks games.json and config.js, and explains any problem in plain English.
// GitHub runs this automatically on every change (see .github/workflows/validate.yml).
// To run it yourself: node scripts/validate.mjs

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const inCI = !!process.env.GITHUB_ACTIONS;

function error(msg, file = "games.json", line) {
  errors.push(msg);
  if (inCI) console.log(`::error file=${file}${line ? `,line=${line}` : ""}::${msg.replace(/\n/g, "%0A")}`);
}
function warn(msg, file) {
  warnings.push(msg);
  if (inCI) console.log(`::warning file=${file}::${msg}`);
}

function lineOf(text, index) {
  const before = text.slice(0, index);
  return { line: before.split("\n").length, col: index - before.lastIndexOf("\n") };
}

/* ---------- config.js ---------- */
try {
  execFileSync(process.execPath, ["--check", join(root, "config.js")], { stdio: "pipe" });
} catch (e) {
  const out = String(e.stderr || e.message);
  const m = out.match(/config\.js:(\d+)/);
  error(
    `config.js has a typo${m ? ` on or just before line ${m[1]}` : ""}. ` +
    `Look for a missing comma at the end of a line, a missing quote mark, or curly “smart quotes”.`,
    "config.js", m ? Number(m[1]) : undefined
  );
}

/* ---------- games.json ---------- */
const ALLOWED = new Set(["slug", "title", "authors", "llm", "file", "blurb", "emoji", "thumbnail", "photo", "added", "updated", "version", "award", "excludeFromJudging"]);
const AWARDS = [null, "winner", "runner-up", "peoples-choice"];

let text = "";
let games = null;
try {
  text = readFileSync(join(root, "games.json"), "utf8");
} catch {
  error("games.json is missing. It must sit in the top folder of the repository.");
}

if (text) {
  const smart = text.search(/[“”‘’]/);
  if (smart !== -1) {
    const { line } = lineOf(text, smart);
    error(`games.json line ${line} has a curly “smart quote”. Replace it with a straight quote: "`, "games.json", line);
  }
  try {
    games = JSON.parse(text);
  } catch (e) {
    const pos = Number((e.message.match(/position (\d+)/) || [])[1]);
    const lc = e.message.match(/line (\d+) column (\d+)/);
    let where = lc ? { line: Number(lc[1]) } : !isNaN(pos) ? lineOf(text, pos) : null;
    const trailing = text.search(/,\s*[\]}]/);
    const missing = text.search(/[}\]"]\s*\n\s*[{"]/);
    if (trailing !== -1) {
      const { line } = lineOf(text, trailing);
      error(`games.json line ${line} ends with a comma, but nothing comes after it. Delete that comma.`, "games.json", line);
    } else if (missing !== -1) {
      const { line } = lineOf(text, missing);
      error(`games.json line ${line} looks like it's missing a comma at the end.`, "games.json", line);
    }
    error(
      `games.json isn't valid${where ? ` around line ${where.line}` : ""}. Common causes:\n` +
      `  • a missing comma between two entries:  }  {   should be  },  {\n` +
      `  • an extra comma after the LAST entry:  },  ]  should be  }  ]\n` +
      `  • a missing quote mark around a value\n` +
      `(Technical detail: ${e.message})`,
      "games.json", where && where.line
    );
  }
}

if (games !== null && !Array.isArray(games)) {
  error("games.json must be a list: it should start with [ and end with ].");
  games = null;
}

if (Array.isArray(games)) {
  const slugs = new Map();
  games.forEach((g, i) => {
    const label = `Entry ${i + 1}${g && g.slug ? ` (${g.slug})` : g && g.title ? ` (${g.title})` : ""}`;
    if (!g || typeof g !== "object" || Array.isArray(g)) { error(`${label} isn't an entry. Each entry must be wrapped in { }.`); return; }

    for (const field of ["slug", "title", "file", "blurb", "llm"]) {
      if (typeof g[field] !== "string" || !g[field].trim()) error(`${label} is missing "${field}".`);
    }
    if (!Array.isArray(g.authors) || !g.authors.length || g.authors.some(a => typeof a !== "string" || !a.trim())) {
      error(`${label}: "authors" must be a list of names in square brackets, like ["Jadon"]. Entries are solo, so just one name.`);
    }
    for (const key of Object.keys(g)) {
      if (!ALLOWED.has(key)) warn(`${label} has an unknown field "${key}". Check the spelling (it will be ignored).`, "games.json");
    }

    if (typeof g.slug === "string" && g.slug) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug)) {
        error(`${label}: the slug "${g.slug}" must be lowercase letters, numbers and single dashes only, e.g. "jadon-sofa-racer".`);
      }
      if (slugs.has(g.slug)) error(`${label} uses the slug "${g.slug}", which entry ${slugs.get(g.slug)} already uses. Every slug must be different.`);
      else slugs.set(g.slug, i + 1);
    }
    if (typeof g.blurb === "string" && g.blurb.length > 100) {
      error(`${label}: the blurb is ${g.blurb.length} characters. Please keep it to 100 or fewer.`);
    }

    if (typeof g.file === "string" && g.file) {
      if (!g.file.startsWith("games/") || !g.file.endsWith(".html")) {
        error(`${label}: "file" should look like "games/name-of-game.html" (it's "${g.file}").`);
      }
      const full = join(root, g.file);
      if (!existsSync(full)) {
        const near = existsSync(join(root, "games")) ? readdirSync(join(root, "games")).find(f => f.toLowerCase() === g.file.slice(6).toLowerCase()) : null;
        error(`${label}: can't find the game file "${g.file}". Upload it into the games folder${near ? ` (there's a "${near}": the capital letters must match exactly)` : ", and check the spelling matches exactly"}.`);
      } else {
        checkGameFile(label, g.file, readFileSync(full, "utf8"));
      }
    }
    if (g.thumbnail != null && g.thumbnail !== "") {
      if (typeof g.thumbnail !== "string" || !existsSync(join(root, g.thumbnail))) {
        error(`${label}: can't find the thumbnail "${g.thumbnail}". Upload it, or delete the "thumbnail" line.`);
      }
    }
    if (g.photo != null && g.photo !== "" && (typeof g.photo !== "string" || !existsSync(join(root, g.photo)))) {
      error(`${label}: can't find the photo "${g.photo}". Upload it, or delete the "photo" line.`);
    }
    if (g.version !== undefined && !(Number.isInteger(g.version) && g.version >= 1)) {
      error(`${label}: "version" must be a whole number like 2, without quotes.`);
    }
    if (g.updated != null && !(typeof g.updated === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.updated))) {
      error(`${label}: "updated" must be a date like "2026-12-01".`);
    }
    if (g.added != null && !(typeof g.added === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.added) && !isNaN(Date.parse(g.added)))) {
      error(`${label}: "added" must be a date like "2027-01-15".`);
    }
    if (g.award !== undefined && !AWARDS.includes(g.award)) {
      error(`${label}: "award" must be "winner", "runner-up", "peoples-choice" or null (it's ${JSON.stringify(g.award)}).`);
    }
    if (g.excludeFromJudging !== undefined && typeof g.excludeFromJudging !== "boolean") {
      error(`${label}: "excludeFromJudging" must be true or false, without quotes.`);
    }
  });
}

function checkGameFile(label, file, html) {
  const found = new Set();
  const patterns = [
    [/<script[^>]+src\s*=\s*["']?\s*(https?:)?\/\//i, "loads a script from the internet"],
    [/<link[^>]+href\s*=\s*["']?\s*(https?:)?\/\//i, "loads a stylesheet or font from the internet"],
    [/<img[^>]+src\s*=\s*["']?\s*(https?:)?\/\//i, "loads an image from the internet"],
    [/url\(\s*["']?\s*https?:\/\//i, "loads an image or font from the internet in its CSS"],
    [/@import\s+(url\()?\s*["']?https?:/i, "imports CSS from the internet"],
    [/\bfetch\s*\(/, "uses fetch() to download something"],
    [/new\s+Audio\s*\(\s*["']https?:/i, "loads a sound from the internet"]
  ];
  for (const [re, what] of patterns) if (re.test(html)) found.add(what);
  if (found.size) {
    warn(`${label}: ${file} ${[...found].join(", and ")}. It may break offline or in the gallery. Ask the AI to "put everything in the one file, with no internet requests".`, file);
  }
  if (/\blocalStorage\b/.test(html) && !/try\s*{[^}]*localStorage/.test(html)) {
    warn(`${label}: ${file} uses localStorage, which is blocked in the gallery's sandbox and may stop the game. Ask the AI to remove it, or wrap it in try/catch.`, file);
  }
  if (!/<\/html>\s*$/i.test(html.trim())) {
    warn(`${label}: ${file} doesn't end with </html>. The AI may have cut the file off. Check the game plays.`, file);
  }
}

/* ---------- Report ---------- */
console.log("");
if (warnings.length) {
  console.log(`⚠️  ${warnings.length} warning(s). These won't stop the site, but are worth a look:`);
  warnings.forEach(w => console.log("   • " + w));
  console.log("");
}
if (errors.length) {
  console.log(`❌  Found ${errors.length} problem(s) to fix:`);
  errors.forEach(e => console.log("   • " + e));
  console.log("\nFix these, commit again, and this check re-runs automatically.");
  process.exit(1);
}
console.log(`✅  All good: config.js is valid and ${games.length} game(s) in games.json passed every check.`);

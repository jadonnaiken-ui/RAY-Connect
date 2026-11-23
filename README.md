# RAY Connect Bonanza

The website for the RAY Connect silly game jam. Colleagues build the silliest browser game they can with an AI assistant, submit it on the site, and everyone plays and rates every entry.

**Live site:** https://jadonnaiken-ui.github.io/RAY-Connect/

It runs free on **GitHub Pages**, with a small free backend in Google Apps Script for sign-in, submissions and ratings.

---

## How it works

```
 Entrant ──signs in with Google──▶ Submit page ──▶ Backend (Apps Script)
                                                    │  • checks they're a colleague
                                                    │  • publishes the game to GitHub
                                                    │  • saves ratings & judges' scores
                                                    ▼        in your Google Sheet
 Everyone ◀── gallery, play, rate ◀── GitHub Pages (this repository)
```

## What's in here

| File / folder | What it is | Do you edit it? |
|---|---|---|
| `config.js` | **All the settings**: name, deadline, prizes, timeline, judges, sign-in | **Yes**, this is your control panel |
| `games.json` | The list of games. The backend adds to it automatically | Only to remove games or set awards |
| `games/` | The game files (one `.html` per game) | Rarely |
| `backend/` | The backend script and **its setup guide** | Follow `backend/SETUP.md` once |
| `index.html` | Home: welcome, rules, prizes, countdown | No |
| `gallery.html` | Every game with live star ratings | No |
| `submit.html` | Sign in and submit a game | No |
| `guide.html` | Everything an entrant needs, including the starter prompt | No |
| `judging.html` | How winners are picked + the judges' scoring panel | No |
| `sample.html` | The sample game and how it was built and submitted | No (reads from `config.js`) |
| `resources.html` | Hand-picked tutorials and tools | Optional |
| `play.html` | Plays a single game, with star rating | No |
| `scripts/` + `.github/` | The automatic checker (green tick / red cross on GitHub) | No |
| `assets/` | Site styles and code | No |

---

## Setup checklist

1. ✅ Repository created and files uploaded
2. ✅ GitHub Pages switched on. Use **Settings → Pages → Source → GitHub Actions**: it has no hourly publish limit, and it won't publish a broken `config.js` or `games.json` (the last working version stays live)
3. ⬜ Fill in the placeholders in `config.js` (search for `PLACEHOLDER`)
4. ⬜ **Connect the backend:** follow [backend/SETUP.md](backend/SETUP.md) (about 30 minutes). Until then, the Submit page says "opening soon" and star ratings are hidden.
5. ⬜ Record the Loom and add its ID to `config.js` (see below)
6. ⬜ Replace the sample game with your own (see below)

## Editing settings

Open `config.js` on GitHub → **pencil icon** → change the text between the quotes → **Commit changes**. The site updates in 1–2 minutes. Check the **Actions** tab: a green tick means the edit was fine; a red cross explains what's wrong (usually a missing comma or quote).

## Games

**Entrants submit on the website.** Once a game is published, it's live in about two minutes. Entrants can update their own game any time before the deadline. Each update raises its version (v2, v3…), and the gallery shows an "Updated" badge for a day.

**One game per person:** submitting a game with a *new* title retires the person's previous game. It leaves the gallery and can no longer be rated, but its ratings and judges' scores stay on record. It stays on both leaderboards (Status column: "Retired: replaced by …") and in the judges' panel under "Replaced games", so the judges can still consider it. Re-submitting the old title brings it back and retires the newer one. The Submit page warns entrants and asks them to confirm before replacing.

**Ratings and updates:** each person has one rating per game. It carries over when the game is updated, and people can change it whenever they like. Anyone who rated an older version sees a nudge: "Updated to v2 since you rated it."

**Removing a game:** sign in as an admin (your email must be in `ADMIN_EMAILS`), open the game, and click **Remove game**. This deletes its files from GitHub and moves its ratings, judges' scores and submission history to the **Removed** tab of the Google Sheet. Standings stay clean, and nothing is lost for good.

**Adding a game by hand** (if someone can't use the Submit page):
1. Open the `games` folder → **Add file → Upload files** → drag in the `.html` → **Commit changes**.
2. Edit `games.json`. Before the final `]`, add a comma after the last `}`, then an entry like this:
   ```json
   {
     "slug": "jadon-sofa-racer",
     "title": "Sofa Racer",
     "authors": ["Jadon"],
     "llm": "Claude",
     "file": "games/jadon-sofa-racer.html",
     "blurb": "Formula 1, but everyone is a couch.",
     "emoji": "🛋️",
     "added": "2026-12-01",
     "award": null
   }
   ```
3. Commit. If the Actions tab shows a red cross, click it: it names the exact line and problem.

A game added by hand has no owner, so nobody can update it through the Submit page. Re-upload the file yourself instead.

| Field | Required | Notes |
|---|---|---|
| `slug` | ✅ | Unique. Lowercase letters, numbers, dashes. Used in the web address |
| `title`, `blurb`, `llm` | ✅ | Blurb is 100 characters max |
| `authors` | ✅ | One name in square brackets: `["Jadon"]` (entries are solo) |
| `file` | ✅ | Must match the uploaded file exactly, capitals included |
| `emoji`, `thumbnail`, `photo`, `added` | | Optional |
| `version`, `updated` | | Set automatically when a game is re-submitted |
| `award` | | `null`, `"winner"`, `"runner-up"` or `"peoples-choice"` |
| `excludeFromJudging` | | `true` for example games: not judged, not rated |

## Photos

- **Entrants** must add their RAY profile picture on the Submit page (updates keep the existing one). It's cropped to a square and shown as a small round picture next to their name.
- **Judges:** upload a square photo for each judge into `assets/judges/` (e.g. `jadon.jpg`) and make sure the `photo` paths in `config.js` match. Until a photo exists, initials are shown.
- The site is public, so only use photos people are happy to share.

## Judging and ratings

- **Grand champion & Runner-up:** judges sign in and score each game on the **Judging** page (5 criteria, 1–5 each, weighted to 100). Their emails go in `JUDGE_EMAILS` in the backend settings; their names go in `judges` in `config.js`.
- **People's choice:** everyone rates games 1–5 stars from the play page. The highest average wins, among games with at least `minRatingsForPeoplesChoice` ratings.
- **Standings:** judges and admins see them at the bottom of the Judging page, or open the Google Sheet → **Bonanza** menu → **Refresh leaderboards**.

## Announcing the winners

1. In `games.json`, set `"award"` on the three winners: `"winner"`, `"runner-up"`, `"peoples-choice"`.
2. In `config.js`, set `winnersAnnounced: true`. This also closes star voting.
3. Commit. Winners appear at the top of the home page and gallery.

## Loom walkthrough

Record it, set sharing to **Anyone with the link can view**, and copy the share link, e.g. `https://www.loom.com/share/abc123def456`. Put only the last part in `config.js`: `loomId: "abc123def456",`. It appears at the top of the guide.

## Making the sample game your own

Submit your game like anyone else. Then, in `config.js` → `showcase`: set `slug` to your game's slug (shown on the Submit page after submitting), fill in `builder`, `llm`, `timeSpent` and `idea`, paste the exact follow-up prompts you used into `followUps`, and set `isPlaceholder: false`. To retire Toaster Panic, remove it from `games.json` and `games/`.

## Common problems

| What you see | Fix |
|---|---|
| "The game list didn't load" | Typo in `games.json`. The Actions tab names the line |
| "The settings file has a typo" | Typo in `config.js`. The Actions tab names the line |
| "The game file is missing" | Just submitted? Wait a minute and refresh. Otherwise the `file` path doesn't match the file name |
| Changes don't show | Wait 2 minutes, then hard-refresh with **Ctrl + Shift + R** |
| A game works alone but not in the gallery | It probably uses `localStorage` or internet files. The Submit page and the Actions log both warn about this |
| Sign-in / submit problems | See Troubleshooting in [backend/SETUP.md](backend/SETUP.md) |

## Previewing locally

Run `python3 -m http.server 8000` in this folder and visit http://localhost:8000. Google sign-in only works on the live site unless you add `http://localhost:8000` as an extra JavaScript origin (backend/SETUP.md, Part C). Run `node scripts/validate.mjs` to run the same checks GitHub runs.

## Look and feel

Follows the RAY design system: Archivo Light headlines, Switzer body, warm greys, hairline cards. All colours are variables at the top of `assets/site.css`.

## Security

- Games run in a **sandboxed frame**. They can't read the site, other games, or anyone's sign-in.
- The GitHub token lives only in the Apps Script settings, never on the website.
- The backend only accepts sign-ins from your work domain, and only lets each person update their own game.
- The site is public: no company data in games.

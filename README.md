# RAY Connect Bonanza 2027

The website for the RAY Connect silly game jam. Colleagues build the silliest browser game they can with an AI assistant, and this site hosts every entry, the guide, the rules and the judging tools.

It runs free on **GitHub Pages**. There's no server, no database and nothing to install. Everything is done in the GitHub website.

---

## What's in here

| File / folder | What it is | Do you edit it? |
|---|---|---|
| `config.js` | **All the settings**: name, deadline, prizes, links, timeline, judges | **Yes**, this is your control panel |
| `games.json` | The list of games shown in the gallery | **Yes**, once per new entry |
| `games/` | The game files themselves (one `.html` per game) | Upload new games here |
| `games/thumbs/` | Optional screenshots for gallery cards | Optional |
| `index.html` | Home page: welcome, rules, prizes, countdown | No |
| `gallery.html` | Every game in a grid | No |
| `guide.html` | Everything an entrant needs, including the starter prompt | No |
| `judging.html` | Rubric, scoring sheets, results calculator | No |
| `sample.html` | The sample game and how it was built and uploaded | No (it reads from `config.js`) |
| `resources.html` | Hand-picked tutorials and tools | Optional |
| `play.html` | The page that plays a single game | No |
| `templates/scoring-sheet.csv` | Blank judges' sheet | No |
| `scripts/validate.mjs` + `.github/` | The automatic checker (green tick / red cross) | No |
| `assets/` | Site styles and code | No |

---

## 1. One-time setup (about 15 minutes)

### Step 1: Create the repository
1. Sign in at [github.com](https://github.com). Create a free account if you need one.
2. Click the **+** in the top right → **New repository**.
3. Name it, e.g. `ray-bonanza`. This name becomes part of the web address.
4. Choose **Public**. *(Free GitHub accounts can only publish public repositories as websites. Anyone with the link can see the site, which is why the rules say "no company data".)*
5. Leave everything else as it is and click **Create repository**.

### Step 2: Upload the files
1. On the new, empty repository page, click the link **"uploading an existing file"**.
2. On your computer, open the `RAY Connect` folder, select **everything inside it**, and drag it into the browser window.
   - ⚠️ **Hidden items:** the `.github` folder and the `.nojekyll` file start with a dot, so your computer hides them. Show them first: on Mac press **Cmd + Shift + .** in Finder; on Windows, in File Explorer go to **View → Show → Hidden items**.
   - If dragging the `.github` folder doesn't work, see "Adding the checker by hand" below. The site works without it, but you lose the automatic checks.
3. Scroll down, type "First upload" in the box, and click **Commit changes**. Wait for the upload to finish.

### Step 3: Turn on the website
1. In the repository, click **Settings** (top bar) → **Pages** (left sidebar).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
4. Wait about 2 minutes and refresh. A box appears at the top: **"Your site is live at https://YOUR-NAME.github.io/ray-bonanza/"**. That's your link. Share it with everyone.

### Step 4: Fill in your settings
1. Back on the repository's main page, click `config.js`, then the **pencil icon** (top right of the file).
2. Change every value marked `>>> PLACEHOLDER <<<`:
   - `deadline`: the moment submissions close
   - `timeline`: your real dates
   - `prizes`: real amounts
   - `submitUrl` and `submitLabel`: where people send games (e.g. your Slack channel link)
   - `contact`: who people ask for help
   - `repoUrl`: this repository's web address (optional; shows the "upload it yourself" route)
3. Click **Commit changes** → **Commit changes**.
4. Wait about 1 minute, then open your site and check it.

### Step 5: Check it works
- Open the live site. You should see the countdown, the prizes and the rules.
- Open the **Gallery** and click **Toaster Panic**. It should play.
- Click the **Actions** tab in GitHub. You should see a **green tick ✅**.

#### Adding the checker by hand (only if the `.github` folder didn't upload)
1. On the repository page click **Add file → Create new file**.
2. In the name box type exactly `.github/workflows/validate.yml`. The slashes create the folders.
3. Open `.github/workflows/validate.yml` from your computer in a text editor, copy everything, paste it in, and click **Commit changes**.

---

## 2. Adding a new game (under 5 minutes)

An entrant posts their `.html` file plus a message from the guide's **Submission helper**. The message ends with a ready-made block of text for `games.json`.

1. **Download** the entrant's `.html` file from Slack (or wherever they sent it).
2. **Upload it:** in the repository, click into the `games` folder → **Add file → Upload files** → drag the file in → **Commit changes**.
   - The file name must match the `"file"` in their message exactly, e.g. `jadon-sofa-racer.html`.
3. **Add it to the list:** go back to the main page → click `games.json` → **pencil icon**.
4. Put your cursor just before the final `]` at the bottom. Type a **comma** after the previous entry's closing `}`, then paste the entrant's block. It should look like this:

   ```json
   [
     {
       "slug": "organisers-toaster-panic",
       ...
       "excludeFromJudging": true
     },
     {
       "slug": "jadon-sofa-racer",
       "title": "Sofa Racer",
       "authors": ["Jadon"],
       "llm": "Claude",
       "file": "games/jadon-sofa-racer.html",
       "blurb": "Formula 1, but everyone is a couch.",
       "emoji": "🛋️",
       "added": "2027-01-15",
       "award": null
     }
   ]
   ```
5. Click **Commit changes**.
6. Check the **Actions** tab. Green tick = done; the game appears in the gallery within ~2 minutes. Red cross = click it, then click **validate**, and read the message. It says exactly what's wrong, e.g. *"games.json line 14 ends with a comma, but nothing comes after it."*

**Updating a game:** upload the new file with the **same name** into `games`. GitHub replaces the old one. No need to touch `games.json`.

**Optional thumbnail:** upload a screenshot (PNG or JPG, roughly 800 × 500) into `games/thumbs/`, and add a line `"thumbnail": "games/thumbs/jadon-sofa-racer.png",` to that entry. Without one, the card shows the emoji.

### Fields in games.json

| Field | Required | Example | Notes |
|---|---|---|---|
| `slug` | ✅ | `"jadon-sofa-racer"` | Unique. Lowercase letters, numbers, dashes |
| `title` | ✅ | `"Sofa Racer"` | |
| `authors` | ✅ | `["Jadon"]` or `["Jadon", "Sam"]` | Always in square brackets |
| `llm` | ✅ | `"Claude"` | The main AI they used |
| `file` | ✅ | `"games/jadon-sofa-racer.html"` | Must match the uploaded file exactly |
| `blurb` | ✅ | `"Formula 1, but everyone is a couch."` | 100 characters max |
| `emoji` | | `"🛋️"` | Shown when there's no thumbnail |
| `thumbnail` | | `"games/thumbs/jadon-sofa-racer.png"` | |
| `added` | | `"2027-01-15"` | Shows a "New" badge for a day |
| `award` | | `null`, `"winner"`, `"runner-up"`, `"peoples-choice"` | Set after judging |
| `excludeFromJudging` | | `true` | For example games. Leaves them off judges' sheets |

---

## 3. Adding the Loom walkthrough

1. Record your Loom (a suggested 3–4 minute script is in the project spec).
2. In Loom, set sharing to **Anyone with the link can view**.
3. Copy the share link, e.g. `https://www.loom.com/share/abc123def456`. You only need the last part: `abc123def456`.
4. In `config.js`, set `loomId: "abc123def456",` and commit. The video appears at the top of the guide.

## 4. Making the sample game your own

When your own game is ready:
1. Add it to the gallery (section 2).
2. In `config.js`, update the `showcase` section: set `slug` to your game's slug, fill in `builder`, `llm`, `timeSpent` and `idea`, paste the **exact follow-up messages** you sent the AI into `followUps`, and set `isPlaceholder: false`.
3. Optional: to hide Toaster Panic, delete its entry from `games.json`.

## 5. Running judging

1. **Before the demo session:** send judges the link to the **Judging** page. Each judge types their name and clicks **Download my sheet**. They get a spreadsheet already listing every game, with the weighted total calculated automatically.
2. Judges open it in **Google Sheets** (File → Import → Upload → *Replace spreadsheet*) or Excel, score each game 1–5, and leave their own entry blank.
3. Judges send back their sheet as a CSV (Google Sheets: File → Download → Comma-separated values).
4. **You:** open the Judging page → **Results calculator** → select all the judges' CSV files at once → **Calculate the ranking**. It averages the judges, applies the Silliness tie-break, flags any remaining ties and any bad rows, and gives you a ranked table. Nothing leaves your computer.
5. **People's choice:** create a Google Form (one question: "Which game made you laugh most?", with "Limit to 1 response" turned on), put its link in `votingUrl` in `config.js`, and vote buttons appear across the site.

> **Excel tip:** if a CSV opens with everything squashed into one column (common on computers set to South African regional settings), use Google Sheets instead, or in Excel go to **Data → From Text/CSV** and choose "Comma" as the delimiter.

## 6. Announcing the winners

1. In `games.json`, set `"award"` on the winning entries: `"winner"`, `"runner-up"` and `"peoples-choice"`.
2. In `config.js`, set `winnersAnnounced: true`.
3. Commit. The home page and gallery now show the winners at the top.

---

## Common problems

| What you see | What it means | Fix |
|---|---|---|
| "The game list didn't load" | A typo in `games.json` | Check the **Actions** tab. It names the line. Usually a missing or extra comma |
| "The settings file has a typo" | A typo in `config.js` | Check the **Actions** tab. Usually a missing comma or quote |
| A game shows "The game file is missing" | The file name in `games.json` doesn't match the uploaded file | Capital letters matter. `Sofa-Racer.html` ≠ `sofa-racer.html` |
| Changes don't show up | GitHub Pages takes 1–2 minutes | Wait, then hard-refresh (Ctrl + Shift + R, or Cmd + Shift + R on Mac) |
| A game works on its own but not in the gallery | It uses `localStorage` or loads files from the internet | The Actions log warns about this. Ask the entrant to fix it with their AI (prompts are in the guide's Troubleshooting section) |
| Curly quotes “like this” in your edits | Pasted from Word, Slack or Notes | Retype them as straight quotes `"` |

## Previewing locally (optional, for the technically curious)

Opening `index.html` by double-clicking won't show games, because browsers block the game list for local files. To preview on your own computer, open a terminal in this folder and run `python3 -m http.server 8000`, then visit <http://localhost:8000>. Run `node scripts/validate.mjs` to run the same checks GitHub runs.

## Changing the look

Colours and fonts follow the RAY design system (Archivo Light headlines, Switzer body, warm greys, hairline cards). They're all defined as variables at the top of `assets/site.css`. To match the official design-system tokens exactly, change the values there.

## Security notes

- Games run inside a **sandboxed frame**. They can't read or change the site, other games, or visitors' data.
- Nothing is collected from visitors. There are no accounts, cookies or analytics.
- Assume the site is public. No company data, logos of clients, or anything confidential in any game.

# Backend setup: sign-in, submissions and star ratings

This connects the website to a small free "backend" that runs in your Google account. Once it's done:

- people **sign in with their work Google account** (top right of every page)
- entrants **submit games on the website**, and the games publish to GitHub automatically
- everyone can **rate games 1–5 stars**, and judges **score games on the site**
- every rating, score and submission is saved in **a Google Sheet that you own**

It takes about **30 minutes, once**. You need: your work Google account, and your GitHub account.

You'll collect four values along the way. Keep a note open to paste them into:

| Value | Looks like | From |
|---|---|---|
| GitHub token | `github_pat_11ABC…` | Part B |
| Google Client ID | `1234-abc….apps.googleusercontent.com` | Part C |
| Web app URL | `https://script.google.com/macros/s/AKfy…/exec` | Part E |
| Your work email domain | e.g. `getray.ai` | You know this one |

> ⚠️ **The GitHub token is like a password.** Only paste it into the Apps Script settings (Part D). Never put it in `config.js` or anywhere on GitHub.

---

## Part A: Create the Google Sheet and script (5 min)

1. Sign in to Google with your **work** account, then go to **[sheets.new](https://sheets.new)**.
2. Name the spreadsheet **RAY Bonanza data** (click "Untitled spreadsheet" at the top left).
3. In the menu, click **Extensions → Apps Script**. A code editor opens in a new tab.
4. Click "Untitled project" at the top and rename it **RAY Bonanza backend**.
5. In the editor you'll see a file called `Code.gs` with a few lines in it. **Delete everything** in it.
6. Open [backend/Code.gs on GitHub](https://github.com/jadonnaiken-ui/RAY-Connect/blob/main/backend/Code.gs), click the **Copy raw file** button (two overlapping squares, top right of the code), and paste it into the editor.
7. Press **Ctrl + S** to save.

## Part B: Create a GitHub token (5 min)

This lets the backend publish games to your repository, and nothing else.

1. Go to **[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)**.
2. **Token name:** `Bonanza backend`
3. **Expiration:** choose **Custom** and pick a date about a week after winners are announced.
4. **Repository access:** choose **Only select repositories**, then pick **RAY-Connect**.
5. **Permissions → Repository permissions → Contents:** change to **Read and write**. Leave everything else as it is.
6. Click **Generate token**, then copy the token (it starts with `github_pat_`). GitHub only shows it once.

## Part C: Create the Google sign-in "Client ID" (10 min)

This is what makes the "Sign in with Google" button work on your site.

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**, signed in with your **work** account. Accept the terms if asked.
2. At the top, click the **project picker** (it may say "Select a project") → **New project**. Name it `RAY Bonanza` → **Create**. When it's ready, make sure it's selected in the project picker.
3. In the search bar at the top, type **OAuth consent screen** and open it. (Google may call this section **Google Auth Platform**.) Click **Get started**.
   - **App name:** `RAY Connect Bonanza`
   - **User support email:** your email
   - **Audience:** choose **Internal**. This means only people in your organisation can sign in.
   - **Contact email:** your email. Then agree to the policy and click **Create**.
4. In the left menu, click **Clients** → **Create client**.
   - **Application type:** Web application
   - **Name:** `Bonanza website`
   - **Authorized JavaScript origins** → **Add URI** → type exactly `https://jadonnaiken-ui.github.io` (no slash at the end, nothing after `.io`)
   - Leave "Authorized redirect URIs" empty. Click **Create**.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`). You don't need the client secret.

> If you can't create a project, or "Internal" is greyed out, your company's Google admin has restricted it. Ask IT to create the project for you, or to allow it.

## Part D: Add the settings to the script (5 min)

1. Go back to the Apps Script tab. In the left sidebar, click the **⚙️ gear (Project Settings)**.
2. Scroll down to **Script properties** → **Add script property**. Add these, one per row (names must match exactly, in capitals):

| Property | Value |
|---|---|
| `GITHUB_TOKEN` | your token from Part B |
| `GITHUB_REPO` | `jadonnaiken-ui/RAY-Connect` |
| `GOOGLE_CLIENT_ID` | your Client ID from Part C |
| `ALLOWED_DOMAINS` | your work email domain, e.g. `getray.ai` (separate several with commas) |
| `JUDGE_EMAILS` | the judges' work emails, separated by commas, e.g. `jadon@getray.ai, ronald@getray.ai, joshua@getray.ai` |
| `ADMIN_EMAILS` | your work email (organisers can see standings and submit after the deadline) |

3. Click **Save script properties**.

## Part E: Check it and switch it on (5 min)

1. In the left sidebar, click **< > Editor**.
2. In the toolbar, there's a dropdown showing a function name. Choose **setup**, then click **▶ Run**.
3. Google asks for permission the first time: **Review permissions** → choose your account → **Allow**. (If you see "Google hasn't verified this app", click **Advanced → Go to RAY Bonanza backend**. It's your own script.)
4. The **Execution log** at the bottom shows a checklist. Everything should be ✅. If anything says ❌, it tells you which part to redo.
5. Click **Deploy** (top right) → **New deployment**.
   - Click the ⚙️ next to "Select type" → **Web app**
   - **Description:** `v1`
   - **Execute as:** Me
   - **Who has access:** **Anyone**
   - Click **Deploy**. Allow permissions again if asked.
6. Copy the **Web app URL** (ends in `/exec`).

> **Why "Anyone"?** The website needs to be able to reach the script. That doesn't mean anyone can do anything: the script checks every request for a valid sign-in from your work domain, and rejects everything else. If "Anyone" isn't offered, your Google admin has blocked it, so ask IT.

## Part F: Connect the website (2 min)

1. On GitHub, open `config.js` → **pencil icon**.
2. Fill in:
   ```js
   apiUrl: "https://script.google.com/macros/s/AKfy…/exec",
   googleClientId: "1234-abc….apps.googleusercontent.com",
   workDomain: "getray.ai",
   ```
3. **Commit changes**. Wait about 2 minutes.

## Part G: Test it

1. Open the site. **Sign in** appears at the top right. Sign in with your work account.
2. Open a game in the gallery and rate it. (Toaster Panic is an example and can't be rated, so test this once a real game is in.)
3. Go to **Submit**, fill in the form with a test game and submit. It should appear in the gallery about 2 minutes later.
4. Open the Google Sheet: you'll see tabs called **Submissions** and **Ratings** filling up.
5. On the **Judging** page, judges see a scoring panel when signed in.

To delete a test game: in GitHub, delete its file in `games/` and remove its entry from `games.json`.

---

## Day-to-day

- **See the standings:** in the Google Sheet, use the **Bonanza** menu → **Refresh leaderboards**. A **Leaderboard** tab shows the judges' ranking and the star ranking. Judges and admins can also see standings at the bottom of the Judging page.
- **Remove an inappropriate game:** delete its file in `games/` on GitHub and remove its entry from `games.json`.
- **Change judges:** edit `JUDGE_EMAILS` in Script properties. It takes effect within a few minutes.
- **Close voting:** set `winnersAnnounced: true` in `config.js`. Ratings stop being accepted within 2 minutes.

## If you change `Code.gs` later

Saving isn't enough. The live version only updates when you redeploy: **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy**. The Web app URL stays the same.

## Troubleshooting

| Problem | Fix |
|---|---|
| No "Sign in" button on the site | Check `apiUrl` and `googleClientId` in `config.js`. Ad blockers can also hide it |
| Google says "origin not allowed" or "invalid client" | In Part C, the JavaScript origin must be exactly `https://jadonnaiken-ui.github.io` |
| "Please sign in with your work Google account" | The account's domain isn't in `ALLOWED_DOMAINS` |
| "Couldn't reach the server" | The Web app URL is wrong, or the deployment's "Who has access" isn't **Anyone** |
| Submissions fail with a GitHub error | The token expired or lacks **Contents: Read and write** on RAY-Connect. Make a new one (Part B) and update `GITHUB_TOKEN` |
| A judge doesn't see the scoring panel | Their exact email must be in `JUDGE_EMAILS`. Have them sign out and in again |

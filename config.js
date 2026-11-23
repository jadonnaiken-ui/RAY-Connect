/* =====================================================================
   RAY CONNECT BONANZA: SETTINGS
   ---------------------------------------------------------------------
   This is the ONLY file you need to edit to run the competition.

   How to edit safely (on GitHub):
     1. Open this file on GitHub and click the pencil icon (Edit).
     2. Change the text between the "quotes". Keep the quotes!
     3. Every line inside { } ends with a comma, like this:   name: "Thing",
     4. Click "Commit changes". The site updates in about 1–2 minutes.

   If the site shows "config.js has a typo", you probably deleted a quote,
   a comma, or a bracket. The green/red tick on GitHub's "Actions" tab will
   tell you which line.

   Anything marked  >>> PLACEHOLDER <<<  still needs your real value.
   ===================================================================== */

window.JAM_CONFIG = {

  /* ---------- The basics ---------- */

  // Shown in page titles, the header and the home page.
  name: "RAY Connect Bonanza 2027",

  // One short line under the name.
  tagline: "Two weeka. One HTML file. Supreme silliness.",

  // A friendly paragraph on the home page.
  welcome:
    "Welcome, brave builders! For two weeks, everyone at RAY gets to make the silliest " +
    "browser game they can, with an AI assistant doing the heavy lifting. No coding experience " +
    "needed. The real skill being tested: what can you make with the little you have?",

  /* ---------- Dates ---------- */

  // The moment submissions close. Format: YYYY-MM-DDTHH:MM:SS+HH:MM
  // The "+02:00" part is your timezone (South Africa = +02:00, UK winter = +00:00).
  // The countdown is correct for everyone, wherever they are.
  deadline: "2026-12-08T17:00:00+02:00", // >>> PLACEHOLDER <<<

  // Shown on the home page and in the guide. Add or remove rows freely.
  timeline: [ // >>> PLACEHOLDER dates <<<
    { when: "Tues 24 Nov", what: "Kick-off: the guide and Loom video go out" },
    { when: "Fri 8 Dec, 17:00", what: "Submissions close. Hands off keyboards!" },
    { when: "Tues 15 Dec", what: "Winners announced" }
  ],

  // Change to true once judging is done and you've added "award" values in games.json.
  // The home page and gallery then show the winners at the top.
  winnersAnnounced: false,

  /* ---------- Sign-in, submissions and star ratings ---------- */
  // These two values come from the backend setup (see backend/SETUP.md).
  // While they're "", the Submit page says "opening soon" and star ratings are hidden.
  apiUrl: "",          // the Apps Script "Web app URL", ending in /exec
  googleClientId: "",  // ends in .apps.googleusercontent.com

  // Your work email domain, e.g. "getray.ai". Used for the sign-in hint and messages.
  // (The real check happens in the backend's ALLOWED_DOMAINS setting.)
  workDomain: "",

  // People's choice goes to the highest average star rating among games
  // with at least this many ratings, so one lucky 5-star can't win it.
  minRatingsForPeoplesChoice: 5,

  // Your Loom walkthrough. From a link like https://www.loom.com/share/abc123def456
  // copy only the last part: "abc123def456". Leave as "" to hide the video.
  // Remember to set the Loom to "Anyone with the link can view".
  loomId: "",

  // Who people should ask for help.
  contact: "Jadon in the RAY Connect chat",

  /* ---------- People and prizes ---------- */

  // Leave as [] to show "Judges will be announced at kick-off".
  // (Their email addresses go in the backend's JUDGE_EMAILS setting, so they can score on the site.)
  judges: ["Jadon", "Ronald", "Joshua"], // e.g. ["Thandi", "Sam", "Priya"]

  // Prizes. Edit the amounts and wording. Remove a block to remove a prize.
  prizes: [ // >>> PLACEHOLDER amounts <<<
    { title: "Grand champion", amount: "$100", description: "Highest score from the judges. Eternal glory included." },
    { title: "Runner-up", amount: "$50", description: "Second-highest score. Still extremely silly." },
    { title: "People's choice", amount: "$30", description: "Highest average star rating from everyone. Charm the crowd." }
  ],

  // The AI assistants people can pick from when they submit.
  llms: ["Claude", "ChatGPT", "Gemini", "Copilot", "Other"],

  /* ---------- The "Sample game" page ---------- */
  // This tells the story of one game from first prompt to upload.
  // Swap it for YOUR game once it's in games.json, and set isPlaceholder to false.
  showcase: {
    isPlaceholder: true,
    slug: "organisers-toaster-panic",       // must match a "slug" in games.json
    builder: "The organisers",
    llm: "Claude",
    timeSpent: "About 45 minutes",
    idea: "A toaster that has become self-aware and launches breakfast at the ceiling. You catch it on a plate.",
    // The exact follow-up messages sent to the AI after the starter prompt, in order.
    followUps: [
      "Make the toaster have a face, and make it get angrier and redder as the score goes up.",
      "Every few seconds the toaster should say something unhinged in a speech bubble.",
      "Add croissants worth 5 points, and socks that cost you a life if you catch them.",
      "Add little sound effects using the Web Audio API: a pop when toast launches, a ding when I catch it.",
      "On my phone I can't move the plate. Make it follow my finger when I drag.",
      "When the game ends, give me a silly rank title based on my score."
    ],
    lessons: [
      "Ask for one change at a time. Big lists of changes tend to break things.",
      "When something breaks, describe what you SEE (\"the plate disappears when I touch it\"), not what you think the code problem is.",
      "Play it on your phone before you submit. Touch controls are the thing AIs most often forget."
    ]
  }
};

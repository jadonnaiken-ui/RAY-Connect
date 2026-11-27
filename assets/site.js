/* =====================================================================
   RAY Connect Bonanza: site logic
   Hosts never need to edit this file. Settings live in config.js,
   entries live in games.json (the backend adds new entries automatically).
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- Shared content ---------------- */

  var STARTER_PROMPT = [
    "Make me a silly browser game as a single, self-contained HTML file.",
    "",
    "Requirements:",
    "- All HTML, CSS and JavaScript in one file. No external images, libraries,",
    "  fonts or network requests. Draw everything with code, emoji or inline SVG.",
    "  Use the Web Audio API for any sound.",
    "- Works in a normal web browser on a laptop, and on a phone with touch.",
    "- Shows a one-sentence \"how to play\" on screen.",
    "- Has a clear goal, score, or win/lose moment, plus a restart button.",
    "- Don't use localStorage, cookies or alert() pop-ups. It will run inside",
    "  a sandboxed frame where those don't work.",
    "- Prioritise being funny and absurd, but it must actually work.",
    "",
    "My game idea: [DESCRIBE YOUR RIDICULOUS IDEA HERE]"
  ].join("\n");

  var RUBRIC = [
    { name: "Silliness", weight: 40, mult: 8, look: "Made us laugh. The absurdity is intentional and central to the game." },
    { name: "Playability", weight: 20, mult: 4, look: "It works, the controls make sense, and there's a goal or a score." },
    { name: "Originality", weight: 20, mult: 4, look: "A fresh idea, or a familiar game twisted into something new." },
    { name: "Presentation", weight: 10, mult: 2, look: "A title, on-screen instructions and a good one-line pitch." },
    { name: "Wildcard", weight: 10, mult: 2, look: "Anything delightful the other criteria miss." }
  ];

  var RULES = [
    ["One HTML file", "Everything in a single .html file that works without the internet."],
    ["Understandable in 30 seconds", "Put a one-line \"how to play\" on screen."],
    ["Must be playable", "A goal or a score, and a way to restart."],
    ["No company data", "No logos or confidential info. The site is public."],
    ["Any tool goes", "Any AI assistant, or code it yourself. Solo, one game each."],
    ["Keep it kind", "Silly, not mean."],
    ["The deadline is firm", "Late entries can't be accepted."],
    ["Get people playing", "People's choice needs at least {min} star ratings. Submit early and share your link."]
  ];

  var AWARD_LABEL = { "winner": "Winner", "runner-up": "Runner-up", "peoples-choice": "People's choice" };
  var AWARD_ORDER = ["winner", "runner-up", "peoples-choice"];

  var NAV = [
    ["index.html", "Home", "home"],
    ["gallery.html", "Gallery", "gallery"],
    ["guide.html", "Guide", "guide"],
    ["submit.html", "Submit", "submit"],
    ["judging.html", "Judging", "judging"],
    ["sample.html", "Sample game", "sample"],
    ["resources.html", "Resources", "resources"]
  ];

  var ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z"/>'
  };
  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[name] + "</svg>";
  }

  /* ---------------- Helpers ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function slot(name) { return $('[data-slot="' + name + '"]'); }
  function fill(name, html) { var el = slot(name); if (el) el.innerHTML = html; return el; }
  function hide(name) { $$('[data-show="' + name + '"]').forEach(function (el) { el.hidden = true; }); }

  function joinNames(list) {
    if (!list || !list.length) return "";
    if (list.length === 1) return list[0];
    return list.slice(0, -1).join(", ") + " & " + list[list.length - 1];
  }

  function slugify(text) {
    return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "0"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return Promise.resolve(ok);
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    }
    return fallback();
  }

  function announce(msg) {
    var live = $("#live-region");
    if (!live) return;
    live.textContent = "";
    setTimeout(function () { live.textContent = msg; }, 50);
  }

  var toastTimer;
  function toast(msg, kind) {
    var el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 4000);
  }

  // Any button with data-copy="#id" copies that element's text.
  function bindCopyButtons(root) {
    $$("[data-copy]", root).forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      var original = btn.innerHTML;
      btn.addEventListener("click", function () {
        var target = $(btn.getAttribute("data-copy"));
        if (!target) return;
        copyText(target.textContent).then(function (ok) {
          if (ok) {
            btn.innerHTML = icon("check") + " Copied";
            btn.setAttribute("data-copied", "true");
            announce("Copied to clipboard");
          } else {
            btn.textContent = "Select the text and copy manually";
          }
          setTimeout(function () { btn.innerHTML = original; btn.removeAttribute("data-copied"); }, 2200);
        });
      });
    });
  }

  /* ---------------- Config ---------------- */

  // Escapes text, then turns the chat's name into a link to the group chat.
  function withChatLink(text) {
    var html = esc(text);
    if (!CFG || !CFG.chatUrl || !CFG.chatName) return html;
    var name = esc(CFG.chatName);
    var link = '<a href="' + esc(CFG.chatUrl) + '" target="_blank" rel="noopener">' + name + "</a>";
    return html.indexOf(name) !== -1 ? html.replace(name, link) : html;
  }
  function contactHtml() { return withChatLink(CFG.contact || "the organisers"); }

  var CFG = window.JAM_CONFIG;
  var page = document.body.getAttribute("data-page");

  function apiOn() { return !!(CFG && CFG.apiUrl && CFG.googleClientId); }

  function renderShell() {
    var name = (CFG && CFG.name) || "RAY Connect Bonanza";
    var parts = name.match(/^(.*?)(\s+\d{4})?$/);
    var header = $("#site-header");
    if (header) {
      header.outerHTML =
        '<a class="skip-link" href="#main">Skip to content</a>' +
        '<header class="site-header"><div class="wrap">' +
        '<a class="brand" href="index.html"><b>' + esc(parts[1]) + "</b>" + (parts[2] ? "<span>" + esc(parts[2].trim()) + "</span>" : "") + "</a>" +
        '<nav class="site-nav" id="site-nav" aria-label="Main"><ul>' +
        NAV.map(function (n) {
          return '<li><a href="' + n[0] + '"' + (n[2] === page ? ' aria-current="page"' : "") + ">" + n[1] + "</a></li>";
        }).join("") +
        "</ul></nav>" +
        '<div class="header-end"><div class="auth-slot" data-auth="compact"></div>' +
        '<button class="btn btn-small nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">' + icon("menu") + '<span class="visually-hidden">Menu</span></button></div>' +
        "</div></header>";
      var toggle = $(".nav-toggle"), nav = $("#site-nav");
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }
    var footer = $("#site-footer");
    if (footer) {
      footer.outerHTML =
        '<footer class="site-footer"><div class="wrap">' +
        "<span>" + esc(name) + "</span>" +
        "<span>" + (CFG && CFG.contact ? "Questions? Message " + contactHtml() + "." : "") + "</span>" +
        '<p class="footer-note">You must sign in with your RAY Google account to submit a game and to rate others.</p>' +
        "</div></footer>";
    }
    var live = document.createElement("div");
    live.id = "live-region"; live.className = "visually-hidden";
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(live);
    if (CFG && CFG.name) document.title = document.title.replace("{name}", CFG.name);
  }

  function renderConfigError() {
    var main = $("#main") || document.body;
    document.title = "Settings need fixing";
    main.innerHTML =
      '<div class="wrap"><div class="error-box config-error">' +
      "<h2>The settings file has a typo</h2>" +
      "<p>The site couldn't read <code>config.js</code>, so it can't show this page yet.</p>" +
      "<p><strong>If you're the organiser:</strong> open <code>config.js</code> on GitHub and check the lines you changed last. Usually it's one of these:</p>" +
      "<ul><li>A missing comma at the end of a line</li>" +
      "<li>A missing or extra quote mark <code>\"</code></li>" +
      "<li>Curly “smart quotes” pasted from Word or Slack instead of straight quotes</li>" +
      "<li>A deleted <code>{</code>, <code>}</code>, <code>[</code> or <code>]</code></li></ul>" +
      "<p>The <strong>Actions</strong> tab on GitHub names the exact line that's broken.</p>" +
      "<p><strong>If you're a visitor:</strong> please let the organisers know. They'll fix it in a minute.</p>" +
      "</div></div>";
  }

  /* ---------------- Sign-in (Google) and the backend ---------------- */

  var Auth = { token: null, me: null, loading: false, gsi: false, failed: false, subs: [] };

  // The sign-in is remembered in this browser until it expires (6 hours) or you sign out.
  var SESSION_KEY = "bonanza.session";

  function saveSession(token, expires) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ token: token, expires: expires, me: Auth.me, savedAt: Date.now() })); } catch (e) { /* private mode */ }
  }
  // Keep the saved copy of "me" (ratings, games, scores) in step after a change.
  function persistMe() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (s && s.token === Auth.token) saveSession(s.token, s.expires);
    } catch (e) { /* ignore */ }
  }
  function loadSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (s && s.token && s.expires > Date.now() + 60000) return s;
    } catch (e) { /* ignore */ }
    clearSession();
    return null;
  }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } }

  function tokenExpiry(jwt) {
    try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000; } catch (e) { return Date.now() + 50 * 60000; }
  }

  function onAuth(fn) { Auth.subs.push(fn); }
  function authChanged() {
    renderAuthSlots();
    Auth.subs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  function signedIn() { return !!(Auth.me && Auth.token); }

  // Actions that are safe to repeat if the first try hits a hiccup.
  var RETRYABLE = { me: 1, rate: 1, judge: 1, results: 1, signout: 1 };

  function transient(message) { var e = new Error(message); e.transient = true; return e; }

  function api(action, data, attempt) {
    attempt = attempt || 1;
    var body = Object.assign({ action: action, idToken: Auth.token }, data || {});
    // Sent as plain text so the browser doesn't need a CORS preflight.
    return fetch(CFG.apiUrl, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { throw transient("The server didn't respond properly. Please try again."); });
      }, function () { throw transient("Couldn't reach the server. Check your connection and try again."); })
      .then(function (res) {
        if (res.ok) return res;
        if (/busy|in a moment/i.test(res.error || "")) throw transient(res.error);
        if (res.code === "auth" && action !== "me") {
          Auth.token = null; Auth.me = null; clearSession(); authChanged();
          if (window.google && google.accounts) google.accounts.id.prompt();
        }
        var err = new Error(res.error || "Something went wrong.");
        err.code = res.code;
        throw err;
      })
      .catch(function (err) {
        // Brief hiccups (network blips, a busy moment) are retried for actions that are safe to repeat.
        if (!err.transient || !RETRYABLE[action] || attempt >= 3) throw err;
        return new Promise(function (r) { setTimeout(r, attempt * 1200); }).then(function () { return api(action, data, attempt + 1); });
      });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.onload = resolve;
      s.onerror = function () { reject(new Error("load")); };
      document.head.appendChild(s);
    });
  }

  function initAuth() {
    if (!apiOn()) return;
    var saved = loadSession();
    if (saved) {
      // Signed in on an earlier page: show it straight away, then refresh ratings etc. quietly.
      Auth.token = saved.token;
      Auth.me = saved.me;
      authChanged();
      // Signed in moments ago on another page? Skip the check to keep page changes instant.
      if (saved.savedAt && Date.now() - saved.savedAt < 90000) { startGoogle(false); return; }
      refreshMe().then(function () { saveSession(saved.token, saved.expires); authChanged(); }, function (e) {
        if (e.code !== "auth") return; // offline for a moment: keep the saved sign-in
        Auth.token = null; Auth.me = null; clearSession(); authChanged();
        if (Auth.gsi) google.accounts.id.prompt(); else Auth.wantPrompt = true;
      });
      startGoogle(false);
      return;
    }
    startGoogle(true);
  }

  function startGoogle(promptNow) {
    loadScript("https://accounts.google.com/gsi/client").then(function () {
      var opts = { client_id: CFG.googleClientId, callback: onCredential, auto_select: true, cancel_on_tap_outside: true, use_fedcm_for_prompt: true };
      if (CFG.workDomain) opts.hd = CFG.workDomain;
      google.accounts.id.initialize(opts);
      Auth.gsi = true;
      renderAuthSlots();
      if ((promptNow || Auth.wantPrompt) && !signedIn()) google.accounts.id.prompt();
    }, function () { Auth.failed = true; renderAuthSlots(); });
  }

  function onCredential(resp) {
    Auth.token = resp.credential;
    Auth.loading = true;
    renderAuthSlots();
    refreshMe().then(function (me) {
      // Swap Google's 1-hour token for the backend's longer session pass, if it gave one.
      if (me.session) { Auth.token = me.session.token; saveSession(me.session.token, me.session.expires); }
      else saveSession(Auth.token, tokenExpiry(Auth.token));
      toast("Signed in as " + Auth.me.user.name);
    }, function (e) {
      Auth.token = null;
      toast(e.message, "bad");
    }).then(function () { Auth.loading = false; authChanged(); });
  }

  // Signing in or out in one tab updates the others.
  window.addEventListener("storage", function (e) {
    if (e.key !== SESSION_KEY || !apiOn()) return;
    var s = loadSession();
    Auth.token = s ? s.token : null;
    Auth.me = s ? s.me : null;
    authChanged();
  });

  function refreshMe() {
    return api("me").then(function (me) { Auth.me = me; persistMe(); return me; });
  }

  function signOut() {
    if (Auth.token) api("signout").catch(function () { /* already gone */ });
    Auth.token = null; Auth.me = null;
    clearSession();
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
    authChanged();
    toast("Signed out");
  }

  function renderAuthSlots() {
    $$(".auth-slot").forEach(function (el) {
      if (!apiOn()) { el.innerHTML = ""; return; }
      var big = el.getAttribute("data-auth") === "large";
      if (Auth.loading) { el.innerHTML = '<span class="muted auth-note">Signing in…</span>'; return; }
      if (signedIn()) {
        el.innerHTML = '<span class="auth-name">' + esc(Auth.me.user.givenName || Auth.me.user.name) + "</span>" +
          '<button class="btn btn-small" type="button" data-signout>Sign out</button>';
        $("[data-signout]", el).addEventListener("click", signOut);
        return;
      }
      if (Auth.failed) { el.innerHTML = '<span class="muted auth-note">Sign-in unavailable. Try turning off ad blockers.</span>'; return; }
      if (!Auth.gsi) { el.innerHTML = ""; return; }
      el.innerHTML = '<div class="gsi-btn"></div>';
      var dark = matchMedia("(prefers-color-scheme: dark)").matches;
      google.accounts.id.renderButton($(".gsi-btn", el), {
        theme: dark ? "filled_black" : "outline", size: big ? "large" : "medium",
        shape: "pill", text: big ? "signin_with" : "signin", logo_alignment: "left"
      });
    });
  }

  /* ---------------- Ratings ---------------- */

  var Stats = {};
  function loadStats() {
    if (!apiOn()) return Promise.resolve(Stats);
    var get = function () { return fetch(CFG.apiUrl + "?action=stats").then(function (r) { return r.json(); }); };
    return get().catch(function () { return new Promise(function (r) { setTimeout(r, 1500); }).then(get); })
      .then(function (res) { Stats = (res && res.ratings) || {}; return Stats; }, function () { return Stats; });
  }

  function ratable(g) { return apiOn() && !g.excludeFromJudging; }

  function starSummary(slug) {
    var s = Stats[slug];
    if (!s || !s.count) return "No ratings yet";
    return "★ " + s.avg.toFixed(1) + " · " + plural(s.count, "rating");
  }

  function myRating(slug) { return signedIn() && Auth.me.myRatings ? Auth.me.myRatings[slug] || 0 : 0; }

  function starsWidget(g) {
    var mine = myRating(g.slug);
    var closed = CFG.winnersAnnounced;
    var html = '<div class="rate" role="radiogroup" aria-label="Your rating for ' + esc(g.title) + '">';
    for (var n = 1; n <= 5; n++) {
      html += '<button type="button" role="radio" class="star' + (n <= mine ? " on" : "") + '" data-stars="' + n + '" aria-checked="' + (n === mine) + '" aria-label="' + plural(n, "star") + '"' + (closed ? " disabled" : "") + ">" + icon("star") + "</button>";
    }
    return html + "</div>";
  }

  function bindStars(root, g, onDone) {
    $$("[data-stars]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!signedIn()) { toast("Sign in with your work Google account to rate games."); if (window.google && google.accounts) google.accounts.id.prompt(); return; }
        var stars = Number(btn.getAttribute("data-stars"));
        $$("[data-stars]", root).forEach(function (b) { b.disabled = true; });
        api("rate", { slug: g.slug, stars: stars }).then(function (res) {
          Auth.me.myRatings[g.slug] = stars;
          persistMe();
          Auth.me.myRatedVersions = Auth.me.myRatedVersions || {};
          Auth.me.myRatedVersions[g.slug] = res.version || 1;
          if (res.stats) Stats[g.slug] = res.stats;
          toast("You gave " + g.title + " " + plural(stars, "star") + ". You can change it any time.", "good");
          if (onDone) onDone();
        }, function (e) {
          toast(e.message, "bad");
          $$("[data-stars]", root).forEach(function (b) { b.disabled = false; });
        });
      });
    });
  }

  /* ---------------- Rate after playing ---------------- */
  // Once someone has played a game for PLAY_SECONDS (their "first go"), they're asked to rate it
  // before moving on: when they leave the game, and on any page until they do. Signed-out players
  // are asked to sign in first. Ratings can still be changed later from the game's page.
  var PLAY_SECONDS = 20;
  var PLAY_INPUTS = 3; // ...or this many key presses / clicks / taps inside the game
  var PAUSE_SECONDS = 6; // after playing, this long without input usually means the round is over
  var ANON_KEY = "bonanza.played.anon";

  function playedKey() { return signedIn() ? "bonanza.played." + Auth.me.user.email : ANON_KEY; }
  function readMap(key) { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; } }
  function playedMap() { return readMap(playedKey()); }
  function markPlayed(slug) {
    var m = playedMap();
    if (m[slug]) return;
    m[slug] = Date.now();
    try { localStorage.setItem(playedKey(), JSON.stringify(m)); } catch (e) { /* private mode */ }
  }
  // Games played before signing in count once they sign in.
  function adoptAnonPlays() {
    if (!signedIn()) return;
    var anon = readMap(ANON_KEY), keys = Object.keys(anon);
    if (!keys.length) return;
    var m = playedMap();
    keys.forEach(function (k) { if (!m[k]) m[k] = anon[k]; });
    try { localStorage.setItem(playedKey(), JSON.stringify(m)); localStorage.removeItem(ANON_KEY); } catch (e) { /* ignore */ }
  }
  function isMine(g) { return signedIn() && (Auth.me.mySubmissions || []).some(function (x) { return x.slug === g.slug; }); }
  // Signed-in players: games that aren't theirs and they haven't rated. Signed-out: any ratable game.
  function needsRating(g) {
    if (!ratable(g) || CFG.winnersAnnounced) return false;
    return !signedIn() || (!isMine(g) && !myRating(g.slug));
  }

  // The earliest game this person has played but not yet rated (ignoring the one they're on).
  function owedRating(games, exceptSlug) {
    var m = playedMap();
    return games.filter(function (g) { return m[g.slug] && g.slug !== exceptSlug && needsRating(g); })
      .sort(function (a, b) { return m[a.slug] - m[b.slug]; })[0] || null;
  }

  var gateState = null; // { game, opts } while the box is open, so it can update after sign-in

  function closeGate() {
    var el = $("#rating-gate");
    if (el) el.remove();
    gateState = null;
    document.body.classList.remove("gate-open");
  }

  // leaving: true when they're leaving the game they just played (they may choose to keep playing).
  function showRatingGate(g, opts) {
    opts = opts || {};
    var el = $("#rating-gate");
    if (!el) {
      el = document.createElement("div");
      el.className = "gate";
      el.id = "rating-gate";
      document.body.appendChild(el);
      document.body.classList.add("gate-open");
    }
    gateState = { game: g, opts: opts };
    var ask = signedIn()
      ? '<div class="gate-stars">' + starsWidget(g) + "</div>"
      : '<p class="gate-signin">Sign in with your RAY Google account to rate it.</p><div class="auth-slot gate-auth" data-auth="large"></div>';
    el.innerHTML = '<div class="gate-card" role="dialog" aria-modal="true" aria-labelledby="gate-title">' +
      '<span class="gate-emoji" aria-hidden="true">' + esc(g.emoji || "🎮") + "</span>" +
      '<h2 id="gate-title">' + (opts.round ? "Round over! " : "") + "How was " + esc(g.title) + (opts.paused ? " so far" : "") + "?</h2>" +
      '<p class="muted">' + (opts.round || opts.paused ? "Rate it now, or keep playing and rate it later." : opts.leaving ? "Rate it before you go." : "You played this earlier. Rate it before you carry on.") +
      " It counts towards People's choice. Ratings are anonymous, and you can change yours any time.</p>" +
      ask +
      (opts.leaving || opts.round || opts.paused
        ? '<button type="button" class="btn btn-small" data-gate-stay>' + (opts.round ? "Play again" : "Keep playing") + "</button>"
        : '<a class="btn btn-small" href="play.html?game=' + encodeURIComponent(g.slug) + '">Play it again first</a>') +
      "</div>";
    if (signedIn()) bindStars(el, g, function () { closeGate(); if (opts.after) opts.after(); });
    else renderAuthSlots();
    var stay = $("[data-gate-stay]", el);
    if (stay) {
      stay.addEventListener("click", closeGate);
      el.onkeydown = function (e) { if (e.key === "Escape") closeGate(); };
    }
    var first = $("[data-stars]", el);
    if (first) first.focus();
  }

  // After signing in from the box: show the stars, or move on if it's their own game / already rated.
  function refreshGate() {
    if (!gateState || !signedIn()) return;
    var g = gateState.game, opts = gateState.opts;
    if (needsRating(g)) showRatingGate(g, opts);
    else { closeGate(); if (opts.after) opts.after(); }
  }

  // On every page: if they owe a rating, ask for it (one game at a time).
  function checkOwedRatings(exceptSlug) {
    if (!apiOn() || $("#rating-gate")) return;
    loadGames().then(function (games) {
      var g = owedRating(games, exceptSlug);
      if (g && !$("#rating-gate")) showRatingGate(g, { after: function () { checkOwedRatings(exceptSlug); } });
    }, function () { /* the page shows its own error */ });
  }

  /* ---------------- Deadline / status ---------------- */

  function deadlineMs() { return Date.parse(CFG.deadline); }
  function submissionsOpen() { var d = deadlineMs(); return isNaN(d) || Date.now() < d; }

  function phase() {
    if (CFG.winnersAnnounced) return "winners";
    return submissionsOpen() ? "open" : "closed";
  }

  function formatDeadline() {
    var d = new Date(deadlineMs());
    try {
      return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(d);
    } catch (e) { return d.toString(); }
  }

  function countdownText(ms) {
    var mins = Math.floor(ms / 60000);
    var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    if (d > 0) return plural(d, "day") + ", " + plural(h, "hour");
    if (h > 0) return plural(h, "hour") + ", " + plural(m, "minute");
    return m > 0 ? plural(m, "minute") : "less than a minute";
  }

  function renderStatus() {
    var el = slot("status");
    if (!el) return;
    var p = phase();
    if (isNaN(deadlineMs())) {
      el.innerHTML = '<p class="status-banner">The deadline in config.js isn\'t a valid date yet.</p>';
      return;
    }
    if (p === "winners") {
      el.innerHTML = '<p class="status-banner live"><span class="dot"></span>The winners are in. <a href="gallery.html">See them in the gallery</a></p>';
      return;
    }
    if (p === "closed") {
      el.innerHTML = '<p class="status-banner"><span class="dot"></span>Submissions closed. Judging in progress.' + (apiOn() ? ' <a href="gallery.html">Keep rating games</a>' : "") + "</p>";
      return;
    }
    el.innerHTML =
      '<p class="status-label" data-cd="text"></p>' +
      '<div class="countdown" aria-hidden="true">' +
      ["days", "hours", "minutes", "seconds"].map(function (u) {
        return '<div class="unit"><span class="num" data-cd="' + u + '">00</span><span class="lbl">' + u + "</span></div>";
      }).join("") +
      '</div><p class="status-note">Deadline: ' + esc(formatDeadline()) + " (shown in your local time)</p>";

    function tick() {
      var left = deadlineMs() - Date.now();
      if (left <= 0) { clearInterval(timer); renderStatus(); return; }
      var s = Math.floor(left / 1000);
      var vals = { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
      Object.keys(vals).forEach(function (k) {
        var n = $('[data-cd="' + k + '"]', el);
        if (n) n.textContent = String(vals[k]).padStart(2, "0");
      });
      var t = $('[data-cd="text"]', el);
      var txt = "Submissions close in " + countdownText(left);
      if (t && t.textContent !== txt) t.textContent = txt;
    }
    var timer = setInterval(tick, 1000);
    tick();
  }

  /* ---------------- Shared renderers ---------------- */

  function renderPrizes() {
    var prizes = CFG.prizes || [];
    if (!prizes.length) { hide("prizes"); return; }
    fill("prizes", prizes.map(function (p) {
      return '<article class="card prize"><h3>' + esc(p.title) + '</h3><span class="amount">' + esc(p.amount || "") + '</span><p class="muted">' + esc(p.description || "") + "</p></article>";
    }).join(""));
  }

  function renderRules() {
    fill("rules", RULES.map(function (r) {
      return "<li><strong>" + esc(r[0]) + "</strong>" + esc(r[1].replace("{min}", CFG.minRatingsForPeoplesChoice || 5)) + "</li>";
    }).join(""));
  }

  function renderCriteria() {
    fill("criteria", RUBRIC.map(function (c) {
      return '<div class="criterion"><span>' + c.name + '</span><span class="bar"><span style="width:' + c.weight * 2.5 + '%"></span></span><span class="pct">' + c.weight + "%</span></div>";
    }).join(""));
  }

  function renderTimeline() {
    var tl = CFG.timeline || [];
    if (!tl.length) { hide("timeline"); return; }
    fill("timeline", tl.map(function (t) {
      return '<li><span class="when">' + esc(t.when) + "</span>" + esc(t.what) + "</li>";
    }).join(""));
  }

  function renderConfigText() {
    $$("[data-contact]").forEach(function (el) { el.innerHTML = contactHtml(); });
    $$("[data-config-name]").forEach(function (el) { el.textContent = CFG.name; });
    $$("[data-config-tagline]").forEach(function (el) { el.textContent = CFG.tagline || ""; });
    $$("[data-config-welcome]").forEach(function (el) { el.textContent = CFG.welcome || ""; });
    $$("[data-min-ratings]").forEach(function (el) { el.textContent = CFG.minRatingsForPeoplesChoice || 5; });
    $$("[data-max-updates]").forEach(function (el) { el.textContent = CFG.maxUpdates == null ? 2 : CFG.maxUpdates; });
    $$("[data-work-domain]").forEach(function (el) { el.textContent = CFG.workDomain ? "@" + CFG.workDomain : "work"; });
    $$("[data-api-only]").forEach(function (el) { el.hidden = !apiOn(); });
    $$("[data-chat-link]").forEach(function (a) {
      if (CFG.chatUrl) { a.href = CFG.chatUrl; a.target = "_blank"; a.rel = "noopener"; if (CFG.chatName) a.textContent = CFG.chatName; }
      else a.replaceWith(document.createTextNode(a.textContent));
    });
  }

  function judgeList() {
    return (CFG.judges || []).map(function (j) { return typeof j === "string" ? { name: j } : j; }).filter(function (j) { return j && j.name; });
  }

  function renderJudges() {
    var judges = judgeList();
    fill("judges", judges.length ? esc(joinNames(judges.map(function (j) { return j.name; }))) : "The judges will be announced at kick-off.");
    var el = fill("judge-list", judges.map(function (j) {
      return '<li>' + avatar(j.photo, j.name, "lg") + '<strong>' + esc(j.name) + "</strong>" + (j.role ? '<span class="muted">' + esc(j.role) + "</span>" : "") + "</li>";
    }).join(""));
    if (el) bindAvatarFallbacks(el);
    if (!judges.length) hide("judges");
  }

  /* ---------------- Games ---------------- */

  function loadGames() {
    if (location.protocol === "file:") {
      return Promise.reject({ kind: "file" });
    }
    return fetch("games.json", { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw { kind: "http", status: res.status };
      return res.text();
    }).then(function (text) {
      var data;
      try { data = JSON.parse(text); } catch (e) { throw { kind: "json", detail: e.message }; }
      if (!Array.isArray(data)) throw { kind: "json", detail: "The file should start with [ and end with ]." };
      return data.filter(function (g) { return g && g.slug && g.title && g.file; });
    });
  }

  function gamesErrorHtml(err) {
    var body;
    if (err && err.kind === "file") {
      body = "<p>You've opened this page straight from your computer. Browsers block the game list when a page is opened as a local file, so the gallery only works once it's on GitHub Pages.</p>" +
        "<p>To preview on your own computer, see “Previewing locally” in the README.</p>";
    } else if (err && err.kind === "json") {
      body = "<p>The list of games (<code>games.json</code>) has a typo, so the browser can't read it. Usually it's a missing comma between two entries, or an extra comma after the last one.</p>" +
        "<p>The <strong>Actions</strong> tab on GitHub names the exact line.</p>" +
        (err.detail ? "<pre>" + esc(err.detail) + "</pre>" : "");
    } else {
      body = "<p>The list of games didn't load" + (err && err.status ? " (error " + esc(err.status) + ")" : "") + ". Check your connection and refresh. If it keeps happening, message " + contactHtml() + ".</p>";
    }
    return '<div class="error-box"><h3>The game list didn\'t load</h3>' + body + "</div>";
  }

  function recent(date) {
    if (!date) return false;
    var t = Date.parse(date + "T00:00:00");
    return !isNaN(t) && Date.now() >= t && Date.now() - t < 36 * 3600 * 1000;
  }

  function initials(name) {
    return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase();
  }

  // A round photo, or initials when there's no photo (or it fails to load).
  function avatar(src, name, size) {
    var cls = "avatar" + (size ? " avatar-" + size : "");
    var fallback = '<span class="' + cls + '" aria-hidden="true">' + esc(initials(name)) + "</span>";
    if (!src) return fallback;
    return '<img class="' + cls + '" src="' + esc(src) + '" alt="" loading="lazy" data-initials="' + esc(initials(name)) + '">';
  }

  function bindAvatarFallbacks(root) {
    $$("img.avatar[data-initials]", root).forEach(function (img) {
      img.addEventListener("error", function () {
        var span = document.createElement("span");
        span.className = img.className;
        span.setAttribute("aria-hidden", "true");
        span.textContent = img.getAttribute("data-initials");
        img.replaceWith(span);
      });
    });
  }

  function isNew(g) {
    if (!g.added) return false;
    var added = Date.parse(g.added + "T00:00:00");
    return !isNaN(added) && Date.now() - added < 36 * 3600 * 1000 && Date.now() >= added;
  }

  function gameCard(g, opts) {
    opts = opts || {};
    var visual = '<span aria-hidden="true">' + esc(g.emoji || "🎮") + "</span>";
    var thumb = g.thumbnail
      ? '<img src="' + esc(g.thumbnail) + '" alt="" loading="lazy" data-fallback="' + esc(g.emoji || "🎮") + '">'
      : visual;
    var badges = [];
    if (isNew(g)) badges.push('<span class="sticker mint">New</span>');
    else if (recent(g.updated)) badges.push('<span class="sticker mint">Updated</span>');
    if (Number(g.version) > 1) badges.push('<span class="sticker">v' + Number(g.version) + "</span>");
    if (g.excludeFromJudging) badges.push('<span class="sticker">Example, not judged</span>');
    var meta = [];
    if (g.llm) meta.push('<span class="sticker">Made with ' + esc(g.llm) + "</span>");
    if (ratable(g)) {
      meta.push('<span class="sticker stars-sticker">' + esc(starSummary(g.slug)) + "</span>");
      var mine = myRating(g.slug);
      if (mine) meta.push('<span class="sticker mint">You: ' + "★".repeat(mine) + "</span>");
    }
    return '<a class="game-card" href="play.html?game=' + encodeURIComponent(g.slug) + '">' +
      '<div class="game-thumb">' + thumb + "</div>" +
      (badges.length ? '<div class="badges">' + badges.join("") + "</div>" : "") +
      (opts.award ? '<span class="award-tag">' + esc(AWARD_LABEL[g.award] || g.award) + "</span>" : "") +
      '<div class="game-body"><h3>' + esc(g.title) + "</h3>" +
      '<p class="game-by">' + avatar(g.photo, (g.authors || [])[0]) + "<span>by " + esc(joinNames(g.authors || [])) + "</span></p>" +
      '<p class="game-blurb">' + esc(g.blurb || "") + "</p>" +
      '<div class="game-meta">' + meta.join("") + "</div>" +
      "</div></a>";
  }

  function bindThumbFallbacks(root) {
    bindAvatarFallbacks(root);
    $$("img[data-fallback]", root).forEach(function (img) {
      img.addEventListener("error", function () {
        var span = document.createElement("span");
        span.setAttribute("aria-hidden", "true");
        span.textContent = img.getAttribute("data-fallback");
        img.replaceWith(span);
      });
    });
  }

  function winnersHtml(games) {
    if (!CFG.winnersAnnounced) return "";
    var winners = games.filter(function (g) { return AWARD_ORDER.indexOf(g.award) !== -1; })
      .sort(function (a, b) { return AWARD_ORDER.indexOf(a.award) - AWARD_ORDER.indexOf(b.award); });
    if (!winners.length) return "";
    return '<h2>The winners</h2><div class="winners">' + winners.map(function (g) { return gameCard(g, { award: true }); }).join("") + "</div>";
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Games run in a sandbox where browser storage is blocked. Many AI-made games read saved
  // scores or settings the moment they start, and that error stops the whole game. This small
  // script runs first and gives each game a stand-in storage that lasts until the page closes.
  var SANDBOX_SHIM = "(function(){function m(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}[\"localStorage\",\"sessionStorage\"].forEach(function(n){var ok=false;try{var s=window[n];s.setItem(\"__t\",\"1\");s.removeItem(\"__t\");ok=true}catch(e){}if(!ok){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(e){}}});try{document.cookie}catch(e){var c=\"\";try{Object.defineProperty(document,\"cookie\",{get:function(){return c},set:function(v){c=String(v).split(\";\")[0]},configurable:true})}catch(e2){}}})();";
  // Used in the Submit preview: reports errors back to this page so entrants can fix them.
  var ERROR_REPORTER = "(function(){var n=0;function send(m,l){if(n++<5)parent.postMessage({bonanza:\"error\",message:String(m||\"Unknown error\"),line:l||0},\"*\")}addEventListener(\"error\",function(e){if(e.message)send(e.message,e.lineno)});addEventListener(\"unhandledrejection\",function(e){send(e.reason&&e.reason.message||e.reason,0)});addEventListener(\"load\",function(){setTimeout(function(){parent.postMessage({bonanza:\"loaded\"},\"*\")},1500)})})();";

  // Used on the play page: reports when the player is actually playing, and when they click a
  // "play again / restart" button (a round has ended), so we can ask for a rating at the right moment.
  var ACTIVITY_REPORTER = "(function(){var last=0;function ping(){var n=Date.now();if(n-last>700){last=n;parent.postMessage({bonanza:'input'},'*')}}['keydown','pointerdown','touchstart'].forEach(function(t){addEventListener(t,ping,true)});addEventListener('click',function(e){var el=e.target&&e.target.closest?e.target.closest('button,a,[role=button],input[type=button],input[type=submit]'):null;if(!el)return;var t=(el.innerText||el.value||el.getAttribute('aria-label')||'').toLowerCase();if(/again|another|restart|retry|replay|reincarnate|new game|new round|reset|\\u21bb|\\u27f3|\\ud83d\\udd01/.test(t))parent.postMessage({bonanza:'round'},'*')},true)})();";

  // Inserts our scripts at the very start of the game, without changing its line numbers.
  function gameDoc(html, report, activity) {
    var tag = "<script>" + SANDBOX_SHIM + (report ? ERROR_REPORTER : "") + (activity ? ACTIVITY_REPORTER : "") + "<\/script>";
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, function (m) { return m + tag; });
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, function (m) { return m + tag; });
    if (/<!doctype[^>]*>/i.test(html)) return html.replace(/<!doctype[^>]*>/i, function (m) { return m + tag; });
    return tag + html;
  }

  // Loads a game file and shows it in a sandboxed frame. Calls onMissing if the file isn't there.
  function loadGameFrame(file, attrs, onMissing, activity) {
    var frame = sandboxedFrame(attrs);
    fetch(file, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("missing");
      return r.text();
    }).then(function (html) { frame.srcdoc = gameDoc(html, false, activity); }, function () { if (onMissing) onMissing(); });
    return frame;
  }

  // Plain-English explanation of a game error, for the Submit page health check.
  function explainError(msg) {
    if (/ends in the middle|Unexpected end of input|Unterminated|Invalid or unexpected token|Unexpected token|missing \)|expected expression/i.test(msg)) return "The code looks cut off or has a typo. This often happens when the AI's reply was too long to send in one go.";
    if (/is not defined|is not a function/i.test(msg)) return "The code uses something that doesn't exist, often a piece of code that went missing, or a library it tried to load from the internet.";
    if (/Cannot read propert|Cannot set propert|of null|of undefined/i.test(msg)) return "The code looks for part of the page that isn't there.";
    if (/SecurityError|localStorage|sessionStorage|cookie|indexedDB/i.test(msg)) return "It uses browser storage that's blocked in the gallery.";
    return "The game hit an error while starting, so parts of it may not work.";
  }

  function sandboxedFrame(attrs) {
    var f = document.createElement("iframe");
    // Sandboxed: the game can run scripts but can't touch this site, read sign-ins, or navigate away.
    f.setAttribute("sandbox", "allow-scripts allow-pointer-lock allow-modals");
    f.setAttribute("allow", "fullscreen; autoplay; gamepad");
    Object.keys(attrs).forEach(function (k) { f.setAttribute(k, attrs[k]); });
    return f;
  }

  /* ---------------- Pages ---------------- */

  var pages = {};

  pages.home = function () {
    renderStatus(); renderPrizes(); renderRules(); renderCriteria(); renderTimeline(); renderJudges();
    var el = slot("latest");
    if (!el) return;
    Promise.all([loadGames(), loadStats()]).then(function (res) {
      var games = res[0];
      function draw() {
        var html = winnersHtml(games);
        var latest = games.slice().sort(function (a, b) { return String(b.added || "").localeCompare(String(a.added || "")); }).slice(0, 3);
        if (!latest.length) {
          html += '<div class="empty"><span class="big" aria-hidden="true">🕹️</span><p>No games yet. Yours could be the first.</p><a class="btn btn-primary" href="guide.html">Read the guide</a></div>';
        } else {
          html += '<div class="games">' + latest.map(function (g) { return gameCard(g); }).join("") + "</div>";
        }
        el.innerHTML = html;
        bindThumbFallbacks(el);
      }
      draw();
      onAuth(draw);
      fill("game-count", games.length ? plural(games.length, "game") + " so far" : "Latest entries");
    }, function (err) { el.innerHTML = gamesErrorHtml(err); });
  };

  pages.gallery = function () {
    renderStatus();
    var el = slot("gallery");
    var state = { q: "", llm: "all", sort: "shuffle", unrated: false };
    var all = [], shuffled = [];

    function draw() {
      var list = state.sort === "shuffle" ? shuffled.slice() : all.slice();
      if (state.sort === "az") list.sort(function (a, b) { return a.title.localeCompare(b.title); });
      if (state.sort === "new") list.sort(function (a, b) { return String(b.added || "").localeCompare(String(a.added || "")); });
      if (state.sort === "top") list.sort(function (a, b) {
        var sa = Stats[a.slug] || { avg: 0, count: 0 }, sb = Stats[b.slug] || { avg: 0, count: 0 };
        return (sb.avg - sa.avg) || (sb.count - sa.count);
      });
      var q = state.q.trim().toLowerCase();
      list = list.filter(function (g) {
        if (state.llm !== "all" && (g.llm || "Other") !== state.llm) return false;
        if (state.unrated && !(ratable(g) && !isMine(g) && !myRating(g.slug))) return false;
        if (!q) return true;
        return (g.title + " " + (g.authors || []).join(" ") + " " + (g.blurb || "")).toLowerCase().indexOf(q) !== -1;
      });
      var grid = slot("grid");
      grid.innerHTML = list.length
        ? '<div class="games">' + list.map(function (g) { return gameCard(g); }).join("") + "</div>"
        : '<div class="empty"><span class="big" aria-hidden="true">' + (state.unrated ? "🎉" : "🔍") + "</span><p>" + (state.unrated ? "You've rated every game. Thank you!" : "No games match that search.") + "</p></div>";
      bindThumbFallbacks(grid);
      fill("count", list.length === all.length ? plural(all.length, "game") : list.length + " of " + plural(all.length, "game"));
    }

    Promise.all([loadGames(), loadStats()]).then(function (res) {
      var games = res[0];
      all = games; shuffled = shuffle(games);
      if (!games.length) {
        el.innerHTML = '<div class="empty"><span class="big" aria-hidden="true">🕹️</span><h3>No games yet</h3><p>The gallery fills up as entries come in. Want to be first?</p><a class="btn btn-primary" href="submit.html">Submit your game</a></div>';
        return;
      }
      var llms = [];
      games.forEach(function (g) { var l = g.llm || "Other"; if (llms.indexOf(l) === -1) llms.push(l); });
      el.innerHTML = winnersHtml(games) +
        (CFG.winnersAnnounced ? "<h2>All entries</h2>" : "") +
        '<div class="toolbar">' +
        '<label class="search"><span class="visually-hidden">Search games</span><input type="search" placeholder="Search by title, name or description" data-filter="q"></label>' +
        '<div class="chips" role="group" aria-label="Filter by AI assistant">' +
        ['<button class="chip" type="button" aria-pressed="true" data-llm="all">All</button>'].concat(llms.map(function (l) {
          return '<button class="chip" type="button" aria-pressed="false" data-llm="' + esc(l) + '">' + esc(l) + "</button>";
        })).join("") + "</div>" +
        (apiOn() ? '<button class="chip" type="button" aria-pressed="false" data-unrated>Not rated by me</button>' : "") +
        '<label class="visually-hidden" for="sort">Order</label>' +
        '<select class="chip" id="sort" data-filter="sort"><option value="shuffle">Shuffled</option><option value="new">Newest first</option>' +
        (apiOn() ? '<option value="top">Top rated</option>' : "") + '<option value="az">A to Z</option></select>' +
        '</div><p class="muted" data-slot="count" aria-live="polite"></p><div data-slot="grid"></div>';
      $('[data-filter="q"]', el).addEventListener("input", function (e) { state.q = e.target.value; draw(); });
      $('[data-filter="sort"]', el).addEventListener("change", function (e) { state.sort = e.target.value; draw(); });
      var unratedBtn = $("[data-unrated]", el);
      if (unratedBtn) unratedBtn.addEventListener("click", function () {
        if (!signedIn()) { toast("Sign in with your RAY Google account to see which games you haven't rated."); return; }
        state.unrated = !state.unrated;
        unratedBtn.setAttribute("aria-pressed", String(state.unrated));
        draw();
      });
      $$("[data-llm]", el).forEach(function (b) {
        b.addEventListener("click", function () {
          state.llm = b.getAttribute("data-llm");
          $$("[data-llm]", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          draw();
        });
      });
      bindThumbFallbacks(el);
      draw();
      onAuth(draw);
    }, function (err) { el.innerHTML = gamesErrorHtml(err); });
  };

  pages.guide = function () {
    renderRules(); renderCriteria(); renderTimeline();
    fill("starter-prompt", esc(STARTER_PROMPT));
    fill("deadline-text", esc(isNaN(deadlineMs()) ? "the deadline" : formatDeadline()));
  };

  /* ---------- Submit ---------- */

  pages.submit = function () {
    var form = $("#submit-form");
    var state = { html: "", fileName: "", thumb: "", photo: "", hasPhoto: false };
    // Games already in the gallery, so an update can reuse the photo it already has.
    var published = [];
    loadGames().then(function (list) { published = list; }, function () { /* not essential */ });

    function setPhotoNeeded(needed) {
      state.hasPhoto = !needed;
      $("#sf-photo").required = needed;
      $("#sf-photo-hint").textContent = needed ? "Required." : "Optional: your current picture is kept.";
    }
    var llmSelect = $("#sf-llm");
    llmSelect.innerHTML = (CFG.llms || ["Claude", "ChatGPT", "Other"]).map(function (l) { return "<option>" + esc(l) + "</option>"; }).join("");
    fill("deadline-text", esc(isNaN(deadlineMs()) ? "the deadline" : formatDeadline()));

    function show(which) {
      $$("[data-state]").forEach(function (el) { el.hidden = el.getAttribute("data-state") !== which; });
    }

    function render() {
      if (!apiOn()) return show("off");
      if (!submissionsOpen()) return show("closed");
      if (!signedIn()) return show(Auth.loading ? "loading" : "signin");
      show("form");
      var names = $("#sf-name");
      if (!names.value) names.value = Auth.me.user.name;
      var mine = Auth.me.mySubmissions || [];
      var max = CFG.maxUpdates == null ? 2 : Number(CFG.maxUpdates);
      var g = mine[0];
      state.mine = g || null;
      if (!g) {
        fill("my-games", "");
        $("#submit-form").hidden = false;
        $("#sf-title").readOnly = false;
        fill("update-confirm", "");
        $("#sf-submit").textContent = "Submit my game";
        update();
        return;
      }
      var left = Math.max(0, max - ((g.version || 1) - 1));
      fill("my-games",
        '<div class="card" style="margin-bottom:1.25rem"><h3 style="margin-bottom:.25rem">Your game: ' + esc(g.emoji || "🎮") + " " + esc(g.title) + ' <span class="sticker">v' + (g.version || 1) + "</span></h3>" +
        '<p class="muted" style="margin:0 0 .75rem">' + (left ? plural(left, "update") + " left out of " + max + "." : "That was your last update, so this version is final. Good luck!") + "</p>" +
        '<a class="btn btn-small" href="play.html?game=' + encodeURIComponent(g.slug) + '">' + icon("play") + " Play it</a></div>");
      if (!left) { $("#submit-form").hidden = true; return; }
      // Update mode: same game, same title; the form is filled in for them.
      $("#submit-form").hidden = false;
      $("#sf-title").value = g.title;
      $("#sf-title").readOnly = true;
      if (!$("#sf-name").value || $("#sf-name").value === Auth.me.user.name) $("#sf-name").value = g.authors[0] || Auth.me.user.name;
      if (!$("#sf-blurb").value) $("#sf-blurb").value = g.blurb || "";
      if (!$("#sf-emoji").value) $("#sf-emoji").value = g.emoji || "";
      if (g.llm) llmSelect.value = g.llm;
      var live = published.filter(function (x) { return x.slug === g.slug; })[0];
      setPhotoNeeded(!(g.photo || (live && live.photo)));
      fill("update-confirm", '<div class="panel" style="margin-top:1rem"><strong>' +
        (left === 1 ? "This uses your last update, so this version will be final." : "This uses 1 of your " + left + " remaining updates.") + "</strong>" +
        ' Play the preview first to check it works.<label style="display:flex;gap:.5rem;align-items:center;margin-top:.6rem"><input type="checkbox" id="sf-use-update"> Yes, use an update</label></div>');
      $("#sf-use-update").addEventListener("change", function (ev) { state.useUpdate = ev.target.checked; });
      state.useUpdate = false;
      $("#sf-submit").textContent = "Submit update";
      update();
    }

    function authors() {
      return [$("#sf-name").value.trim()].filter(Boolean);
    }

    function update() {
      var blurb = $("#sf-blurb").value;
      $("#sf-count").textContent = blurb.length + " / 100";
      var a = authors();
      var slug = (slugify((a[0] || "you").split(" ")[0]) + "-" + (slugify($("#sf-title").value) || "your-game")).slice(0, 60);
      $("#sf-slug").textContent = slug;
    }

    function checkHtml(html) {
      var notes = [];
      if (/<(script|link|img)[^>]+(src|href)\s*=\s*["']?\s*(https?:)?\/\//i.test(html) || /url\(\s*["']?https?:/i.test(html)) notes.push("It loads something from the internet, which may not work in the gallery. Ask your AI to put everything in the one file.");
      if (/\bindexedDB\b/.test(html)) notes.push("It uses indexedDB to save data, which is blocked in the gallery. Ask your AI to remove it.");
      if (!/<\/html>\s*$/i.test(html.trim())) notes.push("It doesn't end with </html>, so the code might be cut off. Check the preview works.");
      return notes;
    }

    function drawHealth(done) {
      var el = slot("health");
      if (!el) return;
      if (!state.errors.length) {
        el.innerHTML = done ? '<p class="field-ok">' + icon("check") + " Your game started without any errors. Give it a quick play below.</p>" : '<p class="muted">Checking your game starts properly…</p>';
        return;
      }
      var first = state.errors[0];
      var prompt = first.cut
        ? "The HTML game file you gave me is cut off: it ends in the middle of the code. Please send me the complete file again, from <!DOCTYPE html> to </html>. If it's too long for one reply, make the code shorter."
        : "My HTML game shows this error when it starts: \"" + first.message + "\"" + (first.line ? " (around line " + first.line + ")" : "") +
          ". Please fix it and send me the complete updated file, from <!DOCTYPE html> to </html>.";
      el.innerHTML = '<div class="error-box" style="margin:.5rem 0 1rem"><h3>' + (first.cut ? "Your game file is cut off" : "Your game hit an error while starting") + "</h3>" +
        "<p>" + esc(explainError(first.message)) + "</p>" +
        "<ul>" + state.errors.map(function (er) { return "<li><code>" + esc(er.message) + "</code>" + (er.line ? " (line " + er.line + ")" : "") + "</li>"; }).join("") + "</ul>" +
        "<p><strong>How to fix it:</strong> copy this message, paste it into the AI you used, then upload the new file it gives you.</p>" +
        '<pre id="fix-prompt">' + esc(prompt) + "</pre>" +
        '<p><button class="btn btn-small copy-btn" type="button" data-copy="#fix-prompt">' + icon("copy") + " Copy message for your AI</button></p>" +
        '<label style="display:flex;gap:.5rem;align-items:center;margin-top:.75rem"><input type="checkbox" id="sf-override"' + (state.override ? " checked" : "") + "> I've played the preview and it works anyway. Submit it as it is.</label></div>";
      bindCopyButtons(el);
      $("#sf-override").addEventListener("change", function (ev) { state.override = ev.target.checked; });
    }

    addEventListener("message", function (e) {
      if (!state.frame || e.source !== state.frame.contentWindow || !e.data || !e.data.bonanza) return;
      if (e.data.bonanza === "error") state.errors.push({ message: String(e.data.message).slice(0, 300), line: Number(e.data.line) || 0 });
      drawHealth(e.data.bonanza === "loaded");
    });

    $("#sf-file").addEventListener("change", function (e) {
      var file = e.target.files[0];
      state.html = ""; fill("preview", ""); fill("file-notes", "");
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { fill("file-notes", '<p class="field-error">That file is over 3 MB. Ask your AI to make it smaller.</p>'); return; }
      file.text().then(function (text) {
        if (!/<html|<!doctype|<script|<canvas|<body/i.test(text)) {
          fill("file-notes", '<p class="field-error">That doesn\'t look like an HTML game. Make sure you saved the whole code as a .html file.</p>');
          return;
        }
        state.html = text; state.fileName = file.name;
        var notes = checkHtml(text);
        fill("file-notes", notes.length ? '<div class="panel"><strong>Worth checking</strong><ul>' + notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div>" : '<p class="field-ok">' + icon("check") + " Looks good. Try it in the preview below.</p>");
        var holder = slot("preview");
        holder.innerHTML = '<p class="muted">Preview. This is exactly how it will run in the gallery:</p><div data-slot="health" aria-live="polite"><p class="muted">Checking your game starts properly…</p></div>';
        var f = sandboxedFrame({ "class": "embed-frame", title: "Preview of your game" });
        state.errors = []; state.override = false; state.frame = f;
        // A cut-off file never runs its unfinished script, and the browser reports no error,
        // so the game just sits there. Catch it by checking every <script> is closed.
        var opened = (text.match(/<script\b/gi) || []).length, closed = (text.match(/<\/script>/gi) || []).length;
        if (opened > closed) state.errors.push({ message: "The file ends in the middle of the game's code (a <script> section is never closed).", line: 0, cut: true });
        f.srcdoc = gameDoc(text, true);
        holder.appendChild(f);
        drawHealth(false);
      });
    });

    $("#sf-thumb").addEventListener("change", function (e) {
      var file = e.target.files[0];
      state.thumb = ""; fill("thumb-preview", "");
      if (!file) return;
      if (!/^image\//.test(file.type)) { fill("thumb-preview", '<p class="field-error">Please choose an image (PNG or JPG).</p>'); return; }
      // Shrink to at most 800px wide so uploads stay small.
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 800 / img.width);
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        state.thumb = c.toDataURL("image/jpeg", 0.85);
        fill("thumb-preview", '<img src="' + state.thumb + '" alt="Your thumbnail" class="thumb-preview">');
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { fill("thumb-preview", '<p class="field-error">That image couldn\'t be read. Try a PNG or JPG.</p>'); };
      img.src = URL.createObjectURL(file);
    });

    $("#sf-photo").addEventListener("change", function (e) {
      var file = e.target.files[0];
      state.photo = ""; fill("photo-preview", "");
      if (!file) return;
      if (!/^image\//.test(file.type)) { fill("photo-preview", '<p class="field-error">Please choose a photo (PNG or JPG).</p>'); return; }
      // Crop to a centred square and shrink to 256px so it uploads quickly.
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.width, img.height), size = 256;
        var c = document.createElement("canvas");
        c.width = size; c.height = size;
        c.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        state.photo = c.toDataURL("image/jpeg", 0.85);
        fill("photo-preview", '<img src="' + state.photo + '" alt="Your photo" class="avatar avatar-lg">');
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { fill("photo-preview", '<p class="field-error">That photo couldn\'t be read. Try a PNG or JPG.</p>'); };
      img.src = URL.createObjectURL(file);
    });

    form.addEventListener("input", update);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      fill("submit-result", "");
      var title = $("#sf-title").value.trim(), blurb = $("#sf-blurb").value.trim();
      var problem = !authors().length ? "Please add your name." : !title ? "Please give your game a title." : !blurb ? "Please add a one-line description." : !state.photo && !state.hasPhoto ? "Please add your RAY profile picture." : !state.html ? "Please choose your game's .html file." : "";
      if (!problem && state.mine && !state.useUpdate) problem = "Tick \"Yes, use an update\" to confirm. You have a limited number of updates.";
      if (!problem && state.errors && state.errors.length && !state.override) problem = "Your game hit an error in the preview. Fix it with your AI, or tick \"it works anyway\" under the preview.";
      if (problem) { fill("submit-result", '<div class="error-box"><p style="margin:0">' + esc(problem) + "</p></div>"); return; }
      var btn = $("#sf-submit");
      btn.disabled = true; btn.textContent = "Publishing… (usually 10 seconds, up to a minute when busy)";
      api("submit", {
        title: title, authors: authors(), llm: llmSelect.value, blurb: blurb,
        emoji: $("#sf-emoji").value.trim(), html: state.html, thumbnail: state.thumb || null, photo: state.photo || null
      }).then(function (res) {
        form.reset(); state = { html: "", fileName: "", thumb: "", photo: "", hasPhoto: false, errors: [], override: false, frame: null, mine: null, useUpdate: false };
        setPhotoNeeded(true);
        fill("preview", ""); fill("file-notes", ""); fill("thumb-preview", ""); fill("photo-preview", "");
        fill("submit-result",
          '<div class="card success-box"><h3>' + (res.updated ? "Updated! " + esc(title) + " is now v" + res.version + " 🎉" : "You're in! " + esc(title) + " has been submitted 🎉") + "</h3>" +

          "<p>It'll be in the gallery in about 2 minutes. " +
          (res.updatesLeft ? "You have " + plural(res.updatesLeft, "update") + " left if you want to improve it before the deadline." : "That was your last update, so this version is final.") + "</p>" +
          '<p><strong>Now get people playing.</strong> You need at least ' + (CFG.minRatingsForPeoplesChoice || 5) + " star ratings to qualify for People's choice. Share your link in the " + withChatLink(CFG.chatName || "RAY Connect chat") + ":</p>" +
          '<p><code id="share-link">' + esc(new URL("play.html?game=" + encodeURIComponent(res.slug), location.href).href) + '</code></p>' +
          '<p><button class="btn btn-small copy-btn" type="button" data-copy="#share-link">' + icon("copy") + " Copy link</button></p>" +
          '<div class="btn-row"><a class="btn btn-primary" href="play.html?game=' + encodeURIComponent(res.slug) + '">' + icon("play") + ' Play it</a><a class="btn" href="gallery.html">Go to the gallery</a></div>' +
          "</div>");
        bindCopyButtons(slot("submit-result"));
        slot("submit-result").scrollIntoView({ behavior: "smooth", block: "center" });
        return refreshMe().then(render);
      }, function (err) {
        fill("submit-result", '<div class="error-box"><h3>That didn\'t work</h3><p style="margin:0">' + esc(err.message) + "</p></div>");
      }).then(function () { btn.disabled = false; btn.textContent = state.mine ? "Submit update" : "Submit my game"; });
    });

    render();
    onAuth(render);
  };

  /* ---------- Judging ---------- */

  pages.judging = function () {
    fill("rubric", RUBRIC.map(function (c) {
      return "<tr><td><strong>" + c.name + "</strong></td><td>" + c.weight + "%</td><td>×" + c.mult + "</td><td>" + esc(c.look) + "</td></tr>";
    }).join(""));
    renderJudges();

    var gamesP = loadGames();
    function render() {
      var panel = slot("judge-panel");
      if (!apiOn()) { panel.innerHTML = '<p class="muted">Judges\' scoring opens once the organiser connects sign-in.</p>'; return; }
      if (!signedIn()) {
        panel.innerHTML = '<p>Judges: sign in with your work Google account to score the games.</p><div class="auth-slot" data-auth="large"></div>';
        renderAuthSlots();
        return;
      }
      var u = Auth.me.user;
      if (!u.isJudge && !u.isAdmin) { panel.innerHTML = '<p class="muted">You\'re signed in, but scoring is only for the judges. Rate games with stars in the <a href="gallery.html">gallery</a> instead.</p>'; return; }
      gamesP.then(function (games) {
        var scores = Auth.me.myScores || {};
        var judged = games.filter(function (g) { return !g.excludeFromJudging; });
        // Judges don't score their own game (the backend refuses it too).
        var list = judged.filter(function (g) { return !isMine(g); });
        var skipped = judged.length - list.length;
        var byTitle = function (a, b) { return a.title.localeCompare(b.title); };
        var todo = list.filter(function (g) { return !scores[g.slug]; }).sort(byTitle);
        var done = list.filter(function (g) { return scores[g.slug]; }).sort(byTitle);
        var html = "";
        if (u.isJudge) {
          var pct = list.length ? Math.round(done.length / list.length * 100) : 0;
          html += '<div class="judge-summary"><p><strong>Hi ' + esc(u.givenName) + ".</strong> You've scored " + done.length + " of " + plural(list.length, "game") + ". Click a game to score it; you can change scores any time.</p>" +
            '<div class="judge-progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Scoring progress"><span style="width:' + pct + '%"></span></div>' +
            (skipped ? '<p class="muted" style="margin:.5rem 0 0;font-size:.9rem">Your own game isn\'t listed: the other judges score it.</p>' : "") + "</div>";
          if (!list.length) html += '<p class="muted">No games to judge yet.</p>';
          else {
            html += '<h3 class="judge-group">To score <span class="sticker">' + todo.length + "</span></h3>" +
              (todo.length ? todo.map(judgeItem).join("") : '<p class="muted">All done. Every game has your score.</p>');
            if (done.length) html += '<h3 class="judge-group">Scored <span class="sticker mint">' + done.length + "</span></h3>" + done.map(judgeItem).join("");
          }
        }
        html += '<div class="card" style="margin-top:1.5rem"><h3>Current standings</h3><p class="muted">Visible to judges and organisers only.</p><button class="btn" type="button" id="show-results">Show standings</button><div data-slot="results"></div></div>';
        panel.innerHTML = html;
        $$("[data-judge]", panel).forEach(bindJudgeRow);
        $("#show-results").addEventListener("click", showResults);
      });
    }
    function total(s) { return s.reduce(function (sum, v, i) { return sum + v * RUBRIC[i].mult; }, 0); }

    // One collapsed row per game: just the title until a judge opens it to score.
    function judgeItem(g) {
      var s = (Auth.me.myScores || {})[g.slug] || [];
      return '<details class="judge-item">' +
        '<summary><span class="ji-name">' + esc(g.emoji || "🎮") + " <strong>" + esc(g.title) + '</strong> <span class="muted">by ' + esc(joinNames(g.authors)) + "</span></span>" +
        '<span class="ji-status' + (s.length ? " done" : "") + '" data-total>' + (s.length ? total(s) + " / 100" : "Not scored") + "</span>" +
        '<span class="ji-chevron" aria-hidden="true">' + icon("arrow") + "</span></summary>" +
        '<form class="judge-form" data-judge="' + esc(g.slug) + '">' +
        '<div class="judge-scores">' + RUBRIC.map(function (c, i) {
          return '<label class="field"><span>' + c.name + ' <span class="muted">×' + c.mult + '</span></span><select name="s' + i + '"><option value="">–</option>' +
            [1, 2, 3, 4, 5].map(function (n) { return "<option" + (s[i] === n ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</select></label>";
        }).join("") + "</div>" +
        '<div class="judge-foot"><a class="btn btn-small" href="play.html?game=' + encodeURIComponent(g.slug) + '" target="_blank" rel="noopener">' + icon("play") + " Play</a>" +
        '<button class="btn btn-small btn-primary" type="submit">Save score</button></div></form></details>';
    }
    function bindJudgeRow(formEl) {
      formEl.addEventListener("submit", function (e) {
        e.preventDefault();
        var vals = RUBRIC.map(function (c, i) { return Number(formEl.elements["s" + i].value); });
        if (vals.some(function (v) { return !v; })) { toast("Pick a score for every criterion first.", "bad"); return; }
        var slug = formEl.getAttribute("data-judge");
        var btn = $("button[type=submit]", formEl);
        btn.disabled = true;
        api("judge", { slug: slug, scores: vals }).then(function (res) {
          Auth.me.myScores = Auth.me.myScores || {};
          Auth.me.myScores[slug] = vals;
          persistMe();
          toast("Saved: " + res.total + " / 100", "good");
          render();
        }, function (err) { toast(err.message, "bad"); btn.disabled = false; });
      });
    }
    function showResults() {
      var out = slot("results");
      out.innerHTML = '<p class="muted">Loading…</p>';
      api("results").then(function (res) {
        var min = CFG.minRatingsForPeoplesChoice || 5;
        out.innerHTML =
          '<h4 style="margin-top:1.25rem">Judges\' ranking</h4><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Game</th><th>Average / 100</th><th>Silliness avg</th><th>Judges</th></tr></thead><tbody>' +
          res.judges.map(function (e, i) {
            return "<tr><td>" + (i + 1) + "</td><td>" + esc(e.title) + (e.tied ? ' <span class="sticker pink">Tied: discuss</span>' : "") + "</td><td>" + (e.judged ? e.avg.toFixed(1) : "–") + "</td><td>" + (e.judged ? e.sillyAvg.toFixed(2) : "–") + "</td><td>" + e.judged + "</td></tr>";
          }).join("") + "</tbody></table></div>" +
          '<h4 style="margin-top:1.5rem">People\'s choice (stars)</h4><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Game</th><th>Average</th><th>Ratings</th><th>Qualifies</th></tr></thead><tbody>' +
          res.stars.map(function (e, i) {
            return "<tr><td>" + (i + 1) + "</td><td>" + esc(e.title) + "</td><td>" + (e.count ? "★ " + e.avg.toFixed(2) : "–") + "</td><td>" + e.count + "</td><td>" + (e.qualifies ? "Yes" : "Needs " + min) + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      }, function (err) { out.innerHTML = '<p class="field-error">' + esc(err.message) + "</p>"; });
    }
    render();
    onAuth(render);
  };

  /* ---------- Player ---------- */

  pages.play = function () {
    var slug = new URLSearchParams(location.search).get("game");
    var main = $("#main");
    function message(title, body) {
      main.innerHTML = '<div class="player-msg"><span style="font-size:3rem" aria-hidden="true">🫠</span><h1 style="font-size:2rem">' + title + "</h1>" + body +
        '<p><a class="btn btn-primary" href="gallery.html">' + icon("back") + " Back to the gallery</a></p></div>";
    }
    if (!slug) { message("No game picked", "<p>This page plays one game at a time. Choose one from the gallery.</p>"); return; }
    Promise.all([loadGames(), loadStats()]).then(function (res) {
      var g = res[0].filter(function (x) { return x.slug === slug; })[0];
      if (!g) { message("We couldn't find that game", "<p>There's no game called <code>" + esc(slug) + "</code>. If it was just submitted, wait a minute and refresh.</p>"); return; }
      document.title = g.title + " · " + CFG.name;
      var version = Number(g.version) || 1;

      // Measure real time spent on the game while the tab is visible (by the clock, not by timer
      // ticks, which a busy computer can delay). After the first go, it needs a rating.
      var playedMs = 0, lastTick = Date.now();
      function addPlayTime() {
        var now = Date.now(), step = Math.min(now - lastTick, 5000);
        lastTick = now;
        if (document.hidden || !needsRating(g)) return;
        playedMs += step;
        if (playedMs >= PLAY_SECONDS * 1000) { markPlayed(g.slug); clearInterval(timer); }
      }
      var timer = setInterval(addPlayTime, 1000);
      document.addEventListener("visibilitychange", function () { lastTick = Date.now(); });
      $$('.player-bar a[href="gallery.html"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
          addPlayTime();
          if (!playedMap()[g.slug] || !needsRating(g)) return;
          e.preventDefault();
          showRatingGate(g, { leaving: true, after: function () { location.href = a.href; } });
        });
      });
      $("#player-title").innerHTML = "<strong>" + esc(g.title) + (version > 1 ? ' <span class="sticker">v' + version + "</span>" : "") + "</strong><span>by " + esc(joinNames(g.authors || [])) + (g.llm ? " · made with " + esc(g.llm) : "") + "</span>";

      function drawRating() {
        var el = $("#player-rating");
        if (!ratable(g)) { el.innerHTML = g.excludeFromJudging && apiOn() ? '<span class="muted">Example game, not rated</span>' : ""; return; }
        var rated = signedIn() && Auth.me.myRatedVersions ? Auth.me.myRatedVersions[g.slug] : 0;
        var stale = myRating(g.slug) && rated && rated < version;
        var count = (Stats[g.slug] || {}).count || 0, min = CFG.minRatingsForPeoplesChoice || 5;
        var qualify = count < min ? " · needs " + (min - count) + " more to qualify" : " · qualifies";
        el.innerHTML = '<span class="rate-summary">' + esc(starSummary(g.slug) + qualify) + "</span>" + starsWidget(g) +
          (stale ? '<span class="rate-note">Updated to v' + version + " since you rated it. Change your stars if you like.</span>" : "");
        bindStars(el, g, drawRating);
      }
      drawRating();
      onAuth(drawRating);

      function drawAdmin() {
        var el = $("#player-admin");
        if (!el) return;
        if (!signedIn() || !Auth.me.user.isAdmin) { el.innerHTML = ""; return; }
        el.innerHTML = '<button class="btn btn-small btn-danger" type="button">Remove game</button>';
        $("button", el).addEventListener("click", function () {
          if (!window.confirm("Remove \"" + g.title + "\" from the gallery?\n\nIts file is deleted from GitHub, and its ratings and judges' scores move to the \"Removed\" tab in the Google Sheet. This can't be undone from the website.")) return;
          var btn = this;
          btn.disabled = true; btn.textContent = "Removing…";
          api("delete", { slug: g.slug }).then(function (res) {
            toast("Removed " + res.title + ". It disappears from the gallery in about 2 minutes.", "good");
            setTimeout(function () { location.href = "gallery.html"; }, 2500);
          }, function (err) {
            toast(err.message, "bad");
            btn.disabled = false; btn.textContent = "Remove game";
          });
        });
      }
      drawAdmin();
      onAuth(drawAdmin);

      var frame = loadGameFrame(g.file, { "class": "player-frame", title: g.title }, function () {
        message("The game file is missing", "<p>The gallery lists this game, but its file isn't published yet. If it was just submitted, wait a minute and refresh.</p>");
      }, true);
      main.innerHTML = "";
      main.appendChild(frame);

      // A "go" also counts once they've actually played (a few key presses, clicks or taps), however
      // short the round. When they click "play again" (a round ended), ask for a rating once per visit.
      // Many games have no restart button (tap to restart), so a pause after real play also counts:
      // it's usually the game-over screen. Either way, ask only once per visit.
      var inputs = 0, asked = false, idleTimer = null;
      function askOnce(opts) {
        if (asked || $("#rating-gate") || !needsRating(g)) return;
        asked = true;
        markPlayed(g.slug);
        showRatingGate(g, opts);
      }
      window.addEventListener("message", function (e) {
        if (e.source !== frame.contentWindow || !e.data || !e.data.bonanza || !needsRating(g)) return;
        if (e.data.bonanza === "input") {
          if (++inputs >= PLAY_INPUTS) {
            markPlayed(g.slug);
            clearTimeout(idleTimer);
            idleTimer = setTimeout(function () { askOnce({ paused: true }); }, PAUSE_SECONDS * 1000);
          }
        }
        if (e.data.bonanza === "round") { clearTimeout(idleTimer); askOnce({ round: true }); }
      });
      frame.addEventListener("load", function () { try { frame.focus(); } catch (e) { /* ignore */ } });
      var fs = $("#fullscreen");
      var req = frame.requestFullscreen || frame.webkitRequestFullscreen;
      if (req) {
        fs.hidden = false;
        fs.addEventListener("click", function () { req.call(frame); });
      }
    }, function (err) { main.innerHTML = '<div class="player-msg">' + gamesErrorHtml(err) + "</div>"; });
  };

  /* ---------- Sample ---------- */

  pages.sample = function () {
    var s = CFG.showcase || {};
    if (!s.isPlaceholder) hide("placeholder-note");
    fill("sc-builder", esc(s.builder || ""));
    fill("sc-llm", esc(s.llm || ""));
    fill("sc-time", esc(s.timeSpent || ""));
    var first = STARTER_PROMPT.replace("[DESCRIBE YOUR RIDICULOUS IDEA HERE]", s.idea || "…");
    fill("sc-chat",
      '<div class="bubble me"><small>Message 1: the starter prompt, with the idea filled in</small><pre style="white-space:pre-wrap;margin:0;font-size:.85rem">' + esc(first) + "</pre></div>" +
      (s.followUps || []).map(function (f, i) {
        return '<div class="bubble me"><small>Message ' + (i + 2) + "</small>" + esc(f) + "</div>";
      }).join(""));
    fill("sc-lessons", (s.lessons || []).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join(""));
    var frameSlot = slot("sc-game");
    loadGames().then(function (games) {
      var g = games.filter(function (x) { return x.slug === s.slug; })[0];
      if (!g) { frameSlot.innerHTML = '<div class="error-box"><p>The sample game <code>' + esc(s.slug) + "</code> isn't in games.json yet. Check the <code>showcase.slug</code> setting in config.js.</p></div>"; return; }
      fill("sc-title", esc(g.title));
      fill("sc-blurb", esc(g.blurb));
      frameSlot.innerHTML = "";
      frameSlot.appendChild(loadGameFrame(g.file, { "class": "embed-frame", title: g.title }));
      frameSlot.insertAdjacentHTML("beforeend", '<div class="btn-row" style="margin-top:1rem"><a class="btn btn-primary" href="play.html?game=' + encodeURIComponent(g.slug) + '">' + icon("play") + " Play full screen</a></div>");
    }, function (err) { frameSlot.innerHTML = gamesErrorHtml(err); });
  };

  pages.resources = function () {};

  /* ---------------- Boot ---------------- */

  function boot() {
    renderShell();
    if (!CFG || typeof CFG !== "object") { renderConfigError(); return; }
    renderConfigText();
    try {
      if (pages[page]) pages[page]();
    } catch (e) {
      console.error(e);
      var main = $("#main");
      if (main) main.insertAdjacentHTML("afterbegin", '<div class="wrap"><div class="error-box" style="margin-top:2rem"><h3>Something on this page broke</h3><p>Please tell the organisers. Technical detail: <code>' + esc(e.message) + "</code></p></div></div>");
    }
    bindCopyButtons();
    var current = page === "play" ? new URLSearchParams(location.search).get("game") : null;
    onAuth(function () {
      adoptAnonPlays();
      if (gateState) refreshGate(); else checkOwedRatings(current);
    });
    initAuth();
    checkOwedRatings(current);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

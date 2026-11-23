/* =====================================================================
   RAY Connect Bonanza: site logic
   Hosts never need to edit this file. Settings live in config.js,
   entries live in games.json.
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
    ["One HTML file", "Everything in a single .html file that opens in a browser. No extra files, no internet needed."],
    ["Understandable in 30 seconds", "Put a one-line \"how to play\" on screen."],
    ["Must be playable", "A goal, a score or a win/lose moment, and a way to restart."],
    ["No company data", "No logos, customer data or anything confidential. The site may be public."],
    ["Any tool goes", "Claude, ChatGPT, Gemini, Copilot, or code it yourself. Solo or teams of two."],
    ["Keep it kind", "Silly, not mean. No games about a colleague without their blessing."],
    ["The deadline is firm", "Send updates as often as you like until the deadline."]
  ];

  var AWARD_LABEL = { "winner": "Winner", "runner-up": "Runner-up", "peoples-choice": "People's choice" };
  var AWARD_ORDER = ["winner", "runner-up", "peoples-choice"];

  var NAV = [
    ["index.html", "Home", "home"],
    ["gallery.html", "Gallery", "gallery"],
    ["guide.html", "Guide", "guide"],
    ["judging.html", "Judging", "judging"],
    ["sample.html", "Sample game", "sample"],
    ["resources.html", "Resources", "resources"]
  ];

  var ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
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

  // Any button with data-copy="#id" copies that element's text.
  function bindCopyButtons(root) {
    $$("[data-copy]", root).forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      var original = btn.innerHTML;
      btn.addEventListener("click", function () {
        var target = $(btn.getAttribute("data-copy"));
        if (!target) return;
        var text = "value" in target && target.tagName !== "PRE" ? target.value : target.textContent;
        copyText(text).then(function (ok) {
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

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------- Config ---------------- */

  var CFG = window.JAM_CONFIG;
  var page = document.body.getAttribute("data-page");

  function renderShell() {
    var name = (CFG && CFG.name) || "RAY Connect Bonanza";
    var parts = name.match(/^(.*?)(\s+\d{4})?$/);
    var header = $("#site-header");
    if (header) {
      header.outerHTML =
        '<a class="skip-link" href="#main">Skip to content</a>' +
        '<header class="site-header"><div class="wrap">' +
        '<a class="brand" href="index.html"><b>' + esc(parts[1]) + "</b>" + (parts[2] ? "<span>" + esc(parts[2].trim()) + "</span>" : "") + "</a>" +
        '<button class="btn btn-small nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">' + icon("menu") + " Menu</button>" +
        '<nav class="site-nav" id="site-nav" aria-label="Main"><ul>' +
        NAV.map(function (n) {
          return '<li><a href="' + n[0] + '"' + (n[2] === page ? ' aria-current="page"' : "") + ">" + n[1] + "</a></li>";
        }).join("") +
        "</ul></nav></div></header>";
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
        "<span>" + esc(name) + ". Built one HTML file at a time.</span>" +
        "<span>" + (CFG && CFG.contact ? "Questions? Ask " + esc(CFG.contact) + "." : "") + "</span>" +
        "</div></footer>";
    }
    var live = document.createElement("div");
    live.id = "live-region"; live.className = "visually-hidden";
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(live);
    if (CFG && CFG.name && document.title.indexOf(CFG.name) === -1) {
      document.title = document.title.replace("{name}", CFG.name);
    }
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

  /* ---------------- Deadline / status ---------------- */

  function deadlineMs() { return Date.parse(CFG.deadline); }

  function phase() {
    if (CFG.winnersAnnounced) return "winners";
    var d = deadlineMs();
    if (isNaN(d)) return "open";
    return Date.now() < d ? "open" : "closed";
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
      el.innerHTML = '<p class="status-banner"><span class="dot"></span>Submissions closed. Judging in progress.</p>';
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
      return "<li><strong>" + esc(r[0]) + "</strong>" + esc(r[1]) + "</li>";
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

  function renderSubmitLinks() {
    $$("[data-submit-link]").forEach(function (a) {
      if (CFG.submitUrl) { a.href = CFG.submitUrl; a.target = "_blank"; a.rel = "noopener"; }
      else a.href = "guide.html#submit";
    });
    $$("[data-submit-label]").forEach(function (el) { el.textContent = CFG.submitLabel || "the submission channel"; });
    $$("[data-contact]").forEach(function (el) { el.textContent = CFG.contact || "the organisers"; });
    $$("[data-vote-link]").forEach(function (a) {
      if (CFG.votingUrl) { a.href = CFG.votingUrl; a.target = "_blank"; a.rel = "noopener"; a.hidden = false; }
      else a.hidden = true;
    });
    $$("[data-config-name]").forEach(function (el) { el.textContent = CFG.name; });
    $$("[data-config-tagline]").forEach(function (el) { el.textContent = CFG.tagline || ""; });
    $$("[data-config-welcome]").forEach(function (el) { el.textContent = CFG.welcome || ""; });
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
      body = "<p>The list of games didn't load" + (err && err.status ? " (error " + esc(err.status) + ")" : "") + ". Check your connection and refresh. If it keeps happening, tell <span data-contact></span>.</p>";
    }
    return '<div class="error-box"><h3>The game list didn\'t load</h3>' + body + "</div>";
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
    if (g.excludeFromJudging) badges.push('<span class="sticker">Example, not judged</span>');
    return '<a class="game-card" href="play.html?game=' + encodeURIComponent(g.slug) + '">' +
      '<div class="game-thumb">' + thumb + "</div>" +
      (badges.length ? '<div class="badges">' + badges.join("") + "</div>" : "") +
      (opts.award ? '<span class="award-tag">' + esc(AWARD_LABEL[g.award] || g.award) + "</span>" : "") +
      '<div class="game-body"><h3>' + esc(g.title) + "</h3>" +
      '<p class="game-by">by ' + esc(joinNames(g.authors || [])) + "</p>" +
      '<p class="game-blurb">' + esc(g.blurb || "") + "</p>" +
      '<div class="game-meta">' + (g.llm ? '<span class="sticker">Made with ' + esc(g.llm) + "</span>" : "") + "</div>" +
      "</div></a>";
  }

  function bindThumbFallbacks(root) {
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

  /* ---------------- Pages ---------------- */

  var pages = {};

  pages.home = function () {
    renderStatus(); renderPrizes(); renderRules(); renderCriteria(); renderTimeline();
    var el = slot("latest");
    if (!el) return;
    loadGames().then(function (games) {
      var html = winnersHtml(games);
      var latest = games.slice().sort(function (a, b) { return String(b.added || "").localeCompare(String(a.added || "")); }).slice(0, 3);
      if (!latest.length) {
        html += '<div class="empty"><span class="big" aria-hidden="true">🕹️</span><p>No games yet. Yours could be the first.</p><a class="btn btn-primary" href="guide.html">Read the guide</a></div>';
      } else {
        html += '<div class="games">' + latest.map(function (g) { return gameCard(g); }).join("") + "</div>";
      }
      el.innerHTML = html;
      bindThumbFallbacks(el);
      fill("game-count", games.length ? plural(games.length, "game") + " so far" : "");
    }, function (err) { el.innerHTML = gamesErrorHtml(err); renderSubmitLinks(); });
  };

  pages.gallery = function () {
    renderStatus();
    var el = slot("gallery");
    var state = { q: "", llm: "all", sort: "shuffle" };
    var all = [], shuffled = [];

    function draw() {
      var list = state.sort === "shuffle" ? shuffled.slice() : all.slice();
      if (state.sort === "az") list.sort(function (a, b) { return a.title.localeCompare(b.title); });
      if (state.sort === "new") list.sort(function (a, b) { return String(b.added || "").localeCompare(String(a.added || "")); });
      var q = state.q.trim().toLowerCase();
      list = list.filter(function (g) {
        if (state.llm !== "all" && (g.llm || "Other") !== state.llm) return false;
        if (!q) return true;
        return (g.title + " " + (g.authors || []).join(" ") + " " + (g.blurb || "")).toLowerCase().indexOf(q) !== -1;
      });
      var grid = slot("grid");
      grid.innerHTML = list.length
        ? '<div class="games">' + list.map(function (g) { return gameCard(g); }).join("") + "</div>"
        : '<div class="empty"><span class="big" aria-hidden="true">🔍</span><p>No games match that search.</p></div>';
      bindThumbFallbacks(grid);
      fill("count", list.length === all.length ? plural(all.length, "game") : list.length + " of " + plural(all.length, "game"));
    }

    loadGames().then(function (games) {
      all = games; shuffled = shuffle(games);
      if (!games.length) {
        el.innerHTML = '<div class="empty"><span class="big" aria-hidden="true">🕹️</span><h3>No games yet</h3><p>The gallery fills up as entries come in. Want to be first?</p><a class="btn btn-primary" href="guide.html">Read the guide</a></div>';
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
        '<label class="visually-hidden" for="sort">Order</label>' +
        '<select class="chip" id="sort" data-filter="sort"><option value="shuffle">Shuffled</option><option value="new">Newest first</option><option value="az">A to Z</option></select>' +
        '</div><p class="muted" data-slot="count" aria-live="polite"></p><div data-slot="grid"></div>';
      $('[data-filter="q"]', el).addEventListener("input", function (e) { state.q = e.target.value; draw(); });
      $('[data-filter="sort"]', el).addEventListener("change", function (e) { state.sort = e.target.value; draw(); });
      $$("[data-llm]", el).forEach(function (b) {
        b.addEventListener("click", function () {
          state.llm = b.getAttribute("data-llm");
          $$("[data-llm]", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          draw();
        });
      });
      bindThumbFallbacks(el);
      draw();
    }, function (err) { el.innerHTML = gamesErrorHtml(err); renderSubmitLinks(); });
  };

  pages.guide = function () {
    renderRules(); renderCriteria(); renderTimeline();
    if (CFG.loomId) {
      fill("loom", '<div class="video"><iframe src="https://www.loom.com/embed/' + encodeURIComponent(CFG.loomId) + '" title="Walkthrough video" allowfullscreen loading="lazy"></iframe></div>');
    } else {
      hide("loom");
    }
    if (!CFG.repoUrl) hide("repo-route");
    $$("[data-repo-link]").forEach(function (a) { a.href = CFG.repoUrl; });
    fill("starter-prompt", esc(STARTER_PROMPT));
    fill("deadline-text", esc(isNaN(deadlineMs()) ? "the deadline" : formatDeadline()));
    setupSubmissionHelper();
  };

  function setupSubmissionHelper() {
    var form = $("#submit-helper");
    if (!form) return;
    var llmSelect = $("#sh-llm");
    llmSelect.innerHTML = (CFG.llms || ["Claude", "ChatGPT", "Other"]).map(function (l) {
      return "<option>" + esc(l) + "</option>";
    }).join("");
    function update() {
      var names = $("#sh-names").value.split(/,|&| and /).map(function (s) { return s.trim(); }).filter(Boolean);
      var title = $("#sh-title").value.trim();
      var blurb = $("#sh-blurb").value.trim();
      var emoji = $("#sh-emoji").value.trim() || "🎮";
      var llm = llmSelect.value;
      $("#sh-count").textContent = blurb.length + " / 100";
      var first = slugify((names[0] || "yourname").split(/\s+/)[0]);
      var slug = first + "-" + (slugify(title) || "game-title");
      var entry = {
        slug: slug,
        title: title || "Game title",
        authors: names.length ? names : ["Your name"],
        llm: llm,
        file: "games/" + slug + ".html",
        blurb: blurb || "One line about your game.",
        emoji: emoji,
        added: new Date().toISOString().slice(0, 10),
        award: null
      };
      $("#sh-filename").textContent = slug + ".html";
      $("#sh-message").textContent =
        "New Bonanza entry\n" +
        "Title: " + entry.title + "\n" +
        "By: " + joinNames(entry.authors) + "\n" +
        "Made with: " + llm + "\n" +
        "One-liner: " + entry.blurb + "\n" +
        "File: " + slug + ".html (attached)\n\n" +
        "For the organisers (paste into games.json):\n" +
        JSON.stringify(entry, null, 2);
    }
    form.addEventListener("input", update);
    update();
  }

  pages.judging = function () {
    fill("rubric", RUBRIC.map(function (c) {
      return "<tr><td><strong>" + c.name + "</strong></td><td>" + c.weight + "%</td><td>×" + c.mult + "</td><td>" + esc(c.look) + "</td></tr>";
    }).join(""));
    var judges = CFG.judges || [];
    fill("judges", judges.length ? "Judged by " + esc(joinNames(judges)) + "." : "The judges will be announced at kick-off.");
    $$("[data-vote-only]").forEach(function (el) { el.hidden = !CFG.votingUrl; });

    var btn = $("#make-sheet");
    if (btn) btn.addEventListener("click", function () {
      loadGames().then(function (games) {
        var judge = $("#judge-name").value.trim();
        var rows = games.filter(function (g) { return !g.excludeFromJudging; });
        if (!rows.length) { announce("There are no judged entries yet."); alertBox("There are no entries to judge yet."); return; }
        download("scoring-sheet" + (judge ? "-" + slugify(judge) : "") + ".csv", buildSheet(rows, judge));
      }, function (err) { alertBox(gamesErrorHtml(err), true); });
    });
    setupResults();
  };

  function alertBox(msg, isHtml) {
    var el = slot("sheet-msg");
    if (!el) return;
    el.innerHTML = isHtml ? msg : "<p>" + esc(msg) + "</p>";
  }

  function csvCell(v) {
    v = String(v == null ? "" : v);
    return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function buildSheet(games, judge) {
    var head = ["Judge", "Entry slug", "Entry title", "Silliness", "Playability", "Originality", "Presentation", "Wildcard", "Weighted total", "Notes"];
    var lines = [head.join(",")];
    games.forEach(function (g, i) {
      var r = i + 2;
      lines.push([csvCell(judge), csvCell(g.slug), csvCell(g.title), "", "", "", "", "",
        "=D" + r + "*8+E" + r + "*4+F" + r + "*4+G" + r + "*2+H" + r + "*2", ""].join(","));
    });
    return lines.join("\r\n") + "\r\n";
  }

  /* ---------- Results calculator ---------- */

  function parseCsv(text) {
    text = text.replace(/^﻿/, "");
    var firstLine = text.split(/\r?\n/)[0] || "";
    var counts = { ",": firstLine.split(",").length, ";": firstLine.split(";").length, "\t": firstLine.split("\t").length };
    var delim = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    var rows = [], row = [], cell = "", inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') inQ = false;
        else cell += c;
      } else if (c === '"') inQ = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }

  function computeResults(texts) {
    var keys = ["judge", "slug", "title", "silliness", "playability", "originality", "presentation", "wildcard"];
    var entries = {}, warnings = [], seen = {};
    texts.forEach(function (text, fi) {
      var rows = parseCsv(text);
      var header = rows.shift() || [];
      var col = {};
      header.forEach(function (h, i) {
        var k = h.trim().toLowerCase();
        keys.forEach(function (key) { if (col[key] === undefined && k.indexOf(key) !== -1) col[key] = i; });
      });
      if (col.slug === undefined || col.silliness === undefined) {
        warnings.push("Sheet " + (fi + 1) + " is missing the “Entry slug” or score columns, so it was skipped.");
        return;
      }
      rows.forEach(function (r, ri) {
        var slug = (r[col.slug] || "").trim();
        if (!slug) return;
        var judge = col.judge !== undefined ? (r[col.judge] || "").trim() : "";
        var scores = RUBRIC.map(function (c) { return parseFloat(String(r[col[c.name.toLowerCase()]] || "").replace(",", ".")); });
        var where = "Sheet " + (fi + 1) + ", row " + (ri + 2) + " (" + slug + (judge ? ", " + judge : "") + ")";
        if (scores.every(isNaN)) return;
        if (scores.some(function (s) { return isNaN(s) || s < 1 || s > 5; })) {
          warnings.push(where + ": every score must be a number from 1 to 5. Row skipped.");
          return;
        }
        var key = judge.toLowerCase() + "|" + slug;
        if (judge && seen[key]) { warnings.push(where + ": " + judge + " scored this entry twice. Only the first score was used."); return; }
        seen[key] = true;
        var total = scores.reduce(function (sum, s, i) { return sum + s * RUBRIC[i].mult; }, 0);
        var e = entries[slug] || (entries[slug] = { slug: slug, title: (col.title !== undefined && r[col.title]) || slug, totals: [], silly: [], judges: [] });
        e.totals.push(total); e.silly.push(scores[0]); e.judges.push(judge || "?");
      });
    });
    function avg(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
    var list = Object.keys(entries).map(function (k) {
      var e = entries[k]; e.avg = avg(e.totals); e.sillyAvg = avg(e.silly); return e;
    }).sort(function (a, b) { return b.avg - a.avg || b.sillyAvg - a.sillyAvg; });
    var counts = list.map(function (e) { return e.totals.length; });
    var maxJ = counts.length ? Math.max.apply(null, counts) : 0;
    list.forEach(function (e, i) {
      var prev = list[i - 1], next = list[i + 1];
      function same(o) { return o && Math.abs(o.avg - e.avg) < 1e-9 && Math.abs(o.sillyAvg - e.sillyAvg) < 1e-9; }
      e.rank = prev && same(prev) ? prev.rank : i + 1;
      e.note = same(prev) || same(next) ? "Still tied after the Silliness tie-break: judges discuss" : "";
      if (e.totals.length < maxJ) e.note = (e.note ? e.note + ". " : "") + "Scored by " + e.totals.length + " of " + maxJ + " judges";
    });
    return { list: list, warnings: warnings };
  }

  function setupResults() {
    var btn = $("#calc-results");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var files = Array.prototype.slice.call($("#results-files").files || []);
      var pasted = $("#results-paste").value;
      Promise.all(files.map(function (f) { return f.text(); })).then(function (texts) {
        if (pasted.trim()) texts.push(pasted);
        var out = slot("results");
        if (!texts.length) { out.innerHTML = '<p class="muted">Choose at least one sheet, or paste one in.</p>'; return; }
        var res = computeResults(texts);
        if (!res.list.length) {
          out.innerHTML = '<div class="error-box"><h3>No scores found</h3><p>Check that the sheets have the same column headings as the template, and that scores are filled in.</p>' +
            (res.warnings.length ? "<ul><li>" + res.warnings.map(esc).join("</li><li>") + "</li></ul>" : "") + "</div>";
          return;
        }
        var plain = res.list.map(function (e) { return e.rank + ". " + e.title + " (" + e.avg.toFixed(1) + ")"; }).join("\n");
        out.innerHTML =
          '<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Entry</th><th>Average score (out of 100)</th><th>Silliness average</th><th>Judges</th><th>Notes</th></tr></thead><tbody>' +
          res.list.map(function (e) {
            return "<tr><td>" + e.rank + "</td><td><strong>" + esc(e.title) + '</strong><br><span class="muted">' + esc(e.slug) + "</span></td><td>" + e.avg.toFixed(1) +
              "</td><td>" + e.sillyAvg.toFixed(2) + "</td><td>" + esc(e.judges.join(", ")) + "</td><td>" + esc(e.note) + "</td></tr>";
          }).join("") + "</tbody></table></div>" +
          (res.warnings.length ? '<div class="panel" style="margin-top:1rem"><strong>Check these rows</strong><ul><li>' + res.warnings.map(esc).join("</li><li>") + "</li></ul></div>" : "") +
          '<pre id="results-plain" hidden>' + esc(plain) + '</pre><p style="margin-top:1rem"><button class="btn btn-small copy-btn" type="button" data-copy="#results-plain">' + icon("copy") + " Copy ranking as text</button></p>";
        bindCopyButtons(out);
      });
    });
  }

  pages.play = function () {
    var slug = new URLSearchParams(location.search).get("game");
    var main = $("#main");
    function message(title, body) {
      main.innerHTML = '<div class="player-msg"><span style="font-size:3rem" aria-hidden="true">🫠</span><h1 style="font-size:2rem">' + title + "</h1>" + body +
        '<p><a class="btn btn-primary" href="gallery.html">' + icon("back") + " Back to the gallery</a></p></div>";
    }
    if (!slug) { message("No game picked", "<p>This page plays one game at a time. Choose one from the gallery.</p>"); return; }
    loadGames().then(function (games) {
      var g = games.filter(function (x) { return x.slug === slug; })[0];
      if (!g) { message("We couldn't find that game", "<p>There's no game called <code>" + esc(slug) + "</code>. It may have been renamed. Try the gallery.</p>"); return; }
      document.title = g.title + " · " + CFG.name;
      $("#player-title").innerHTML = "<strong>" + esc(g.title) + "</strong><span>by " + esc(joinNames(g.authors || [])) + (g.llm ? " · made with " + esc(g.llm) : "") + "</span>";
      $("#open-tab").href = g.file;
      $("#open-tab").hidden = false;
      fetch(g.file, { method: "HEAD", cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error();
        var frame = document.createElement("iframe");
        frame.className = "player-frame";
        frame.title = g.title;
        // Sandboxed: the game can run scripts but can't touch this site or navigate away.
        frame.setAttribute("sandbox", "allow-scripts allow-pointer-lock allow-modals");
        frame.setAttribute("allow", "fullscreen; autoplay; gamepad");
        frame.src = g.file;
        main.innerHTML = "";
        main.appendChild(frame);
        frame.addEventListener("load", function () { try { frame.focus(); } catch (e) {} });
      }).catch(function () {
        message("The game file is missing", "<p>The gallery lists this game, but the file <code>" + esc(g.file) + "</code> isn't in the repository yet. If you're the organiser, upload it into the <code>games</code> folder.</p>");
      });
    }, function (err) { main.innerHTML = '<div class="player-msg">' + gamesErrorHtml(err) + "</div>"; renderSubmitLinks(); });
  };

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
      frameSlot.innerHTML = '<iframe class="embed-frame" src="' + esc(g.file) + '" title="' + esc(g.title) + '" sandbox="allow-scripts allow-pointer-lock allow-modals" loading="lazy"></iframe>' +
        '<div class="btn-row" style="margin-top:1rem"><a class="btn btn-primary" href="play.html?game=' + encodeURIComponent(g.slug) + '">' + icon("play") + " Play full screen</a>" +
        '<a class="btn" href="' + esc(g.file) + '" target="_blank" rel="noopener">' + icon("external") + " Open the raw file</a></div>";
    }, function (err) { frameSlot.innerHTML = gamesErrorHtml(err); renderSubmitLinks(); });
  };

  pages.resources = function () {};

  /* ---------------- Boot ---------------- */

  function boot() {
    renderShell();
    if (!CFG || typeof CFG !== "object") { renderConfigError(); return; }
    renderSubmitLinks();
    try {
      if (pages[page]) pages[page]();
    } catch (e) {
      console.error(e);
      var main = $("#main");
      if (main) main.insertAdjacentHTML("afterbegin", '<div class="wrap"><div class="error-box" style="margin-top:2rem"><h3>Something on this page broke</h3><p>Please tell the organisers. Technical detail: <code>' + esc(e.message) + "</code></p></div></div>");
    }
    renderSubmitLinks();
    bindCopyButtons();
  }

  // Expose for the results tests and for curious people in the console.
  window.Bonanza = { computeResults: computeResults, buildSheet: buildSheet, slugify: slugify };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

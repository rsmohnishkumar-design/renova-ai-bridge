// Renova AI Bridge — local "AI development team" simulation engine.
// Rule-based text generation from the user's app idea, focus and extra requirements.
// No network, no AI services: every message is produced by this code and must be shown as simulated.
(function (root) {
  "use strict";
  const Starter = typeof require !== "undefined" && typeof module !== "undefined" ? require("./starter.js") : root.RenovaStarter;

  const SIM_LABEL = "SIMULATION — AI RESPONSES ARE GENERATED LOCALLY OR PREWRITTEN; NO REAL AI SERVICES ARE CONNECTED.";
  const ROLES = {
    chatgpt: { name: "ChatGPT", title: "Architect & Reviewer", summary: "Plans the architecture and reviews technical decisions." },
    claude: { name: "Claude", title: "Lead Developer", summary: "Proposes the implementation and produces the final development plan and starter code where supported." },
    gemini: { name: "Gemini", title: "Design & Innovation Reviewer", summary: "Evaluates usability, design and new features." },
    grok: { name: "Grok", title: "Critical Reviewer", summary: "Challenges assumptions, identifies weaknesses and proposes alternatives." }
  };
  const FOCUSES = { general: "General", security: "Security", ux: "User Experience", performance: "Performance", features: "Features" };
  const MAX_EXTRAS = 8;

  const esc = Starter.esc;
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const titleCase = s => s.replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
  const list = a => (a.length < 2 ? a.join("") : a.slice(0, -1).join("; ") + "; and " + a[a.length - 1]);
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };

  // ================= app-type knowledge =================
  const KINDS = {
    invoice: {
      re: /invoice|billing|receipt|quote|estimate/i, preview: "invoice",
      users: "freelancers and small businesses that bill clients", problem: "producing a correct, professional-looking invoice quickly without paid software",
      data: "invoices with client names and amounts", sensitivity: "client names and billing amounts", scale: "the saved invoice history",
      core: "the invoice total calculation", journey: "create and print a correct invoice in about a minute",
      tradeoff: "exact money arithmetic and a plain tax field over supporting every country's tax rules in version one",
      ideas: ["Recurring invoices from a saved template", "A copy-ready payment reminder message for late invoices"],
      features: [["Business and client details", "must"], ["Line items with quantity, rate and automatic totals", "must"], ["Tax and discount calculation", "must"], ["Printable / save-as-PDF invoice layout", "must"], ["Auto-numbered invoices with due dates", "should"], ["Saved invoice history in the browser", "should"], ["Multiple currencies", "later"], ["Email sending and online payments", "later"]],
      ux: ["show a live invoice preview next to the form so every change is visible instantly", "keep the totals in a sticky summary so they stay on screen on phones", "add a clean print stylesheet so the saved PDF looks professional"],
      risks: ["tax rules differ by country, so a hard-coded tax rate would be wrong for many users", "floating-point maths can leave totals a cent out, so money must be calculated in whole cents", "data stored only in the browser disappears if the user clears site data"],
      fixes: ["make tax a user-entered percentage per invoice, with no built-in rates", "store and calculate every amount as integer cents and round once", "add JSON export and import so users can back up their invoices"],
      fixNames: ["User-entered tax percentage", "Whole-cent money calculations", "JSON export and import backup"],
      dispute: { feature: "Saved invoice history in the browser", objection: "it promises a record-keeping feature that can silently vanish, which is dangerous for financial documents.", defence: "users constantly re-issue and copy earlier invoices, so history is core to the workflow, and a printed PDF is the real record anyway.", resolution: "keep history, but label it clearly as 'stored in this browser only' and ship JSON export and import in the first release.", added: "JSON export and import backup" },
      tests: ["a three-line invoice with 18% tax and a 10% discount totals to the exact expected cents", "printing produces one clean page with no form controls visible"],
      files: ["index.html — form, live preview and totals", "style.css — layout and print styles", "app.js — line items, cent-based maths, storage, export/import", "README.md — how to host and edit"]
    },
    tasks: {
      re: /todo|to-do|task|checklist|planner|habit|reminder/i, preview: "records", complete: true, fields: [["Task", "text"], ["Due date", "date"], ["Priority", "text"]],
      users: "people who want to track what they need to do without an account", problem: "keeping a short, trustworthy list of tasks that works on any device",
      data: "tasks with due dates and priorities", sensitivity: "the content of personal and work to-dos", scale: "the task list over months of use",
      core: "adding, completing and finding tasks", journey: "capture a task in a few seconds and tick it off later",
      tradeoff: "a dependable one-device list over recurrence and sync in version one",
      ideas: ["A 'today' view that shows only overdue and due-today tasks", "Quick-add by typing 'task, date' on one line"],
      features: [["Add, complete and delete tasks", "must"], ["Due dates and priorities", "must"], ["Tasks saved in the browser", "must"], ["Search tasks", "should"], ["Categories or tags", "should"], ["Recurring tasks", "later"], ["Sync across devices", "later"]],
      ux: ["make completing a task one large tap target with an undo toast", "sort overdue tasks to the top with a clear, non-colour-only marker", "show an empty state that explains how to add the first task"],
      risks: ["a task list that loses data on a cleared browser would destroy user trust", "recurring tasks multiply edge cases (time zones, month ends) and can sink the schedule", "unbounded lists get slow if rendering rebuilds everything on each change"],
      fixes: ["add export/import and a clear 'saved in this browser' note", "defer recurrence to a later version and say so in the interface", "render incrementally and cap displayed completed tasks"],
      fixNames: ["JSON export and import backup", "Optional repeat field in the task record", "Incremental list rendering"],
      dispute: { feature: "Recurring tasks", objection: "it is the riskiest feature for the smallest payoff and could delay the whole release.", defence: "habit-style tasks are what keep people coming back, so leaving recurrence out makes the product forgettable.", resolution: "ship the first release without recurrence, but design the task record with an optional repeat field so it can be added without a data migration.", added: "JSON export and import backup" },
      tests: ["adding, completing and deleting a task survives a page reload", "overdue tasks are visibly marked and sorted first"],
      files: ["index.html — task form and list", "style.css — responsive layout", "app.js — task model, filtering, storage", "README.md — hosting guide"]
    },
    expense: {
      re: /expense|budget|finance|money|spend|saving/i, preview: "records", sum: "Amount", fields: [["Description", "text"], ["Amount", "number"], ["Date", "date"]],
      users: "individuals and households who want to see where their money goes", problem: "recording spending quickly and seeing a clear total",
      data: "expenses with amounts and dates", sensitivity: "personal spending habits", scale: "years of daily expenses",
      core: "totals that must always add up exactly", journey: "log an expense in a few seconds and see the new total",
      tradeoff: "exact totals and a simple list over charts and bank connections in version one",
      ideas: ["A monthly budget limit with a visible 'remaining' figure", "Quick-add buttons for the user's most frequent expenses"],
      features: [["Add and delete expenses with amount and date", "must"], ["Running total of expenses", "must"], ["Expenses saved in the browser", "must"], ["Search expenses", "should"], ["Category breakdown", "should"], ["CSV export", "should"], ["Charts", "later"], ["Bank import", "later"]],
      ux: ["offer an amount-first quick-add form that opens the numeric keypad on phones", "show category figures as labelled bars with the numbers printed as text", "keep a persistent running total at the top of the list"],
      risks: ["money maths with floating point can drift, so amounts must be stored in whole minor units", "spending data is sensitive, so nothing may leave the device without the user knowing", "bank import is a compliance and security project, not a feature"],
      fixes: ["store amounts as integer minor units", "state plainly that data stays in this browser and offer a one-click clear", "remove bank import from scope entirely"],
      fixNames: ["Whole-cent money calculations", "Clear all saved data", "Bank import removed from scope"],
      dispute: { feature: "Charts", objection: "charts add a dependency or a lot of custom code for something a sorted table already communicates.", defence: "a visual breakdown is what makes a budget tool feel useful at a glance.", resolution: "no chart library: use simple CSS bars with the numbers shown as text, which is light, accessible and free.", added: "CSV export" },
      tests: ["three expenses add up to the exact total in cents", "deleting an expense updates the total immediately"],
      files: ["index.html — entry form, list, totals", "style.css — layout", "app.js — amounts in cents, totals, search, CSV", "README.md"]
    },
    notes: {
      re: /note|journal|diary|memo|writing/i, preview: "records", fields: [["Title", "text"], ["Note", "textarea"]],
      users: "people who want a private, quick place to write things down", problem: "capturing and finding notes without an account or cloud service",
      data: "personal notes", sensitivity: "private thoughts and sometimes passwords or addresses typed into notes", scale: "hundreds of notes over time",
      core: "saving text reliably and finding it again", journey: "jot something down instantly and find it later by searching",
      tradeoff: "plain text that is safe and fast over rich formatting in version one",
      ideas: ["Pinned notes that stay at the top", "A word and character count while typing"],
      features: [["Create and delete notes", "must"], ["Search across notes", "must"], ["Notes saved in the browser", "must"], ["Edit existing notes", "should"], ["Tags", "should"], ["Export notes as JSON", "should"], ["Rich text formatting", "later"], ["Cloud sync", "later"]],
      ux: ["autosave while typing and show a quiet 'saved' indicator", "make search instant and highlight the match", "use a two-pane layout on desktop and a single-pane list-to-editor flow on phones"],
      risks: ["autosave bugs can overwrite a note with an empty one", "rich text brings sanitising and XSS risks", "browser-only storage means a cleared cache deletes every note"],
      fixes: ["never save an empty value over existing text without confirming", "keep notes plain text, which removes the XSS surface", "add export and a visible backup reminder"],
      fixNames: ["Empty-save protection", "Plain-text notes only", "JSON export and import backup"],
      dispute: { feature: "Rich text formatting", objection: "rich text needs an editor library and HTML sanitising, which is a security and size cost.", defence: "plain text feels too basic and users will compare it with big note apps.", resolution: "plain text with optional Markdown-style display later; no HTML editor in version one.", added: "JSON export and import backup" },
      tests: ["a note typed and reloaded is identical", "searching a word returns only the notes that contain it"],
      files: ["index.html — note list and editor", "style.css", "app.js — notes model, search, autosave, export", "README.md"]
    },
    booking: {
      re: /book|appointment|schedul|reservation|calendar/i, preview: "records", fields: [["Name", "text"], ["Date", "date"], ["Time", "time"], ["Service", "text"]],
      users: "small service businesses and their customers", problem: "letting people request a time slot without a paid booking platform",
      data: "booking requests with names, dates and contact details", sensitivity: "customer names and appointment times", scale: "a busy calendar of requests",
      core: "showing which slots are free", journey: "pick a service and time and get a clear confirmation",
      tradeoff: "an honest request-and-confirm flow over a real-time booking guarantee a static site cannot give",
      ideas: ["A copy-ready confirmation message for the owner to send", "A week view that greys out slots the owner marked as taken"],
      features: [["Record booking requests (add and delete)", "must"], ["Service list and available time slots", "must"], ["Owner view of requests", "must"], ["Double-booking prevention", "must"], ["Confirmation message to copy or print", "should"], ["Email or SMS reminders", "later"], ["Online payment", "later"]],
      ux: ["show open slots as large, labelled buttons grouped by day", "confirm the chosen time in plain words before submitting", "make the form work with the keyboard only"],
      risks: ["a static site has no server, so bookings made by customers cannot reach the owner reliably", "double bookings are likely if two people choose a slot at once", "reminders and payments need paid services"],
      fixes: ["be explicit that the first release is a request form the owner receives through a free form-handling service or email link", "treat a slot as confirmed only after the owner approves it", "leave reminders and payments out of scope"],
      fixNames: ["Owner-approved confirmation", "Request delivery via the owner's email link", "Reminders and payments out of scope"],
      dispute: { feature: "Double-booking prevention", objection: "without a backend it cannot truly be guaranteed, so advertising it would be misleading.", defence: "customers expect to see taken slots, and the feature is the whole point of a booking tool.", resolution: "rename it 'availability display': the owner marks slots as taken, and the interface never claims real-time guarantees.", added: "Owner-managed slot availability" },
      tests: ["a request shows the chosen service, date and time in the confirmation", "a slot marked as taken can no longer be selected"],
      files: ["index.html — services, slots, request form", "style.css", "app.js — slots, owner view, storage", "README.md — how requests reach the owner"]
    },
    quiz: {
      re: /quiz|flashcard|study|exam|learn|trivia/i, preview: "records", fields: [["Question", "text"], ["Answer", "text"]],
      users: "students and teachers who want self-testing without an account", problem: "practising questions and seeing progress",
      data: "question-and-answer cards", sensitivity: "nothing very sensitive, but a student's study progress is still personal", scale: "decks of hundreds of cards",
      core: "showing a card, revealing the answer and scoring", journey: "flip through cards and see how many were right",
      tradeoff: "simple shuffle and retry over a scheduling algorithm we cannot validate in version one",
      ideas: ["A timed 'sprint' mode for ten random cards", "A 'missed cards' deck built automatically after each session"],
      features: [["Create question-and-answer cards", "must"], ["Practice mode that reveals the answer", "must"], ["Score for the session", "must"], ["Cards saved in the browser", "must"], ["Shuffle and retry missed cards", "should"], ["Shared decks", "later"], ["Spaced repetition", "later"]],
      ux: ["show one card at a time with a large reveal button", "give right/wrong feedback with text as well as colour", "show progress as 'card 3 of 12'"],
      risks: ["spaced repetition done badly is worse than simple shuffling", "shared decks need accounts and moderation", "very large decks can hurt performance"],
      fixes: ["start with shuffle and retry-missed only", "defer sharing; allow export and import of a deck file", "paginate or lazily render big decks"],
      fixNames: ["Shuffle and retry-missed only", "JSON export and import backup", "Lazy rendering of large decks"],
      dispute: { feature: "Spaced repetition", objection: "a naive scheduler creates false confidence in the learner's retention.", defence: "it is the feature that makes flashcards effective rather than a toy.", resolution: "version one uses shuffle and 'retry missed'; a simple, documented scheduling rule can follow once real usage shows what is needed.", added: "JSON export and import backup" },
      tests: ["revealing a card and marking it missed puts it in the retry pile", "the session score equals the number of correct answers"],
      files: ["index.html — deck editor and practice view", "style.css", "app.js — deck model, practice logic, storage", "README.md"]
    },
    calculator: {
      re: /calculator|convert|emi|loan|tip|percentage|calculate/i, preview: null, stores: false,
      users: "people who need a quick, trustworthy calculation", problem: "getting a correct result with clearly stated assumptions",
      data: "the numbers a user types in", sensitivity: "financial figures the user may not want shared", scale: "very little data, so the risk is correctness, not size",
      core: "the formula and its rounding", journey: "enter the numbers and see a clear result with the formula underneath",
      tradeoff: "one correct, explained result over many configurable options in version one",
      ideas: ["A side-by-side comparison of two scenarios", "A shareable link that restores the inputs"],
      features: [["Input form with validation", "must"], ["Clear result with the formula shown", "must"], ["Reset and sample values", "should"], ["Copy result", "should"], ["Shareable link with the inputs", "later"], ["History of calculations", "later"]],
      ux: ["show results as the user types, with the formula underneath", "validate inputs inline with plain-language messages", "use large numeric inputs that open the right keyboard on phones"],
      risks: ["rounding and floating-point errors can produce wrong results that look confident", "unstated assumptions make a correct formula misleading", "financial results can be mistaken for advice"],
      fixes: ["use well-tested rounding rules and unit tests with known values", "print the assumptions next to the result", "add a short 'estimate only, not advice' note"],
      fixNames: ["Tested rounding rules", "Assumptions printed with the result", "Estimate-only disclaimer"],
      dispute: { feature: "History of calculations", objection: "it adds storage and privacy concerns to a tool whose value is instant answers.", defence: "people re-run the same figures and appreciate seeing earlier results.", resolution: "no history in version one; add a Copy result button instead, which covers the need with no storage.", added: "Assumptions and disclaimer text" },
      tests: ["a worked example from a textbook returns the exact published answer", "invalid or empty input shows a message instead of NaN"],
      files: ["index.html — inputs and result", "style.css", "app.js — calculation functions and validation", "README.md — formulas and sources"]
    },
    generic: {
      re: /.^/, preview: "records", fields: [["Title", "text"], ["Details", "textarea"]],
      users: "people who want a simple, free, no-account tool for this purpose", problem: "doing this one job quickly, with data that stays on the user's device",
      data: "the entries the user creates", sensitivity: "whatever personal details the user decides to type in", scale: "a list that grows with use",
      core: "creating and finding entries", journey: "add an entry in a few seconds and find it again later",
      tradeoff: "a small, dependable core over a long feature list in version one",
      ideas: ["Pinned or favourite entries", "A simple summary count at the top of the list"],
      features: [["Create and delete {lname} entries", "must"], ["Search entries", "must"], ["Entries saved in the browser", "must"], ["Categories or tags", "should"], ["Export and import backup", "should"], ["Accounts and cloud sync", "later"], ["Sharing with other people", "later"]],
      ux: ["keep the main action visible and one tap away on phones", "give every empty state a short explanation of what to do next", "use clear labels and visible focus so the app works by keyboard"],
      risks: ["an unclear idea tends to grow features before the basics work", "browser-only storage means data disappears if site data is cleared", "accounts and sync need a backend, which breaks the free-hosting goal"],
      fixes: ["lock a small must-have list and test it before adding anything", "add export/import and say where the data is stored", "keep accounts and sync out of the first release"],
      fixNames: ["Locked must-have list", "JSON export and import backup", "Accounts and sync out of scope"],
      dispute: { feature: "Accounts and cloud sync", objection: "it needs a server and ongoing cost, which contradicts the zero-budget goal.", defence: "users expect their data on every device, so a tool without sync feels unfinished.", resolution: "no accounts in version one; export and import give users manual portability at no cost.", added: "JSON export and import backup" },
      tests: ["an entry created, reloaded and deleted behaves correctly", "the app is usable at 375px width with the keyboard only"],
      files: ["index.html — main screen", "style.css — responsive styles", "app.js — data model, storage, rendering", "README.md"]
    }
  };

  // ================= requirement classification (user-supplied extras) =================
  const REQ_RULES = [
    { key: "accounts", re: /log ?in|sign ?(in|up)|account|authenticat|password|user profile/i, mode: "defer",
      assess: "real accounts need a server and a database, and a static GitHub Pages site cannot provide either securely",
      challenge: "A fake login screen would be worse than none: it would imply protection that does not exist, and passwords must never be handled in the browser alone.",
      resolution: "no accounts in version one. Data stays on the device, export and import cover moving it, and the interface says so plainly." },
    { key: "payments", re: /payment|pay online|stripe|paypal|checkout|razorpay|upi/i, mode: "defer",
      assess: "taking payments needs a regulated payment provider and server-side code, which a free static site cannot do safely",
      challenge: "Even a 'demo' payment form trains users to type card details into an untrusted page. I'd rather not have one at all.",
      resolution: "not built. The app can display payment instructions as plain text that the owner types in." },
    { key: "messaging", re: /e-?mail|sms|whatsapp|notification|remind|alert/i, mode: "adapt", label: "a copy-ready message and a mailto: link",
      assess: "a static page cannot send email or SMS by itself, and a notification promise it cannot keep would mislead users",
      challenge: "Check the adaptation: a mailto: link opens the user's own mail app, so nothing is sent from the site. That has to be obvious in the wording.",
      resolution: "provide a ready-to-copy message and a mailto: link that opens the user's own email app, labelled so nobody thinks the site sends it." },
    { key: "sync", re: /sync|cloud|multi-?device|share|collaborat|real-?time|team/i, mode: "defer",
      assess: "syncing or sharing data between people needs a backend, which breaks the zero-cost hosting goal",
      challenge: "Sync is where data loss bugs live. Without a server we can't resolve conflicts, so any 'sync' would be a guess.",
      resolution: "no live sync. JSON export and import give users manual portability between devices at no cost." },
    { key: "ai", re: /\bai\b|chatbot|machine learning|gpt|recommend|assistant/i, mode: "adapt", label: "a clearly labelled rule-based helper",
      assess: "real AI features need a paid or keyed service, which this project does not have",
      challenge: "Calling a rule-based helper 'AI' would be misleading. If we build one, it must be labelled as simple rules.",
      resolution: "a rule-based helper that is clearly labelled as simple rules, not AI. No AI claims anywhere in the interface." },
    { key: "darkmode", re: /dark ?mode|theme|colou?r scheme/i, mode: "build",
      assess: "this is a CSS task: colour variables plus a prefers-color-scheme media query, with no JavaScript needed",
      challenge: "Contrast must hold in both themes, so every colour pair needs checking, not just the background.",
      resolution: "follow the system colour scheme with CSS variables and check contrast in both modes. A manual toggle can follow later." },
    { key: "export", re: /pdf|print|csv|download|export|backup|save as/i, mode: "build",
      assess: "printing uses a print stylesheet and downloads use a Blob link, both entirely client-side",
      challenge: "Downloads can be blocked in embedded or sandboxed pages, so there has to be a copy-from-textarea fallback and a visible note.",
      resolution: "implement print styling and JSON download with a visible text fallback. CSV only if the simpler formats are working." },
    { key: "search", re: /search|filter|sort|find/i, mode: "build",
      assess: "client-side search is a small function over the in-memory list",
      challenge: "Define what a match means (case, accents, partial words) and how the empty result looks, or users will think it is broken.",
      resolution: "case-insensitive substring search with a clear 'no matches' message." },
    { key: "charts", re: /chart|graph|report|analytic|dashboard|statistic/i, mode: "adapt", label: "CSS bars with the figures printed as text",
      assess: "chart libraries add weight and a dependency, while CSS bars with text figures are light and accessible",
      challenge: "A chart that colour alone explains fails colour-blind users. The numbers must be present as text.",
      resolution: "simple CSS bars with the figures printed next to them. No chart library." },
    { key: "offline", re: /offline|pwa|install|service worker/i, mode: "build",
      assess: "a web manifest and a small service worker work on GitHub Pages because it serves over HTTPS",
      challenge: "A cache-first service worker can leave users on stale code forever unless the cache is versioned.",
      resolution: "add after the core features, with a versioned cache name and an update note." },
    { key: "i18n", re: /language|translat|i18n|multi-?lingual|hindi|tamil|spanish|french/i, mode: "adapt", label: "a translated interface with untranslated user content",
      assess: "interface strings can live in a dictionary keyed by language, but user-entered content is not translated",
      challenge: "Machine-made translations of legal or money wording can be wrong. Who checks them?",
      resolution: "a dictionary-based interface for the languages the owner can review, defaulting to English." },
    { key: "upload", re: /upload|image|photo|logo|camera|scan|attachment/i, mode: "adapt", label: "a small local image kept on the device",
      assess: "files can be read locally with FileReader, but localStorage fills up fast with images and nothing may be uploaded to a server",
      challenge: "A 4 MB photo in localStorage will break saving for everything else. There must be a hard size cap.",
      resolution: "allow one small image (about 200 KB maximum), kept on the device and included in the export. Nothing is uploaded." }
  ];
  const REQ_DEFAULT = { key: "other", mode: "build",
    assess: "it can be built client-side as a small, self-contained addition",
    challenge: "Say exactly how we will know it works before we add it, otherwise it will drift.",
    resolution: "add it as a must-have with its own acceptance test." };

  function classifyRequirement(text) {
    const rule = REQ_RULES.find(r => r.re.test(text)) || REQ_DEFAULT;
    return { text, key: rule.key, mode: rule.mode, label: rule.label || "", assess: rule.assess, challenge: rule.challenge, resolution: rule.resolution };
  }
  function reqFeature(c) {
    if (c.mode === "defer") return { name: c.text, tier: "later", requested: true, note: "Deferred: " + c.resolution };
    if (c.mode === "adapt") return { name: c.text, tier: "should", requested: true, note: "Adapted as " + c.label + ". " + cap(c.resolution) };
    return { name: c.text, tier: "must", requested: true, note: cap(c.resolution) };
  }

  // ================= input handling =================
  const STOP = new Set("a an the my me i we you want need to please create build make design develop write code generate app apps application applications website site tool tools software program online simple new web system platform project something thing for of with and in on that is it".split(" "));
  function detectKind(idea) { return Object.keys(KINDS).find(k => k !== "generic" && KINDS[k].re.test(idea)) || "generic"; }

  // Returns {ok:true} or {ok:false, reason, message}. Rejects ideas too vague to plan from.
  function assessIdea(raw) {
    const idea = String(raw || "").trim().replace(/\s+/g, " ");
    if (!idea) return { ok: false, reason: "empty", message: "Enter an app idea first, for example: Create an online invoice generator." };
    const words = idea.toLowerCase().match(/[\p{L}\p{N}'-]+/gu) || [];
    const content = words.filter(w => !STOP.has(w));
    if (detectKind(idea) !== "generic" || content.length >= 2) return { ok: true };
    return { ok: false, reason: content.length ? "short" : "vague",
      message: "That idea is too vague to plan well. Describe what the app should do and who it is for, for example: \"Create an online invoice generator for freelancers\" or \"Build a flashcard app with a score\"." };
  }
  function deriveName(idea) {
    let s = idea.split(/\b(?:with|including|that|which|where|for)\b|[,.;:]/i)[0];
    s = s.replace(/^\s*(please\s+)?(create|build|make|design|develop|write|code|i want|i need|generate)\b\s*/i, "")
      .replace(/^(an?|the|my|some)\s+/i, "").replace(/^(online|simple|free|basic|web|web-based)\s+/gi, "")
      .replace(/[^\p{L}\p{N} &-]/gu, "").trim();
    const words = s.split(/\s+/).filter(Boolean).slice(0, 5);
    return words.length ? titleCase(words.join(" ").toLowerCase()) : "Your App";
  }
  function parseInlineExtras(idea) {
    const m = idea.match(/\b(?:with|including|that has|that have)\s+(.+)$/i);
    return m ? m[1].split(/,|\band\b/i).map(x => x.trim().replace(/^(an?|the)\s+/i, "")) : [];
  }
  // Accepts an array or a newline/semicolon separated string. De-duplicates and caps length and count.
  function normalizeExtras(input) {
    const parts = Array.isArray(input) ? input : String(input || "").split(/[\n;]+/);
    const out = [];
    for (let x of parts) {
      x = String(x).trim().replace(/\s+/g, " ");
      if (x.length < 3 || x.length > 120) continue;
      x = x[0].toUpperCase() + x.slice(1);
      if (!out.some(o => o.toLowerCase() === x.toLowerCase())) out.push(x);
      if (out.length >= MAX_EXTRAS) break;
    }
    return out;
  }
  function fill(obj, name) {
    const lname = name.toLowerCase();
    return JSON.parse(JSON.stringify(obj, (k, v) => (k === "re" ? undefined : v)).replace(/\{lname\}/g, () => lname.replace(/["\\]/g, "")));
  }

  // ================= message helpers =================
  const msg = (ai, phase, text, extra) => Object.assign({ ai, role: ROLES[ai].title, phase, text }, extra || {});
  function applyEffects(base, messages) {
    const fs = base.map(f => Object.assign({}, f));
    const find = n => fs.find(f => f.name.toLowerCase() === n.toLowerCase());
    for (const m of messages) for (const e of m.effects || []) {
      if (e.type === "add" && !find(e.feature.name)) fs.push(Object.assign({}, e.feature));
      else if (e.type === "defer") { const f = find(e.name); if (f) { f.tier = "later"; f.note = e.note || f.note; } }
      else if (e.type === "promote") { const f = find(e.name); if (f) f.tier = e.tier; }
    }
    return fs;
  }
  const add = (name, tier, note) => ({ type: "add", feature: Object.assign({ name, tier, added: true }, note ? { note } : {}) });
  const dec = (topic, by, text) => ({ topic, by, text });
  const bullets = a => a.map(x => "- " + x).join("\n");

  // ================= dialogue construction =================
  function makeState(idea, opts) {
    const kind = detectKind(idea), name = deriveName(idea);
    const K = fill(KINDS[kind], name);
    K.re = KINDS[kind].re;
    const focus = FOCUSES[opts.focus] ? opts.focus : "general";
    const texts = normalizeExtras(parseInlineExtras(idea).concat(normalizeExtras(opts.extras || [])));
    return { idea, kind, name, K, focus, v: hash(idea.toLowerCase() + "|" + focus), extraTexts: texts, extras: texts.map(classifyRequirement),
      baseFeatures: K.features.map(([n, t]) => ({ name: n, tier: t })) };
  }
  const archLine = S => "a static site (HTML, CSS and vanilla JavaScript) hosted free on GitHub Pages" + (S.K.stores === false ? "" : ", keeping " + S.K.data + " in the browser's localStorage");

  function proposal(S, M) {
    const { name, K, focus, idea } = S;
    const t = tier => S.baseFeatures.filter(f => f.tier === tier).map(f => f.name);
    const tiers = "Must have: " + list(t("must")) + ".\nShould have: " + list(t("should")) + ".\nLater: " + (t("later").length ? list(t("later")) : "nothing yet") + ".";
    const extra = S.extras.length ? "\n\nYour additional requirements (" + list(S.extraTexts) + ") will each be assessed in this discussion before they are accepted." : "";
    const open = {
      general: `I've analysed the idea "${idea}". The users are ${K.users}, and the core problem is ${K.problem}. My architecture proposal: ${archLine(S)}. Proposed scope for "${name}":`,
      security: `I've analysed "${idea}", and I want to start from the data, not the features. "${name}" will handle ${K.data}, so the architecture must be safe by default: ${archLine(S)}, with no third-party scripts and no data leaving the device. With that boundary, the proposed scope is:`,
      ux: `I've analysed "${idea}". The users are ${K.users}, and the job they need done is to ${K.journey}. Architecture: ${archLine(S)}, kept simple so the design can lead. Proposed scope for "${name}":`,
      performance: `I've analysed "${idea}". Expect ${K.scale} to grow, and the work that matters is ${K.core}. Architecture: ${archLine(S)}, with a performance budget of no dependencies and a small total download. Proposed scope for "${name}":`,
      features: `I've analysed "${idea}" for ${K.users}. Rather than commit to everything, I'm sorting candidate features into tiers for "${name}" so we can argue about the cut line:`
    }[focus];
    const handoff = { general: "Claude, how would you build it?", security: "Grok, attack this plan before Claude builds on it.", ux: "Gemini, how should the experience work?",
      performance: "Claude, how would you keep it fast?", features: "Gemini, what would make this stand out?" }[focus];
    M.push(msg("chatgpt", "Architecture and scope", open + "\n\n" + tiers + extra + "\n\n" + handoff));
  }

  function implementation(S, M, intro) {
    const { name, K, focus } = S;
    const must = applyEffects(S.baseFeatures, M).filter(f => f.tier === "must").length;
    const body = {
      general: `Reviewing ChatGPT's architecture. I agree with the static, no-dependency approach, so "${name}" stays free to host. The first release covers the ${must} must-have features only.`,
      security: `Taking the review into account, I'll build in the mitigations rather than just note them. The first release covers the ${must} must-have features, on a static site with no backend to attack.`,
      ux: `Taking the design direction into account, I'll structure the code around one screen and one state object, so the interface can change without touching storage. The first release covers the ${must} must-have features.`,
      performance: `Here is how I'd keep ${K.core} fast: a single in-memory state object as the source of truth, writes to localStorage only when something changes, and rendering only what is visible. The first release covers the ${must} must-have features.`,
      features: `Effort-wise, the ${must} must-have features are one screen and one data module, so they are realistic for a first release. I'd keep the structure flat so anything we promote later is easy to add.`
    }[focus];
    M.push(msg("claude", "Implementation plan", (intro || "") + body + "\n\nFiles:\n" + bullets(K.files) + "\n\nNothing outside this list gets built until the must-haves pass their tests.",
      { decision: dec("Technology", "Claude (Lead Developer), reviewed by ChatGPT", "Static site: HTML, CSS and vanilla JavaScript" + (K.stores === false ? "" : ", browser localStorage") + ", free GitHub Pages hosting, no external services.") }));
  }

  function extrasBeats(S) {
    const E = [];
    S.extras.slice(0, 3).forEach(c => {
      E.push(msg("claude", "Requirement review", `Your requirement "${c.text}": ${c.assess}.` + (c.mode === "build" ? " I can build it in the first release." : c.mode === "adapt" ? ` What I can honestly offer instead is ${c.label}.` : " I can't deliver it as stated at zero cost."), { reqKey: c.text }));
      E.push(msg(c.mode === "adapt" ? "chatgpt" : "grok", c.mode === "adapt" ? "Architecture review" : "Critical review", c.challenge, { reqKey: c.text }));
      E.push(msg("claude", "Requirement decision", `Decision on "${c.text}": ${c.resolution}`, { reqKey: c.text, effects: [{ type: "add", feature: reqFeature(c) }], decision: dec(`Your requirement: ${c.text}`, c.mode === "adapt" ? "Claude, after ChatGPT's architecture review" : "Claude, after Grok's challenge", c.resolution) }));
    });
    const rest = S.extras.slice(3);
    if (rest.length) E.push(msg("claude", "Remaining requirements", "Assessing the rest of your requirements together:\n" + rest.map(c => `- "${c.text}": ${c.mode === "build" ? "buildable client-side; added as a must-have" : c.mode === "adapt" ? "adapted as " + c.label : "deferred, " + c.assess}`).join("\n"),
      { reqKey: rest.map(c => c.text).join("|"), effects: rest.map(c => ({ type: "add", feature: reqFeature(c) })), decision: dec("Your remaining requirements", "Claude", rest.map(c => `${c.text} (${c.mode === "build" ? "build" : c.mode === "adapt" ? "adapt" : "defer"})`).join("; ") + ".") }));
    return E;
  }

  function disputeFor(S) {
    const { K, name, v } = S, k = v % 3;
    if (k === 0) return Object.assign({ kind: "feature" }, K.dispute);
    const i = k - 1;
    return { kind: "risk", feature: "the plan as scoped", objection: `the weakest point is that ${K.risks[i]}. I'd rather ship less than ship that.`,
      defence: `cutting the affected feature removes the core value of ${name}. It needs a mitigation, not a deletion.`,
      resolution: `mitigate instead of cutting: ${K.fixes[i]}. Trade-off accepted: ${K.tradeoff}.`, added: K.fixNames[i] };
  }

  function generalPath(S, M) {
    const { name, K, v } = S, D = disputeFor(S), u = (i) => cap(K.ux[(i + v) % 3]);
    const ref = D.kind === "feature" ? `"${D.feature}"` : "the main weakness";
    const crit = (first) => msg("grok", "Critical review", (first ? "Before we go further, here's what I think is wrong with the plan:" : "Problems I can see:") + `\n1. ${cap(K.risks[0])}.\n2. ${cap(K.risks[1])}.\n3. ${cap(K.risks[2])}.\n\n${D.kind === "feature" ? `I also object to "${D.feature}"` : "My main objection"}: ${D.objection}`);
    implementation(S, M, "");
    const design = (afterRevision) => msg("gemini", "Design and innovation review", `${afterRevision ? "On the revised plan, three" : "The structure is sound. Three"} design improvements:\n1. ${u(0)}.\n2. ${u(1)}.\n3. ${u(2)}.\n\nOne new feature worth considering: ${K.ideas[0].toLowerCase()}, because it serves the main job without adding data we don't already hold.${afterRevision ? "\n\nAnd accessibility has to count as part of done: labelled fields, keyboard use, visible focus and readable contrast." : ""}`,
      { effects: [add(K.ideas[0], "later", "Suggested by the design reviewer; not committed for the first release.")] });
    if (v % 2 === 0) {
      M.push(design(false));
      M.push(crit(false));
      M.push(msg("chatgpt", "Technical review", `Gemini's suggestions improve the product, so I'm adding them to the requirements. On Grok's points: I accept the first risk and want it handled in the architecture. On ${ref} I partly disagree: ${D.defence}`));
      M.push(msg("claude", "Decision", `Resolving the disagreement: ${D.resolution}\n\nFor Grok's risks I'll build in:\n${bullets(K.fixes.map(cap))}`, { effects: [add(D.added, "should")].concat(K.fixNames.map(n => add(n, "should"))),
        decision: dec(D.kind === "feature" ? `Disputed feature: ${D.feature}` : "Disputed weakness", "Grok objected, ChatGPT defended, Claude decided", D.resolution) }));
      M.push(msg("gemini", "Refinement", "That resolves my concern. One addition to the definition of done: accessibility. Every field labelled, every control usable by keyboard, a visible focus outline, readable contrast, and a layout that works at 375px wide.",
        { effects: [add("Accessibility: labels, keyboard use, focus, contrast", "must")], decision: dec("Accessibility", "Gemini (Design Reviewer)", "Labelled fields, keyboard operation, visible focus, readable contrast and a 375px layout are part of done.") }));
    } else {
      M.push(crit(true));
      M.push(msg("claude", "Revised plan", `Taking Grok's critique into account, I'm changing the plan. On the disagreement: ${D.resolution}\n\nMitigations I'll add:\n${bullets(K.fixes.map(cap))}\n\nWhat I'm not changing: ${K.tradeoff} stays as the guiding trade-off.`, { effects: [add(D.added, "should")].concat(K.fixNames.map(n => add(n, "should"))) }));
      M.push(design(true));
      M.push(msg("chatgpt", "Architecture decision", `Technical ruling. Grok was right that ${ref} needed a different answer, and Claude's revision is sound. Where I disagree with Grok: removing the feature entirely would cost more than the risk does, because ${D.defence} I'm also adding Gemini's accessibility point to the definition of done: labelled fields, keyboard use, visible focus, readable contrast and a 375px layout.`,
        { effects: [add("Accessibility: labels, keyboard use, focus, contrast", "must")], decision: dec(D.kind === "feature" ? `Disputed feature: ${D.feature}` : "Disputed weakness", "Grok objected, Claude revised, ChatGPT ruled", D.resolution) }));
    }
    M.push(msg("grok", "Acceptance", `I accept the compromise on one condition: acceptance tests. At minimum: (a) ${K.tests[0]}; (b) ${K.tests[1]}. If those pass, I have no blocking objection left.`,
      { decision: dec("Acceptance tests", "Grok (Critical Reviewer)", K.tests.join("; ") + ".") }));
  }

  function securityPath(S, M) {
    const { name, K } = S;
    M.push(msg("grok", "Attack review", `Attacking the plan first:\n1. ${cap(K.data)} sit in plain text in the browser, so anyone using this device can read ${K.sensitivity}.\n2. Every field the user types is untrusted text. If it is ever inserted as HTML, ${name} becomes an injection hole.\n3. Importing a backup file is the same risk: a malformed or hostile file must not be able to break the page or run script.\n\nAlternative: collect less. What is the minimum data the first release needs?`));
    implementation(S, M, "Fair points, so I'm building the defences in. ");
    M.push(msg("claude", "Mitigations", `Concretely: user text is only ever written with textContent, never innerHTML; there are no third-party scripts, fonts or analytics; a Content-Security-Policy meta tag blocks anything external; and backup imports are parsed, checked field by field and size-capped before anything is loaded. For the first point I won't pretend to encrypt: a password we cannot recover would lock users out, so we state the limit honestly instead.`,
      { effects: [add("Safe rendering and validated imports", "must"), add("Clear all saved data with confirmation", "should")],
        decision: dec("Security baseline", "Grok attacked, Claude mitigated", "Text is written with textContent only, no third-party scripts, a Content-Security-Policy, validated and size-capped imports, and an honest note that data is not encrypted on the device.") }));
    M.push(msg("chatgpt", "Technical review", `Reviewing the design: I agree, with one structural change. All reads and writes go through a single storage module that carries a version number, so a later format change cannot silently corrupt saved data, and every path that loads data passes through the same validation. Trade-off accepted: ${K.tradeoff}.`,
      { decision: dec("Storage architecture", "ChatGPT (Architect), accepted by Claude", "One storage module with a schema version, and one validation path for every load.") }));
    M.push(msg("gemini", "Safe design", `Security has to be visible to be useful. I'd add a plain-language note, "stored only in this browser on this device", a one-click Clear all saved data that needs a second click to confirm, and a warning before an import replaces anything. One idea that fits the privacy goal: ${K.ideas[0].toLowerCase()}, as long as nothing new leaves the device.`,
      { effects: [add(K.ideas[0], "later", "Suggested by the design reviewer; must not add any data leaving the device.")] }));
    M.push(msg("grok", "Residual risk and tests", `Residual risk: a shared computer. We can't fix that, so the notice and the clear button matter. Acceptance tests: (a) text containing <script> or an HTML tag, typed into any field, is shown as plain text and never runs; (b) an import with missing or wrong-typed fields is rejected with a message and changes nothing; (c) ${K.tests[0]}.`,
      { decision: dec("Security acceptance tests", "Grok (Critical Reviewer)", "Hostile text is displayed as text; bad imports are rejected without changes; " + K.tests[0] + ".") }));
  }

  function uxPath(S, M) {
    const { name, K, v } = S, i = v % 3;
    M.push(msg("gemini", "User journey", `The user's job is to ${K.journey}. I'd design the whole screen around that: one primary action, labels above fields, sensible defaults, a clear empty state and large tap targets. Specifically I'd ${K.ux[0]}, and I'd ${K.ux[1]}. New ideas that serve the journey: ${K.ideas[0].toLowerCase()}, and ${K.ideas[1].toLowerCase()}.`,
      { effects: [add(K.ideas[0], "later", "Suggested by the design reviewer."), add("Guided empty states", "should")] }));
    M.push(msg("grok", "Challenge", `Challenge: you're assuming users want every field and every nicety up front. Each extra field costs completions. Do we know people will actually "${K.ux[i]}", or is that designer taste? I'd cut to the essentials, hide the rest behind "More options", and watch someone who has never seen ${name} try it.`));
    implementation(S, M, "Grok's challenge is fair, so I'm planning for it. ");
    M.push(msg("claude", "Compromise", `What I can build: only the essential fields are visible by default and the rest sit in a <details> section, which needs no JavaScript. The idea to ${K.ux[i]} stays, because it is cheap and directly supports "${K.journey}". The idea to ${K.ux[(i + 1) % 3]} is kept too, but it is the first thing I'd drop if the schedule tightens.`,
      { effects: [add("Essential fields first, extra options collapsed", "should")], decision: dec("Progressive disclosure", "Gemini proposed, Grok challenged, Claude compromised", "Only essential fields are visible by default; the rest are collapsed. The agreed headline interaction: " + K.ux[i] + ".") }));
    M.push(msg("chatgpt", "Technical review", `Reviewing the structure: keep one state object and a pure render function, so interface tweaks never touch storage. Focus management matters for keyboard users: after adding or deleting, focus returns to a sensible place. Trade-off accepted: ${K.tradeoff}.`));
    M.push(msg("gemini", "Accessibility", "Definition of done for the experience: every field labelled, every control usable by keyboard, visible focus, readable contrast, status changes announced to screen readers, and a layout that works at 375px wide.",
      { effects: [add("Accessibility: labels, keyboard use, focus, contrast", "must")], decision: dec("Accessibility", "Gemini (Design Reviewer)", "Labels, keyboard operation, visible focus, readable contrast, announced status messages and a 375px layout.") }));
    M.push(msg("grok", "Acceptance", `Usability acceptance tests: (a) a first-time user completes the main task without instructions; (b) ${K.tests[0]}; (c) ${K.tests[1]}. If those pass, I'm satisfied.`, { decision: dec("Usability acceptance tests", "Grok (Critical Reviewer)", "First-time user completes the task unaided; " + K.tests.join("; ") + ".") }));
  }

  function performancePath(S, M) {
    const { name, K } = S;
    implementation(S, M, "");
    M.push(msg("grok", "Scale challenge", `Challenge: ${K.scale} will keep growing. If every change re-renders the whole list and re-reads localStorage, ${name} will stutter after a few hundred entries. And "fast" isn't a requirement until it has a number. What is the budget, and who tests it?`));
    M.push(msg("chatgpt", "Technical ruling", `Agreed, and here is the ruling. The in-memory copy is the source of truth; localStorage is written only on change, debounced. The list renders in pages of 50. The budget: no dependencies, roughly 60 KB total, interactive in about a second on a mid-range phone. All of it is measurable, so Grok can test it. Trade-off accepted: ${K.tradeoff}.`,
      { effects: [add("Paged list rendering (50 per page)", "should")], decision: dec("Performance budget", "Grok challenged, ChatGPT ruled", "In-memory source of truth, debounced writes, 50 entries per page, no dependencies, about 60 KB total, interactive in about one second on a mid-range phone.") }));
    M.push(msg("gemini", "Perceived performance", `Perceived speed matters as much as measured speed. Show the form immediately, keep the main action responsive while saving, and use a quiet empty state instead of spinners. ${cap(K.ideas[0].toLowerCase())} would need computing, so if we add it, it must run lazily and never block typing.`,
      { effects: [add(K.ideas[0], "later", "Only if it can be computed lazily without blocking input.")] }));
    M.push(msg("claude", "Update", `Updating the plan: I'll debounce writes by about 300 ms, render pages of 50, avoid layout thrash by building rows off-screen, and keep the code free of dependencies so there is nothing to download but our own files.`,
      { decision: dec("Rendering strategy", "Claude (Lead Developer)", "Debounced writes, paged rendering and off-screen row building; zero dependencies.") }));
    M.push(msg("grok", "Measurable tests", `Acceptance tests: (a) with 500 sample entries, adding one stays responsive with no visible lag; (b) total transfer size stays under the budget; (c) ${K.tests[0]}. If those pass, no objection from me.`,
      { decision: dec("Performance acceptance tests", "Grok (Critical Reviewer)", "500-entry responsiveness, size under budget, " + K.tests[0] + ".") }));
  }

  function featuresPath(S, M) {
    const { name, K } = S;
    M.push(msg("gemini", "Innovation", `Two ideas that would make ${name} stand out: "${K.ideas[0]}" and "${K.ideas[1]}". Both build on the main job rather than adding a new one, and they are the sort of thing users mention when they recommend a tool.`));
    M.push(msg("grok", "Scope challenge", `That is scope creep. A tool that does one job well beats one that does five badly, and every extra feature needs tests and upkeep. I'd accept one of them at most, and only if it doesn't touch the core flow. What does the user lose if neither ships?`));
    M.push(msg("chatgpt", "Prioritisation", `Prioritising. "${K.ideas[0]}" sits next to the core job, so it becomes a should-have. "${K.ideas[1]}" depends on data or behaviour we don't have yet, so it moves to later. Cut line: must-haves ship first; should-haves only after the acceptance tests pass.`,
      { effects: [add(K.ideas[0], "should"), add(K.ideas[1], "later", "Depends on data not yet collected; revisit after real usage.")], decision: dec("Feature cut line", "Gemini proposed, Grok challenged, ChatGPT prioritised", `"${K.ideas[0]}" is a should-have; "${K.ideas[1]}" is deferred; must-haves ship first.`) }));
    implementation(S, M, "That cut line works. ");
    M.push(msg("gemini", "Value check", `Value check: the idea to ${K.ux[S.v % 3]} fits the cut line, since it supports the main job. I'd put it in the must-have flow rather than treat it as an extra.`));
    M.push(msg("grok", "Acceptance", `I accept the cut line on one condition: the must-haves have tests before anything else is added. (a) ${K.tests[0]}; (b) ${K.tests[1]}.`, { decision: dec("Acceptance tests", "Grok (Critical Reviewer)", K.tests.join("; ") + ".") }));
  }

  function wrapUp(S, M) {
    const fs = applyEffects(S.baseFeatures, M), n = t => fs.filter(f => f.tier === t).length;
    M.push(msg("chatgpt", "Agreed requirements", `Summary of what we agreed. "${S.name}" ships with ${n("must")} must-have and ${n("should")} should-have features, accessibility as part of done, Grok's acceptance tests, and ${n("later")} items explicitly deferred${S.extras.length ? ", including how each of your additional requirements was handled" : ""}. Claude, please finalise.`));
    M.push(msg("claude", "Final plan", `Final decision recorded. I'm producing the final development plan${S.K.preview ? " and a starter app" : ""} in the result panel. Anything the starter does not implement is listed as not implemented rather than assumed.`, { final: true }));
  }

  function buildScript(S) {
    const M = [];
    proposal(S, M);
    const path = { general: generalPath, security: securityPath, ux: uxPath, performance: performancePath, features: featuresPath }[S.focus];
    const body = [];
    path(S, body);
    // Extras are reviewed right after the first implementation message of the chosen path.
    const iClaude = body.findIndex(m => m.ai === "claude");
    const E = extrasBeats(S);
    body.splice(iClaude < 0 ? 0 : iClaude + 1, 0, ...E);
    M.push(...body);
    wrapUp(S, M);
    return M;
  }

  // ================= public: build / extend =================
  function buildPlan(rawIdea, opts) {
    opts = opts || {};
    const check = assessIdea(rawIdea);
    if (!check.ok) return null;
    const idea = String(rawIdea).trim().replace(/\s+/g, " ").slice(0, 200);
    const S = makeState(idea, opts);
    return { idea, kind: S.kind, name: S.name, focus: S.focus, extras: S.extraTexts.slice(), v: S.v, script: buildScript(S), continuations: 0 };
  }

  // Continue an existing discussion. Played messages (script[0..upTo)) are kept; unplayed ones are dropped
  // and replaced by a short re-planning round that includes the new requirement.
  function extendPlan(plan, upTo, requirement) {
    const req = normalizeExtras([requirement])[0];
    if (!req) return { error: "Enter a requirement of at least 3 characters." };
    if (plan.extras.some(x => x.toLowerCase() === req.toLowerCase())) return { error: "That requirement is already part of this discussion." };
    if (plan.extras.length >= MAX_EXTRAS) return { error: `A discussion can hold at most ${MAX_EXTRAS} additional requirements.` };
    upTo = Math.max(0, Math.min(upTo, plan.script.length));
    if (upTo === 0) return { plan: buildPlan(plan.idea, { focus: plan.focus, extras: plan.extras.concat(req) }) };
    const S = makeState(plan.idea, { focus: plan.focus, extras: plan.extras });
    const c = classifyRequirement(req), K = S.K;
    const interrupted = upTo < plan.script.length;
    const played = plan.script.slice(0, upTo);
    const lead = interrupted ? "The meeting was still in progress, so I'm dropping the points we haven't reached and re-planning from here. " : "Reopening the discussion. ";
    const E = [];
    E.push(msg("chatgpt", "New requirement", `${lead}New requirement from the user: "${req}". Architecturally, ${c.mode === "build" ? "it fits inside the existing structure, so no redesign is needed" : c.mode === "adapt" ? "it cannot be done as stated on a static site, so we need an adapted version" : "it touches what static hosting cannot do, so this is a scope boundary question"}. Context: the app is "${S.name}", with focus on ${FOCUSES[S.focus].toLowerCase()}.`, { reqKey: req }));
    const claude1 = msg("claude", "Requirement review", `On "${req}": ${c.assess}.` + (c.mode === "build" ? " I can add it without touching the agreed files." : c.mode === "adapt" ? ` What I can offer honestly is ${c.label}.` : " I can't promise it at zero cost."), { reqKey: req });
    const grok1 = msg("grok", "Critical review", c.challenge, { reqKey: req });
    const gemini1 = msg("gemini", "Design impact", c.mode === "defer" ? `Design-wise, we should state the boundary in the interface so nobody expects "${req}" to work. A short, honest note beats a disabled control that looks broken.` : `Design-wise, "${req}" needs one clear place in the interface, a label that says what it does, and keyboard access. It should not add a new screen. ${cap(K.ux[S.v % 3])} still holds.`, { reqKey: req });
    if (c.mode === "build") E.push(claude1, gemini1, grok1); else E.push(grok1, claude1, gemini1);
    E.push(msg("chatgpt", "Decision", `Decision on "${req}": ${c.resolution}`, { reqKey: req, effects: [{ type: "add", feature: reqFeature(c) }],
      decision: dec(`Your requirement: ${req}`, "Team decision, ChatGPT recording", c.resolution) }));
    E.push(msg("claude", "Updated final plan", `Updated plan recorded with "${req}" handled as decided. The result panel reflects the change, and the starter app only claims what it actually implements.`, { final: true }));
    return { plan: Object.assign({}, plan, { extras: plan.extras.concat(req), script: played.concat(E), continuations: (plan.continuations || 0) + 1 }) };
  }

  // ================= final plan =================
  function getFinal(plan, upTo) {
    const n = upTo === undefined ? plan.script.length : upTo;
    const played = plan.script.slice(0, n);
    const S = makeState(plan.idea, { focus: plan.focus, extras: plan.extras });
    const { K } = S;
    const features = applyEffects(S.baseFeatures, played);
    const cfg = { fields: K.fields, sum: K.sum, complete: K.complete };
    features.forEach(f => { f.status = Starter.statusFor(f, K.preview, cfg); });
    const discussed = new Set(played.map(m => m.reqKey).filter(Boolean));
    const decisions = played.filter(m => m.decision).map(m => m.decision);
    const additional = plan.extras.map(text => {
      const c = classifyRequirement(text), f = features.find(x => x.name.toLowerCase() === text.toLowerCase());
      const done = f !== undefined;
      return { text, handling: c.mode === "build" ? "build" : c.mode === "adapt" ? "adapt" : "defer", outcome: done ? c.resolution : "Not yet discussed (the discussion ended before it was reached).", tier: f ? f.tier : null, status: f ? f.status : "not-discussed" };
    });
    const implemented = features.filter(f => f.status === "implemented").map(f => f.name);
    const notImplemented = features.filter(f => f.status === "not-implemented" || f.status === "deferred").map(f => f.name);
    let code = null, codeNote;
    const notes = { implemented, notImplemented };
    if (K.preview === "invoice") code = Starter.invoiceCode(S.name, notes);
    else if (K.preview === "records") code = Starter.recordsCode(S.name, cfg, notes);
    if (code) codeNote = `A basic working starter built for the agreed requirements. It implements ${implemented.length} of ${features.length} requirements; the other ${features.length - implemented.length} are listed as not implemented or deferred, and nothing beyond the implemented list should be assumed to work.`;
    else codeNote = "No starter app is available for this type of app, so no feature is claimed to work. Follow the development steps.";

    const mustNames = features.filter(f => f.tier === "must").map(f => f.name);
    const stores = K.stores !== false;
    const components = ["Presentation: index.html and style.css, responsive, no external fonts or libraries",
      "Application logic: app.js, covering " + K.core];
    if (stores) components.push("Storage: browser localStorage behind one small wrapper with try/catch and a schema version", "Backup: JSON export and import with validation before anything is loaded");
    if (S.focus === "security") components.push("Security: textContent-only rendering, no third-party scripts, Content-Security-Policy meta tag, validated imports");
    if (S.focus === "performance") components.push("Performance budget: no dependencies, about 60 KB total, paged list rendering, debounced writes");
    if (S.focus === "ux") components.push("Interaction design: one primary flow, essential fields first, keyboard operable, 375px layout");
    if (S.focus === "features") components.push("Release plan: must-haves first, should-haves behind the cut line, later items documented but not built");
    const fileNames = K.files.map(f => f.split(" — ")[0]);
    const steps = [
      "Create the repository and add " + fileNames.join(", ") + ".",
      stores ? "Write the data model and storage helpers (with try/catch around localStorage)." : "Write the calculation functions with unit-style checks against known values.",
      "Build the main screen from the must-have features: " + list(mustNames) + ".",
      "Implement the agreed mitigations: " + K.fixes.slice(0, 2).join("; ") + ".",
      "Add the should-have features that fit the schedule: " + (features.some(f => f.tier === "should") ? list(features.filter(f => f.tier === "should").map(f => f.name)) : "none") + ".",
      "Accessibility and responsive pass: labels, keyboard use, focus, contrast, 375px layout.",
      "Run the acceptance tests: " + K.tests.join("; ") + ".",
      "Enable GitHub Pages (Settings → Pages → deploy from branch) and share the link."
    ];
    const limitations = [
      "This plan comes from a local simulation. No real AI service (ChatGPT, Claude, Gemini or Grok) took part.",
      "Hosting is static: no accounts, server, email sending or payments."
    ];
    if (stores) limitations.push("Data lives in the user's browser only; clearing site data deletes it, so regular JSON exports are advised.");
    if (code) limitations.push(`The starter implements ${implemented.length} of ${features.length} requirements; the rest are not implemented or deferred. In the sandboxed preview, saving, printing and downloads are limited; download index.html to use them.`);
    else limitations.push("No starter app was generated for this type of app.");
    const deferredNames = features.filter(f => f.tier === "later").map(f => f.name);
    if (deferredNames.length) limitations.push("Deferred to later versions: " + list(deferredNames) + ".");

    const counts = {};
    played.forEach(m => { counts[m.ai] = (counts[m.ai] || 0) + 1; });
    const roles = Object.keys(ROLES).map(id => ({ id, name: ROLES[id].name, title: ROLES[id].title, summary: ROLES[id].summary, messages: counts[id] || 0 }));
    return {
      name: S.name, idea: plan.idea, kind: plan.kind, focus: plan.focus, focusLabel: FOCUSES[plan.focus],
      complete: n >= plan.script.length && played.length > 0 && !!played[played.length - 1].final,
      roles, requirements: features, additionalRequirements: additional, decisions,
      architecture: { summary: "A static single-page app hosted free on GitHub Pages" + (stores ? "; all data stays in the user's browser." : "; nothing is stored."), components },
      structure: S.name.toLowerCase().replace(/\s+/g, "-") + "/\n" + K.files.map(f => "  " + f.replace(" — ", "   # ")).join("\n"),
      steps, limitations,
      starter: { available: !!code, code, note: codeNote, implemented, notImplemented },
      simulation: { label: SIM_LABEL, discussionMessages: played.length, continuations: plan.continuations || 0 }
    };
  }

  // ================= exports =================
  const mdEsc = s => String(s).replace(/\r?\n/g, " ").replace(/([\\`*_{}\[\]<>#|])/g, "\\$1");
  const STATUS_TEXT = { implemented: "in starter", "not-implemented": "not implemented in starter", deferred: "deferred", "no-starter": "no starter available", "not-discussed": "not yet discussed" };

  function toMarkdown(final, opts) {
    const when = (opts && opts.generatedAt) || new Date().toISOString();
    const L = [];
    L.push(`# Final plan: ${mdEsc(final.name)}`, "", `> **${SIM_LABEL}**`, "",
      `- **App idea:** ${mdEsc(final.idea)}`, `- **Discussion focus:** ${final.focusLabel}`, `- **Generated:** ${when}`, "");
    L.push("## Participating simulated roles", "");
    final.roles.forEach(r => L.push(`- **${r.name} (simulated)** — ${r.title}: ${r.summary} (${r.messages} messages)`));
    L.push("", "## Requirements", "");
    [["must", "Must have"], ["should", "Should have"], ["later", "Later"]].forEach(([t, label]) => {
      const items = final.requirements.filter(f => f.tier === t);
      L.push(`### ${label}`, "");
      if (!items.length) L.push("- None");
      items.forEach(f => L.push(`- ${mdEsc(f.name)}${f.requested ? " *(requested by you)*" : ""} — ${STATUS_TEXT[f.status]}`));
      L.push("");
    });
    L.push("## Additional requirements from you", "");
    if (!final.additionalRequirements.length) L.push("- None");
    final.additionalRequirements.forEach(a => L.push(`- ${mdEsc(a.text)} — ${a.handling} (${STATUS_TEXT[a.status] || a.status}): ${mdEsc(a.outcome)}`));
    L.push("", "## Key decisions", "");
    if (!final.decisions.length) L.push("- None recorded");
    final.decisions.forEach(d => L.push(`- **${mdEsc(d.topic)}:** ${mdEsc(d.text)} — *${mdEsc(d.by)}*`));
    L.push("", "## Proposed architecture", "", mdEsc(final.architecture.summary), "");
    final.architecture.components.forEach(c => L.push(`- ${mdEsc(c)}`));
    L.push("", "## Application structure", "", "```", final.structure, "```", "", "## Implementation steps", "");
    final.steps.forEach((s, i) => L.push(`${i + 1}. ${mdEsc(s)}`));
    L.push("", "## Starter app", "", mdEsc(final.starter.note), "");
    L.push("**Implemented:**", ...(final.starter.implemented.length ? final.starter.implemented.map(x => `- ${mdEsc(x)}`) : ["- None"]), "");
    L.push("**Not implemented or deferred:**", ...(final.starter.notImplemented.length ? final.starter.notImplemented.map(x => `- ${mdEsc(x)}`) : ["- None"]), "");
    if (final.starter.available) L.push("The starter source is available through the Download index.html button, and in the JSON export.", "");
    L.push("## Known limitations", "");
    final.limitations.forEach(x => L.push(`- ${mdEsc(x)}`));
    return L.join("\n") + "\n";
  }
  function toJSON(final, opts) {
    const when = (opts && opts.generatedAt) || new Date().toISOString();
    return JSON.stringify({ schema: "renova-ai-bridge/final-plan", version: 2, generatedAt: when, simulation: true, disclaimer: SIM_LABEL,
      appIdea: final.idea, appName: final.name, focus: final.focus, roles: final.roles, requirements: final.requirements, additionalRequirements: final.additionalRequirements,
      decisions: final.decisions, architecture: final.architecture, structure: final.structure, implementationSteps: final.steps, limitations: final.limitations,
      starter: { available: final.starter.available, note: final.starter.note, implemented: final.starter.implemented, notImplemented: final.starter.notImplemented, code: final.starter.code } }, null, 2);
  }

  const api = { SIM_LABEL, ROLES, FOCUSES, MAX_EXTRAS, assessIdea, normalizeExtras, classifyRequirement, buildPlan, extendPlan, getFinal, toMarkdown, toJSON };
  if (typeof module !== "undefined") module.exports = api; else root.RenovaSimulation = api;
})(typeof window !== "undefined" ? window : globalThis);

// Renova AI Bridge — local "AI development team" simulation engine.
// Pure rule-based text generation from the user's app idea. No network, no AI services.
// Every message it produces is scripted by this code and must be labelled as simulated.
(function (root) {
  const ROLES = {
    chatgpt: "Product Analyst",
    claude: "Lead Developer",
    gemini: "UX & Design Reviewer",
    grok: "Risk Reviewer"
  };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const titleCase = s => s.replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
  const list = a => a.length < 2 ? a.join("") : a.slice(0, -1).join("; ") + "; and " + a[a.length - 1];

  // ---- app-type knowledge (each entry is plain data; {name}/{lname} are filled in per idea) ----
  const KINDS = {
    invoice: {
      re: /invoice|billing|receipt|quote|estimate/i,
      users: "freelancers and small businesses that bill clients",
      problem: "producing a correct, professional-looking invoice quickly without paid software",
      features: [["Business and client details", "must"], ["Line items with quantity, rate and automatic totals", "must"], ["Tax and discount calculation", "must"], ["Printable / save-as-PDF invoice layout", "must"], ["Auto-numbered invoices with due dates", "should"], ["Saved invoice history in the browser", "should"], ["Multiple currencies", "later"], ["Email sending and online payments", "later"]],
      ux: ["show a live invoice preview next to the form so every change is visible instantly", "keep the totals in a sticky summary so they stay on screen on phones", "add a clean print stylesheet so the saved PDF looks professional"],
      risks: ["tax rules differ by country, so a hard-coded tax rate would be wrong for many users", "floating-point maths can leave totals a cent out, so money must be calculated in whole cents", "data stored only in the browser disappears if the user clears site data"],
      fixes: ["make tax a user-entered percentage per invoice, with no built-in rates", "store and calculate every amount as integer cents and round once", "add JSON export and import so users can back up their invoices"],
      dispute: { feature: "Saved invoice history in the browser", objection: "it promises a record-keeping feature that can silently vanish, which is dangerous for financial documents.", defence: "users constantly re-issue and copy earlier invoices, so history is core to the workflow, and a printed PDF is the real record anyway.", resolution: "keep history, but label it clearly as 'stored in this browser only' and ship JSON export/import in the first release.", added: "JSON export and import backup" },
      tests: ["a three-line invoice with 18% tax and a 10% discount totals to the exact expected cents", "printing produces one clean page with no form controls visible"],
      files: ["index.html — form, live preview and totals", "style.css — layout and print styles", "app.js — line items, cent-based maths, storage, export/import", "README.md — how to host and edit"],
      preview: "invoice"
    },
    tasks: {
      re: /todo|to-do|task|checklist|planner|habit|reminder/i,
      users: "people who want to track what they need to do without an account",
      problem: "keeping a short, trustworthy list of tasks that works on any device",
      features: [["Add, edit, complete and delete tasks", "must"], ["Due dates and priorities", "must"], ["Filter by status and priority", "should"], ["Tasks saved in the browser", "must"], ["Categories or tags", "should"], ["Recurring tasks", "later"], ["Sync across devices", "later"]],
      ux: ["make completing a task one large tap target with an undo toast", "sort overdue tasks to the top with a clear, non-colour-only marker", "show an empty state that explains how to add the first task"],
      risks: ["a task list that loses data on a cleared browser would destroy user trust", "recurring tasks multiply edge cases (time zones, month ends) and can sink the schedule", "unbounded lists get slow if rendering rebuilds everything on each change"],
      fixes: ["add export/import and a clear 'saved in this browser' note", "defer recurrence to a later version and say so in the interface", "render incrementally and cap displayed completed tasks"],
      dispute: { feature: "Recurring tasks", objection: "it is the riskiest feature for the smallest payoff and could delay the whole release.", defence: "habit-style tasks are what keep people coming back, so leaving recurrence out makes the product forgettable.", resolution: "ship the first release without recurrence, but design the task record with an optional repeat field so it can be added without a data migration.", added: "Export and import backup" },
      tests: ["adding, completing and deleting a task survives a page reload", "overdue tasks are visibly marked and sorted first"],
      files: ["index.html — task form and list", "style.css — responsive layout", "app.js — task model, filtering, storage", "README.md — hosting guide"],
      preview: "records", fields: [["Task", "text"], ["Due date", "date"], ["Priority", "text"]]
    },
    expense: {
      re: /expense|budget|finance|money|spend|saving/i,
      users: "individuals and households who want to see where their money goes",
      problem: "recording spending quickly and seeing a clear total",
      features: [["Add and delete expenses with amount, date and category", "must"], ["Running total and per-category totals", "must"], ["Monthly filter", "should"], ["Expenses saved in the browser", "must"], ["CSV export", "should"], ["Charts", "later"], ["Bank import", "later"]],
      ux: ["offer an amount-first quick-add form that opens the numeric keypad on phones", "show category totals as labelled bars with the figures printed as text", "keep a persistent running total at the top of the list"],
      risks: ["money maths with floating point can drift, so amounts must be stored in whole minor units", "spending data is sensitive, so nothing may leave the device without the user knowing", "bank import is a compliance and security project, not a feature"],
      fixes: ["store amounts as integer minor units", "state plainly that data stays in this browser and offer a one-click clear", "remove bank import from scope entirely"],
      dispute: { feature: "Charts", objection: "charts add a dependency or a lot of custom code for something a sorted table already communicates.", defence: "a visual breakdown is what makes a budget tool feel useful at a glance.", resolution: "no chart library: use simple CSS bars with the numbers shown as text, which is light, accessible and free.", added: "CSV export" },
      tests: ["three expenses add up to the exact total in cents", "the monthly filter excludes expenses from other months"],
      files: ["index.html — entry form, list, totals", "style.css — layout", "app.js — amounts in cents, totals, filter, CSV", "README.md"],
      preview: "records", fields: [["Description", "text"], ["Amount", "number"], ["Date", "date"]], sum: "Amount"
    },
    notes: {
      re: /note|journal|diary|memo|writing/i,
      users: "people who want a private, quick place to write things down",
      problem: "capturing and finding notes without an account or cloud service",
      features: [["Create, edit and delete notes", "must"], ["Search across notes", "must"], ["Notes saved in the browser", "must"], ["Tags", "should"], ["Export to a text file", "should"], ["Rich text formatting", "later"], ["Cloud sync", "later"]],
      ux: ["autosave while typing and show a quiet 'saved' indicator", "make search instant and highlight the match", "use a two-pane layout on desktop and a single-pane list-to-editor flow on phones"],
      risks: ["autosave bugs can overwrite a note with an empty one", "rich text brings sanitising and XSS risks", "browser-only storage means a cleared cache deletes every note"],
      fixes: ["never save an empty value over existing text without confirming", "keep notes plain text, which removes the XSS surface", "add export and a visible backup reminder"],
      dispute: { feature: "Rich text formatting", objection: "rich text needs an editor library and HTML sanitising, which is a security and size cost.", defence: "plain text feels too basic and users will compare it with big note apps.", resolution: "plain text with optional Markdown-style display later; no HTML editor in version one.", added: "Export to a text file" },
      tests: ["a note typed and reloaded is identical", "searching a word returns only the notes that contain it"],
      files: ["index.html — note list and editor", "style.css", "app.js — notes model, search, autosave, export", "README.md"],
      preview: "records", fields: [["Title", "text"], ["Note", "textarea"]]
    },
    booking: {
      re: /book|appointment|schedul|reservation|calendar/i,
      users: "small service businesses and their customers",
      problem: "letting people request a time slot without a paid booking platform",
      features: [["Service list and available time slots", "must"], ["Booking request form", "must"], ["Owner view of requests", "must"], ["Double-booking prevention", "must"], ["Confirmation message to copy or print", "should"], ["Email or SMS reminders", "later"], ["Online payment", "later"]],
      ux: ["show open slots as large, labelled buttons grouped by day", "confirm the chosen time in plain words before submitting", "make the form work with the keyboard only"],
      risks: ["a static site has no server, so bookings made by customers cannot reach the owner reliably", "double bookings are likely if two people choose a slot at once", "reminders and payments need paid services"],
      fixes: ["be explicit that the first release is a request form the owner receives through a free form-handling service or email link", "treat a slot as confirmed only after the owner approves it", "leave reminders and payments out of scope"],
      dispute: { feature: "Double-booking prevention", objection: "without a backend it cannot truly be guaranteed, so advertising it would be misleading.", defence: "customers expect to see taken slots, and the feature is the whole point of a booking tool.", resolution: "rename it 'availability display': the owner marks slots as taken, and the interface never claims real-time guarantees.", added: "Owner-managed slot availability" },
      tests: ["a request shows the chosen service, date and time in the confirmation", "a slot marked as taken can no longer be selected"],
      files: ["index.html — services, slots, request form", "style.css", "app.js — slots, owner view, storage", "README.md — how requests reach the owner"],
      preview: "records", fields: [["Name", "text"], ["Date", "date"], ["Time", "time"], ["Service", "text"]]
    },
    quiz: {
      re: /quiz|flashcard|study|exam|learn|trivia/i,
      users: "students and teachers who want self-testing without an account",
      problem: "practising questions and seeing progress",
      features: [["Create question-and-answer cards", "must"], ["Practice mode that reveals the answer", "must"], ["Score for the session", "must"], ["Cards saved in the browser", "must"], ["Shuffle and retry missed cards", "should"], ["Shared decks", "later"], ["Spaced repetition", "later"]],
      ux: ["show one card at a time with a large reveal button", "give right/wrong feedback with text as well as colour", "show progress as 'card 3 of 12'"],
      risks: ["spaced repetition done badly is worse than simple shuffling", "shared decks need accounts and moderation", "very large decks can hurt performance"],
      fixes: ["start with shuffle and retry-missed only", "defer sharing; allow export and import of a deck file", "paginate or lazily render big decks"],
      dispute: { feature: "Spaced repetition", objection: "a naive scheduler creates false confidence in the learner's retention.", defence: "it is the feature that makes flashcards effective rather than a toy.", resolution: "version one uses shuffle and 'retry missed'; a simple, documented scheduling rule can follow once real usage shows what is needed.", added: "Deck export and import" },
      tests: ["revealing a card and marking it missed puts it in the retry pile", "the session score equals the number of correct answers"],
      files: ["index.html — deck editor and practice view", "style.css", "app.js — deck model, practice logic, storage", "README.md"],
      preview: "records", fields: [["Question", "text"], ["Answer", "text"]]
    },
    calculator: {
      re: /calculator|convert|emi|loan|tip|percentage|calculate/i,
      users: "people who need a quick, trustworthy calculation",
      problem: "getting a correct result with clearly stated assumptions",
      features: [["Input form with validation", "must"], ["Clear result with the formula shown", "must"], ["Reset and sample values", "should"], ["Copy result", "should"], ["Shareable link with the inputs", "later"], ["History of calculations", "later"]],
      ux: ["show results as the user types, with the formula underneath", "validate inputs inline with plain-language messages", "use large numeric inputs that open the right keyboard on phones"],
      risks: ["rounding and floating-point errors can produce wrong results that look confident", "unstated assumptions make a correct formula misleading", "financial results can be mistaken for advice"],
      fixes: ["use well-tested rounding rules and unit tests with known values", "print the assumptions next to the result", "add a short 'estimate only, not advice' note"],
      dispute: { feature: "History of calculations", objection: "it adds storage and privacy concerns to a tool whose value is instant answers.", defence: "people re-run the same figures and appreciate seeing earlier results.", resolution: "no history in version one; add a Copy result button instead, which covers the need with no storage.", added: "Assumptions and disclaimer text" },
      tests: ["a worked example from a textbook returns the exact published answer", "invalid or empty input shows a message instead of NaN"],
      files: ["index.html — inputs and result", "style.css", "app.js — calculation functions and validation", "README.md — formulas and sources"],
      preview: null
    },
    generic: {
      re: /.^/,
      users: "people who want a simple, free, no-account tool for this purpose",
      problem: "doing this one job quickly, with data that stays on the user's device",
      features: [["Create, edit and delete {lname} entries", "must"], ["Search and filter entries", "must"], ["Entries saved in the browser", "must"], ["Categories or tags", "should"], ["Export and import backup", "should"], ["Accounts and cloud sync", "later"], ["Sharing with other people", "later"]],
      ux: ["keep the main action visible and one tap away on phones", "give every empty state a short explanation of what to do next", "use clear labels and visible focus so the app works by keyboard"],
      risks: ["scope creep: an unclear idea tends to grow features before the basics work", "browser-only storage means data disappears if site data is cleared", "accounts and sync need a backend, which breaks the free-hosting goal"],
      fixes: ["lock a small must-have list and test it before adding anything", "add export/import and say where the data is stored", "keep accounts and sync out of the first release"],
      dispute: { feature: "Accounts and cloud sync", objection: "it needs a server and ongoing cost, which contradicts the zero-budget goal.", defence: "users expect their data on every device, so a tool without sync feels unfinished.", resolution: "no accounts in version one; export and import give users manual portability at no cost.", added: "Export and import backup" },
      tests: ["an entry created, reloaded and deleted behaves correctly", "the app is usable at 375px width with the keyboard only"],
      files: ["index.html — main screen", "style.css — responsive styles", "app.js — data model, storage, rendering", "README.md"],
      preview: "records", fields: [["Title", "text"], ["Details", "textarea"]]
    }
  };

  function deriveName(idea) {
    let s = idea.split(/\b(?:with|including|that|which|where|for)\b|[,.;:]/i)[0];
    s = s.replace(/^\s*(please\s+)?(create|build|make|design|develop|write|code|i want|i need|generate)\b\s*/i, "")
         .replace(/^(an?|the|my|some)\s+/i, "").replace(/^(online|simple|free|basic|web|web-based)\s+/gi, "")
         .replace(/[^\p{L}\p{N} &-]/gu, "").trim();
    const words = s.split(/\s+/).filter(Boolean).slice(0, 5);
    return words.length ? titleCase(words.join(" ").toLowerCase()) : "Your App";
  }
  function parseExtras(idea) {
    const m = idea.match(/\b(?:with|including|that has|that have)\s+(.+)$/i);
    if (!m) return [];
    return m[1].split(/,|\band\b/i).map(x => x.trim().replace(/^(an?|the)\s+/i, "")).filter(x => x.length > 2 && x.length < 60)
      .slice(0, 5).map(x => x[0].toUpperCase() + x.slice(1));
  }
  function fill(obj, name) {
    const lname = name.toLowerCase();
    return JSON.parse(JSON.stringify(obj).replace(/\{lname\}/g, () => lname.replace(/["\\]/g, "")).replace(/\{name\}/g, () => name.replace(/["\\]/g, "")));
  }

  // ---- starter-app generators (real, working code; deliberately basic) ----
  const BASE_CSS = "body{font-family:system-ui,sans-serif;margin:0;background:#f5f7fa;color:#1a2433}main{max-width:760px;margin:auto;padding:20px}h1{font-size:24px}label{display:block;font-weight:600;margin:10px 0 4px;font-size:14px}input,textarea{width:100%;padding:10px;border:1px solid #8a97a8;border-radius:8px;font:inherit}button{padding:10px 16px;border:0;border-radius:8px;background:#0f766e;color:#fff;font:inherit;font-weight:700;cursor:pointer;min-height:44px}button.q{background:#e5e9ef;color:#1a2433}:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}.card{background:#fff;border:1px solid #d5dbe4;border-radius:12px;padding:16px;margin:14px 0}.row{display:flex;gap:10px;flex-wrap:wrap}.row>*{flex:1 1 140px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #e1e6ee;text-align:left}.num{text-align:right}";

  function invoiceCode(name) {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)}</title>
<style>${BASE_CSS}@media print{.noprint{display:none}body{background:#fff}.card{border:0;padding:0}}</style></head>
<body><main>
<h1>${esc(name)}</h1>
<div class="card noprint">
 <div class="row"><div><label for="from">Your business</label><input id="from" value="Your Business"></div><div><label for="to">Client</label><input id="to" value="Client Name"></div></div>
 <div class="row"><div><label for="no">Invoice no.</label><input id="no" value="INV-001"></div><div><label for="date">Date</label><input id="date" type="date"></div></div>
 <h2>Items</h2><div id="items"></div><p><button class="q" id="add" type="button">Add item</button></p>
 <div class="row"><div><label for="tax">Tax %</label><input id="tax" type="number" min="0" step="0.01" value="0"></div><div><label for="disc">Discount %</label><input id="disc" type="number" min="0" max="100" step="0.01" value="0"></div></div>
</div>
<div class="card" id="out"></div>
<p class="noprint"><button id="print" type="button">Print or save as PDF</button></p>
</main>
<script>
const $=id=>document.getElementById(id);
let items=[{d:"Consulting",q:1,r:100}];
const cents=x=>Math.round((Number(x)||0)*100);
const money=c=>(c/100).toFixed(2);
$("date").valueAsDate=new Date();
function drawForm(){const box=$("items");box.textContent="";items.forEach((it,i)=>{const row=document.createElement("div");row.className="row";
 [["d","Description","text"],["q","Qty","number"],["r","Rate","number"]].forEach(([k,l,t])=>{const w=document.createElement("div");const lab=document.createElement("label");lab.textContent=l+" "+(i+1);const inp=document.createElement("input");inp.type=t;inp.value=it[k];inp.setAttribute("aria-label",l+" "+(i+1));inp.oninput=()=>{it[k]=inp.value;draw()};w.append(lab,inp);row.append(w)});
 const rm=document.createElement("button");rm.type="button";rm.className="q";rm.textContent="Remove";rm.onclick=()=>{items.splice(i,1);drawForm();draw()};row.append(rm);box.append(row)})}
function draw(){const out=$("out");out.textContent="";
 const h=document.createElement("h2");h.textContent="Invoice "+$("no").value;const p=document.createElement("p");p.textContent="From: "+$("from").value+" | To: "+$("to").value+" | Date: "+$("date").value;out.append(h,p);
 const t=document.createElement("table");let sub=0;
 items.forEach(it=>{const line=Math.round((Number(it.q)||0)*cents(it.r));sub+=line;const tr=t.insertRow();[it.d,it.q+" x "+money(cents(it.r)),money(line)].forEach((v,i)=>{const td=tr.insertCell();td.textContent=v;if(i)td.className="num"})});
 const disc=Math.round(sub*(Number($("disc").value)||0)/100),tax=Math.round((sub-disc)*(Number($("tax").value)||0)/100);
 [["Subtotal",sub],["Discount",-disc],["Tax",tax],["Total",sub-disc+tax]].forEach(([l,v])=>{const tr=t.insertRow();tr.insertCell().textContent=l;tr.insertCell();const td=tr.insertCell();td.className="num";td.textContent=money(v);if(l==="Total"){tr.style.fontWeight="700"}});
 out.append(t)}
$("add").onclick=()=>{items.push({d:"",q:1,r:0});drawForm();draw()};
["from","to","no","date","tax","disc"].forEach(id=>$(id).oninput=draw);
$("print").onclick=()=>window.print();
drawForm();draw();
</script></body></html>`;
  }

  function recordsCode(name, fields, sumField) {
    const cfg = JSON.stringify({ fields, sum: sumField || null }).replace(/</g, "\\u003c");
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)}</title><style>${BASE_CSS}</style></head>
<body><main>
<h1>${esc(name)}</h1>
<p>Starter version: add, view and delete entries. Entries live in this page's memory and are saved in the browser when the page is opened on its own.</p>
<form class="card" id="f"></form>
<div class="card"><h2>Entries</h2><div id="list"></div><p id="total"></p></div>
</main>
<script>
const cfg=${cfg};const $=id=>document.getElementById(id);const KEY="starter-"+document.title;
let rows=[];try{rows=JSON.parse(localStorage.getItem(KEY)||"[]")}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(rows))}catch(e){}};
const form=$("f");
cfg.fields.forEach(([l,t],i)=>{const lab=document.createElement("label");lab.htmlFor="i"+i;lab.textContent=l;const inp=document.createElement(t==="textarea"?"textarea":"input");if(t!=="textarea")inp.type=t;if(t==="number")inp.step="0.01";inp.id="i"+i;form.append(lab,inp)});
const b=document.createElement("button");b.textContent="Add";form.append(document.createElement("br"),b);
form.onsubmit=e=>{e.preventDefault();const r=cfg.fields.map((_,i)=>$("i"+i).value.trim());if(!r[0]){$("i0").focus();return}rows.push(r);cfg.fields.forEach((_,i)=>$("i"+i).value="");save();draw()};
function draw(){const L=$("list");L.textContent="";if(!rows.length){L.textContent="Nothing here yet.";}
 rows.forEach((r,idx)=>{const d=document.createElement("div");d.className="row card";const s=document.createElement("span");s.textContent=r.filter(Boolean).join(" · ");const x=document.createElement("button");x.className="q";x.textContent="Delete";x.setAttribute("aria-label","Delete entry "+(idx+1));x.onclick=()=>{rows.splice(idx,1);save();draw()};d.append(s,x);L.append(d)});
 const T=$("total");T.textContent="";if(cfg.sum){const k=cfg.fields.findIndex(f=>f[0]===cfg.sum);const c=rows.reduce((a,r)=>a+Math.round((Number(r[k])||0)*100),0);T.textContent="Total "+cfg.sum.toLowerCase()+": "+(c/100).toFixed(2)}}
draw();
</script></body></html>`;
  }

  // ---- main entry ----
  function buildPlan(rawIdea) {
    const idea = String(rawIdea || "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!idea) return null;
    const kind = Object.keys(KINDS).find(k => k !== "generic" && KINDS[k].re.test(idea)) || "generic";
    const name = deriveName(idea);
    const K = fill(KINDS[kind], name);
    const extras = parseExtras(idea);
    const features = K.features.map(([n, t]) => ({ name: n, tier: t }));
    extras.forEach(e => { if (!features.some(f => f.name.toLowerCase() === e.toLowerCase())) features.push({ name: e, tier: "must", requested: true }); });
    const d = K.dispute;
    if (!features.some(f => f.name === d.added)) features.push({ name: d.added, tier: "should", added: true });
    const tier = t => features.filter(f => f.tier === t).map(f => f.name);
    const must = tier("must"), should = tier("should"), later = tier("later");
    const disputed = features.find(f => f.name === d.feature);

    const m = (ai, phase, text) => ({ ai, role: ROLES[ai], phase, text });
    const script = [
      m("chatgpt", "Proposal", `I've analysed the idea "${idea}". The target users are ${K.users}, and the core problem is ${K.problem}. I propose "${name}" with these features.\n\nMust have: ${list(must)}.\nShould have: ${list(should)}.\nLater: ${later.length ? list(later) : "nothing yet"}.${extras.length ? `\n\nYou asked for ${list(extras)}, so I have made those must-haves.` : ""}\n\nClaude, can you plan the build?`),
      m("claude", "Implementation plan", `Reviewing ChatGPT's proposal. To keep "${name}" free to host, I'd build it as a static site: plain HTML, CSS and vanilla JavaScript, with data in the browser's localStorage, deployable to GitHub Pages.\n\nFiles:\n- ${K.files.join("\n- ")}\n\nThe first release covers the ${must.length} must-have features only. I'd defer: ${list(later.concat(should.slice(0, 1))) || "nothing"}. Gemini, does the design hold up?`),
      m("gemini", "Design review", `The structure is sound. Three improvements I'd make:\n1. ${K.ux[0][0].toUpperCase() + K.ux[0].slice(1)}.\n2. ${K.ux[1][0].toUpperCase() + K.ux[1].slice(1)}.\n3. ${K.ux[2][0].toUpperCase() + K.ux[2].slice(1)}.\n\nGrok, what could go wrong?`),
      m("grok", "Risk review", `Problems I can see:\n1. ${K.risks[0][0].toUpperCase() + K.risks[0].slice(1)}.\n2. ${K.risks[1][0].toUpperCase() + K.risks[1].slice(1)}.\n3. ${K.risks[2][0].toUpperCase() + K.risks[2].slice(1)}.\n\nI also object to "${d.feature}" as currently proposed: ${d.objection}`),
      m("chatgpt", "Response", `Gemini's three suggestions improve the product, so I'm adding them to the requirements. Grok, I partly disagree about "${d.feature}": ${d.defence} I do accept your first risk and want it handled in the plan.`),
      m("claude", "Decision", `Resolving the disagreement: ${d.resolution}\n\nFor Grok's risks I'll build in these fixes:\n1. ${K.fixes[0][0].toUpperCase() + K.fixes[0].slice(1)}.\n2. ${K.fixes[1][0].toUpperCase() + K.fixes[1].slice(1)}.\n3. ${K.fixes[2][0].toUpperCase() + K.fixes[2].slice(1)}.`),
      m("gemini", "Refinement", `That resolves my concern. One addition to the definition of done: accessibility. Every field labelled, every control usable by keyboard, a visible focus outline, readable contrast, and a layout that works at 375px wide.`),
      m("grok", "Acceptance", `I accept the compromise on one condition: acceptance tests. At minimum: (a) ${K.tests[0]}; (b) ${K.tests[1]}. If those pass, I have no blocking objection left.`),
      m("chatgpt", "Agreed requirements", `Summary of what we agreed. "${name}" ships with ${must.length} must-have and ${should.length} should-have features, accessibility as part of done, Grok's two acceptance tests, and ${later.length || "no"} items explicitly deferred. Claude, please finalise.`),
      m("claude", "Final specification", `Final decision recorded. I'm producing the specification, app structure, development steps and a ${K.preview ? "starter build" : "build outline"} in the result panel below.`)
    ];

    const decisions = [
      { topic: "Technology", by: "Claude (Lead Developer)", text: "Static site: HTML, CSS and vanilla JavaScript, browser localStorage, free GitHub Pages hosting." },
      { topic: "Design improvements", by: "Gemini (UX Reviewer), accepted by ChatGPT", text: list(K.ux.map(x => x[0].toUpperCase() + x.slice(1))) + "." },
      { topic: `Disputed feature: ${d.feature}`, by: "Grok objected, ChatGPT defended, Claude decided", text: d.resolution },
      { topic: "Risk mitigations", by: "Grok raised, Claude accepted", text: list(K.fixes.map(x => x[0].toUpperCase() + x.slice(1))) + "." },
      { topic: "Acceptance tests", by: "Grok (Risk Reviewer)", text: K.tests.join("; ") + "." },
      { topic: "Deferred", by: "Claude and ChatGPT", text: later.length ? list(later) + "." : "Nothing deferred." }
    ];
    const fileNames = K.files.map(f => f.split(" — ")[0]);
    const structure = `${name.toLowerCase().replace(/\s+/g, "-")}/\n` + K.files.map(f => "  " + f.replace(" — ", "   # ")).join("\n");
    const steps = [
      "Create the repository and add " + fileNames.join(", ") + ".",
      "Write the data model and storage helpers (with try/catch around localStorage).",
      "Build the main screen from the must-have features: " + list(must) + ".",
      "Implement the core logic and the mitigations: " + K.fixes[0] + "; " + K.fixes[1] + ".",
      "Add the should-have features that fit the schedule: " + (should.length ? list(should) : "none") + ".",
      "Accessibility and responsive pass: labels, keyboard use, focus, contrast, 375px layout.",
      "Run the acceptance tests: " + K.tests.join("; ") + ".",
      "Enable GitHub Pages (Settings → Pages → deploy from branch) and share the link."
    ];
    let code = null, codeNote;
    if (K.preview === "invoice") { code = invoiceCode(name); codeNote = "A working starter invoice generator: editable line items, tax, discount, cent-accurate totals and print. Saved history, numbering and export from the spec are not included."; }
    else if (K.preview === "records") { code = recordsCode(name, K.fields, K.sum); codeNote = "A basic working starter (add, list and delete entries). It demonstrates the data fields only; the full feature list above is not built."; }
    else codeNote = "No preview is available for this type of app; follow the plan above.";

    return { idea, kind, name, script, final: { name, kind, features, decisions, structure, steps, code, codeNote } };
  }

  const api = { buildPlan, ROLES };
  if (typeof module !== "undefined") module.exports = api; else root.RenovaSimulation = api;
})(typeof window !== "undefined" ? window : globalThis);

// Engine tests. Run with: node test-simulation.js
const assert = require("assert");
const vm = require("vm");
const Sim = require("./simulation.js");
const Starter = require("./starter.js");

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log("ok -", name); };
const FOCUSES = Object.keys(Sim.FOCUSES);
const ORDER = p => p.script.map(m => m.ai).join(",");
const scriptSyntaxOk = html => {
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  assert(m, "generated page has a script");
  new vm.Script(m[1]);   // throws on a syntax error
};

// ---------------- input quality ----------------
ok("vague, empty and too-short ideas are rejected with a clarification", () => {
  for (const bad of ["", "   ", "app", "website", "create an app", "a tool", "build me something"]) {
    const r = Sim.assessIdea(bad);
    assert.equal(r.ok, false, `"${bad}" should be rejected`);
    assert(r.message.length > 20, "message asks for more detail");
    assert.equal(Sim.buildPlan(bad), null, "no plan is generated for vague input");
  }
  assert(/for example/i.test(Sim.assessIdea("app").message));
});
ok("clear ideas are accepted", () => {
  for (const good of ["invoice", "todo app", "Create an online invoice generator", "pet adoption directory", "recipe sharing site"]) assert.equal(Sim.assessIdea(good).ok, true, good);
});

// ---------------- roles ----------------
ok("role definitions are exactly as specified", () => {
  assert.equal(Sim.ROLES.chatgpt.title, "Architect & Reviewer");
  assert.equal(Sim.ROLES.claude.title, "Lead Developer");
  assert.equal(Sim.ROLES.gemini.title, "Design & Innovation Reviewer");
  assert.equal(Sim.ROLES.grok.title, "Critical Reviewer");
});
ok("every message carries its speaker's role, and all four roles contribute, for every focus and app type", () => {
  for (const idea of ["Create an online invoice generator", "Build an expense tracker", "loan EMI calculator", "pet adoption directory", "todo list", "flashcard study app", "appointment booking site", "private journal app"]) {
    for (const focus of FOCUSES) {
      const p = Sim.buildPlan(idea, { focus });
      assert(p, idea);
      p.script.forEach(m => assert.equal(m.role, Sim.ROLES[m.ai].title, `${idea}/${focus}`));
      assert.equal(new Set(p.script.map(m => m.ai)).size, 4, `${idea}/${focus}: all four roles speak`);
      assert.equal(p.script[0].ai, "chatgpt", "the architect opens");
      assert.equal(p.script[p.script.length - 1].ai, "claude", "the lead developer closes");
      assert(p.script[p.script.length - 1].final, "closing message is flagged final");
    }
  }
});
ok("Claude produces the implementation plan and ChatGPT reviews technically", () => {
  const p = Sim.buildPlan("Create an online invoice generator", { focus: "general" });
  assert(p.script.find(m => m.ai === "claude" && m.phase === "Implementation plan"));
  assert(p.script.some(m => m.ai === "chatgpt" && /Technical|Architecture/.test(m.phase)));
});

// ---------------- dynamic paths ----------------
ok("each focus gives a different discussion path and order", () => {
  const orders = new Set(FOCUSES.map(f => ORDER(Sim.buildPlan("Create an online invoice generator", { focus: f }))));
  assert(orders.size >= 4, "at least four distinct speaker orders, got " + orders.size);
  const phases = new Set(FOCUSES.map(f => Sim.buildPlan("Create an online invoice generator", { focus: f }).script.map(m => m.phase).join(">")));
  assert.equal(phases.size, 5, "five distinct phase sequences");
});
ok("focus changes the substance of the discussion", () => {
  const text = f => Sim.buildPlan("Create an online invoice generator", { focus: f }).script.map(m => m.text).join("\n");
  assert(/textContent/.test(text("security")) && /Content-Security-Policy/.test(text("security")));
  assert(/budget/i.test(text("performance")) && /50 entries|pages of 50/.test(text("performance")));
  assert(/journey|primary action/i.test(text("ux")));
  assert(/cut line/i.test(text("features")) && /scope creep/i.test(text("features")));
});
ok("different ideas in the same focus produce different, relevant discussions", () => {
  const a = Sim.buildPlan("Create an online invoice generator", { focus: "general" });
  const b = Sim.buildPlan("Build an expense tracker", { focus: "general" });
  const c = Sim.buildPlan("pet adoption directory", { focus: "general" });
  const all = p => p.script.map(m => m.text).join("\n");
  assert(/invoice/i.test(all(a)) && !/expense/i.test(all(a)));
  assert(/expense/i.test(all(b)) && !/invoice/i.test(all(b)));
  assert(/pet adoption directory/i.test(all(c)));
  assert.notEqual(all(a), all(b));
});
ok("general discussions vary in order and in which disagreement is argued, across ideas", () => {
  const ideas = ["Create an online invoice generator", "Build an expense tracker", "todo list manager", "private journal app", "quiz maker", "booking site", "loan calculator", "pet adoption directory", "photo gallery", "recipe organiser"];
  const plans = ideas.map(i => Sim.buildPlan(i, { focus: "general" }));
  assert(new Set(plans.map(ORDER)).size >= 2, "more than one speaker order");
  assert(new Set(plans.map(p => p.script.find(m => m.decision && /Disputed/.test(m.decision.topic)).decision.topic)).size >= 2, "feature disputes and weakness disputes both occur");
});
ok("disagreements end in a reasoned, recorded resolution", () => {
  for (const f of FOCUSES) {
    const p = Sim.buildPlan("Create an online invoice generator", { focus: f });
    const fin = Sim.getFinal(p);
    assert(fin.decisions.length >= 3, f + ": decisions recorded");
    assert(fin.decisions.every(d => d.topic && d.by && d.text.length > 15));
  }
  const g = Sim.getFinal(Sim.buildPlan("Create an online invoice generator", { focus: "general" }));
  assert(g.decisions.some(d => /Disputed/.test(d.topic) && /Grok/.test(d.by) && /Claude|ChatGPT/.test(d.by)));
});
ok("planning is deterministic for the same input", () => {
  const o = { focus: "ux", extras: "Dark mode" };
  assert.deepStrictEqual(Sim.buildPlan("todo list", o), Sim.buildPlan("todo list", o));
});

// ---------------- additional requirements ----------------
ok("additional requirements are discussed and preserved through the final plan", () => {
  const p = Sim.buildPlan("Create an online invoice generator", { focus: "general", extras: "Dark mode\nExport to PDF\nClient logos" });
  const all = p.script.map(m => m.text).join("\n");
  ["Dark mode", "Export to PDF", "Client logos"].forEach(x => assert(all.includes(x), x + " discussed"));
  const f = Sim.getFinal(p);
  assert.equal(f.additionalRequirements.length, 3);
  ["Dark mode", "Export to PDF", "Client logos"].forEach(x => assert(f.requirements.some(r => r.name === x && r.requested), x + " in requirements"));
  assert(Sim.toMarkdown(f).includes("Client logos") && Sim.toJSON(f).includes("Client logos"));
});
ok("requirements are classified sensibly (build / adapt / defer)", () => {
  assert.equal(Sim.classifyRequirement("User login with passwords").mode, "defer");
  assert.equal(Sim.classifyRequirement("Accept card payments").mode, "defer");
  assert.equal(Sim.classifyRequirement("Send email reminders").mode, "adapt");
  assert.equal(Sim.classifyRequirement("Dark mode").mode, "build");
  assert.equal(Sim.classifyRequirement("Add a search box").mode, "build");
  assert.equal(Sim.classifyRequirement("Show spending charts").mode, "adapt");
  assert.equal(Sim.classifyRequirement("Something unusual").mode, "build");
});
ok("deferred requirements are never claimed as working", () => {
  const f = Sim.getFinal(Sim.buildPlan("Create an online invoice generator", { extras: "User login\nAccept card payments" }));
  ["User login", "Accept card payments"].forEach(x => { const r = f.requirements.find(q => q.name === x); assert.equal(r.tier, "later"); assert.equal(r.status, "deferred"); });
  assert(!f.starter.implemented.includes("User login"));
});
ok("inline 'with ...' requirements are picked up, extras are de-duplicated and capped", () => {
  const p = Sim.buildPlan("Create a todo app with dark mode, search and reminders", { extras: "dark mode\nDark Mode\nRecurring tasks" });
  assert.deepStrictEqual(p.extras.slice(0, 3), ["Dark mode", "Search", "Reminders"]);
  assert.equal(p.extras.filter(x => /^dark mode$/i.test(x)).length, 1);
  const many = Array.from({ length: 20 }, (_, i) => "Requirement number " + i).join("\n");
  assert.equal(Sim.buildPlan("todo list", { extras: many }).extras.length, Sim.MAX_EXTRAS);
  assert.deepStrictEqual(Sim.normalizeExtras("a\nok one\n  \nx".split("\n")), ["Ok one"]);
});

// ---------------- continue discussion ----------------
ok("continuing mid-discussion keeps played messages and drops unplayed ones", () => {
  const p = Sim.buildPlan("Create an online invoice generator", { focus: "general" });
  const r = Sim.extendPlan(p, 3, "Add a search box");
  assert(!r.error);
  const q = r.plan;
  assert.deepStrictEqual(q.script.slice(0, 3), p.script.slice(0, 3));
  assert(/still in progress/.test(q.script[3].text), "interruption is acknowledged");
  assert(q.script.slice(3).some(m => m.text.includes("Add a search box")));
  const dropped = p.script.slice(3).filter(m => !q.script.some(n => n.text === m.text));
  assert(dropped.length > 0, "some unplayed messages were dropped");
  assert(q.script[q.script.length - 1].final);
  assert.deepStrictEqual(q.extras, ["Add a search box"]);
  assert.equal(q.continuations, 1);
});
ok("continuing keeps the final plan consistent with what was actually discussed", () => {
  const p = Sim.buildPlan("Create an online invoice generator", { focus: "general" });
  const q = Sim.extendPlan(p, 3, "Add a search box").plan;
  const f = Sim.getFinal(q);
  assert(f.complete);
  assert(f.requirements.some(r => r.name === "Add a search box"));
  const topics = f.decisions.map(d => d.topic).join("|");
  assert(/Add a search box/.test(topics));
  const partial = Sim.getFinal(p, 3);
  assert.equal(partial.complete, false, "an unfinished discussion is not a complete plan");
});
ok("continuing after the discussion finished appends a new round", () => {
  const p = Sim.buildPlan("todo list", { focus: "security" });
  const q = Sim.extendPlan(p, p.script.length, "Dark mode").plan;
  assert.deepStrictEqual(q.script.slice(0, p.script.length), p.script);
  assert(q.script.length > p.script.length);
  assert(/Reopening/.test(q.script[p.script.length].text));
  assert(Sim.getFinal(q).requirements.some(r => r.name === "Dark mode" && r.status === "implemented"));
  const q2 = Sim.extendPlan(q, q.script.length, "User accounts").plan;
  assert.equal(q2.continuations, 2);
  assert(Sim.getFinal(q2).requirements.some(r => r.name === "User accounts" && r.tier === "later"));
});
ok("continuing before anything was played rebuilds the plan with the new requirement", () => {
  const p = Sim.buildPlan("todo list", { focus: "ux", extras: "Dark mode" });
  const q = Sim.extendPlan(p, 0, "Search").plan;
  assert.deepStrictEqual(q.extras, ["Dark mode", "Search"]);
  assert(q.script.some(m => m.text.includes('"Search"')));
});
ok("continue rejects empty, duplicate and excessive requirements", () => {
  const p = Sim.buildPlan("todo list", { extras: "Dark mode" });
  assert(Sim.extendPlan(p, 2, "  ").error);
  assert(Sim.extendPlan(p, 2, "ab").error);
  assert(Sim.extendPlan(p, 2, "dark MODE").error);
  const full = Sim.buildPlan("todo list", { extras: Array.from({ length: 8 }, (_, i) => "Requirement " + i).join("\n") });
  assert(Sim.extendPlan(full, 2, "One more thing").error);
});

// ---------------- final plan & exports ----------------
ok("final plan has the required structure", () => {
  const f = Sim.getFinal(Sim.buildPlan("Create an online invoice generator", { focus: "general", extras: "Dark mode" }));
  for (const k of ["name", "idea", "focus", "focusLabel", "complete", "roles", "requirements", "additionalRequirements", "decisions", "architecture", "structure", "steps", "limitations", "starter", "simulation"]) assert(k in f, "has " + k);
  assert.equal(f.complete, true);
  assert.equal(f.roles.length, 4);
  f.roles.forEach(r => assert(r.messages > 0 && r.title && r.summary));
  f.requirements.forEach(r => { assert(["must", "should", "later"].includes(r.tier)); assert(["implemented", "not-implemented", "deferred", "no-starter"].includes(r.status)); });
  assert(f.architecture.components.length >= 4 && f.architecture.summary);
  assert(f.steps.length >= 7 && f.limitations.length >= 4);
  assert(f.structure.includes("index.html"));
  assert(/SIMULATION/.test(f.simulation.label) && /NO REAL AI SERVICES ARE CONNECTED/.test(f.simulation.label));
  assert(f.limitations.some(l => /No real AI service/.test(l)));
});
ok("Markdown export contains every required section", () => {
  const f = Sim.getFinal(Sim.buildPlan("Create an online invoice generator", { focus: "security", extras: "Dark mode" }));
  const md = Sim.toMarkdown(f, { generatedAt: "2026-01-01T00:00:00Z" });
  ["# Final plan: Invoice Generator", "NO REAL AI SERVICES ARE CONNECTED", "**App idea:**", "Create an online invoice generator", "Discussion focus:** Security", "2026-01-01", "## Participating simulated roles", "ChatGPT (simulated)", "Architect & Reviewer", "Grok (simulated)", "## Requirements", "### Must have", "Dark mode", "## Additional requirements from you", "## Key decisions", "## Proposed architecture", "## Application structure", "## Implementation steps", "1. ", "## Starter app", "Not implemented or deferred", "## Known limitations"].forEach(s => assert(md.includes(s), "markdown includes: " + s));
});
ok("JSON export is valid and complete", () => {
  const f = Sim.getFinal(Sim.buildPlan("Create an online invoice generator", { focus: "performance", extras: "Dark mode\nClient logos" }));
  const j = JSON.parse(Sim.toJSON(f, { generatedAt: "2026-01-01T00:00:00Z" }));
  assert.equal(j.schema, "renova-ai-bridge/final-plan");
  assert.equal(j.simulation, true);
  assert(/NO REAL AI SERVICES ARE CONNECTED/.test(j.disclaimer));
  assert.equal(j.appIdea, "Create an online invoice generator");
  assert.equal(j.focus, "performance");
  assert.equal(j.roles.length, 4);
  assert(j.requirements.length > 5 && j.decisions.length > 2 && j.implementationSteps.length > 5 && j.limitations.length > 3);
  assert.equal(j.additionalRequirements.length, 2);
  assert(j.architecture.components.length > 3);
  assert.equal(j.starter.available, true);
  assert(j.starter.code.startsWith("<!doctype html>"));
  assert(j.starter.notImplemented.includes("Client logos"));
});
ok("exports escape user text instead of injecting Markdown or HTML", () => {
  const f = Sim.getFinal(Sim.buildPlan("Build a **bold** tracker [x](http://evil) <b>hi</b>", { extras: "<script>alert(1)</script>\n# heading | pipe" }));
  const md = Sim.toMarkdown(f);
  assert(!/(^|[^\\])<script>/.test(md), "raw <script> not present in markdown");
  assert(!md.split("\n").some(l => /^# heading/.test(l)), "user text cannot create a heading");
  assert(/\\<script\\>/.test(md));
  JSON.parse(Sim.toJSON(f));   // still valid JSON
});

// ---------------- starter generator honesty & safety ----------------
ok("invoice starter implements saved history and JSON export/import, and says so", () => {
  const f = Sim.getFinal(Sim.buildPlan("Create an online invoice generator", { extras: "Recurring billing" }));
  assert(f.starter.available);
  const by = n => f.requirements.find(r => r.name === n);
  assert.equal(by("Saved invoice history in the browser").status, "implemented");
  assert.equal(by("JSON export and import backup").status, "implemented");
  assert.equal(by("Multiple currencies").status, "deferred");
  assert.equal(by("Recurring billing").status, "not-implemented");
  const code = f.starter.code;
  ["Saved invoices", "Export JSON", "Import JSON", "localStorage", "Math.round", "armClear", "Content-Security-Policy"].forEach(s => assert(code.includes(s), "invoice code has " + s));
  assert(/Not implemented in this starter[\s\S]*Recurring billing/.test(code), "limitation disclosed inside the generated app");
  scriptSyntaxOk(code);
});
ok("every record-style template generates syntactically valid code that matches its agreed features", () => {
  const cases = { "todo list": "Add, complete and delete tasks", "Build an expense tracker": "Running total of expenses", "private journal app": "Search across notes", "appointment booking site": "Record booking requests (add and delete)", "flashcard study app": "Create question-and-answer cards", "pet adoption directory": "Search entries" };
  for (const [idea, feature] of Object.entries(cases)) {
    const f = Sim.getFinal(Sim.buildPlan(idea, {}));
    assert(f.starter.available, idea);
    assert.equal(f.requirements.find(r => r.name === feature).status, "implemented", idea + ": " + feature);
    scriptSyntaxOk(f.starter.code);
  }
  assert(Sim.getFinal(Sim.buildPlan("todo list")).starter.code.includes('"complete":true'));
  assert(Sim.getFinal(Sim.buildPlan("Build an expense tracker")).starter.code.includes('"sum":"Amount"'));
});
ok("features the starter lacks are reported as not implemented, never as working", () => {
  const f = Sim.getFinal(Sim.buildPlan("Build an expense tracker"));
  assert.equal(f.requirements.find(r => r.name === "CSV export").status, "not-implemented");
  assert.equal(f.requirements.find(r => r.name === "Category breakdown").status, "not-implemented");
  assert(f.starter.notImplemented.includes("CSV export"));
  assert(/implements \d+ of \d+ requirements/.test(f.starter.note));
});
ok("apps with no starter are labelled honestly", () => {
  const f = Sim.getFinal(Sim.buildPlan("loan EMI calculator"));
  assert.equal(f.starter.available, false);
  assert.equal(f.starter.code, null);
  assert(f.requirements.every(r => r.status === "no-starter"));
  assert(/No starter app/.test(f.starter.note));
});
ok("requirement names cannot be mistaken for implemented capabilities", () => {
  assert.equal(Starter.statusFor({ name: "Client logos", tier: "should", requested: true }, "invoice", {}), "not-implemented");
  assert.equal(Starter.statusFor({ name: "Client logos", tier: "should" }, "invoice", {}), "implemented", "built-in 'client' feature maps to client details");
  assert.equal(Starter.statusFor({ name: "Dark mode", tier: "must", requested: true }, "records", {}), "implemented");
  assert.equal(Starter.statusFor({ name: "Dark mode", tier: "must", requested: true }, null, {}), "no-starter");
});
ok("user-provided text is escaped in generated code", () => {
  const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  const p = Sim.buildPlan("Create an invoice " + evil + " tool", { extras: evil });
  const code = Sim.getFinal(p).starter.code;
  assert(!code.includes("<script>alert(1)"), "no injected script");
  assert(!code.includes("<img src=x"), "no injected element");
  assert.equal((code.match(/<script>/g) || []).length, 1, "only the app's own script tag");
  assert(code.includes("&lt;script&gt;"));
  const rec = Sim.getFinal(Sim.buildPlan("Build a tracker </script><b>x", { extras: evil })).starter.code;
  assert.equal((rec.match(/<\/script>/g) || []).length, 1);
  scriptSyntaxOk(rec);
  assert.equal(Starter.esc(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
});
ok("generated apps use only the minimum: CSP blocks external resources", () => {
  const code = Sim.getFinal(Sim.buildPlan("Create an online invoice generator")).starter.code;
  assert(/default-src 'none'/.test(code));
  assert(!/https?:\/\//.test(code), "no external URLs");
  assert(!/<link|<img|<iframe|fetch\(|XMLHttpRequest/.test(code));
});

console.log(passed, "tests passed");

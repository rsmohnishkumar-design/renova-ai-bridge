// Run with: node test-simulation.js
const assert = require("assert");
const { buildPlan } = require("./simulation.js");
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("ok -", name); };

ok("empty idea gives no plan", () => assert.equal(buildPlan("   "), null));
ok("invoice idea", () => {
  const p = buildPlan("Create an online invoice generator");
  assert.equal(p.kind, "invoice"); assert.equal(p.name, "Invoice Generator");
  assert.deepEqual(p.script.map(m => m.ai), ["chatgpt","claude","gemini","grok","chatgpt","claude","gemini","grok","chatgpt","claude"]);
  assert(p.script[0].text.includes("Create an online invoice generator"));
  assert(p.final.code.includes("<!doctype html>") && /Math\.round/.test(p.final.code));
});
ok("different ideas give different content", () => {
  const a = buildPlan("Build an expense tracker"), b = buildPlan("Make a quiz app for history");
  assert.notEqual(a.kind, b.kind); assert.notEqual(a.script[3].text, b.script[3].text);
  assert(/expense/i.test(a.final.name)); assert(a.final.code.includes('"sum":"Amount"'));
});
ok("unknown idea falls back to generic with its own name", () => {
  const p = buildPlan("Pet adoption directory"); assert.equal(p.kind, "generic"); assert(p.final.features.some(f => /pet adoption directory entries/.test(f.name)));
});
ok("calculator has honest no-preview note", () => { const p = buildPlan("loan EMI calculator"); assert.equal(p.final.code, null); assert(/No preview/.test(p.final.codeNote)); });
ok("requested extras become must-haves", () => {
  const p = buildPlan("Create an invoice generator with dark mode, client logos and recurring billing");
  assert(p.final.features.some(f => f.name === "Dark mode" && f.tier === "must" && f.requested));
  assert(p.script[0].text.includes("Dark mode"));
});
ok("HTML in the idea is escaped in generated code", () => {
  const p = buildPlan('Create an invoice <script>alert(1)</script> tool'); assert(!/<title>[^<]*<script>/.test(p.final.code));
  assert(!p.final.code.includes("<script>alert(1)"));
});
ok("every message is attributed to a distinct role", () => {
  const p = buildPlan("todo list"); const roles = new Set(p.script.map(m => m.role)); assert.equal(roles.size, 4);
  p.script.forEach(m => assert(m.text.length > 20));
});
console.log(n, "tests passed");

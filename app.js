// Renova AI Bridge — Manual Relay + Simulation. No network access, no dependencies.
// State is stored only in this browser's localStorage.
const $ = id => document.getElementById(id);
const STORE = "renovaBridge.v3";
const SIM = RenovaSimulation;
const AIS = ["chatgpt", "claude", "gemini", "grok"].map((id, i) => ({
  id, name: SIM.ROLES[id].name, title: SIM.ROLES[id].title, summary: SIM.ROLES[id].summary, short: ["GPT", "CL", "GE", "GR"][i]
}));
const byId = id => AIS.find(a => a.id === id);
const SIM_LABEL = SIM.SIM_LABEL;

// ---------- state ----------
const blank = () => ({ mode: "manual", task: "", notes: "", prompts: {}, drafts: {}, messages: [], seq: 0 });
let state = blank();
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || "null");
  if (saved && typeof saved === "object" && Array.isArray(saved.messages)) state = { ...blank(), ...saved };
} catch { /* corrupt or blocked storage: start fresh */ }

let storageWarned = false;
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); }
  catch { if (!storageWarned) { storageWarned = true; toast("Browser storage is unavailable; changes won't be kept after you close this page."); } }
}

let toastTimer;
function toast(msg) {
  const el = $("toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
async function copy(text, okMsg, title) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { window.prompt(title, text); }
}
const stamp = ts => new Date(ts).toLocaleString();
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function button(label, cls, onClick) { const b = el("button", "button " + cls, label); b.type = "button"; b.addEventListener("click", onClick); return b; }

// ---------- prompt building ----------
function basePrompt(ai) {
  return `You are ${ai.name}, helping the Renova Office team as its ${ai.title}: ${ai.summary}\n\nTASK:\n${state.task.trim() || "(no task entered yet)"}\n\nPROJECT NOTES:\n${state.notes.trim() || "(none)"}\n\nPlease reply in plain text with your analysis and recommendations.`;
}
function relayPrompt(from, to, text) {
  return `You are ${to.name}, helping the Renova Office team as its ${to.title}: ${to.summary}\n\nTASK:\n${state.task.trim() || "(no task entered yet)"}\n\nPROJECT NOTES:\n${state.notes.trim() || "(none)"}\n\nBELOW IS A RESPONSE FROM ${from.name.toUpperCase()}, PASTED IN MANUALLY BY THE USER:\n"""\n${text}\n"""\n\nPlease review it and reply with your own findings.`;
}

// ---------- manual mode: build panels once ----------
const panelRefs = {};
function buildManualPanels() {
  const root = $("manualPanels"); root.textContent = "";
  for (const ai of AIS) {
    const sec = el("section", "panel ai"); sec.setAttribute("aria-labelledby", `h-${ai.id}`); sec.id = `pn-${ai.id}`; sec.dataset.ai = ai.id;
    const head = el("div", "ai-head");
    const h = el("h3", "", ai.name); h.id = `h-${ai.id}`;
    const titles = el("div"); titles.append(h, el("span", "role", ai.title));
    head.append(el("span", `avatar av-${ai.id}`, ai.short), titles);

    const pLabel = el("label", "", `Instructions for ${ai.name}`); pLabel.htmlFor = `p-${ai.id}`;
    const prompt = el("textarea"); prompt.id = `p-${ai.id}`; prompt.rows = 5;
    prompt.placeholder = `Write or generate the prompt you will paste into ${ai.name}'s own chat.`;
    prompt.value = state.prompts[ai.id] || "";
    prompt.addEventListener("input", () => { state.prompts[ai.id] = prompt.value; persist(); });
    const pRow = el("div", "row tight");
    pRow.append(
      button("Fill from task", "small", () => {
        if (prompt.value.trim() && !confirm(`Replace the current instructions for ${ai.name}?`)) return;
        prompt.value = basePrompt(ai); state.prompts[ai.id] = prompt.value; persist(); toast(`Prompt for ${ai.name} prepared`);
      }),
      button("Copy prompt", "small primary", () => {
        if (!prompt.value.trim()) { toast("Write or fill the instructions first"); return; }
        copy(prompt.value, `Prompt copied. Paste it into ${ai.name}'s own chat`, `Copy this prompt for ${ai.name}:`);
      })
    );

    const dLabel = el("label", "", `Paste ${ai.name}'s actual response`); dLabel.htmlFor = `d-${ai.id}`;
    const draft = el("textarea"); draft.id = `d-${ai.id}`; draft.rows = 5;
    draft.placeholder = `Paste what ${ai.name} really replied.`;
    draft.value = state.drafts[ai.id] || "";
    draft.addEventListener("input", () => { state.drafts[ai.id] = draft.value; persist(); });
    const dRow = el("div", "row tight");
    dRow.append(button("Save response", "small primary", () => {
      const text = draft.value.trim();
      if (!text) { toast("Paste a response first"); return; }
      state.messages.push({ id: ++state.seq, ai: ai.id, text, time: Date.now() });
      draft.value = ""; state.drafts[ai.id] = ""; persist(); renderManualMessages(); toast(`${ai.name} response saved`);
    }));

    const list = el("ul", "msgs"); list.setAttribute("aria-label", `Saved ${ai.name} responses`);
    sec.append(head, pLabel, prompt, pRow, dLabel, draft, dRow, el("h4", "", "Saved responses"), list);
    root.append(sec);
    panelRefs[ai.id] = { prompt, list };
  }
  makeTabs(root, "Manual relay AI panels", "pn-");
}

// On narrow screens the four AI panels become tabs (one visible at a time); CSS hides the tab bar on wider screens.
function makeTabs(container, label, idPrefix) {
  const bar = el("div", "tabs"); bar.setAttribute("role", "tablist"); bar.setAttribute("aria-label", label);
  const panels = [...container.children];
  const select = (id, focus) => {
    panels.forEach(p => p.classList.toggle("active", p.dataset.ai === id));
    [...bar.children].forEach(b => { const on = b.dataset.ai === id; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  };
  AIS.forEach((ai, i) => {
    const b = el("button", "tab", ai.name); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.ai = ai.id; b.setAttribute("aria-controls", idPrefix + ai.id);
    b.addEventListener("click", () => select(ai.id));
    b.addEventListener("keydown", e => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); select(AIS[(i + d + AIS.length) % AIS.length].id, true); }
    });
    bar.append(b);
  });
  container.before(bar); select(AIS[0].id);
}

function msgItem(m, withActions) {
  const ai = byId(m.ai);
  const li = el("li", "msg " + (m.sim ? "simulated" : "manual"));
  const head = el("div", "msg-head");
  head.append(el("b", "", m.sim ? `${ai.name} (simulated) · ${m.role}` : ai.name));
  if (m.phase) head.append(el("span", "phase", m.phase));
  if (m.decision) head.append(el("span", "phase decision", "Decision"));
  head.append(el("span", "tag " + (m.sim ? "simulated" : "manual"), m.sim ? "SIMULATED" : "ENTERED MANUALLY BY YOU"));
  const t = el("time", "", stamp(m.time)); head.append(t);
  li.append(head, el("p", "", m.text));
  if (withActions) {
    const row = el("div", "row tight");
    const others = AIS.filter(a => a.id !== m.ai);
    const sel = el("select"); sel.setAttribute("aria-label", `Send this ${ai.name} response to`);
    others.forEach(o => { const op = el("option", "", o.name); op.value = o.id; sel.append(op); });
    row.append(
      button("Copy", "small", () => copy(m.text, "Response copied", "Copy response:")),
      el("span", "sendlbl", "Send to"), sel,
      button("Prepare prompt", "small", () => {
        const to = byId(sel.value), ref = panelRefs[to.id];
        if (ref.prompt.value.trim() && !confirm(`Replace the current instructions for ${to.name} with this prepared prompt?`)) return;
        ref.prompt.value = relayPrompt(ai, to, m.text); state.prompts[to.id] = ref.prompt.value; persist();
        ref.prompt.focus(); ref.prompt.scrollIntoView({ block: "center" });
        toast(`Prompt for ${to.name} prepared. Review it, then press Copy prompt`);
      })
    );
    li.append(row);
  }
  return li;
}

function renderManualMessages() {
  for (const ai of AIS) {
    const list = panelRefs[ai.id].list; list.textContent = "";
    const mine = state.messages.filter(m => m.ai === ai.id);
    if (!mine.length) list.append(el("li", "empty", "No saved responses yet."));
    mine.forEach(m => list.append(msgItem(m, true)));
  }
  const feed = $("manualFeed"); feed.textContent = "";
  if (!state.messages.length) feed.append(el("li", "empty", "Responses you paste and save will appear here with a timestamp."));
  state.messages.forEach(m => feed.append(msgItem(m, false)));
}

// ---------- simulation ----------
const SPEED_MS = { slow: 3200, normal: 1800, fast: 700 };
const STATUS_LABEL = { implemented: "In starter", "not-implemented": "Not in starter", deferred: "Deferred", "no-starter": "No starter", "not-discussed": "Not discussed" };
const sim = { plan: null, idx: 0, times: [], playing: false, timer: null, speed: "normal", resultKey: "", final: null };

function buildSimPanels() {
  const root = $("simPanels"); root.textContent = "";
  for (const ai of AIS) {
    const sec = el("section", "panel ai simpanel"); sec.id = `sp-${ai.id}`; sec.dataset.ai = ai.id; sec.setAttribute("aria-labelledby", `sh-${ai.id}`);
    const head = el("div", "ai-head");
    const h = el("h3", "", `${ai.name} (simulated)`); h.id = `sh-${ai.id}`;
    const titles = el("div"); titles.append(h, el("span", "role", ai.title));
    head.append(el("span", `avatar av-${ai.id}`, ai.short), titles);
    sec.append(head, el("p", "role-summary", ai.summary), el("p", "tag simulated blocktag", "SIMULATED"), el("ul", "msgs", ""));
    sec.lastElementChild.id = `sl-${ai.id}`;
    root.append(sec);
  }
  makeTabs(root, "Simulated team members", "sp-");
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan"; }
function download(name, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = el("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderResult(done) {
  const box = $("result"), body = $("resultBody");
  box.hidden = !done;
  if (!done) { sim.resultKey = ""; sim.final = null; body.textContent = ""; return; }
  const key = sim.plan.script.length + "|" + sim.plan.extras.join("\u0001");
  if (key === sim.resultKey) return;               // already rendered: don't reload the preview frame
  sim.resultKey = key; body.textContent = "";
  const f = sim.final = SIM.getFinal(sim.plan, sim.idx);
  const sect = (title, node) => { const s = el("div", "rsect"); s.append(el("h3", "", title), node); body.append(s); };
  const ulOf = (items, build) => { const u = el("ul", "plain"); items.forEach(x => u.append(build(x))); return u; };
  body.append(el("p", "tag simulated blocktag", SIM_LABEL));
  body.append(el("p", "", `Proposed app: ${f.name}. Focus: ${f.focusLabel}. Produced by the local simulation from your idea; not by any real AI.`));
  sect("Participating simulated roles", ulOf(f.roles, r => { const li = el("li"); li.append(el("b", "", `${r.name} (simulated) — ${r.title}: `), document.createTextNode(`${r.summary} ${r.messages} messages.`)); return li; }));
  sect("Agreed requirements", ulOf(f.requirements, x => {
    const li = el("li"); li.append(el("span", "tier " + x.tier, x.tier === "must" ? "Must" : x.tier === "should" ? "Should" : "Later"), document.createTextNode(" " + x.name + (x.requested ? " (requested by you) " : " ")), el("span", "st " + x.status, STATUS_LABEL[x.status]));
    return li;
  }));
  if (f.additionalRequirements.length) sect("Your additional requirements", ulOf(f.additionalRequirements, a => {
    const li = el("li"); li.append(el("b", "", a.text + ": "), document.createTextNode(`${a.handling}. ${a.outcome}`)); return li;
  }));
  sect("Decisions and who made them", ulOf(f.decisions, d => { const li = el("li"); li.append(el("b", "", d.topic + ": "), document.createTextNode(d.text + " "), el("i", "", `— ${d.by}`)); return li; }));
  const arch = el("div"); arch.append(el("p", "", f.architecture.summary), ulOf(f.architecture.components, c => el("li", "", c)));
  sect("Proposed architecture", arch);
  sect("App structure", el("pre", "code", f.structure));
  const ol = el("ol", "plain"); f.steps.forEach(x => ol.append(el("li", "", x))); sect("Development steps", ol);
  const out = el("div"); out.append(el("p", "", f.starter.note));
  if (f.starter.available) {
    const frame = el("iframe", "preview"); frame.title = `Preview of ${f.name} (generated starter, sandboxed)`;
    frame.setAttribute("sandbox", "allow-scripts");   // minimum needed: scripts only, no forms, modals, downloads or same-origin access
    frame.srcdoc = f.starter.code;
    const row = el("div", "row tight");
    row.append(button("Copy code", "small", () => copy(f.starter.code, "Code copied", "Copy code:")), button("Download index.html", "small", () => download("index.html", "text/html", f.starter.code)));
    const det = el("details"); det.append(el("summary", "", "Show generated code"), el("pre", "code", f.starter.code));
    out.append(row, frame, det);
  }
  sect("Starter build / preview", out);
  sect("Known limitations", ulOf(f.limitations, x => el("li", "", x)));
}

function renderSim() {
  const plan = sim.plan, total = plan ? plan.script.length : 0;
  const shown = plan ? plan.script.slice(0, sim.idx).map((m, i) => ({ ...m, sim: true, time: sim.times[i] || Date.now() })) : [];
  for (const ai of AIS) {
    const list = $(`sl-${ai.id}`); list.textContent = "";
    const mine = shown.filter(m => m.ai === ai.id);
    if (!mine.length) list.append(el("li", "empty", "Waiting for the simulation."));
    mine.forEach(m => list.append(msgItem(m, false)));
    $(`sp-${ai.id}`).classList.toggle("speaking", sim.playing && shown.length > 0 && shown[shown.length - 1].ai === ai.id);
  }
  const feed = $("simFeed"); feed.textContent = "";
  if (!shown.length) feed.append(el("li", "empty", "Enter an app idea and press Start. The simulated team will discuss it here."));
  shown.forEach(m => feed.append(msgItem(m, false)));
  feed.scrollTop = feed.scrollHeight;
  const done = !!plan && sim.idx >= total, active = !!plan && !done;
  let status = "Ready";
  if (sim.playing) { const next = plan.script[sim.idx]; status = "Playing" + (next ? ` · ${byId(next.ai).name} (simulated) is replying` : ""); }
  else if (done) status = "Finished"; else if (active) status = "Paused";
  $("simProgress").textContent = `${status} · message ${sim.idx} of ${total} · ${sim.speed} speed`;
  $("simStart").disabled = active;
  $("simPause").disabled = !sim.playing;
  $("simResume").disabled = !(active && !sim.playing);
  $("simReset").disabled = !plan;
  $("contBtn").disabled = !plan; $("contReq").disabled = !plan;
  ["idea", "focus", "extras"].forEach(id => $(id).disabled = active);
  renderResult(done);
}
function schedule(ms) {
  clearTimeout(sim.timer);
  if (sim.playing) sim.timer = setTimeout(simStep, ms === undefined ? SPEED_MS[sim.speed] : ms);
}
function simStep() {
  if (!sim.playing || !sim.plan) return;
  sim.times[sim.idx] = Date.now(); sim.idx++;
  if (sim.idx >= sim.plan.script.length) sim.playing = false;
  renderSim(); schedule();
}
function simStart() {
  const idea = $("idea").value, check = SIM.assessIdea(idea);
  if (!check.ok) { $("simError").textContent = check.message; $("idea").focus(); return; }
  const lines = $("extras").value.split(/[\n;]+/).filter(x => x.trim().length >= 3).length;
  $("simError").textContent = lines > SIM.MAX_EXTRAS ? `Only the first ${SIM.MAX_EXTRAS} additional requirements are used.` : "";
  const plan = SIM.buildPlan(idea, { focus: $("focus").value, extras: $("extras").value });
  Object.assign(sim, { plan, idx: 0, times: [], playing: true, resultKey: "" });
  renderSim(); schedule(700);
}
function simPause() { if (!sim.playing) return; sim.playing = false; clearTimeout(sim.timer); renderSim(); }
function simResume() { if (!sim.plan || sim.playing || sim.idx >= sim.plan.script.length) return; sim.playing = true; renderSim(); schedule(500); }
function simReset() { clearTimeout(sim.timer); Object.assign(sim, { plan: null, idx: 0, times: [], playing: false, resultKey: "" }); $("simError").textContent = ""; renderSim(); }
// Add a requirement to the existing discussion. Played messages are kept; unplayed ones are replaced by a re-planning round.
function simContinue() {
  if (!sim.plan) { $("simError").textContent = "Start a discussion first."; return; }
  const r = SIM.extendPlan(sim.plan, sim.idx, $("contReq").value);
  if (r.error) { $("simError").textContent = r.error; $("contReq").focus(); return; }
  const finished = sim.idx >= sim.plan.script.length;
  clearTimeout(sim.timer);
  sim.plan = r.plan; sim.times.length = Math.min(sim.times.length, sim.idx);
  sim.playing = sim.playing || finished;        // a paused discussion stays paused; a finished one resumes
  sim.resultKey = ""; $("contReq").value = ""; $("simError").textContent = "";
  renderSim(); schedule(700);
}
function setSpeed(v) { sim.speed = v; renderSim(); if (sim.playing) schedule(); }

// ---------- mode ----------
function setMode(mode) {
  state.mode = mode; persist();
  const manual = mode === "manual";
  if (!manual) { /* keep sim state */ } else simPause();
  $("manualView").hidden = !manual; $("simView").hidden = manual;
  $("btnManual").setAttribute("aria-pressed", manual); $("btnSim").setAttribute("aria-pressed", !manual);
  const pill = $("modePill"), banner = $("banner");
  pill.textContent = manual ? "MODE: MANUAL RELAY" : "MODE: SIMULATION";
  pill.className = "modepill " + (manual ? "manual" : "sim");
  banner.className = "banner " + (manual ? "manual" : "sim");
  banner.textContent = manual
    ? "MANUAL RELAY — you copy prompts into each AI's own chat and paste its real reply back. This page never contacts any AI."
    : SIM_LABEL;
  document.title = (manual ? "Manual Relay" : "Simulation") + " · Renova AI Bridge";
}

// ---------- wiring ----------
$("task").value = state.task; $("notes").value = state.notes;
$("task").addEventListener("input", () => { state.task = $("task").value; persist(); });
$("notes").addEventListener("input", () => { state.notes = $("notes").value; persist(); });

$("clearConv").addEventListener("click", () => {
  if (!state.messages.length && !Object.values(state.drafts).some(Boolean)) { toast("There is no conversation to clear"); return; }
  if (!confirm("Delete all saved responses and unsaved pasted drafts? Your task, notes and instructions are kept.")) return;
  state.messages = []; state.drafts = {}; state.seq = 0; persist();
  AIS.forEach(a => { $(`d-${a.id}`).value = ""; });
  renderManualMessages(); toast("Conversation cleared");
});
$("resetWs").addEventListener("click", () => {
  if (!confirm("Reset the whole workspace? This deletes the task, notes, instructions and all saved responses from this browser.")) return;
  state = blank(); try { localStorage.removeItem(STORE); } catch { /* ignore */ }
  $("task").value = ""; $("notes").value = "";
  AIS.forEach(a => { panelRefs[a.id].prompt.value = ""; $(`d-${a.id}`).value = ""; });
  renderManualMessages(); setMode("manual"); toast("Workspace reset");
});
$("btnManual").addEventListener("click", () => setMode("manual"));
$("btnSim").addEventListener("click", () => setMode("sim"));
$("simStart").addEventListener("click", simStart);
$("simPause").addEventListener("click", simPause);
$("simResume").addEventListener("click", simResume);
$("simReset").addEventListener("click", simReset);
$("idea").addEventListener("keydown", e => { if (e.key === "Enter" && !$("simStart").disabled) simStart(); });
$("contBtn").addEventListener("click", simContinue);
$("contReq").addEventListener("keydown", e => { if (e.key === "Enter" && !$("contBtn").disabled) simContinue(); });
document.querySelectorAll('input[name="speed"]').forEach(r => r.addEventListener("change", () => { if (r.checked) setSpeed(r.value); }));
const exportFinal = (kind) => {
  if (!sim.final) return;
  const base = slug(sim.final.name) + "-final-plan";
  if (kind === "md") download(base + ".md", "text/markdown", SIM.toMarkdown(sim.final));
  else download(base + ".json", "application/json", SIM.toJSON(sim.final));
  toast("Exported " + (kind === "md" ? "Markdown" : "JSON"));
};
$("expMd").addEventListener("click", () => exportFinal("md"));
$("expJson").addEventListener("click", () => exportFinal("json"));
$("copyMd").addEventListener("click", () => { if (sim.final) copy(SIM.toMarkdown(sim.final), "Markdown copied", "Copy Markdown:"); });

buildManualPanels(); buildSimPanels();
renderManualMessages(); renderSim();
setMode(state.mode === "sim" ? "sim" : "manual");

// Renova AI Bridge — Manual Relay + Simulation. No network access, no dependencies.
// State is stored only in this browser's localStorage.
const $ = id => document.getElementById(id);
const STORE = "renovaBridge.v3";
const AIS = [
  { id: "chatgpt", name: "ChatGPT", short: "GPT" },
  { id: "claude", name: "Claude", short: "CL" },
  { id: "gemini", name: "Gemini", short: "GE" },
  { id: "grok", name: "Grok", short: "GR" }
];
const byId = id => AIS.find(a => a.id === id);
const SIM_LABEL = "SIMULATION — AI RESPONSES ARE GENERATED LOCALLY OR PREWRITTEN; NO REAL AI SERVICES ARE CONNECTED.";

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
  return `You are ${ai.name}, helping the Renova Office team.\n\nTASK:\n${state.task.trim() || "(no task entered yet)"}\n\nPROJECT NOTES:\n${state.notes.trim() || "(none)"}\n\nPlease reply in plain text with your analysis and recommendations.`;
}
function relayPrompt(from, to, text) {
  return `You are ${to.name}, helping the Renova Office team.\n\nTASK:\n${state.task.trim() || "(no task entered yet)"}\n\nPROJECT NOTES:\n${state.notes.trim() || "(none)"}\n\nBELOW IS A RESPONSE FROM ${from.name.toUpperCase()}, PASTED IN MANUALLY BY THE USER:\n"""\n${text}\n"""\n\nPlease review it and reply with your own findings.`;
}

// ---------- manual mode: build panels once ----------
const panelRefs = {};
function buildManualPanels() {
  const root = $("manualPanels"); root.textContent = "";
  for (const ai of AIS) {
    const sec = el("section", "panel ai"); sec.setAttribute("aria-labelledby", `h-${ai.id}`);
    const head = el("div", "ai-head");
    head.append(el("span", `avatar av-${ai.id}`, ai.short), (() => { const h = el("h3", "", ai.name); h.id = `h-${ai.id}`; return h; })());

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
}

function msgItem(m, withActions) {
  const ai = byId(m.ai);
  const li = el("li", "msg " + (m.sim ? "simulated" : "manual"));
  const head = el("div", "msg-head");
  head.append(el("b", "", m.sim ? `${ai.name} (simulated) · ${m.role}` : ai.name));
  if (m.phase) head.append(el("span", "phase", m.phase));
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
const sim = { plan: null, idx: 0, playing: false, timer: null, startedAt: 0 };
const STEP_MS = 1800;

function buildSimPanels() {
  const root = $("simPanels"); root.textContent = "";
  for (const ai of AIS) {
    const sec = el("section", "panel ai simpanel"); sec.id = `sp-${ai.id}`; sec.setAttribute("aria-labelledby", `sh-${ai.id}`);
    const head = el("div", "ai-head");
    const h = el("h3", "", `${ai.name} (simulated)`); h.id = `sh-${ai.id}`;
    const titles = el("div"); titles.append(h, el("span", "role", RenovaSimulation.ROLES[ai.id]));
    head.append(el("span", `avatar av-${ai.id}`, ai.short), titles);
    const list = el("ul", "msgs"); list.id = `sl-${ai.id}`;
    sec.append(head, el("p", "tag simulated blocktag", "SIMULATED"), list);
    root.append(sec);
  }
}

function renderResult() {
  const box = $("result"), body = $("resultBody"); body.textContent = "";
  const done = sim.plan && sim.idx >= sim.plan.script.length;
  box.hidden = !done; if (!done) return;
  const f = sim.plan.final;
  const sect = (title, node) => { const s = el("div", "rsect"); s.append(el("h3", "", title), node); body.append(s); };
  body.append(el("p", "tag simulated blocktag", SIM_LABEL));
  body.append(el("p", "", `Proposed app: ${f.name}. Produced by the local simulation from your idea; not by any real AI.`));
  const ul = el("ul", "plain");
  ["must", "should", "later"].forEach(t => f.features.filter(x => x.tier === t).forEach(x => {
    const li = el("li"); li.append(el("span", "tier " + t, t === "must" ? "Must" : t === "should" ? "Should" : "Later"), document.createTextNode(" " + x.name + (x.requested ? " (requested by you)" : "")));
    ul.append(li);
  }));
  sect("Agreed requirements", ul);
  const dl = el("ul", "plain");
  f.decisions.forEach(d => { const li = el("li"); li.append(el("b", "", d.topic + ": "), document.createTextNode(d.text + " "), el("i", "", `(${d.by})`)); dl.append(li); });
  sect("Decisions and who made them", dl);
  sect("App structure", el("pre", "code", f.structure));
  const ol = el("ol", "plain"); f.steps.forEach(x => ol.append(el("li", "", x)));
  sect("Development steps", ol);
  const out = el("div"); out.append(el("p", "", f.codeNote));
  if (f.code) {
    const frame = el("iframe", "preview"); frame.title = `Preview of ${f.name} (generated starter, sandboxed)`;
    frame.setAttribute("sandbox", "allow-scripts allow-modals allow-forms"); frame.srcdoc = f.code;
    const row = el("div", "row tight");
    row.append(
      button("Copy code", "small", () => copy(f.code, "Code copied", "Copy code:")),
      button("Download index.html", "small", () => {
        const url = URL.createObjectURL(new Blob([f.code], { type: "text/html" }));
        const a = el("a"); a.href = url; a.download = "index.html"; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      })
    );
    const det = el("details"); det.append(el("summary", "", "Show generated code"), el("pre", "code", f.code));
    out.append(row, frame, det);
  }
  sect("Starter build / preview", out);
}

function renderSim() {
  const total = sim.plan ? sim.plan.script.length : 0;
  const shown = sim.plan ? sim.plan.script.slice(0, sim.idx).map((m, i) => ({ ...m, sim: true, time: sim.startedAt + i * STEP_MS })) : [];
  for (const ai of AIS) {
    const list = $(`sl-${ai.id}`); list.textContent = "";
    const mine = shown.filter(m => m.ai === ai.id);
    if (!mine.length) list.append(el("li", "empty", "Waiting for the simulation."));
    mine.forEach(m => list.append(msgItem(m, false)));
    $(`sp-${ai.id}`).classList.toggle("speaking", sim.playing && shown.length && shown[shown.length - 1].ai === ai.id);
  }
  const feed = $("simFeed"); feed.textContent = "";
  if (!shown.length) feed.append(el("li", "empty", "Enter an app idea and press Start. The simulated team will discuss it here."));
  shown.forEach(m => feed.append(msgItem(m, false)));
  feed.scrollTop = feed.scrollHeight;
  const done = total && sim.idx >= total, active = sim.plan && !done;
  let status = "Ready";
  if (sim.playing) { const next = sim.plan.script[sim.idx]; status = `Playing · ${next ? byId(next.ai).name + " (simulated) is replying" : ""}`; }
  else if (done) status = "Finished"; else if (active) status = "Paused";
  $("simProgress").textContent = `${status} · message ${sim.idx} of ${total}`;
  $("simStart").disabled = !!active;
  $("simPause").disabled = !sim.playing;
  $("simResume").disabled = !(active && !sim.playing);
  $("simReset").disabled = !sim.plan;
  $("idea").disabled = !!active;
  renderResult();
}
function simStep() {
  if (!sim.playing) return;
  sim.idx++;
  if (sim.idx >= sim.plan.script.length) sim.playing = false;
  renderSim();
  if (sim.playing) sim.timer = setTimeout(simStep, STEP_MS);
}
function simStart() {
  const plan = RenovaSimulation.buildPlan($("idea").value);
  if (!plan) { $("simError").textContent = "Enter an app idea first, for example: Create an online invoice generator."; $("idea").focus(); return; }
  $("simError").textContent = "";
  clearTimeout(sim.timer);
  Object.assign(sim, { plan, idx: 0, playing: true, startedAt: Date.now() });
  renderSim(); sim.timer = setTimeout(simStep, 700);
}
function simPause() { if (!sim.playing) return; sim.playing = false; clearTimeout(sim.timer); renderSim(); }
function simResume() { if (!sim.plan || sim.playing || sim.idx >= sim.plan.script.length) return; sim.playing = true; renderSim(); sim.timer = setTimeout(simStep, 600); }
function simReset() { clearTimeout(sim.timer); Object.assign(sim, { plan: null, idx: 0, playing: false }); $("simError").textContent = ""; renderSim(); }

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

buildManualPanels(); buildSimPanels();
renderManualMessages(); renderSim();
setMode(state.mode === "sim" ? "sim" : "manual");

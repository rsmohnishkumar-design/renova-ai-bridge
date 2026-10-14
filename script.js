// Renova Office AI Bridge — plain JavaScript, no dependencies.
// Everything is stored in this browser's localStorage; nothing is sent anywhere.

const $ = id => document.getElementById(id);
const keys = {
  task: "renovaBridgeTask",
  gpt: "renovaBridgeChatGPT",
  claude: "renovaBridgeClaude",
  events: "renovaBridgeEvents"
};

// localStorage can be blocked or hold corrupt data, so every access is guarded.
function read(key, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

let events = [];
try {
  const parsed = JSON.parse(read(keys.events, "[]"));
  if (Array.isArray(parsed)) events = parsed;
} catch { /* corrupt history: start empty */ }

let toastTimer;
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function save(key, value) {
  if (!write(key, value)) toast("Could not save: browser storage is unavailable");
}

function addEvent(label, text) {
  if (!text.trim()) return;
  events.unshift({ label, text: text.trim(), time: new Date().toLocaleString() });
  events = events.slice(0, 30);
  save(keys.events, JSON.stringify(events));
  render();
}

function render() {
  const timeline = $("timeline");
  timeline.textContent = "";
  if (!events.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Your saved task and handoffs will appear here.";
    timeline.append(empty);
    return;
  }
  for (const item of events) {
    const entry = document.createElement("li");
    entry.className = "entry";
    const head = document.createElement("div");
    head.className = "entry-head";
    const who = document.createElement("span");
    who.textContent = item.label;
    const time = document.createElement("time");
    time.textContent = item.time;
    head.append(who, time);
    const body = document.createElement("p");
    body.textContent = item.text;
    entry.append(head, body);
    timeline.append(entry);
  }
}

function load() {
  $("task").value = read(keys.task);
  $("chatgptNote").value = read(keys.gpt);
  $("claudeReply").value = read(keys.claude);
  render();
}

// Copy to clipboard, or fall back to a manual-copy dialog.
async function copyText(text, successMessage, fallbackTitle) {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage);
    return true;
  } catch {
    window.prompt(fallbackTitle, text);
    return false;
  }
}

$("saveTask").addEventListener("click", () => {
  const value = $("task").value.trim();
  save(keys.task, value);
  addEvent("Shared task", value);
  toast(value ? "Task saved in this browser" : "Enter a task first");
});

$("copyToClaude").addEventListener("click", async () => {
  const task = $("task").value.trim();
  const note = $("chatgptNote").value.trim();
  save(keys.task, task);
  save(keys.gpt, note);
  const text =
`RENOVA OFFICE AI BRIDGE — HANDOFF TO CLAUDE

SHARED TASK:
${task || "(No task entered)"}

CHATGPT'S NOTES / INSTRUCTIONS:
${note || "(No notes entered)"}

Please review the task and notes. State assumptions, propose a practical solution, and return the result so it can be pasted back into the shared workspace for ChatGPT to review.`;
  await copyText(text, "Handoff copied. Paste it into Claude", "Copy this handoff into Claude:");
  addEvent("Handoff prepared for Claude", text);
});

$("saveClaude").addEventListener("click", () => {
  const value = $("claudeReply").value.trim();
  save(keys.claude, value);
  addEvent("Claude response", value);
  toast(value ? "Claude response saved" : "Paste a response first");
});

$("copyReply").addEventListener("click", () => {
  const value = $("claudeReply").value.trim();
  if (!value) { toast("Paste a Claude response first"); return; }
  copyText(value, "Response copied. Paste it into ChatGPT", "Copy Claude's response:");
});

$("clearThread").addEventListener("click", () => {
  if (!confirm("Clear the saved task, notes, response, and activity from this browser?")) return;
  Object.values(keys).forEach(remove);
  events = [];
  load();
  toast("Workspace cleared");
});

// Autosave on edit.
$("task").addEventListener("change", () => save(keys.task, $("task").value));
$("chatgptNote").addEventListener("change", () => save(keys.gpt, $("chatgptNote").value));
$("claudeReply").addEventListener("change", () => save(keys.claude, $("claudeReply").value));

load();

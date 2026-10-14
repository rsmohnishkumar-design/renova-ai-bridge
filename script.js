const $ = id => document.getElementById(id);
const keys = {task:"renovaBridgeTask",gpt:"renovaBridgeChatGPT",claude:"renovaBridgeClaude",events:"renovaBridgeEvents"};
let events = JSON.parse(localStorage.getItem(keys.events) || "[]");
let toastTimer;
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2200)}
function save(key,value){localStorage.setItem(key,value)}
function addEvent(label,text){if(!text.trim())return;events.unshift({label,text:text.trim(),time:new Date().toLocaleString()});events=events.slice(0,30);save(keys.events,JSON.stringify(events));render()}
function render(){
 const timeline=$("timeline");
 timeline.innerHTML="";
 const task=localStorage.getItem(keys.task)||"";
 if(task) events.unshift; // keep rendering based on saved activity below
 if(!events.length){timeline.innerHTML='<div class="empty-state">Your saved task and handoffs will appear here.</div>';return}
 events.forEach(item=>{const entry=document.createElement("article");entry.className="entry";const head=document.createElement("div");head.className="entry-head";const who=document.createElement("span");who.textContent=item.label;const time=document.createElement("time");time.textContent=item.time;head.append(who,time);const p=document.createElement("p");p.textContent=item.text;entry.append(head,p);timeline.append(entry)})
}
function load(){ $("task").value=localStorage.getItem(keys.task)||""; $("chatgptNote").value=localStorage.getItem(keys.gpt)||""; $("claudeReply").value=localStorage.getItem(keys.claude)||"";render() }
$("saveTask").addEventListener("click",()=>{const value=$("task").value.trim();save(keys.task,value);addEvent("Shared task",value);toast("Task saved in this browser")});
$("copyToClaude").addEventListener("click",async()=>{const task=$("task").value.trim();const note=$("chatgptNote").value.trim();save(keys.task,task);save(keys.gpt,note);const text=`RENOVA AI BRIDGE — HANDOFF TO CLAUDE\n\nSHARED TASK:\n${task||"(No task entered)"}\n\nCHATGPT'S NOTES / INSTRUCTIONS:\n${note||"(No notes entered)"}\n\nPlease review the task and notes. State assumptions, propose a practical solution, and return the result so it can be pasted back into the shared workspace for ChatGPT to review.`;try{await navigator.clipboard.writeText(text);addEvent("Handoff copied to Claude",text);toast("Handoff copied — paste it into Claude")}catch(e){window.prompt("Copy this handoff into Claude:",text)}});
$("saveClaude").addEventListener("click",()=>{const value=$("claudeReply").value.trim();save(keys.claude,value);addEvent("Claude response",value);toast("Claude response saved")});
$("copyReply").addEventListener("click",async()=>{const value=$("claudeReply").value.trim();if(!value){toast("Paste a Claude response first");return}try{await navigator.clipboard.writeText(value);toast("Response copied — paste it into ChatGPT")}catch(e){window.prompt("Copy Claude's response:",value)}});
$("clearThread").addEventListener("click",()=>{if(!confirm("Clear the saved task, notes, response, and activity from this browser?"))return;Object.values(keys).forEach(k=>localStorage.removeItem(k));events=[];load();toast("Workspace cleared")});
$("chatgptNote").addEventListener("change",()=>save(keys.gpt,$("chatgptNote").value));
$("claudeReply").addEventListener("change",()=>save(keys.claude,$("claudeReply").value));
$("task").addEventListener("change",()=>save(keys.task,$("task").value));
load();

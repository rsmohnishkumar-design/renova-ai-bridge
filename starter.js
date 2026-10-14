// Renova AI Bridge — starter-app generators and requirement-to-capability mapping.
// Pure functions, no network. Generated apps use no external resources and write user text with textContent only.
(function (root) {
  "use strict";

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- which starter capability (if any) a requirement name refers to. First match wins. ----
  const CAP_RULES = [
    [/csv/i, "csv"],
    [/dark ?mode|colou?r scheme|theme/i, "dark-mode"],
    [/safe rendering|validated import|import validation|escap/i, "safe-render"],
    [/json|backup|import|export/i, "export-import"],
    [/accessibility/i, "a11y"],
    [/clear all|clear data|delete all data/i, "clear-data"],
    [/print|pdf/i, "print"],
    [/client|business details/i, "business-client"],
    [/line items/i, "line-items"],
    [/tax|discount/i, "tax-discount"],
    [/auto-numbered/i, "numbering"],
    [/invoice history/i, "history"],
    [/cent|integer|minor unit|rounding/i, "cents"],
    [/due date|priorit/i, "fields-due"],
    [/search|filter/i, "search"],
    [/complete/i, "complete"],
    [/saved in|in the browser|persist|autosave/i, "persist"],
    [/running total|total/i, "sum"],
    [/add|create|delete|cards/i, "add-delete"]
  ];
  function capFor(name) {
    const hit = CAP_RULES.find(([re]) => re.test(name));
    return hit ? hit[1] : null;
  }

  // Capabilities each generated starter actually implements.
  function capsFor(preview, cfg) {
    if (preview === "invoice") {
      return new Set(["business-client", "line-items", "tax-discount", "print", "numbering", "history", "persist", "export-import", "safe-render", "clear-data", "dark-mode", "cents", "a11y"]);
    }
    if (preview === "records") {
      const c = new Set(["add-delete", "persist", "search", "export-import", "safe-render", "clear-data", "dark-mode", "a11y"]);
      if (cfg && cfg.complete) c.add("complete");
      if (cfg && cfg.sum) { c.add("sum"); c.add("cents"); }
      if (cfg && cfg.fields && cfg.fields.some(f => /due/i.test(f[0]))) c.add("fields-due");
      return c;
    }
    return new Set();
  }

  // Requirements typed by the user are matched against a narrow list, so words like "client" in
  // "Client logos" can never be mistaken for an implemented feature.
  const REQUEST_CAP_RULES = [[/csv/i, "csv"], [/dark ?mode|colou?r scheme|theme/i, "dark-mode"], [/pdf|print/i, "print"], [/json|backup|export|download/i, "export-import"], [/search|filter/i, "search"]];
  function requestCapFor(name) { const hit = REQUEST_CAP_RULES.find(([re]) => re.test(name)); return hit ? hit[1] : null; }

  // 'implemented' | 'not-implemented' | 'deferred' | 'no-starter'
  function statusFor(feature, preview, cfg) {
    if (!preview) return "no-starter";
    if (feature.tier === "later") return "deferred";
    const cap = feature.requested ? requestCapFor(feature.name) : capFor(feature.name);
    return cap && capsFor(preview, cfg).has(cap) ? "implemented" : "not-implemented";
  }

  // ---- shared page chrome ----
  const CSS = ":root{--bg:#f5f7fa;--fg:#1a2433;--card:#fff;--line:#d5dbe4;--accent:#0f766e;--btnfg:#fff;--muted:#4b5a6e}" +
    "@media(prefers-color-scheme:dark){:root{--bg:#0f1722;--fg:#e8eef7;--card:#172233;--line:#2c3b52;--accent:#2dd4bf;--btnfg:#04201c;--muted:#a3b2c6}}" +
    "body{font-family:system-ui,sans-serif;margin:0;background:var(--bg);color:var(--fg);line-height:1.5}main{max-width:820px;margin:auto;padding:20px}" +
    "h1{font-size:24px}h2{font-size:18px}h3{font-size:15px;margin:12px 0 4px}label{display:block;font-weight:600;margin:10px 0 4px;font-size:14px}" +
    "input,textarea,select{width:100%;padding:10px;border:1px solid #8a97a8;border-radius:8px;font:inherit;background:var(--card);color:var(--fg)}" +
    "button{padding:10px 16px;border:0;border-radius:8px;background:var(--accent);color:var(--btnfg);font:inherit;font-weight:700;cursor:pointer;min-height:44px}" +
    "button.q{background:transparent;color:var(--fg);border:1px solid #8a97a8}:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}" +
    ".card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:14px 0}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}.row>*{flex:1 1 140px}" +
    "table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid var(--line);text-align:left}.num{text-align:right}.note{color:var(--muted);font-size:14px}" +
    ".item{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:8px 0}.item span{overflow-wrap:anywhere;flex:1 1 200px}.item button{flex:0 0 auto}" +
    "@media print{.noprint{display:none!important}body{background:#fff;color:#000}.card{border:0;padding:0}}";

  const CSP = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:\">";

  function head(name) {
    return "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n" + CSP +
      "\n<title>" + esc(name) + "</title><style>" + CSS + "</style></head>\n";
  }
  function about(notes) {
    const li = a => (a && a.length ? a.map(x => "<li>" + esc(x) + "</li>").join("") : "<li>None</li>");
    return "<details class=\"card noprint\"><summary>About this starter</summary>" +
      "<p class=\"note\">Generated by a local simulation from the agreed requirements. It is a starting point, not a finished product. Everything stays on this device.</p>" +
      "<h3>Implemented</h3><ul>" + li(notes && notes.implemented) + "</ul>" +
      "<h3>Not implemented in this starter</h3><ul>" + li(notes && notes.notImplemented) + "</ul></details>\n";
  }
  // Shared client-side helpers (storage with sandbox fallback, safe download, two-step clear).
  const SHARED_JS =
    "const $=id=>document.getElementById(id);\n" +
    "let sandboxed=false;try{localStorage.getItem('x')}catch(e){sandboxed=true}\n" +
    "if(sandboxed)$('sbx').hidden=false;\n" +
    "let mem=null;\n" +
    "function readStore(key){if(sandboxed)return mem;try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}}\n" +
    "function writeStore(key,v){mem=v;if(sandboxed)return;try{localStorage.setItem(key,JSON.stringify(v))}catch(e){say('Could not save: browser storage is unavailable.')}}\n" +
    "function say(t){$('msg').textContent=t}\n" +
    "function download(name,text){try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;document.body.append(a);a.click();a.remove()}catch(e){}}\n" +
    "function armClear(btn,doClear){let armed=false,t;btn.onclick=()=>{if(!armed){armed=true;btn.textContent='Click again to confirm';t=setTimeout(()=>{armed=false;btn.textContent='Clear all saved data'},4000);return}clearTimeout(t);armed=false;btn.textContent='Clear all saved data';doClear()}}\n" +
    "function str(v,n){return typeof v==='string'?v.slice(0,n):null}\n";

  const SANDBOX_NOTE = "<p class=\"note card\" id=\"sbx\" hidden>Preview mode: this sandboxed preview cannot keep saved data, print or download files. Download index.html and open it on its own to use those features. Export and import still work through the text box.</p>\n";

  // ---------------- invoice starter ----------------
  function invoiceCode(name, notes) {
    return head(name) + "<body><main>\n<h1>" + esc(name) + "</h1>\n" + SANDBOX_NOTE +
      "<p class=\"note\" id=\"msg\" role=\"status\"></p>\n" +
      "<section class=\"card noprint\" aria-label=\"Invoice details\">\n" +
      "<div class=\"row\"><div><label for=\"from\">Your business</label><input id=\"from\" value=\"Your Business\" maxlength=\"120\"></div><div><label for=\"to\">Client</label><input id=\"to\" value=\"Client Name\" maxlength=\"120\"></div></div>\n" +
      "<div class=\"row\"><div><label for=\"no\">Invoice no.</label><input id=\"no\" maxlength=\"40\"></div><div><label for=\"date\">Date</label><input id=\"date\" type=\"date\"></div><div><label for=\"days\">Due in (days)</label><input id=\"days\" type=\"number\" min=\"0\" max=\"365\" value=\"14\"></div></div>\n" +
      "<h2>Items</h2><div id=\"items\"></div><p><button class=\"q\" id=\"add\" type=\"button\">Add item</button></p>\n" +
      "<div class=\"row\"><div><label for=\"tax\">Tax % (enter your own rate)</label><input id=\"tax\" type=\"number\" min=\"0\" step=\"0.01\" value=\"0\"></div><div><label for=\"disc\">Discount %</label><input id=\"disc\" type=\"number\" min=\"0\" max=\"100\" step=\"0.01\" value=\"0\"></div></div>\n" +
      "</section>\n<section class=\"card\" id=\"out\" aria-label=\"Invoice preview\"></section>\n" +
      "<div class=\"row noprint\"><button id=\"save\" type=\"button\">Save invoice to history</button><button class=\"q\" id=\"print\" type=\"button\">Print or save as PDF</button></div>\n" +
      "<section class=\"card noprint\"><h2>Saved invoices</h2><div id=\"hist\"></div></section>\n" +
      "<section class=\"card noprint\"><h2>Backup</h2><div class=\"row\"><button class=\"q\" id=\"exp\" type=\"button\">Export JSON</button><button class=\"q\" id=\"imp\" type=\"button\">Import JSON from the box below</button><button class=\"q\" id=\"clr\" type=\"button\">Clear all saved data</button></div>\n" +
      "<label for=\"io\">Backup data (copy from here to export, paste here to import)</label><textarea id=\"io\" rows=\"5\"></textarea></section>\n" +
      about(notes) + "</main>\n<script>\n" + SHARED_JS +
      "const KEY='renova-starter-invoices-v1';\n" +
      "const cents=x=>Math.max(0,Math.round((Number(x)||0)*100));\n" +
      "const money=c=>(c/100).toFixed(2);\n" +
      "const pad=n=>String(n).padStart(2,'0');\n" +
      "function today(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}\n" +
      "function addDays(s,n){const d=new Date(s+'T00:00:00');if(isNaN(d))return '';d.setDate(d.getDate()+n);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}\n" +
      "function list(){const v=readStore(KEY);return Array.isArray(v)?v:[]}\n" +
      "let items=[{d:'Consulting',q:'1',r:'100'}];\n" +
      "function calc(){let sub=0;items.forEach(it=>{sub+=Math.round((Number(it.q)||0)*cents(it.r))});\n" +
      " const dp=Math.min(100,Math.max(0,Number($('disc').value)||0)),tp=Math.max(0,Number($('tax').value)||0);\n" +
      " const disc=Math.round(sub*dp/100),tax=Math.round((sub-disc)*tp/100);return{sub:sub,disc:disc,tax:tax,total:sub-disc+tax}}\n" +
      "function nextNo(){return 'INV-'+String(list().length+1).padStart(3,'0')}\n" +
      "function drawForm(){const box=$('items');box.textContent='';items.forEach((it,i)=>{const row=document.createElement('div');row.className='row';\n" +
      " [['d','Description','text'],['q','Qty','number'],['r','Rate','number']].forEach(a=>{const w=document.createElement('div');const lab=document.createElement('label');lab.textContent=a[1]+' '+(i+1);\n" +
      "  const inp=document.createElement('input');inp.type=a[2];inp.value=it[a[0]];inp.maxLength=120;inp.oninput=()=>{it[a[0]]=inp.value;draw()};lab.append(inp);w.append(lab);row.append(w)});\n" +
      " const rm=document.createElement('button');rm.type='button';rm.className='q';rm.textContent='Remove';rm.onclick=()=>{items.splice(i,1);drawForm();draw()};row.append(rm);box.append(row)})}\n" +
      "function draw(){const out=$('out');out.textContent='';const h=document.createElement('h2');h.textContent='Invoice '+$('no').value;\n" +
      " const date=$('date').value,due=addDays(date,Number($('days').value)||0);const p=document.createElement('p');p.textContent='From: '+$('from').value+'  |  To: '+$('to').value+'  |  Date: '+date+(due?'  |  Due: '+due:'');out.append(h,p);\n" +
      " const t=document.createElement('table');items.forEach(it=>{const line=Math.round((Number(it.q)||0)*cents(it.r));const tr=t.insertRow();\n" +
      "  [it.d,(it.q||0)+' x '+money(cents(it.r)),money(line)].forEach((v,i)=>{const td=tr.insertCell();td.textContent=v;if(i)td.className='num'})});\n" +
      " const c=calc();[['Subtotal',c.sub],['Discount',-c.disc],['Tax',c.tax],['Total',c.total]].forEach(a=>{const tr=t.insertRow();tr.insertCell().textContent=a[0];tr.insertCell();const td=tr.insertCell();td.className='num';td.textContent=money(a[1]);if(a[0]==='Total')tr.style.fontWeight='700'});out.append(t)}\n" +
      "function drawHist(){const box=$('hist');box.textContent='';const l=list();if(!l.length){box.textContent='No saved invoices yet.';return}\n" +
      " l.forEach((r,i)=>{const row=document.createElement('div');row.className='item';const s=document.createElement('span');s.textContent=r.no+' - '+r.to+' - '+money(r.total)+' ('+r.date+')';\n" +
      "  const ld=document.createElement('button');ld.type='button';ld.className='q';ld.textContent='Load';ld.setAttribute('aria-label','Load invoice '+r.no);ld.onclick=()=>{$('from').value=r.from;$('to').value=r.to;$('no').value=r.no;$('date').value=r.date;$('days').value=r.days;$('tax').value=r.tax;$('disc').value=r.disc;items=r.items.map(x=>({d:x.d,q:String(x.q),r:String(x.r)}));drawForm();draw()};\n" +
      "  const rm=document.createElement('button');rm.type='button';rm.className='q';rm.textContent='Delete';rm.setAttribute('aria-label','Delete invoice '+r.no);rm.onclick=()=>{const n=list();n.splice(i,1);writeStore(KEY,n);drawHist()};row.append(s,ld,rm);box.append(row)})}\n" +
      "$('save').onclick=()=>{const l=list();l.push({no:$('no').value||nextNo(),from:$('from').value,to:$('to').value,date:$('date').value,days:Number($('days').value)||0,tax:Number($('tax').value)||0,disc:Number($('disc').value)||0,items:items.map(x=>({d:x.d,q:Number(x.q)||0,r:Number(x.r)||0})),total:calc().total});\n" +
      " writeStore(KEY,l);say('Invoice saved to history'+(sandboxed?' (preview only, not kept after closing)':'')+'.');$('no').value=nextNo();draw();drawHist()};\n" +
      "$('add').onclick=()=>{items.push({d:'',q:'1',r:'0'});drawForm();draw()};\n" +
      "$('print').onclick=()=>{try{window.print()}catch(e){say('Printing is not available here.')}};\n" +
      "$('exp').onclick=()=>{const text=JSON.stringify({app:'renova-starter-invoices',version:1,invoices:list()},null,2);$('io').value=text;download('invoices.json',text);say('Exported '+list().length+' invoice(s).')};\n" +
      "$('imp').onclick=()=>{let d;try{d=JSON.parse($('io').value)}catch(e){say('Import rejected: not valid JSON. Nothing was changed.');return}\n" +
      " if(!d||d.app!=='renova-starter-invoices'||!Array.isArray(d.invoices)||d.invoices.length>500){say('Import rejected: unexpected format. Nothing was changed.');return}\n" +
      " const ok=[];for(const r of d.invoices){if(!r||typeof r!=='object'||str(r.no,40)===null||str(r.from,120)===null||str(r.to,120)===null||str(r.date,10)===null||typeof r.total!=='number'||!isFinite(r.total)||!Array.isArray(r.items)||r.items.length>100){say('Import rejected: an invoice has missing or invalid fields. Nothing was changed.');return}\n" +
      "  const its=[];for(const x of r.items){if(!x||str(x.d,120)===null||typeof x.q!=='number'||typeof x.r!=='number'){say('Import rejected: an item has invalid fields. Nothing was changed.');return}its.push({d:x.d.slice(0,120),q:x.q,r:x.r})}\n" +
      "  ok.push({no:r.no.slice(0,40),from:r.from.slice(0,120),to:r.to.slice(0,120),date:r.date.slice(0,10),days:Number(r.days)||0,tax:Number(r.tax)||0,disc:Number(r.disc)||0,items:its,total:Math.round(r.total)})}\n" +
      " writeStore(KEY,list().concat(ok));drawHist();$('no').value=nextNo();say('Imported '+ok.length+' invoice(s).')};\n" +
      "armClear($('clr'),()=>{writeStore(KEY,[]);drawHist();$('no').value=nextNo();say('All saved invoices were deleted.')});\n" +
      "['from','to','no','date','days','tax','disc'].forEach(id=>$(id).oninput=draw);\n" +
      "$('date').value=today();$('no').value=nextNo();drawForm();draw();drawHist();\n" +
      "</script></body></html>";
  }

  // ---------------- generic records starter ----------------
  function recordsCode(name, cfg, notes) {
    const conf = JSON.stringify({ key: String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "app", fields: cfg.fields, sum: cfg.sum || null, complete: !!cfg.complete })
      .replace(/</g, "\\u003c");
    return head(name) + "<body><main>\n<h1>" + esc(name) + "</h1>\n" + SANDBOX_NOTE +
      "<p class=\"note\" id=\"msg\" role=\"status\"></p>\n" +
      "<section class=\"card noprint\" id=\"f\" aria-label=\"Add an entry\"></section>\n" +
      "<section class=\"card\"><h2>Entries</h2><div class=\"row noprint\"><div><label for=\"q\">Search</label><input id=\"q\" type=\"search\" maxlength=\"80\"></div><div id=\"fw\"></div></div><div id=\"list\"></div><p id=\"total\" class=\"note\"></p></section>\n" +
      "<section class=\"card noprint\"><h2>Backup</h2><div class=\"row\"><button class=\"q\" id=\"exp\" type=\"button\">Export JSON</button><button class=\"q\" id=\"imp\" type=\"button\">Import JSON from the box below</button><button class=\"q\" id=\"clr\" type=\"button\">Clear all saved data</button></div>\n" +
      "<label for=\"io\">Backup data (copy from here to export, paste here to import)</label><textarea id=\"io\" rows=\"5\"></textarea></section>\n" +
      about(notes) + "</main>\n<script>\n" + SHARED_JS +
      "const cfg=" + conf + ";const KEY='renova-starter-'+cfg.key+'-v1';\n" +
      "function rows(){const v=readStore(KEY);return Array.isArray(v)?v:[]}\n" +
      "const f=$('f');cfg.fields.forEach((fl,i)=>{const lab=document.createElement('label');lab.htmlFor='i'+i;lab.textContent=fl[0];const inp=document.createElement(fl[1]==='textarea'?'textarea':'input');if(fl[1]!=='textarea')inp.type=fl[1];if(fl[1]==='number')inp.step='0.01';inp.id='i'+i;inp.maxLength=500;f.append(lab,inp)});\n" +
      "const addBtn=document.createElement('button');addBtn.type='button';addBtn.textContent='Add';f.append(document.createElement('br'),addBtn);\n" +
      "let sf=null;if(cfg.complete){const l=document.createElement('label');l.htmlFor='sf';l.textContent='Show';sf=document.createElement('select');sf.id='sf';[['all','All'],['open','Open'],['done','Done']].forEach(o=>{const op=document.createElement('option');op.value=o[0];op.textContent=o[1];sf.append(op)});$('fw').append(l,sf);sf.onchange=draw}\n" +
      "addBtn.onclick=()=>{const v=cfg.fields.map((_,i)=>$('i'+i).value.trim().slice(0,500));if(!v[0]){say('Fill in the first field.');$('i0').focus();return}const r=rows();r.push({v:v,done:false});writeStore(KEY,r);cfg.fields.forEach((_,i)=>$('i'+i).value='');say('');draw()};\n" +
      "function draw(){const L=$('list');L.textContent='';const q=$('q').value.toLowerCase(),all=rows();let shown=0;\n" +
      " all.forEach((r,idx)=>{if(q&&!r.v.join(' ').toLowerCase().includes(q))return;if(sf&&((sf.value==='open'&&r.done)||(sf.value==='done'&&!r.done)))return;shown++;\n" +
      "  const row=document.createElement('div');row.className='item';\n" +
      "  if(cfg.complete){const cb=document.createElement('input');cb.type='checkbox';cb.style.width='auto';cb.checked=!!r.done;cb.setAttribute('aria-label','Mark entry '+(idx+1)+' done');cb.onchange=()=>{const n=rows();n[idx].done=cb.checked;writeStore(KEY,n);draw()};row.append(cb)}\n" +
      "  const s=document.createElement('span');s.textContent=r.v.filter(Boolean).join(' - ');if(r.done)s.style.textDecoration='line-through';\n" +
      "  const x=document.createElement('button');x.type='button';x.className='q';x.textContent='Delete';x.setAttribute('aria-label','Delete entry '+(idx+1));x.onclick=()=>{const n=rows();n.splice(idx,1);writeStore(KEY,n);draw()};row.append(s,x);L.append(row)});\n" +
      " if(!shown)L.textContent=all.length?'No entries match.':'Nothing here yet.';\n" +
      " const T=$('total');T.textContent='';if(cfg.sum){const k=cfg.fields.findIndex(a=>a[0]===cfg.sum);let c=0;all.forEach(r=>{c+=Math.round((Number(r.v[k])||0)*100)});T.textContent='Total '+cfg.sum.toLowerCase()+': '+(c/100).toFixed(2)}}\n" +
      "$('q').oninput=draw;\n" +
      "$('exp').onclick=()=>{const text=JSON.stringify({app:'renova-starter-'+cfg.key,version:1,entries:rows()},null,2);$('io').value=text;download(cfg.key+'.json',text);say('Exported '+rows().length+' entr'+(rows().length===1?'y':'ies')+'.')};\n" +
      "$('imp').onclick=()=>{let d;try{d=JSON.parse($('io').value)}catch(e){say('Import rejected: not valid JSON. Nothing was changed.');return}\n" +
      " if(!d||d.app!=='renova-starter-'+cfg.key||!Array.isArray(d.entries)||d.entries.length>2000){say('Import rejected: unexpected format. Nothing was changed.');return}\n" +
      " const ok=[];for(const r of d.entries){if(!r||!Array.isArray(r.v)||r.v.length>cfg.fields.length||r.v.some(x=>str(x,500)===null)){say('Import rejected: an entry has invalid fields. Nothing was changed.');return}ok.push({v:r.v.map(x=>x.slice(0,500)),done:r.done===true})}\n" +
      " writeStore(KEY,rows().concat(ok));draw();say('Imported '+ok.length+' entr'+(ok.length===1?'y':'ies')+'.')};\n" +
      "armClear($('clr'),()=>{writeStore(KEY,[]);draw();say('All saved entries were deleted.')});\n" +
      "draw();\n</script></body></html>";
  }

  const api = { esc, capFor, capsFor, statusFor, invoiceCode, recordsCode };
  if (typeof module !== "undefined") module.exports = api; else root.RenovaStarter = api;
})(typeof window !== "undefined" ? window : globalThis);

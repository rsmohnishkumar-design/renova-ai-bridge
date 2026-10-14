// Browser tests (Playwright + Chromium). Run with: node test-ui.js
// Needs Playwright installed (npm i -D playwright, or a global install) and a Chromium build.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function loadPlaywright() {
  try { return require("playwright"); } catch { /* fall through */ }
  try { return require(path.join(execSync("npm root -g").toString().trim(), "playwright")); } catch { /* fall through */ }
  console.error("Playwright not found. Install it with: npm i -D playwright"); process.exit(2);
}
const { chromium } = loadPlaywright();
const URL = "file://" + path.join(__dirname, "index.html");
const CHROMIUM = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

const jobs = [];
const test = (name, fn) => jobs.push([name, fn]);
const progress = p => p.textContent("#simProgress");
const finished = (p, t = 60000) => p.waitForFunction(() => /Finished/.test(document.getElementById("simProgress").textContent), null, { timeout: t });
const feedCount = p => p.locator("#simFeed .msg").count();

async function newPage(browser, width = 1280, height = 900, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, ...ctxOpts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("dialog", d => d.accept());
  await page.goto(URL);
  return page;
}
async function startSim(page, { idea = "Create an online invoice generator", focus = "general", extras = "", speed = "fast" } = {}) {
  await page.click("#btnSim");
  await page.fill("#idea", idea); await page.selectOption("#focus", focus); await page.fill("#extras", extras);
  await page.check(`input[name=speed][value=${speed}]`);
  await page.click("#simStart");
}

// ---------------------------------------------------------------- Manual Relay (existing features preserved)
test("Manual Relay: panels with roles, prompts, saved responses, send-to-panel, persistence, clear and reset", async b => {
  const p = await newPage(b);
  assert(/MANUAL RELAY/.test(await p.textContent("#modePill")));
  for (const [id, role] of [["chatgpt", "Architect & Reviewer"], ["claude", "Lead Developer"], ["gemini", "Design & Innovation Reviewer"], ["grok", "Critical Reviewer"]]) {
    assert((await p.textContent(`#pn-${id} .role`)).trim() === role, "role shown for " + id);
  }
  await p.fill("#task", "Review the site"); await p.fill("#notes", "No paid services");
  await p.click("#pn-chatgpt button:has-text('Fill from task')");
  const prompt = await p.inputValue("#p-chatgpt");
  assert(/Review the site/.test(prompt) && /Architect & Reviewer/.test(prompt), "prompt carries task and role");
  await p.fill("#d-chatgpt", "ChatGPT real reply"); await p.click("#pn-chatgpt button:has-text('Save response')");
  assert.equal(await p.locator("#manualFeed .tag.manual").count(), 1);
  assert(/ENTERED MANUALLY/.test(await p.textContent("#manualFeed .tag")));
  await p.click("#pn-chatgpt button:has-text('Save response')");                 // empty save is ignored
  assert.equal(await p.locator("#manualFeed .msg").count(), 1);
  await p.selectOption("#pn-chatgpt .msg select", "grok");
  await p.click("#pn-chatgpt button:has-text('Prepare prompt')");
  const gp = await p.inputValue("#p-grok"); assert(/RESPONSE FROM CHATGPT/.test(gp) && /ChatGPT real reply/.test(gp) && /Critical Reviewer/.test(gp));
  await p.reload();
  assert.equal(await p.inputValue("#task"), "Review the site");
  assert.equal(await p.locator("#manualFeed .msg").count(), 1, "history survives a reload");
  await p.click("#clearConv");
  assert.equal(await p.locator("#manualFeed .msg").count(), 0); assert.equal(await p.inputValue("#task"), "Review the site");
  await p.click("#resetWs");
  assert.equal(await p.inputValue("#task"), ""); assert.equal(await p.inputValue("#p-grok"), "");
  assert.deepStrictEqual(p.errors, []); await p.context().close();
});

// ---------------------------------------------------------------- input quality
test("Simulation: vague, short and empty ideas ask for clarification and start nothing", async b => {
  const p = await newPage(b); await p.click("#btnSim");
  await p.click("#simStart"); assert(/Enter an app idea/.test(await p.textContent("#simError")));
  for (const bad of ["app", "website", "create an app"]) {
    await p.fill("#idea", bad); await p.click("#simStart");
    assert(/too vague/.test(await p.textContent("#simError")), bad);
    assert.equal(await feedCount(p), 0); assert(await p.isEnabled("#simStart")); assert(await p.isDisabled("#simPause"));
  }
  await p.fill("#idea", "todo app"); await p.click("#simStart");
  assert.equal(await p.textContent("#simError"), ""); assert(await p.isDisabled("#simStart"));
  await p.click("#simReset");
  assert.deepStrictEqual(p.errors, []); await p.context().close();
});

// ---------------------------------------------------------------- simulation, labels, roles, focus, extras, export
test("Simulation: labelled, role-correct, focus + extra requirements, final plan and Markdown/JSON export", async b => {
  const p = await newPage(b);
  await startSim(p, { focus: "security", extras: "Dark mode\nClient logos" });
  assert(/SIMULATION — AI RESPONSES ARE GENERATED LOCALLY OR PREWRITTEN; NO REAL AI SERVICES ARE CONNECTED\./.test(await p.textContent("#banner")));
  assert(/SIMULATION/.test(await p.textContent("#modePill")));
  assert(await p.isDisabled("#idea") && await p.isDisabled("#focus") && await p.isDisabled("#extras"), "inputs locked while running");
  await finished(p);
  const n = await feedCount(p); assert(n >= 12, "security + 2 extras discussion has many messages: " + n);
  assert.equal(await p.locator("#simFeed .tag.simulated").count(), n, "every message tagged SIMULATED");
  assert.equal(await p.locator("#simFeed .tag.manual").count(), 0);
  const heads = await p.locator("#simFeed .msg-head b").allTextContents();
  assert(heads.every(h => /\(simulated\)/.test(h)), "every speaker label says simulated");
  assert(heads.some(h => /ChatGPT \(simulated\) · Architect & Reviewer/.test(h)) && heads.some(h => /Claude \(simulated\) · Lead Developer/.test(h)) &&
         heads.some(h => /Gemini \(simulated\) · Design & Innovation Reviewer/.test(h)) && heads.some(h => /Grok \(simulated\) · Critical Reviewer/.test(h)));
  assert(!/connected and working|real ChatGPT/i.test(await p.textContent("#simFeed")));
  const feedText = await p.textContent("#simFeed");
  assert(/textContent/.test(feedText), "security focus visible in the discussion");
  assert(/Dark mode/.test(feedText) && /Client logos/.test(feedText), "extra requirements discussed");
  // final result
  assert(await p.isVisible("#result"));
  const result = await p.textContent("#resultBody");
  for (const s of ["Participating simulated roles", "Agreed requirements", "Your additional requirements", "Decisions and who made them", "Proposed architecture", "App structure", "Development steps", "Starter build / preview", "Known limitations", "Client logos"]) assert(result.includes(s), "result has " + s);
  assert(/Client logos[^\n]*Not in starter/.test(result), "unimplemented requirement disclosed");
  // exports
  const [dMd] = await Promise.all([p.waitForEvent("download"), p.click("#expMd")]);
  assert.equal(dMd.suggestedFilename(), "invoice-generator-final-plan.md");
  const md = fs.readFileSync(await dMd.path(), "utf8");
  for (const s of ["# Final plan: Invoice Generator", "NO REAL AI SERVICES ARE CONNECTED", "Security", "Client logos", "## Key decisions", "## Known limitations"]) assert(md.includes(s), "md has " + s);
  const [dJson] = await Promise.all([p.waitForEvent("download"), p.click("#expJson")]);
  assert.equal(dJson.suggestedFilename(), "invoice-generator-final-plan.json");
  const j = JSON.parse(fs.readFileSync(await dJson.path(), "utf8"));
  assert.equal(j.simulation, true); assert.equal(j.focus, "security"); assert.equal(j.additionalRequirements.length, 2); assert.equal(j.roles.length, 4);
  assert.deepStrictEqual(p.errors, []); await p.context().close();
});

test("Simulation: different focuses and ideas produce visibly different discussions", async b => {
  const p = await newPage(b);
  const seen = [];
  for (const [idea, focus] of [["Create an online invoice generator", "performance"], ["Build an expense tracker", "features"]]) {
    await p.click("#btnSim");
    await startSim(p, { idea, focus }); await finished(p);
    seen.push((await p.locator("#simFeed .phase:not(.decision)").allTextContents()).join(">"));
    seen.push(await p.textContent("#simFeed"));
    await p.click("#simReset");
  }
  assert.notEqual(seen[0], seen[2], "phase sequences differ"); assert(/budget/i.test(seen[1])); assert(/cut line/i.test(seen[3])); assert(/expense/i.test(seen[3]) && !/invoice/i.test(seen[3]));
  assert.deepStrictEqual(p.errors, []); await p.context().close();
});

// ---------------------------------------------------------------- controls: pause / resume / reset / speed
test("Simulation controls: start, pause, resume, reset and playback speeds", async b => {
  const p = await newPage(b);
  await startSim(p, { speed: "slow" });
  assert(await p.isDisabled("#simStart") && await p.isEnabled("#simPause") && await p.isDisabled("#simResume") && await p.isEnabled("#simReset"));
  await p.waitForFunction(() => document.querySelectorAll("#simFeed .msg").length >= 1, null, { timeout: 6000 });
  await p.waitForTimeout(1500);
  const slowCount = await feedCount(p);
  assert(slowCount >= 1 && slowCount <= 2, "slow speed after ~2.5s: " + slowCount);
  // pause: nothing moves
  await p.click("#simPause"); const paused = await feedCount(p);
  assert(/Paused/.test(await progress(p)) && await p.isEnabled("#simResume") && await p.isDisabled("#simPause"));
  await p.waitForTimeout(3600); assert.equal(await feedCount(p), paused, "no messages while paused");
  // resume at fast speed: much quicker
  await p.check("input[name=speed][value=fast]"); await p.click("#simResume");
  assert(/Playing/.test(await progress(p)));
  const t0 = Date.now(); await p.waitForFunction(c => document.querySelectorAll("#simFeed .msg").length >= c + 5, paused, { timeout: 8000 });
  assert(Date.now() - t0 < 6500, "five messages quickly at fast speed");
  assert(/fast speed/.test(await progress(p)));
  // switching speed while playing takes effect without restarting
  await p.check("input[name=speed][value=slow]"); const c1 = await feedCount(p); await p.waitForTimeout(1000);
  assert(await feedCount(p) <= c1 + 1, "slow speed reduces the rate");
  await p.check("input[name=speed][value=fast]");
  await finished(p);
  assert(await p.isVisible("#result")); assert(await p.isEnabled("#simStart"), "Start available again after finishing");
  // reset clears everything
  await p.click("#simReset");
  assert.equal(await feedCount(p), 0); assert(await p.isHidden("#result")); assert(await p.isEnabled("#idea")); assert(await p.isDisabled("#simPause") && await p.isDisabled("#simReset"));
  assert(/message 0 of 0/.test(await progress(p)));
  assert.deepStrictEqual(p.errors, []); await p.context().close();
});

// ---------------------------------------------------------------- continue discussion
test("Continue Discussion: during playback, while paused, and after finishing", async b => {
  const p = await newPage(b);
  assert(await p.evaluate(() => true)); await p.click("#btnSim");
  assert(await p.isDisabled("#contBtn"), "disabled before a discussion exists");
  await startSim(p, { speed: "normal" });
  await p.waitForFunction(() => document.querySelectorAll("#simFeed .msg").length >= 2, null, { timeout: 8000 });
  // add requirement during playback
  await p.fill("#contReq", "Add a search box"); await p.click("#contBtn");
  assert.equal(await p.inputValue("#contReq"), "", "field cleared"); assert(/Playing/.test(await progress(p)), "still playing");
  await p.check("input[name=speed][value=fast]");
  await finished(p);
  let feed = await p.textContent("#simFeed");
  assert(/still in progress/.test(feed) && /Add a search box/.test(feed), "re-planning acknowledges the interruption and the new requirement");
  assert(/Add a search box[^\n]*Not in starter/.test(await p.textContent("#resultBody")), "the invoice starter has no search box, so the plan says so instead of claiming it");
  const afterFirst = await feedCount(p);
  // add another after it finished: discussion resumes without restarting
  await p.fill("#contReq", "Accept card payments"); await p.click("#contBtn");
  assert(/Playing/.test(await progress(p)), "finished discussion resumes"); assert(await p.isHidden("#result"), "result hidden while discussing");
  await finished(p);
  assert((await feedCount(p)) > afterFirst, "new messages appended"); assert(/Reopening the discussion/.test(await p.textContent("#simFeed")));
  const res = await p.textContent("#resultBody");
  assert(/Add a search box/.test(res) && /Accept card payments[^\n]*Deferred/.test(res), "both requirements in the final plan; payments deferred, not claimed");
  // paused discussion stays paused
  await p.click("#simReset"); await startSim(p, { speed: "slow" });
  await p.waitForFunction(() => document.querySelectorAll("#simFeed .msg").length >= 1, null, { timeout: 6000 });
  await p.click("#simPause"); await p.fill("#contReq", "Dark mode"); await p.click("#contBtn");
  assert(/Paused/.test(await progress(p)), "paused stays paused"); assert(await p.isEnabled("#simResume"));
  // validation
  await p.fill("#contReq", "ab"); await p.click("#contBtn"); assert(/at least 3/.test(await p.textContent("#simError")));
  await p.fill("#contReq", "dark mode"); await p.click("#contBtn"); assert(/already part/.test(await p.textContent("#simError")));
  assert.deepStrictEqual(p.errors, []); await p.context().close();
});

// ---------------------------------------------------------------- generated starter apps run
test("Generated invoice starter works: totals, saved history, JSON export/import, sandbox is minimal", async b => {
  const p = await newPage(b);
  await startSim(p, {}); await finished(p);
  const iframe = p.locator("iframe.preview");
  assert.equal(await iframe.getAttribute("sandbox"), "allow-scripts", "preview sandbox grants scripts only");
  const f = p.frameLocator("iframe.preview");
  await f.locator("#tax").fill("10");
  assert(/110\.00/.test(await f.locator("#out").textContent()), "100 + 10% tax = 110.00");
  await f.locator("#disc").fill("50"); assert(/55\.00/.test(await f.locator("#out").textContent()), "discount applied before tax");
  await f.locator("#save").click();
  assert(/INV-001/.test(await f.locator("#hist").textContent()), "saved to history");
  assert.equal(await f.locator("#no").inputValue(), "INV-002", "invoice number advances");
  await f.locator("#exp").click();
  const json = JSON.parse(await f.locator("#io").inputValue()); assert.equal(json.invoices.length, 1); assert.equal(json.invoices[0].total, 5500);
  await f.locator("#io").fill("{not json"); await f.locator("#imp").click(); assert(/rejected/.test(await f.locator("#msg").textContent()));
  await f.locator("#io").fill(JSON.stringify({ app: "renova-starter-invoices", version: 1, invoices: [{ no: "<b>X</b>", from: "A", to: "<img src=x onerror=alert(1)>", date: "2026-01-01", total: 100, items: [{ d: "x", q: 1, r: 1 }] }] }));
  await f.locator("#imp").click(); assert(/Imported 1/.test(await f.locator("#msg").textContent()));
  assert.equal(await f.locator("#hist img, #hist b").count(), 0, "imported text is shown as text, never as HTML");
  await f.locator("#io").fill(JSON.stringify({ app: "renova-starter-invoices", invoices: [{ no: 5 }] })); await f.locator("#imp").click();
  assert(/rejected/.test(await f.locator("#msg").textContent()), "invalid records rejected");
  assert(await f.locator("#sbx").isVisible(), "sandbox limits are disclosed in the preview");
  assert(/Not implemented in this starter/.test(await f.locator("details").textContent()));
  assert.deepStrictEqual(p.errors, []); await p.context().close();
});
test("Generated record starters work (expense totals, task completion, hostile text stays text)", async b => {
  const p = await newPage(b);
  await startSim(p, { idea: "Build an expense tracker" }); await finished(p);
  let f = p.frameLocator("iframe.preview");
  await f.locator("#i0").fill("Lunch <b>x</b>"); await f.locator("#i1").fill("12.50"); await f.locator("button:has-text('Add')").click();
  await f.locator("#i0").fill("Taxi"); await f.locator("#i1").fill("7.25"); await f.locator("button:has-text('Add')").click();
  assert(/19\.75/.test(await f.locator("#total").textContent()), "exact total");
  assert.equal(await f.locator("#list b").count(), 0, "no HTML injection");
  await f.locator("#q").fill("taxi"); assert.equal(await f.locator("#list .item").count(), 1, "search filters");
  await f.locator("#q").fill(""); await f.locator("#list .item button").first().click();
  assert(/7\.25/.test(await f.locator("#total").textContent()), "delete updates the total");
  await p.click("#simReset");
  await startSim(p, { idea: "todo list" }); await finished(p);
  f = p.frameLocator("iframe.preview");
  await f.locator("#i0").fill("Write tests"); await f.locator("button:has-text('Add')").click();
  await f.locator("#list input[type=checkbox]").check(); await f.locator("#sf").selectOption("open");
  assert(/Nothing here|No entries match/.test(await f.locator("#list").textContent()), "completed task hidden by the Open filter");
  assert.deepStrictEqual(p.errors, []); await p.context().close();
});
test("Apps without a starter show no preview and claim nothing", async b => {
  const p = await newPage(b);
  await startSim(p, { idea: "loan EMI calculator" }); await finished(p);
  assert.equal(await p.locator("iframe.preview").count(), 0);
  assert(/No starter app is available/.test(await p.textContent("#resultBody")));
  assert.equal(await p.locator("#resultBody .st.implemented").count(), 0);
  await p.context().close();
});

// ---------------------------------------------------------------- responsive layout
test("Mobile layout: four panels become tabs, one visible at a time, no horizontal scroll", async b => {
  const p = await newPage(b, 375, 800);
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  // manual mode
  assert(await p.isVisible("#manualPanels"), "panel grid present");
  assert(await p.locator(".tabs").first().isVisible(), "tab bar visible on mobile");
  const visiblePanels = sel => p.locator(sel).evaluateAll(els => els.filter(e => getComputedStyle(e).display !== "none").length);
  assert.equal(await visiblePanels("#manualPanels > .ai"), 1);
  await p.click("#manualPanels >> xpath=preceding-sibling::div[@role='tablist'] >> button:has-text('Grok')");
  assert(await p.isVisible("#pn-grok")); assert(await p.isHidden("#pn-chatgpt"));
  assert.equal(await overflow(), false, "manual: no horizontal scroll");
  // keyboard: arrow keys move between tabs
  await p.focus("button.tab[aria-selected=true]"); await p.keyboard.press("ArrowRight");
  assert(await p.isVisible("#pn-chatgpt"), "arrow right wraps to the first tab");
  // simulation
  await startSim(p, {}); await finished(p);
  assert.equal(await visiblePanels("#simPanels > .ai"), 1);
  await p.click("#simPanels >> xpath=preceding-sibling::div[@role='tablist'] >> button:has-text('Gemini')");
  assert(await p.isVisible("#sp-gemini")); assert(await p.isHidden("#sp-claude"));
  assert(/Gemini \(simulated\)/.test(await p.textContent("#sp-gemini .msg-head b")), "messages readable inside the panel");
  assert.equal(await overflow(), false, "simulation + result: no horizontal scroll");
  const w = await p.locator("#simFeed .msg").first().evaluate(e => e.getBoundingClientRect().width);
  assert(w > 250, "feed messages use the full width: " + w);
  const small = await p.locator(".button").evaluateAll(els => els.filter(e => e.offsetParent && e.getBoundingClientRect().height < 34).length);
  assert.equal(small, 0, "all visible buttons have a usable height");
  assert.deepStrictEqual(p.errors, []); await p.context().close();
});
test("Tablet and desktop layouts keep all four panels visible without tabs", async b => {
  for (const w of [1280, 768]) {
    const p = await newPage(b, w, 900);
    assert.equal(await p.locator(".tabs").first().isVisible(), false, w + ": tab bar hidden");
    assert.equal(await p.locator("#manualPanels > .ai").evaluateAll(els => els.filter(e => getComputedStyle(e).display !== "none").length), 4, w + ": four panels");
    if (w === 1280) {
      const xs = await p.locator("#manualPanels > .ai").evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().left)));
      assert(new Set(xs).size === 2, "desktop keeps the two-column grid");
    }
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, w + ": no horizontal scroll");
    await p.context().close();
  }
});

// ---------------------------------------------------------------- run
(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  let failed = 0, ran = 0;
  for (const [name, fn] of jobs) {
    if (process.env.TEST_FILTER && !name.includes(process.env.TEST_FILTER)) continue;   // e.g. TEST_FILTER=Continue node test-ui.js
    ran++;
    try { await fn(browser); console.log("ok -", name); }
    catch (e) { failed++; console.error("FAIL -", name, "\n  ", e.message.split("\n")[0]); }
  }
  await browser.close();
  console.log(failed ? `${failed} UI test(s) FAILED` : `${ran} UI tests passed`);
  process.exit(failed ? 1 : 0);
})();

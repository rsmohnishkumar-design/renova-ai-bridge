# Renova AI Bridge

*Your AI Team. One Control Room.* — part of Renova Office, "Renewing the Way You Work."

A free, static web page (HTML, CSS, vanilla JavaScript) with two modes. It runs on GitHub Pages and needs no backend, API keys, paid services or build step.

## Modes

### Manual Relay Mode
A shared task and notes, plus one panel each for ChatGPT, Claude, Gemini and Grok. Prepare a prompt per assistant, copy it into that assistant's own chat, paste its real reply back, and send a reply on to another assistant as a prepared prompt. Saved replies are tagged "ENTERED MANUALLY BY YOU" with a timestamp. This page never contacts any AI.

### Simulation Mode
> SIMULATION — AI RESPONSES ARE GENERATED LOCALLY OR PREWRITTEN; NO REAL AI SERVICES ARE CONNECTED.

Enter an app idea and a scripted team discusses it. The text is produced by rules and templates in `simulation.js`; ChatGPT, Claude, Gemini and Grok do not take part, and every message is labelled "(simulated)".

| Role | Simulated duty |
|---|---|
| ChatGPT — Architect & Reviewer | Plans the architecture and reviews technical decisions |
| Claude — Lead Developer | Proposes the implementation, produces the final plan and starter code where supported |
| Gemini — Design & Innovation Reviewer | Evaluates usability, design and new features |
| Grok — Critical Reviewer | Challenges assumptions, finds weaknesses, proposes alternatives |

What you can control:
- **Focus:** General, Security, User Experience, Performance or Features. Each focus gives a different path, speaker order and set of arguments.
- **Additional requirements:** one per line (or written inline as "… with X, Y"). Each is assessed as *build*, *adapt* or *defer* (for example, accounts and payments are deferred because a free static site cannot do them safely) and carried into the final plan.
- **Playback:** Start, Pause, Resume, Reset; Slow, Normal or Fast.
- **Continue Discussion:** add a requirement during or after a discussion. Messages already shown are kept; points not yet reached are dropped and re-planned around the new requirement, so the final plan only contains decisions that were actually discussed.
- **Vague input** such as "app" is refused with a request for detail.

The result panel shows the agreed requirements, who decided what, architecture, file structure, development steps, known limitations and, for supported app types, a **starter app** with a live preview. Export the plan as **Markdown (.md)** or **JSON (.json)** (JSON also includes the starter source).

### Starter apps: what they do and do not do
Invoice generator (with saved history, auto-numbering, print layout, JSON export/import) and record-style apps (tasks, expenses, notes, bookings, flashcards, generic lists: add, search, delete, JSON export/import, optional totals or completion). Each requirement is marked *In starter*, *Not in starter*, *Deferred* or *No starter*, and the generated page lists what it does not implement. Apps without a starter (for example calculators) are labelled as such. The starters are basic starting points, not finished products.

The preview runs in an iframe with `sandbox="allow-scripts"` only. Inside it, saving, printing and downloads are limited, and the preview says so; download `index.html` and open it on its own to use them. Generated pages carry a Content-Security-Policy that blocks all external resources, and write user text with `textContent` only.

## Not supported
Automatic messaging with real AI services. There is no browser automation, scraping, account access or API integration, by design.

## Privacy
Manual Relay content (task, notes, prompts, saved responses) is stored in this browser's `localStorage` only; nothing is sent anywhere. Other browsers or devices won't see it, and clearing site data deletes it. **Clear Conversation** deletes saved responses; **Reset Workspace** deletes everything. Simulation content is not saved. Don't paste passwords or confidential information.

## Files
- `index.html`, `style.css` — page and styles (the four AI panels become tabs below 720 px)
- `app.js` — interface, Manual Relay, simulation playback, exports
- `simulation.js` — dialogue engine, requirement assessment, final plan, Markdown/JSON export
- `starter.js` — starter-app generators and the requirement-to-feature mapping
- `test-simulation.js`, `test-ui.js`, `package.json` — tests

## Tests
```
node test-simulation.js   # engine: no dependencies
node test-ui.js           # browser: needs Playwright and Chromium (npm i -D playwright)
```

## Deploy on GitHub Pages (free)
Repository **Settings → Pages → Build and deployment → Deploy from a branch**, choose `main` and `/(root)`, then Save. Every commit to `main` republishes the site.

## Editing (beginner guide)
No build step. Edit a file, commit, and Pages republishes. Colours are at the top of `style.css`. New app types are plain data entries in `KINDS` in `simulation.js`.

# Renova AI Bridge

*Your AI Team. One Control Room.* — part of Renova Office, "Renewing the Way You Work."

A free, static web page (HTML, CSS, vanilla JavaScript) with two modes. It works on GitHub Pages and needs no backend, API keys or paid services.

## Modes
**Manual Relay Mode** — a shared task and notes, plus one panel each for ChatGPT, Claude, Gemini and Grok. Prepare a prompt per assistant, copy it into that assistant's own chat, paste its real reply back, and send a reply on to another assistant as a prepared prompt. Everything you save is tagged "ENTERED MANUALLY BY YOU" with a timestamp.

**Simulation Mode** — type an app idea (for example "Create an online invoice generator") and a scripted "development team" discusses it in four roles: ChatGPT (Product Analyst), Claude (Lead Developer), Gemini (UX & Design Reviewer), Grok (Risk Reviewer). Start, Pause, Resume and Reset are available. It ends with a result panel: agreed requirements, decisions, app structure, development steps and, for invoice and record-style ideas, a basic working starter app with a live preview.

> SIMULATION — AI RESPONSES ARE GENERATED LOCALLY OR PREWRITTEN; NO REAL AI SERVICES ARE CONNECTED.

The simulation is rule-based text built by `simulation.js` from your idea. It is not ChatGPT, Claude, Gemini or Grok, none of them took part, and the generated starter app is deliberately basic, not a finished product.

## Not supported
Automatic messaging with real AI services. There is no browser automation, scraping, account access or API integration, by design.

## Privacy
Manual Relay content (task, notes, prompts, saved responses) is stored in this browser's `localStorage` only. Nothing is sent anywhere. Other browsers or devices won't see it, and clearing site data deletes it. **Clear Conversation** deletes saved responses; **Reset Workspace** deletes everything. Simulation content is not saved. Don't paste passwords or confidential information.

## Files
- `index.html`, `style.css` — page and styles
- `app.js` — interface, Manual Relay, simulation playback
- `simulation.js` — local simulation engine and starter-app generator
- `test-simulation.js` — run `node test-simulation.js` to check the engine

## Deploy on GitHub Pages (free)
1. Merge the branch into `main` (or choose this branch in the next step).
2. Repository **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Pick the branch and `/(root)`, then Save. The site URL appears after about a minute.

## Editing (beginner guide)
No build step. Edit a file, commit, and Pages republishes. Colours are at the top of `style.css`. New app types for the simulation are plain data entries in `simulation.js`.

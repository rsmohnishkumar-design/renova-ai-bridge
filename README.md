# Renova AI Bridge

A static, no-cost prototype for coordinating work between ChatGPT and Claude.

## Important limitation
This prototype does **not** connect directly to the ChatGPT or Claude APIs. You copy a handoff into Claude, then paste Claude's response back into this page or into ChatGPT. It requires no API keys and sends no content to a server.

## Run locally
Open `index.html` in a modern browser. Clipboard buttons work best on HTTPS or localhost. If clipboard access is blocked, the page displays a manual copy dialog.

## Publish with GitHub Pages
1. Create a new public repository, for example `renova-ai-bridge`.
2. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**, choose `main` and `/(root)`, then save.
5. Open the published URL shown by GitHub Pages.

## Privacy
This prototype stores task text and handoff history in the browser's `localStorage` on the device where it is used. Clearing browser site data or using another browser/device may remove or separate that history. Do not paste passwords, API keys, or confidential information.

## Future automatic integration
True AI-to-AI communication requires a backend/serverless function and API access for each provider. Never place API keys in browser JavaScript or a public GitHub repository. API charges may apply separately from chat subscriptions.

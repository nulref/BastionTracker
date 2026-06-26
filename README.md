# Bastion Tracker

Static GitHub Pages tracker for a D&D 2024 bastion.

## Files

- `index.html` is the editable tracker page.
- `styles.css` contains the page layout and print styles.
- `app.js` loads, edits, imports, exports, and locally autosaves tracker data.
- `data/bastion.json` is the repo-backed starting data file.

## Data

GitHub Pages can read `data/bastion.json`, but it cannot safely write back to it from the browser without a backend or authenticated GitHub API flow. This tracker loads that JSON file, saves edits to the current browser's `localStorage`, and exports a replacement JSON file.

To update the shared repo data:

1. Edit the tracker in the browser.
2. Click `Export JSON`.
3. Replace `data/bastion.json` in the repo with the exported JSON.
4. Commit and push the change.

## Local Preview

Run a local static server from this folder, then open the printed URL:

```powershell
python -m http.server 8000
```

Opening `index.html` directly from disk may block loading `data/bastion.json`, depending on browser security settings.

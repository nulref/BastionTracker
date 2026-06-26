# Bastion Tracker

Static GitHub Pages tracker for a D&D 2024 bastion.

## Files

- `index.html` is the editable tracker page.
- `styles.css` contains the page layout and print styles.
- `app.js` loads, edits, imports, exports, and locally autosaves tracker data.
- `data/bastion.json` is the repo-backed starting data file.

## Data

GitHub Pages can read `data/bastion.json` directly. The tracker also includes an authenticated GitHub API flow that can commit edits back to that file from the browser.

The GitHub sync flow needs a fine-grained personal access token with access to this repository and `Contents` read/write permission. The token is stored only in your browser according to the option selected in `GitHub Settings`; it is not saved in the repository.

To update the shared repo data without GitHub sync:

1. Edit the tracker in the browser.
2. Click `Export JSON`.
3. Replace `data/bastion.json` in the repo with the exported JSON.
4. Commit and push the change.

To update the shared repo data with GitHub sync:

1. Create a fine-grained token for this repo with `Contents` read/write permission.
2. Open `GitHub Settings`.
3. Confirm owner `nulref`, repository `BastionTracker`, branch `main`, and path `data/bastion.json`.
4. Paste the token and save settings.
5. Add your GitHub noreply address in `Committer Email` if your account blocks private email exposure.
6. Use `Pull GitHub` before editing and `Push GitHub` when ready to commit the JSON file.

## Local Preview

Run a local static server from this folder, then open the printed URL:

```powershell
python -m http.server 8000
```

Opening `index.html` directly from disk may block loading `data/bastion.json`, depending on browser security settings.

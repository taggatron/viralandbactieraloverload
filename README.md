# Bacteria vs Viruses — GCSE Simulation

A simple, bright, interactive simulation showing **two ways pathogens cause disease**:

- **Bacteria**: reproduce independently and may release **toxins** that damage tissues.
- **Viruses**: infect cells and **hijack** the cell’s machinery to make more viruses.

This is a **static** site (no build step) designed to be hosted on **GitHub Pages**.

## Run locally

### Option A: VS Code Live Server
1. Install the VS Code extension “Live Server”.
2. Right-click `index.html` → **Open with Live Server**.

### Option B: Python (built-in)
From this folder:

```bash
python3 -m http.server 8000
```

Then open:
- http://localhost:8000

## Deploy on GitHub Pages

1. Create a new GitHub repo and add these files (`index.html`, `styles.css`, `app.js`).
2. Push to `main`.
3. In GitHub: **Settings → Pages**
4. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/** (root)
5. Save. After a minute or two, GitHub will show your Pages URL.

## Controls

- Switch tabs for **Bacteria** vs **Virus**.
- Adjust sliders to change how quickly symptoms happen.
- Keyboard:
  - Space = pause/resume
  - R = reset
  - B = bacteria tab
  - V = virus tab

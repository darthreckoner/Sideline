# Sideline v0.2 — Youth Soccer Coaching Board (PWA)

Offline-capable coaching whiteboard for iPhone, iPad and desktop. 9v9 by default, 7v7 in the menu. No accounts, no dependencies.

## Run

```bash
python3 -m http.server 8080   # from this folder
```

Or just double-click `index.html` — it works straight from disk. Open `http://localhost:8080` if serving. On a real iPhone it must be served over **HTTPS** (any static host — Netlify, GitHub Pages, Cloudflare Pages) for offline mode and Add to Home Screen.

## GitHub Pages

Site: [Sideline](https://darthreckoner.github.io/Sideline/)

GitHub Pages publishes the root of the `main` branch. The `.nojekyll` file keeps this a plain static site; no build or dependency installation is required. Keep asset paths relative so the app, icons, manifest, and service worker work under `/Sideline/`.

To publish updates, commit the changed files and push `main` to [darthreckoner/Sideline](https://github.com/darthreckoner/Sideline). GitHub Pages deploys the changes automatically. Installed copies refresh their offline cache in the background and use updates on a subsequent launch.

## How it works

- **Pass:** tap any teammate of the player with the ball. One tap = one pass (animated).
- **Move:** drag any player or the ball. Drag the ball off a player for a shot or loose ball; drop it on a player to give them possession.
- **Change possession:** tap the ball, then any player (either team) or an open spot.
- **Demonstrate:** Set start → run the play → Reset. Undo brings the demo back.
- **Draw:** Arrow / Draw modes; Erase removes a touched line. Move mode never draws.
- **Menu:** format, team colors (10 swatches, numbers auto-switch to white on dark colors, teams can't share a color), saved boards, help, install.
- **Save:** 5 named slots in IndexedDB. **Share:** PNG via the iOS share sheet (download fallback).

## Changes from v0.1

- **Layout rebuilt so the field fills the screen.** Landscape: two-column control rail on the right. Portrait: the field turns upright and controls sit underneath — no more "rotate your phone" screen. Status messages are a fading toast over the field.
- **Bigger targets.** On an iPhone 14 the dots went from ~17 px to ~34 px across and touch areas from ~27 px to ~56 px. Nothing scrolls off-screen at iPhone SE size.
- **Ball is grabbable.** The ball is hit-tested before players, so you can drag it off its carrier.
- **Tap-to-pass is a real rule:** teammates only; tapping an opponent explains how to switch possession. Game starts with the centre midfielder on the ball.
- **Color swatches** instead of the iOS color wheel; automatic number contrast.
- **PNG export** no longer includes the "start set" label.
- **Updates reach installed phones:** service worker is stale-while-revalidate (opens instantly offline, refreshes in the background, new version on next launch).
- Format switch only asks for confirmation when you've changed something, and keeps team colors.
- Source is un-minified and commented.

## Files

- `index.html`, `styles.css`, `app.js` — the app
- `presets/soccer-9v9.js`, `presets/soccer-7v7.js` — field lines and formations (add a format by adding a file plus a script tag in index.html)
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA plumbing

## Still to test on a real iPhone

Outdoors in sunlight, one-handed: open, pass, drag, Set start, Reset — under 30 seconds. Then: Home Screen install, offline relaunch, saves surviving a relaunch, PNG → Messages through the share sheet.

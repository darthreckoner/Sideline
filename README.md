# Sideline v0.3 — Youth Soccer Coaching Board (PWA)

Offline-capable coaching whiteboard for iPhone, iPad and desktop. 9v9 by default, 7v7 in the menu. No accounts, no dependencies.

Built for a parent or volunteer youth recreation coach to explain positioning, passing and movement to kids in under a minute. The first release stays focused on a hands-on soccer demonstration: arrange the board, Set start, move and pass, Reset, repeat. Accounts, subscriptions, cloud storage, AI, rosters and animation timelines remain outside this prototype's scope.

## Run

```bash
python3 -m http.server 8080   # from this folder
```

Or just double-click `index.html` — it works straight from disk. Open `http://localhost:8080` if serving. On a real iPhone it must be served over **HTTPS** (any static host — Netlify, GitHub Pages, Cloudflare Pages) for offline mode and Add to Home Screen.

## GitHub Pages

Site: [Sideline](https://darthreckoner.github.io/Sideline/)

GitHub Pages publishes the root of the `main` branch. The `.nojekyll` file keeps this a plain static site; no build or dependency installation is required. Keep asset paths relative so the app, icons, manifest, and service worker work under `/Sideline/`.

To publish updates, commit the changed files and push `main` to [darthreckoner/Sideline](https://github.com/darthreckoner/Sideline). GitHub Pages deploys the changes automatically. Bump the cache version in `sw.js` whenever runtime files change. Each update caches a complete release in the background, then takes over after all existing Sideline tabs and windows close. Open online, close Sideline, and reopen to pick up a downloaded update.

## How it works

- **Pass:** tap any teammate of the player with the ball. One tap = one pass (animated).
- **Move:** drag any player or the ball. Drag the ball off a player for a shot or loose ball; drop it on a player to give them possession.
- **Change possession:** tap the ball, then any player (either team) or an open spot.
- **Demonstrate:** Set start → run the play → Reset. Set start and Reset both select Move. Reset restores the captured players, ball, drawings and colors; Undo brings the demo back. Repeat without recapturing the start.
- **Formation:** Menu → choose 3-3-2 or 3-2-3 for 9v9, or 2-3-1 / 3-2-1 for 7v7. Number 1 is the goalkeeper on each team. **Reset formation** starts a fresh board in the selected formation, keeping colors and clearing drawings and the demo start. Both formation actions are undoable.
- **Draw:** Arrow / Draw modes; Erase removes a touched line. Move mode never draws.
- **Menu:** format, formation, team colors (10 swatches, numbers auto-switch to white on dark colors, teams can't share a color), saved boards, help, install.
- **Save:** 5 named slots in IndexedDB. **Share:** PNG via the iOS share sheet (download fallback).

## Changes from v0.1

- **Layout rebuilt so the field fills the screen.** Landscape: two-column control rail on the right. Portrait: the field turns upright and controls sit underneath — no more "rotate your phone" screen. Status messages are a fading toast over the field.
- **Bigger targets.** On an iPhone 14 the dots went from ~17 px to ~34 px across and touch areas from ~27 px to ~56 px. Nothing scrolls off-screen at iPhone SE size.
- **Ball is grabbable.** The ball is hit-tested before players, so you can drag it off its carrier.
- **Tap-to-pass is a real rule:** teammates only; tapping an opponent explains how to switch possession. Game starts with the centre midfielder on the ball.
- **Color swatches** instead of the iOS color wheel; automatic number contrast.
- **PNG export** no longer includes the "start set" label.
- **Updates reach installed phones:** complete releases are cached for offline use and activate after existing Sideline windows close.
- Format switch only asks for confirmation when you've changed something, and keeps team colors.
- Source is un-minified and commented.

## v0.3 prototype completion

- Exposes the existing formation presets and adds a separate, undoable Reset formation.
- Set start and Reset return to Move so drawing mode cannot interfere with a demonstration.
- Soccer field markings live in a preset renderer; the shared board uses preset dimensions and generates its format choices from the preset registry.
- Existing saved boards without formation metadata still open at their saved positions. Reset formation uses that format's default formation.
- Clarifies that Home Screen installation does not guarantee preservation of local saves.

## Files

- `index.html`, `styles.css`, `app.js` — the app
- `presets/soccer-field.js` — soccer-only field renderer
- `presets/soccer-9v9.js`, `presets/soccer-7v7.js` — runtime preset data; matching JSON files are their source copies
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA plumbing

## Adding a sport later

A preset registers in `window.SIDELINE_PRESETS` with an `id`, `name`, `playerCount`, `field` dimensions and renderer `type`, named `formations`, and a `defaultFormation`. Positions are field coordinates for Home; Away is mirrored across both field axes. The player nearest center starts with the ball. A renderer registers in `window.SIDELINE_FIELDS[type]` and draws only the field on the supplied canvas context.

Add the new preset and renderer scripts to `index.html` and the offline file list in `sw.js`, then bump the cache version. The format picker discovers registered presets automatically. Dragging, drawing, passing, undo, saved boards and demonstration reset share the same engine. Basketball and football presets are not included yet; sport-specific rules or objects may need additional work.

## Verification

Run `node --test tests/*.test.cjs` for behavior and offline-shell checks. These cover demonstration reset and undo, player/ball drags, formations, legacy board compatibility, a different-sized test preset, complete offline assets, and cache isolation. They do not establish real-device touch or iOS acceptance.

## Still to test on a real iPhone

Outdoors in sunlight, one-handed: open, pass, drag, Set start, Reset — under 30 seconds. Then: Home Screen install, offline relaunch, saves surviving a relaunch, PNG → Messages through the share sheet.

# Sideline v0.5 — Youth Soccer Coaching Board (PWA)

Offline-capable coaching whiteboard for iPhone, iPad and desktop. 9v9 by default, with 7v7 in Team → Quick board setup. No accounts or runtime dependencies. The user authorized publishing v0.5 to GitHub Pages for phone testing; see the deployment record in [verification](docs/verification/2026-10-26/README.md).

Built for a parent or volunteer youth recreation coach to explain positioning, passing and movement to kids in under a minute. Board stays hands-on: arrange the board, Set start, move and pass, Reset, repeat. Coaching holds sourced activity illustrations and your playbook; Team holds local rosters and planned lineups. Match tracking, accounts, subscriptions, cloud sync, AI and animation timelines are outside this release.

The [soccer coaching plan](SOCCER_PLAN.md) and [team setup plan](TEAM_PLAN.md) describe the design. The [earlier screen concepts](docs/design/soccer-tabs/README.md) are design references. Current verification is recorded in [v0.5 checks](docs/verification/2026-10-26/README.md).

The user authorized implementation of the verified shortlist. The first pack contains five original schematic illustrations linked to FIFA youth lessons, with the published ages, native activity sizes and Source and adaptation details. Starting-shape, prescribed-triangle and goalkeeper-build-out lessons are excluded. FA candidates remain outside this pack pending separate reuse/link handling. Independent youth-coach and physical-device acceptance remain open; no publisher endorsement is claimed. See the [content standard](docs/COACHING_CONTENT_STANDARD.md) and [implementation source notes](docs/research/IMPLEMENTATION_SOURCE_NOTES.md).

## Workspaces

- **Board:** moving, passing, position/number labels, Pass/Run arrows, freehand drawing, history, Set start, Reset, named saving and PNG sharing.
- **Coaching:** five FIFA-linked activities filtered by published age band and topic; source details; spacing guides; attacking/defending half views; player visibility; My playbook with thumbnails, search, favorites, rename, duplicate, delete and editable-file backups.
- **Team:** quick anonymous setup or multiple named teams, optional roles to try, availability, roster editing, manual starting assignments, bench, short-handed setups and named lineups. A preview and explicit Apply to board are required; team edits alone preserve the current board. Teams and saved lineups can be copied or exported/imported.

Tab changes preserve the live board and history. Applying a lineup or opening an activity is undoable, including a field-format change. Sources use their native group sizes; the canvas preset does not turn a 2v1 into a 9v9 lesson. T means target and OFF means the inactive first defender in the U-10 sequence. The source's live practice conditions are explained; they are not enforced by a game simulation.

## Run

```bash
python3 -m http.server 8080   # from this folder
```

Or just double-click `index.html` — it works straight from disk. Open `http://localhost:8080` if serving. On a real iPhone it must be served over **HTTPS** (any static host — Netlify, GitHub Pages, Cloudflare Pages) for offline mode and Add to Home Screen.

For local browser development use `http://localhost:8080/?preview=1`; on loopback hosts this skips new service-worker registration. Use an otherwise-unused origin for that preview so an older installed worker cannot mask changes. The normal URL still installs the offline shell. `#board`, `#coaching` and `#team` open individual workspaces.

## GitHub Pages

Site: [Sideline](https://darthreckoner.github.io/Sideline/)

GitHub Pages publishes the root of the `main` branch. The `.nojekyll` file keeps this a plain static site; no build or dependency installation is required. Keep asset paths relative so the app, icons, manifest, and service worker work under `/Sideline/`.

To publish updates, commit the changed files and push `main` to [darthreckoner/Sideline](https://github.com/darthreckoner/Sideline). GitHub Pages deploys the changes automatically. Bump the cache version in `sw.js` whenever runtime files change. Each update caches a complete release in the background, then takes over after all existing Sideline tabs and windows close. Open online, close Sideline, and reopen to pick up a downloaded update.

## How it works

- **Pass:** tap any teammate of the player with the ball. One tap = one pass (animated).
- **Move:** drag any player or the ball. Drag the ball off a player for a shot or loose ball; drop it on a player to give them possession.
- **Player labels:** positions are the default. In Move mode, hold a player for about half a second to open its menu. Choose **Pos** and a position or **#** and a number (0–99), then **Apply**. Each marker has its own choice. A desktop right-click opens the same menu. Dragging, releasing early, or cancelling the gesture cancels the hold; opening the menu never passes the ball.
- **Change possession:** tap the ball, then any player (either team) or an open spot.
- **Demonstrate:** Set start → run the play → Reset. Set start and Reset both select Move. Reset restores the captured players, ball, drawings and colors; Undo brings the demo back. Repeat without recapturing the start.
- **Formation:** Team → Quick board setup offers independent Home/Away shapes: 3-3-2 or 3-2-3 for 9v9, 2-3-1 or 3-2-1 for 7v7. Reset both teams starts a fresh board with default labels, preserving colors and clearing drawings and demo start. Undo restores the previous board.
- **Draw:** Arrow shows Pass / Run choices, drawn as solid / dashed marks with a legend. Freehand Draw and Erase remain available. Move mode never draws.
- **Menu:** setup/workspace links, playbook, editable board export/import, full-field recovery, help and installation. Colors and formations live in Team.
- **Save:** named boards in the local playbook; old five-slot saves remain intact. Current board and demo start recover automatically after completed edits. Success is reported after storage transactions commit. **Share:** PNG via the iOS share sheet, with a download fallback and source attribution for activity illustrations.
- **Backup:** export a board, playbook or team as versioned JSON. Imports validate the entire file before applying; playbook and team imports create copies. Browser cleanup can still erase local data. Exported files are the recoverable backup.

Label edits are undoable and included in saved boards, demonstration snapshots and PNG exports. Older saved boards receive position labels from their saved formation (or its default) without moving their players. The 9v9 3-3-2 defaults are GK; LB, CB, RB; LM, CM, RM; LF, RF. Left/right follow each team's attacking direction. The menu also includes LW, RW and ST.

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

## v0.4 position labels

- Formation-specific position labels replace numbers on new boards.
- A stationary 550 ms hold in Move mode opens a compact, screen-bounded per-player editor with Pos / # choices. Numbers and positions remain independent of the marker's internal identity.
- Short taps and drags retain their passing/movement behavior. Undo/redo, demonstration reset, board save/load and PNG rendering include the label choices.

## Files

- `index.html`, `styles.css`, `app.js` — the app
- `workspace.js`, `data.js`, `storage.js` — workspaces, board/team validation and transactional local storage
- `coaching/situations.js` — verified FIFA reference metadata and original practice schematics
- `presets/soccer-field.js` — soccer-only field renderer
- `presets/soccer-9v9.js`, `presets/soccer-7v7.js` — runtime preset data; matching JSON files are their source copies
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA plumbing

## Adding a sport later

A preset registers in `window.SIDELINE_PRESETS` with an `id`, `name`, `playerCount`, `field` dimensions and renderer `type`, named `formations`, and a `defaultFormation`. Positions are field coordinates for Home; Away is mirrored across both field axes. Optional `positions` maps role abbreviations to names, and `formationPositions` provides one role per marker in each formation. Without role metadata, a preset defaults to number labels. The player nearest center starts with the ball. A renderer registers in `window.SIDELINE_FIELDS[type]` and draws only the field on the supplied canvas context.

Add the new preset and renderer scripts to `index.html` and the offline file list in `sw.js`, then bump the cache version. The format picker discovers registered presets automatically. Dragging, drawing, passing, undo, saved boards and demonstration reset share the same engine. Basketball and football presets are not included yet; sport-specific rules or objects may need additional work.

## Verification

Run `node --test tests/*.test.cjs` for board, data and offline-shell checks. The suite covers the existing gestures and labels plus native activity counts, source references, snapshots and import rejection, team identity/copies, assignment rules, bench/availability, cross-format Undo, hidden possession, inverse coordinates, transaction aborts and complete offline assets. Browser checks and screenshots are in the verification record. These do not establish real-device touch, teaching effectiveness or iOS acceptance.

## Still to test on a real iPhone

Outdoors in sunlight, one-handed: open, pass, drag, Set start, Reset — under 30 seconds. Hold a player, change Pos / #, and verify quick taps and drags do not open its menu. Check all three tabs, roster typing and lineup assignment, the save dialog, recovered draft, native board/team-file sharing and imports, Home Screen install, offline relaunch and PNG → Messages. Test a service-worker update with existing saves. Independent youth-coach review and on-field teaching checks are separate from these device checks.

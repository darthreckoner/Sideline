# Sideline v0.5: youth soccer coaching board

Sideline is a soccer whiteboard for iPhone, iPad and desktop. Use it to show your players where to move and pass, then take the idea onto the field. It works offline after setup and doesn't need an account. The board starts at 9v9; you can choose 7v7 under Team → Quick board setup. The published app is at [Sideline](https://darthreckoner.github.io/Sideline/); the deployment record is in [verification](docs/verification/2026-10-26/README.md).

Arrange the players, tap Set start, and show the play. Tap Reset to show it again. Coaching has activity ideas and your saved boards. Team is where you can build a roster and plan lineups. Everything stays on your device unless you export or share it. Match tracking, accounts, subscriptions, cloud sync, AI and animation timelines are outside this release.

The [soccer coaching plan](SOCCER_PLAN.md) and [team setup plan](TEAM_PLAN.md) describe the design. The [earlier screen concepts](docs/design/soccer-tabs/README.md) are design references. Current verification is recorded in [v0.5 checks](docs/verification/2026-10-26/README.md).

The five activity boards are Sideline illustrations based on FIFA youth lessons. Each shows the published ages and group size, with a link to the original lesson and an explanation of what the board leaves out. They aren't complete practices, and no FIFA endorsement is claimed. Independent youth-coach review and physical-device acceptance are still pending. Starting-shape, prescribed-triangle and goalkeeper-build-out lessons aren't included; FA candidates also remain outside this pack pending separate reuse and link handling. See the [content standard](docs/COACHING_CONTENT_STANDARD.md) and [source notes](docs/research/IMPLEMENTATION_SOURCE_NOTES.md).

## The three tabs

- **Board** is where you move players, pass, draw, save and share a picture.
- **Coaching** has five activities you can filter by age and topic, plus guides for the board and My playbook for saved boards. You can search, favorite, rename, copy, delete and export saved boards.
- **Team** lets you set up a board without a roster, or keep named teams, mark who's available, choose starters and save lineups. Once you've assigned a goalkeeper, you can leave other positions empty for a short-handed lineup. You can also copy, export or import teams.

Switching tabs keeps your board and undo history. Opening an activity or applying a lineup can be undone, even if it changes the field format. An activity keeps the group size from its source. For example, a 2v1 stays a 2v1 on the 9v9 board. T marks a target player; OFF marks the first defender who has stopped in the U-10 activity. The board shows an idea to discuss, so players still need to try the activity on the field.

When you're done with an activity, tap **Default field** beside its name on the board. That starts a fresh field in the current format and keeps your team colors. The activity's drawings and starting point are cleared; tap Undo to bring them back.

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

### Move and pass

Choose Move and drag any player or the ball. To pass, tap a teammate of the player with the ball. You can also drag the ball onto a player. To give it to anyone, tap the ball and then that player. Tap an open spot or drag the ball off a player to leave it loose.

Players show their positions at first. In Move mode, hold a player for about half a second, then choose **Pos** and a position or **#** and a number from 0 to 99. Tap Apply. On a computer, you can right-click instead. A short tap or drag won't open the label menu, and opening it won't pass the ball. Each player can have a different label; Undo reverses a change.

### Show a play

Put the players, ball and drawings where you want them, then tap Set start. Move or pass, and tap Reset to return to that starting point. Repeat as often as you like. Set start and Reset both select Move; Reset also restores the saved colors and drawings. Tap Undo to bring back the play you just showed.

Choose Arrow, then Pass for a solid arrow or Run for a dashed arrow. Swipe across the field to place it. Choose Draw to sketch or Erase to remove a line. Move mode won't draw.

### Choose a formation or lineup

In Team → Quick board setup, choose Home, Away or both and pick a formation. The 9v9 choices are 3-3-2 and 3-2-3; the 7v7 choices are 2-3-1 and 3-2-1. Reset both teams puts the players back in their default positions and labels, keeps the colors, and clears drawings and the saved starting point. Undo brings the previous board back.

To use a roster, add your players in Team, check who's available, and choose the starters. Check the lineup preview and tap Apply to board. Team edits alone don't change the board. After applying a lineup, tap Set start on the board if you want to demonstrate a play.

### Save, share and back up

Sideline saves your current board and starting point on this device after completed edits. Tap Save to give a board a name and find it later in Coaching → My playbook. Older five-slot saves stay intact. Share sends a PNG through the device's share sheet when available, or downloads it. Images of activities include their source attribution.

Export a board, playbook or team as an editable JSON file and keep it somewhere else. Browser cleanup can erase local saves, so an exported file is your backup. Sideline checks a whole file before importing it. Team and playbook imports create copies; opening an imported board replaces the current board, and Undo brings that board back.

Label edits are included in saved boards, starting points and PNGs. Older saved boards get position labels from their saved formation or its default without moving the players. The 9v9 3-3-2 defaults are GK; LB, CB, RB; LM, CM, RM; LF, RF. Left and right follow each team's attacking direction. The label menu also includes LW, RW and ST.

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

# Sideline v0.1 — implementation specification

Historical first-build specification. See `README.md` for current prototype behavior, including portrait support, one-tap passing, formation selection, and separate formation/demo resets.

## Audience and promise
Volunteer youth recreation coaches. Get from opening the board to demonstrating a 9v9 soccer play in under 30 seconds, one-handed on an iPhone outdoors. 7v7 is the secondary included format.

## Required behavior
- PWA, responsive on iPhone/iPad, accessible from HTTPS link without App Store install; offline when cached.
- iOS cannot be relied on to lock landscape: show rotate prompt with a bypass enabling portrait.
- Board engine is a single canvas renderer; field and formation data live in JSON presets, not duplicated feature frameworks.
- Two teams with 9 or 7 touch-sized numbered markers, team color inputs, movable ball.
- Tap current ball carrier, then teammate to pass; ball can be dragged and assigned to any player. A 9 CSS-pixel movement threshold distinguishes touch dragging from tapping.
- Explicit Move / Arrow / Draw / Erase modes; gestures in Move never write ink.
- Capture current state as demonstration start; reset restores captured setup, not formation. Reset is undoable.
- Undo/redo includes all player/ball moves, passes, ink edits, capture and reset.
- Five named IndexedDB local saved-board slots. Warn that browser/device storage can be cleared; home-screen installation is recommended, not a guaranteed backup.
- Share high-resolution PNG using Web Share API with File on supported devices; fallback to download.
- High-contrast sun-friendly board, large control and player hit regions, minimal steps.

## Manual iPhone acceptance test (outstanding)
1. Serve via HTTPS, open in iOS Safari, add to Home Screen, confirm offline restart works.
2. In direct sunlight, with one hand, create a 9v9 play, capture, tap-to-pass, drag, and reset; time under 30 seconds.
3. Tap and drag repeatedly to catch accidental passes/ink marks.
4. Save a named board, close and reopen, verify it persists. Check 7v7 switch.
5. Export PNG and use the native share sheet to send to Messages.
6. Rotate between portrait and landscape, test bypass, test all controls on small iPhone viewport.
7. Reset demonstration and Undo; verify previous demonstration state is restored.

## Not in scope
Accounts, payments, animations/timelines, AI, rosters, cloud sync.

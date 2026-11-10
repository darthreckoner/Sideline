# Local review: Sideline v0.6.0

Implemented locally on November 10, 2026. No commit, push, or deployment. The existing unpublished v0.5.10 mobile fixes are preserved. Physical iPhone/iPad and on-field acceptance remain open.

## Review

Open http://127.0.0.1:8102/?preview=1. This serves the working tree and skips service-worker registration. It uses local storage for this origin, separately from the published site.

1. Home opens the landing page from all workspaces and dialog headers. Open board resumes the current board; Default board creates the standard formation or applies the optional default starting lineup.
2. For a quick trial, import [demo-team.json](demo-team.json) through the existing import control. It contains a fictional team with nine starters and two substitutes. Open Team, choose Lineup, and Apply to board.
3. Optionally choose Use starting lineup as default board. Visit Home and choose Default board to check it.
4. Choose Match setup. Enter opponent and season, and set one-minute halves for a quick manual trial (or the intended 25 minutes). Prepare match, then Begin first half.
5. Tap an on-field player and a sub, in either order. The selected field player gets a gold ring. A completed swap transfers player time immediately, while the game clock continues. Tap the ball first to pass while using a roster.
6. At the half boundary, regulation time holds and the separate stoppage counter runs. End of half pauses all player time. Begin second half resumes at the regulation boundary with fresh stoppage time. End match saves the game.
7. Navigate through Home and other screens while running, pause/resume, and reload. Check Details for current player time, goals, corrections, and export. Tactical Reset and Undo preserve recorded match membership.
8. In Team, Game & season stats shows completed games and season totals. Expand a game to see player stats, remove a mistaken goal, or add a missed goal. Added historical goals have unknown timing explicitly recorded in the export.
9. Save a play, move markers, and choose Set position. Reset uses the session position. Reopening the play from the playbook restores its saved reset position. Save asks “Overwrite existing play?” and confirms “Play updated”. Cancel leaves the record unchanged.

The match ledger is stored separately in IndexedDB under `workspace/matches`. Teams and players retain stable IDs; roster edits do not rewrite historical snapshots. The optional default is a snapshot of the starting lineup when the option is selected. Export match records creates a separate JSON backup; importing that ledger is not implemented. Finish/discard a match before replacing its board or formation.

## Verification

- 66 automated tests passed: the original 60 plus six focused match-state tests. Coverage includes stoppage boundaries, halftime, pauses, exact substitution timing, serialization, invalid actions, goals, and aggregation.
- `tests/match.browser.cjs` passed in headless Chrome with an isolated browser profile and controlled clock: default lineup, actual canvas taps and sideline swaps, regulation/stoppage, both halves, Home navigation, tactical Reset/Undo, running and paused reload recovery, completed statistics, historical goal correction, and explicit play overwrite.
- The same workflow checked board/Home bounds at 375×667, 844×390, and 320×568. Screenshots in this folder were inspected; they are desktop renderings, not physical-device evidence.
- All 12 existing mobile browser checks passed, including scrolling, numeric editor/keyboard viewport cases, and offline reopen. Its current-version expectation now reflects 0.6.0.
- JavaScript syntax checks and Git whitespace checks passed.
- The local review server returned the current index and new match scripts successfully.

Run tests using Node and Playwright on `NODE_PATH`:

```powershell
node --test tests/*.test.cjs
node tests/match.browser.cjs
node tests/mobile-layout.browser.cjs
```

The pending What's new entry is in `releases.js` under 0.6.0. Both the retained 0.5.10 mobile changes and 0.6.0 need review before publication. No publication approval has been requested or inferred.

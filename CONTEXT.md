# Sideline continuity

- Static, dependency-free soccer coaching board; entry point is `index.html`.
- User authorized publication to GitHub Pages on 2026-10-25.
- Public repository: https://github.com/darthreckoner/Sideline
- Live site: https://darthreckoner.github.io/Sideline/
- GitHub Pages publishes the repository root from `main`; HTTPS is enforced.
- Initial deployment `fc31bc23c2b913b533b6688b2bf1ea0401feea8d` reached `built` on 2026-10-25. All nine runtime files returned HTTP 200 and matched their committed bytes; the board rendered correctly in the in-app browser.
- Local checks passed for JavaScript syntax, JSON, project-relative asset paths, manifest, icon dimensions, and service-worker cleanup preserving other apps' caches.
- Push changes to `main` to publish updates. The local checkout tracks `origin/main`.
- Real iPhone installation, offline relaunch, sunlight usability, and native sharing acceptance remain outstanding in `README.md`.
- v0.3 (2026-10-26) follows the user's focused youth-recreation brief: a parent/volunteer coach explains 9v9 positioning and movement in under a minute. Demonstrate = Set start → drag/pass → Reset; complex timelines, rosters, AI, accounts and cloud storage remain out of scope.
- Added selectable formations, separate undoable Reset formation, automatic Move mode for demonstrations, and a soccer-only field renderer behind the shared board controls. Existing 7v7 and old saved-board positions are preserved.
- Offline updates cache fresh files as a complete release and activate after existing Sideline windows close. Bump `sw.js`'s cache version for runtime changes.
- Verification on 2026-10-26: all 12 `node --test tests/*.test.cjs` checks passed; browser demo/pass/reset and native formation selection worked; desktop-rendered 667×375, 375×667 and 1024×768 layouts were inspected. The current board and formation menu reloaded with the local server stopped. This does not establish physical iPhone/iPad acceptance.

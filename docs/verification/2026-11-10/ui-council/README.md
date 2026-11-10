# UI council review - 2026-11-10

Local candidate accepted for screenshot design quality. No commit, push, PR or publication. Existing unpublished work preserved.

## Council review

Rounds: 4

| Delegate | Round 1 | Round 2 | Round 3 | Round 4 |
| --- | --- | --- | --- | --- |
| Astra High | 6.5/10 | 7.5/10 | 8.5/10 qualified | 9/10 |
| 6.1 Sol High | 6.5/10 | 7.5/10 | 8.5/10 | 9/10 |
| 6.1 Terra Max | 7/10 | 7.5/10 | 8/10 | 9/10 |

Round 1 scored the original green UI. Initial revisions mistakenly began before Terra returned; Terra isolated its original-build score. Subsequent rounds froze each candidate until all scores returned. Astra round 3 had incomplete Match coverage; round 4 completed it.

Graphite surfaces, clearer action hierarchy, roster-first Team, secondary management disclosure, full-row phone lineup selectors, consistent Board icons and reserved Home arrows. Match initialization race and close glyph corrected. Short portrait Board preserves 440px canvas and scrolls. In Move mode, empty-field touch swipes scroll without changing board state; player/ball drags and drawing modes retain their behavior.

Verification: 66/66 unit tests, 13 mobile browser checks, and match browser workflow pass. Astra and Sol independently reran full checks. Terra verified mobile checks plus paced touch scroll followed by substitution; its instantaneous synthetic-event attempt missed first substitute tap, paced repeat passed.

Round 4 inspected Home, Board, Coaching, populated Team and active Match at 1280x800, 390x844, 320x568 plus scrolled tools and lineups. Compact canvas 293x440; pitch approximately 273x440. All three found no confirmed design blockers. Optional preferences: compact Home title wrapping and balance of Match Details button. Product unchanged after reviews. Chrome simulation does not establish physical iPhone/iPad, sunlight or on-field acceptance. Publication and release-card approval remain open.

Evidence: sol-manifest.json and candidate-hashes.json.

## Screenshots

- [home-1280x800.png](home-1280x800.png)
- [board-1280x800.png](board-1280x800.png)
- [coaching-1280x800.png](coaching-1280x800.png)
- [team-1280x800.png](team-1280x800.png)
- [home-390x844.png](home-390x844.png)
- [board-390x844.png](board-390x844.png)
- [coaching-390x844.png](coaching-390x844.png)
- [team-390x844.png](team-390x844.png)
- [home-320x568.png](home-320x568.png)
- [board-320x568.png](board-320x568.png)
- [coaching-320x568.png](coaching-320x568.png)
- [team-320x568.png](team-320x568.png)
- [active-match-1280x800.png](active-match-1280x800.png)
- [active-match-390x844.png](active-match-390x844.png)
- [active-match-320x568.png](active-match-320x568.png)
- [board-scrolled-tools-320x568.png](board-scrolled-tools-320x568.png)
- [lineup-320x568.png](lineup-320x568.png)
- [lineup-scrolled-320x568.png](lineup-scrolled-320x568.png)
- [player-selected-320x568.png](player-selected-320x568.png)

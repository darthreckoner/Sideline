# Match-only UI council - 2026-11-10

All three requested reviewers scored the unchanged round 4 candidate 9/10 with no blocking findings. This review is separate from the earlier whole-app review. All delegates were read-only; all scores were collected before each revision. No commit, PR, push or publication.

## Council review

Rounds: 4

| Delegate | Round 1 | Round 2 | Round 3 | Round 4 |
| --- | --- | --- | --- | --- |
| Astra High | 7.5/10 | 9/10 | 9/10 | 9/10 |
| 6.1 Sol High | 7.5/10 | 9/10 | 9/10 | 9/10 |
| 6.1 Terra Max | 7/10 | 8.5/10 | 8.5/10 | 9/10 |

## Implemented improvements

Sticky clock/score and explicit match phase, clearer action hierarchy, named substitution selection and completed-swap feedback, Cancel repaint, keyboard-operable on-field selection, direct setup prerequisites with substitutions unavailable until preparation, grouped goal choices, quiet destructive discard, and phone Details tables with pinned player identity. Long names wrap within a bounded 140px column; player picker refresh includes roster names and numbers after match replacement. Match stays separate from teaching Board.

## Evidence and limits

The three Match browser suites and 67 unit tests passed. New regressions reproduce long-name table obstruction and stale names before fixes, then pass at 320/390. Other checks cover match timing, halves, goals, reload, substitutions, Board isolation, selection cancellation and keyboard selection. Screens reviewed at 1280x800, 390x844 and 320x568 include ready/running/halftime/Details/selected bench. All retained Sol candidate source hashes rechecked equal current files at completion.

Optional polish remains: compact scrolling, spare desktop space and intermediate Time played column partially hidden behind pinned identity at full-right scroll. Goals remains readable; swiping back reveals intermediate metrics. All reviewers accepted these limits. Browser simulation does not establish physical-device, sunlight or on-field acceptance. Release text approval and publication remain pending.

## Retained screenshot set

- [1280-details-right.png](1280-details-right.png)
- [1280-goal-picker.png](1280-goal-picker.png)
- [1280-halftime.png](1280-halftime.png)
- [1280-ready.png](1280-ready.png)
- [1280-running.png](1280-running.png)
- [1280-selected.png](1280-selected.png)
- [320-details-right.png](320-details-right.png)
- [320-goal-picker.png](320-goal-picker.png)
- [320-halftime.png](320-halftime.png)
- [320-ready.png](320-ready.png)
- [320-running.png](320-running.png)
- [320-selected.png](320-selected.png)
- [390-details-right.png](390-details-right.png)
- [390-goal-picker.png](390-goal-picker.png)
- [390-halftime.png](390-halftime.png)
- [390-ready.png](390-ready.png)
- [390-running.png](390-running.png)
- [390-selected.png](390-selected.png)

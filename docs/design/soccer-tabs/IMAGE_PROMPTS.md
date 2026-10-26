# Sideline proposed screen image prompts

Generated with the built-in image_gen tool using the imagegen skill. These are UI concepts, not screenshots of implemented features. The palette comes from the existing app. Rivers FC U12 and its players are fictional examples. Board and Coaching received the targeted refinements recorded below; the selected final images use the stable filenames in the screen index.

## 01-board

Output: `01-board.png`

```text
Use case: ui-mockup.
Asset type: high-fidelity proposed Sideline youth soccer coaching PWA interface, for a design review.
Style: polished, realistic, implementable app UI screenshot, flat straight-on, precise layout, crisp large sans-serif system typography, readable English, generous touch targets. No photoreal scene, no hand, no advertising, no ornamental 3D. Use the app's existing palette: darkest forest green #0b2a22 background, #14392f panels, #1d4a3d raised cards, #eef5ea main text, #b9cdc1 secondary text, lime #d9f99d active accents, amber #ffcb54 home markers and primary board action, sky blue #5dc2ff opposing markers, pitch green #1c6749. Restrained rounded corners and fine green borders.
Navigation invariant: exactly three app-level tabs with icon AND exact text "Board", "Coaching", "Team", in that order, always visible. Clearly highlight only the selected tab. No other global tabs. Mobile uses bottom tabs with a safe-area inset; tablet also uses the same bottom tabs. Mark "CONCEPT" subtly outside the app screenshot, not as an app control.
All data are fictional design examples. Team name "Rivers FC U12", 9v9, twelve squad players, nine starting and three bench. No accounts, no cloud sync, no AI, no subscriptions, no score, no match clock, no performance analytics, no video. No clipped text. No random decorative charts.
Primary request: one single portrait mobile screen for Sideline's default Board tab, demonstrating that the live soccer whiteboard stays its own simple workspace. Render as a full-bleed app screenshot with a tiny neutral outer margin, no device hardware frame. Portrait composition around 1024x1536, sharp enough for reading.
Header: exact word "Sideline", compact "9v9" chip, subtle "Rivers FC U12" secondary label.
Content: the majority of the screen is a rectangular vertical full soccer pitch with correct halfway line, central circle, penalty areas and goals. Show exactly nine amber home markers starting in a 3-3-2 shape including GK at bottom and exactly nine blue opponents mirrored toward top. Amber position labels "GK", "LB", "CB", "RB", "LM", "CM", "RM", "LF", "RF". Blue markers have the same set. Keep dots readable and avoid overlap. A white ball next to amber CM. A small solid directional arrow and one dashed movement arrow around midfield illustrate passing and running without crowding. Subtle upward home attacking-direction cue.
Under the pitch, compact functional control grid in two rows of six large touch controls: first row "Move", "Arrow", "Draw", "Erase", "Undo", "Redo"; second row "Set start", "Reset", "Clear ink", "Save", "Share", "Menu". Move is selected. Keep labels readable, allow Set start/Clear ink to wrap onto two lines. Keep all twelve controls distinct. No roster lists or teaching library on this tab.
Bottom navigation: exactly "Board", "Coaching", "Team"; Board selected lime, the other two muted. Plain icons above labels. Do not add nested tabs. Prioritize the pitch and easy-to-reach board controls.
```

## 02-coaching

Output: `02-coaching.png`

```text
Use case: ui-mockup.
Asset type: high-fidelity proposed Sideline youth soccer coaching PWA interface, for a design review.
Style: polished, realistic, implementable app UI screenshot, flat straight-on, precise layout, crisp large sans-serif system typography, readable English, generous touch targets. No photoreal scene, no hand, no advertising, no ornamental 3D. Use the app's existing palette: darkest forest green #0b2a22 background, #14392f panels, #1d4a3d raised cards, #eef5ea main text, #b9cdc1 secondary text, lime #d9f99d active accents, amber #ffcb54 home markers and primary board action, sky blue #5dc2ff opposing markers, pitch green #1c6749. Restrained rounded corners and fine green borders.
Navigation invariant: exactly three app-level tabs with icon AND exact text "Board", "Coaching", "Team", in that order, always visible. Clearly highlight only the selected tab. No other global tabs. Mobile uses bottom tabs with a safe-area inset; tablet also uses the same bottom tabs. Mark "CONCEPT" subtly outside the app screenshot, not as an app control.
All data are fictional design examples. Team name "Rivers FC U12", 9v9, twelve squad players, nine starting and three bench. No accounts, no cloud sync, no AI, no subscriptions, no score, no match clock, no performance analytics, no video. No clipped text. No random decorative charts.
Primary request: one single portrait mobile screen showing the proposed Coaching tab library and a selected teachable moment. Full-bleed flat app screenshot with tiny neutral outer margin and no device hardware frame; same visual family as the Board screen. Portrait composition around 1024x1536, readable large type.
Header exact "Coaching", subheading "One idea. Show it. Try it." Keep this a library browsing screen, not a live board.
Below header a local two-option selector "Situations" (selected) and "My playbook", then format filter chips "7v7" and "9v9" with 9v9 selected.
A compact closed row titled "Teaching aids" with secondary text "Guides · Focus view · Visible players" and a chevron.
Main content: "8 soccer situations" label and a vertically scrollable list. The first card is expanded: title "Pass and support", a clean mini-pitch diagram with three amber player circles arranged in a triangle, one blue defender, a white ball, a solid pass arrow and a dashed support-run arrow; concise legend "Pass" solid line, "Run" dashed line. Cue exactly "Pass, then find a new passing lane." Prompt exactly "Where can you help after the pass?" A large lime CTA "Open on board". The expanded card should fit without a modal or overlay.
Two smaller cards below: "Create width" with subtitle "Make space for the ball carrier"; "Defend together" with subtitle "Pressure and cover". Each has a simple miniature pitch drawing and a subtle chevron. Show continuation of list through a quiet scroll affordance, not illegibly tiny text.
Bottom navigation exactly "Board", "Coaching", "Team"; Coaching selected. No profile setup, roster or lineup list on this screen. No autoplay or video controls. This screen chooses a situation; the button explicitly opens it on the separate Board tab.
```

## 03-team-setup

Output: `03-team-setup.png`

```text
Use case: ui-mockup.
Asset type: high-fidelity proposed Sideline youth soccer coaching PWA interface, for a design review.
Style: polished, realistic, implementable app UI screenshot, flat straight-on, precise layout, crisp large sans-serif system typography, readable English, generous touch targets. No photoreal scene, no hand, no advertising, no ornamental 3D. Use the app's existing palette: darkest forest green #0b2a22 background, #14392f panels, #1d4a3d raised cards, #eef5ea main text, #b9cdc1 secondary text, lime #d9f99d active accents, amber #ffcb54 home markers and primary board action, sky blue #5dc2ff opposing markers, pitch green #1c6749. Restrained rounded corners and fine green borders.
Navigation invariant: exactly three app-level tabs with icon AND exact text "Board", "Coaching", "Team", in that order, always visible. Clearly highlight only the selected tab. No other global tabs. Mobile uses bottom tabs with a safe-area inset; tablet also uses the same bottom tabs. Mark "CONCEPT" subtly outside the app screenshot, not as an app control.
All data are fictional design examples. Team name "Rivers FC U12", 9v9, twelve squad players, nine starting and three bench. No accounts, no cloud sync, no AI, no subscriptions, no score, no match clock, no performance analytics, no video. No clipped text. No random decorative charts.
Primary request: one single landscape tablet screen of the proposed Team tab with setup, roster management and a planned lineup visible together. Flat front-on full-bleed app screenshot with tiny neutral outer margin, no hardware frame. Landscape tablet composition around 2048x1536; comfortably readable system UI.
Header left exact "Team setup", secondary team title "Rivers FC U12". Header right two compact buttons "Team settings" and "Export team". Below, a slim settings strip "9v9" and "3-3-2" selectors plus a gold team-color swatch labeled "Team color".
Split content into a roster column taking about 40 percent width and lineup preview about 60 percent.
Roster column header "Roster" and small "12 players", with "+ Add player" button. Secondary label "Available today" with small checkmarks beside names. Display these fictional rows in a compact but readable list, all marked available: "#1 Maya · GK", "#2 Noah · LB", "#3 Ava · CB", "#4 Leo · RB", "#5 Isla · LM", "#6 Finn · CM", "#7 Ruby · RM", "#8 Owen · LF", "#9 Eli · RF", "#10 Sam", "#11 Milo", "#12 Alex". Subtle edit pencil per row. Rows 10-12 have a small muted "Bench" tag, rows 1-9 have no bench tag. The names and jersey numbers are examples, not photos.
Right column header "Lineup", secondary "9 starting · 3 bench", then a full vertical soccer pitch scaled to fit with exactly NINE amber player circles and short labels; show 3-3-2 and goalkeeper. From bottom upward: "#1 GK"; line "#2 LB", "#3 CB", "#4 RB"; line "#5 LM", "#6 CM", "#7 RM"; top "#8 LF", "#9 RF". Amber attacks upward. No blue opponents on this team preview. Under pitch show "Bench" and three pill chips "#10 Sam", "#11 Milo", "#12 Alex". Clearly connect roster to lineup without spaghetti connector arrows.
At the lower right a prominent lime action "Apply to board", and small helper copy "Your board changes only when you apply." Small saved status near team heading "Saved on this device". This is lineup setup; no live substitutions or match timer.
Bottom navigation across tablet exactly "Board", "Coaching", "Team"; Team selected. Keep all controls, all nine pitch markers, all twelve roster names and all three bench chips visible with comfortable spacing.
```

## Targeted refinement prompts

### 01-board-final

```text
Use case: precise-object-edit / ui-mockup. Edit the referenced Sideline Board UI concept, retaining the same portrait composition, exact app styling, layout, header, pitch, all twelve control buttons, all three navigation tabs, amber player markers and text. Make only these soccer diagram corrections: there must be exactly NINE blue opponent markers, currently the right-side midfield marker is missing. Add the missing sky-blue midfielder in the open right-side midfield position at about x=737,y=369 of this 1024x1536 image. Because blue attacks downward, its viewer-left defenders/midfield/forward labels are RB, RM, RF, while its viewer-right labels are LB, LM, LF. Swap the existing blue outside role labels accordingly; blue GK, CB and CM stay centered. Keep all nine amber markers unchanged in a 3-3-2. Retain the amber CM-to-LM solid pass arrow. Redirect the amber dashed run arrow from CM toward empty space at about x=580,y=605, not into the occupied RF marker; it illustrates the passer moving to offer support after passing. Add a small unobtrusive legend on an unused lower-left pitch area reading exactly "Pass" beside a solid arrow and "Run" beside a dashed arrow; do not obscure any marker. All other typography, controls, navigation and spacing stay exactly as the original. This is a concept screenshot; do not add extra UI or recreate the layout.
```

### 02-coaching-final

```text
Use case: precise-object-edit / ui-mockup. Edit the referenced Sideline Coaching UI concept. Preserve the exact portrait layout, palette, cards, all tabs, all buttons, all player markers, ball, solid pass arrow, cue, question and all other text. Make two tightly targeted clarity fixes: replace the subtitle under "Coaching" with the exact words "Positioning, passing and movement", fitting cleanly on one line or two natural lines. In ONLY the expanded "Pass and support" card's main mini-pitch, remove the old dashed arrow that starts from the upper amber receiver and ends at the lower-right amber player. Draw a new dashed Run arrow from the ORIGINAL PASSER at the lower-left (next to the white ball, about x=229,y=731 in this 1024x1536 image), curving down and right into EMPTY space around x=335,y=790. Keep the solid Pass arrow from that original passer toward the upper amber receiver exactly as-is. Keep the three amber markers and one blue defender in their current positions. The two arrows now mean: pass the ball upward, then the same original passer moves to a new open support position. The new dashed arrow must NOT terminate on any existing player. Keep the "Pass" solid / "Run" dashed legend, and the "Open on board" action. Do not alter the smaller cards or add controls.
```

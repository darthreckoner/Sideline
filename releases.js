// Append a new entry for each release, oldest first. Keep these entries so
// coaches who skip releases can see what changed since their last visit.
window.SIDELINE_RELEASES = [
  {
    version: "0.5.9",
    changes: [
      "Choose your team and show defensive lines or offensive triangles that follow players as you move them.",
      "Your team's dots are slightly smaller.",
      "Reset returns to default positions even when you haven't set a start.",
      "The ball now has a soccer-ball look.",
      "Send feedback from the Board menu.",
      "Find this list again under What's new in the Board menu.",
    ],
  },
  {
    version: "0.5.10",
    changes: [
      "Scroll over the lineup field to reach the player list below it without getting stuck.",
      "Edit player numbers in landscape with the number field and Apply button above the keyboard.",
    ],
  },
  {
    version: "0.6.0",
    changes: [
      "Match status stays visible while scrolling. Details keeps even long player names visible beside scrolling stats and uses consistent match-phase labels. Player choices refresh after roster edits between matches. Selected player names, swap confirmation and keyboard selection make substitutions clearer; Cancel clears the highlight.",
      "Board is the landing screen. Board, Team, Match and Coaching stay available in the bottom navigation.",
      "Match has its own pitch, clock, score and substitutes, separate from Board teaching tools. Prepare its lineup in Team.",
      "Select a substitute and an on-field player in Match to swap them, independently of the Board drawing mode.",
      "Choose Pos or # in the Board menu to change My team labels at once. Opponents keep their labels and remain individually editable. Undo restores your previous labels.",
      "Popups and the Board menu have a visible Close button, with workspace tabs kept in the main navigation.",
      "Phone match actions stay visible, substitutes sit below the pitch, and the field stays upright in portrait. In Move mode on short phones, swipe empty field to scroll while dragging players still moves them. On short phones, scroll the board to use a larger pitch and reach its tools. Lineup selectors use a full row to show more of each name. A calmer interface puts your roster and lineup first, with clearer controls and quieter navigation.",
      "Match setup opens reliably when local records finish loading before the match controls.",
      "Choose a saved starting lineup as your default board, available from the Board menu.",
      "Track matches with configurable halves, a count-up clock, separate stoppage time, and explicit end-of-half controls.",
      "See substitutes beside the pitch. Tap an on-field player and a substitute to swap them and transfer playing-time tracking.",
      "Record and correct goals, save completed matches, and view player time and goals by game and named season for each team.",
      "Match time keeps running across screens and reloads until you pause it. Export match records from match details or team stats.",
      "Set start is now Set position. Reset restores the selected play's position; saving changes to an existing play asks before overwriting it.",
    ],
  },
];

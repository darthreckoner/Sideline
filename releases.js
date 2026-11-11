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
    version: "0.6.0",
    changes: [
      "New Offside button: shades each team's offside zone from the last defender, and offside attackers pulse red as you move them.",
    ],
  },
  {
    version: "0.7.0",
    changes: [
      "New Match tab: run the clock by half, track stoppage time, record goals and make substitutions while playing time is tracked for every player.",
      "See each player's minutes and goals by game and by season in Team → Game & season stats, and export match records.",
      "Team setup is one page: roster first, then lineup. Save a starting lineup as your default board.",
      "Choose home and away kit colors for your team and opponent from a shared palette.",
      "Quick board setup sits at the top of Board, no roster needed. Set start is now Set position.",
      "A cleaner, calmer look: sharper match field, grouped Board menu, clearer buttons and icons in the bottom tabs.",
    ],
  },
];

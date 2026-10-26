// Source references plus original schematics. No publisher media or lesson text.
(function (root) {
  const sources = {
    give: { publisher: "FIFA Training Centre", title: "Give and go", date: "2023-03-14", url: "https://www.fifatrainingcentre.com/en/practice/grassroots/8-to-12/give-and-go.php" },
    keep: { publisher: "FIFA Training Centre", title: "The art of keeping the ball", date: "2023-03-28", url: "https://www.fifatrainingcentre.com/en/practice/grassroots/8-to-12/the-art-of-keeping-the-ball.php" },
    target: { publisher: "FIFA Training Centre", title: "Playing the final pass", date: "2023-04-11", url: "https://www.fifatrainingcentre.com/en/practice/grassroots/8-to-12/playing-the-final-pass.php" },
    overload: { publisher: "FIFA Training Centre", title: "Developing core skills with Clearwater Chargers U-10", date: "2025-06-03", url: "https://www.fifatrainingcentre.com/en/practice/grassroots/global-grassroots-insights/u-10-clearwater-core-skills-1v1.php", coach: "Juan de Brigard" },
  };
  const line = (x, y, x2, y2, type = "line") => ({ type, a: { x, y }, b: { x: x2, y: y2 } });
  const square = line(260, 70, 740, 550, "rect");
  const area = line(90, 70, 910, 550, "rect");
  const players = (home, away = []) => [...home.map(([x, y, position = ""], i) => ({ id: `h${i}`, team: "home", n: i + 1, x, y, position, display: position ? "position" : "number" })), ...away.map(([x, y, position = ""], i) => ({ id: `a${i}`, team: "away", n: i + 1, x, y, position, display: position ? "position" : "number" }))];
  const common = { checked: "2026-10-26", adaptation: "Sideline drew this moment and chose the player positions and questions. This isn't FIFA's diagram or the full practice. A youth coach has not yet independently approved this version.", ages: "8–12", ageMin: 8, ageMax: 12 };
  root.SIDELINE_SITUATIONS = [
    { ...common, id: "A01", title: "Pass, then move", topic: "Passing", size: "4 players · group of up to 6", source: sources.give, section: "Skill development: Pass and move",
      cue: "Make your pass, then move to a new spot.", question: "Where could you go after you pass?",
      conditions: "Inside a square, players pass with their feet in number order. Move after each pass. Running around cones comes later in the activity.",
      changes: "The board shows four players doing the first foot-passing exercise. It doesn't add a defender or the later cone-running exercise. Any routes are examples, not required moves.",
      players: players([[340, 420], [370, 155], [650, 170], [640, 460]]), markings: [square],
    },
    { ...common, id: "A02", title: "Find width through a gate", topic: "Space", size: "5v5", source: sources.give, section: "Game application: small-sided game",
      cue: "Look wide for a way forward.", question: "Which gate could give us room to attack?",
      conditions: "Before scoring, the team must pass or dribble through either wide gate.",
      changes: "The board shows one possible moment with two gates and five players on each side. The numbers don't set a formation.",
      players: players([[130, 310], [340, 130], [430, 310], [340, 495], [700, 300]], [[865, 310], [670, 155], [580, 330], [690, 490], [460, 410]]),
      markings: [line(20, 20, 980, 600, "rect"), line(20, 245, 20, 375, "goal"), line(980, 245, 980, 375, "goal"), line(500, 65, 500, 165, "gate"), line(500, 455, 500, 555, "gate")],
    },
    { ...common, id: "A03", title: "Spread out to keep possession", topic: "Space", size: "6v6", source: sources.keep, section: "Skill development: 6v6 possession game",
      cue: "Move into space so your teammate has another pass.", question: "Where could you receive the ball with some room?",
      conditions: "A team earns a point by completing an agreed number of passes. FIFA starts the activity with the hands and later moves to the feet. The board shows foot passing.",
      changes: "The board shows two teams of six in a marked area, with more than one passing option. It doesn't teach a fixed triangle or full-team formation, and there are no goals.",
      players: players([[180, 300], [310, 130], [520, 150], [790, 220], [700, 460], [350, 480]], [[270, 330], [400, 200], [660, 130], [770, 350], [540, 440], [450, 310]]), markings: [area],
    },
    { ...common, id: "A04", title: "Help a target player", topic: "Passing", size: "6v6 · 5 players + 1 target per team", source: sources.target, section: "Skill development: 6v6, ball to captain, 2 goals",
      cue: "Find a way to get the ball to your target.", question: "How could you make a clear path to the target?",
      conditions: "Each team has five players in the middle and a target in an end zone. Only the target can score. Rotate the target role after attempts.",
      changes: "The board shows both targets and all three zones. It leaves out the added goalkeepers, waiting players and heading variations.",
      players: players([[300, 130], [350, 420], [470, 280], [650, 160], [670, 470], [875, 310, "T"]], [[710, 350], [570, 150], [560, 470], [350, 260], [290, 490], [125, 310, "T"]]),
      markings: [line(20, 20, 980, 600, "rect"), line(20, 245, 20, 375, "goal"), line(980, 245, 980, 375, "goal"), line(200, 20, 200, 600), line(800, 20, 800, 600)],
    },
    { ...common, id: "A05", title: "See the second attacker", topic: "Decisions", ages: "U-10", ageMin: null, ageMax: null, size: "1v1 → 2v1 · 4 players in the sequence", source: sources.overload, section: "Part 2: 1v1 and 2v1 small-sided game",
      cue: "Look up when your teammate joins the attack.", question: "Now that you have help, what could you do?",
      conditions: "Start with one attacker against one defender. When the attacker crosses halfway, that defender stops and another attacker and defender join. Now two attackers face one active defender.",
      changes: "The board shows the second part of the 30×40 m activity, with four mini-goals and the first defender stopped. It leaves out the waiting players and the moment the other players enter.",
      players: players([[570, 290], [720, 465]], [[350, 280, "OFF"], [780, 280]]),
      markings: [area, line(500, 70, 500, 550), line(90, 140, 90, 215, "goal"), line(90, 405, 90, 480, "goal"), line(910, 140, 910, 215, "goal"), line(910, 405, 910, 480, "goal")],
    },
  ];
})(window);

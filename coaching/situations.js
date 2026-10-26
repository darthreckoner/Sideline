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
  const common = { checked: "2026-10-26", adaptation: "Original Sideline schematic of a selected moment. Positions and questions are ours; this is not the publisher's diagram or a complete practice. Independent youth-coach acceptance is pending.", ages: "8–12", ageMin: 8, ageMax: 12 };
  root.SIDELINE_SITUATIONS = [
    { ...common, id: "A01", title: "Pass, then move", topic: "Passing", size: "4 players · group of up to 6", source: sources.give, section: "Skill development: Pass and move",
      cue: "Release the ball, then find your next place.", question: "What space opens after your pass?",
      conditions: "Foot passes follow player numbers inside a square. Move after releasing; cone-running is a later progression.",
      changes: "Four players illustrate the base foot-passing activity. No blocker or cone-running progression is added. Routes are optional examples.",
      players: players([[340, 420], [370, 155], [650, 170], [640, 460]]), markings: [square],
    },
    { ...common, id: "A02", title: "Find width through a gate", topic: "Space", size: "5v5", source: sources.give, section: "Game application: small-sided game",
      cue: "Use width to make a route forward.", question: "Which gate gives us space to attack?",
      conditions: "Use either wide gate by passing or dribbling before scoring.",
      changes: "Two gates and five players per side show one possible moment. Numbered markers do not prescribe a formation.",
      players: players([[130, 310], [340, 130], [430, 310], [340, 495], [700, 300]], [[865, 310], [670, 155], [580, 330], [690, 490], [460, 410]]),
      markings: [line(20, 20, 980, 600, "rect"), line(20, 245, 20, 375, "goal"), line(980, 245, 980, 375, "goal"), line(500, 65, 500, 165, "gate"), line(500, 455, 500, 555, "gate")],
    },
    { ...common, id: "A03", title: "Spread out to keep possession", topic: "Space", size: "6v6", source: sources.keep, section: "Skill development: 6v6 possession game",
      cue: "Create another option before the ball arrives.", question: "Where could a teammate receive with room?",
      conditions: "Connect an agreed pass total for a point. This moment uses feet; the source introduces the activity with hands.",
      changes: "A bounded, opposed six-a-side moment shows multiple options. No fixed triangle, goals or full-team formation is taught.",
      players: players([[180, 300], [310, 130], [520, 150], [790, 220], [700, 460], [350, 480]], [[270, 330], [400, 200], [660, 130], [770, 350], [540, 440], [450, 310]]), markings: [area],
    },
    { ...common, id: "A04", title: "Help a target player", topic: "Passing", size: "6v6 · 5 + target per side", source: sources.target, section: "Skill development: 6v6, ball to captain, 2 goals",
      cue: "Help the target become reachable.", question: "How can you create a clear route to the target?",
      conditions: "Five per side combine centrally. Only the end-zone target scores; rotate that role after attempts.",
      changes: "Both targets and three zones are shown. Added goalkeepers, queues and heading variations are omitted.",
      players: players([[300, 130], [350, 420], [470, 280], [650, 160], [670, 470], [875, 310, "T"]], [[710, 350], [570, 150], [560, 470], [350, 260], [290, 490], [125, 310, "T"]]),
      markings: [line(20, 20, 980, 600, "rect"), line(20, 245, 20, 375, "goal"), line(980, 245, 980, 375, "goal"), line(200, 20, 200, 600), line(800, 20, 800, 600)],
    },
    { ...common, id: "A05", title: "See the second attacker", topic: "Decisions", ages: "U-10", ageMin: null, ageMax: null, size: "1v1 → 2v1 · 4 sequence players", source: sources.overload, section: "Part 2: 1v1 and 2v1 small-sided game",
      cue: "Look for the teammate who has joined the attack.", question: "What has changed now that you have support?",
      conditions: "After the attacker crosses halfway, the first defender stops. A second attacker and defender join the 2v1.",
      changes: "Selected second-half moment of the 30×40 m activity: four mini-goals and an inactive first defender remain visible. Waiting players and automatic activation are omitted.",
      players: players([[570, 290], [720, 465]], [[350, 280, "OFF"], [780, 280]]),
      markings: [area, line(500, 70, 500, 550), line(90, 140, 90, 215, "goal"), line(90, 405, 90, 480, "goal"), line(910, 140, 910, 215, "goal"), line(910, 405, 910, 480, "goal")],
    },
  ];
})(window);

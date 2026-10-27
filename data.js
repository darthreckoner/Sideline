// Serializable board and team rules shared by the UI, local storage and file imports.
(function (root) {
  "use strict";
  const copy = (value) => structuredClone(value);
  const fail = (message) => { throw Error(message); };
  const text = (value, max = 80) => typeof value === "string" && value.length <= max;
  const point = (p, field) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= field.width && p.y <= field.height;
  const color = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  const id = () => root.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function readBoard(input, presets) {
    if (!input || !Object.hasOwn(presets, input.format)) fail("This board's field format is unavailable.");
    const preset = presets[input.format], field = preset.field;
    if (!Array.isArray(input.players) || input.players.length < 1 || input.players.length > 36) fail("Invalid player list.");
    const board = copy(input), ids = new Set();
    if (board.formation != null && !Object.hasOwn(preset.formations, board.formation)) fail("Unknown formation.");
    if (board.formations && ["home", "away"].some((side) => !Object.hasOwn(preset.formations, board.formations[side]))) fail("Unknown team formation.");
    for (const p of board.players) {
      if (!text(p.id) || !p.id || ids.has(p.id) || !["home", "away"].includes(p.team) || !point(p, field)) fail("Invalid player identity or position.");
      if (!Number.isInteger(p.n) || p.n < 0 || p.n > 99 || (p.position != null && !text(p.position, 24))) fail("Invalid player label.");
      if (p.display != null && !["position", "number"].includes(p.display)) fail("Invalid label display.");
      if (p.name != null && !text(p.name, 48)) fail("Invalid player name.");
      ids.add(p.id);
    }
    if (!board.ball || !point(board.ball, field) || (board.ball.carrier != null && !ids.has(board.ball.carrier))) fail("Invalid ball or possession.");
    if (board.players.find((p) => p.id === board.ball.carrier)?.hidden) fail("A hidden player cannot hold the ball.");
    if (!color(board.colors?.home) || !color(board.colors?.away)) fail("Invalid team colors.");
    if (!Array.isArray(board.ink) || board.ink.length > 200) fail("Too many drawings.");
    for (const ink of board.ink) {
      if (ink.type === "arrow") {
        if (!point(ink.a, field) || !point(ink.b, field) || (ink.kind && !["pass", "run"].includes(ink.kind))) fail("Invalid arrow.");
      } else if (ink.type !== "pen" || !Array.isArray(ink.points) || ink.points.length > 4000 || !ink.points.every((p) => point(p, field))) fail("Invalid drawing.");
    }
    if (board.markings != null && (!Array.isArray(board.markings) || board.markings.length > 40 || board.markings.some((m) => !["rect", "line", "gate", "goal"].includes(m.type) || !point(m.a, field) || !point(m.b, field)))) fail("Invalid practice markings.");
    if (board.guides && !["none", "thirds", "lanes"].includes(board.guides)) fail("Invalid spacing guide.");
    if (board.view && !["full", "attack", "defense"].includes(board.view)) fail("Invalid field view.");
    if (board.teachingTeam && !["home", "away"].includes(board.teachingTeam)) fail("Invalid teaching team.");
    if (board.shapeLines != null) {
      const shape = board.shapeLines, team = board.teachingTeam || "home";
      if (typeof shape !== "object" || Array.isArray(shape) || typeof shape.enabled !== "boolean" || !["defense", "offense"].includes(shape.mode) || !Array.isArray(shape.triangles) || shape.triangles.length > 70) fail("Invalid team lines.");
      if (shape.triangles.some((triangle) => !Array.isArray(triangle) || triangle.length !== 3 || new Set(triangle).size !== 3 || triangle.some((id) => !board.players.some((p) => p.id === id && p.team === team)))) fail("Invalid triangle players.");
    }
    if (board.activity != null) {
      const a = board.activity;
      if (!["A01", "A02", "A03", "A04", "A05"].includes(a.id) || !text(a.title, 80)) fail("Unknown coaching activity.");
      if (a.revision != null && a.revision !== 1) fail("This coaching illustration revision is not available.");
      // Reference details come from the installed catalog, never HTML or URLs in an import.
      board.activity = { id: a.id, title: a.title, revision: 1, edited: !!a.edited };
    }
    return board;
  }

  function readSnapshot(input, presets) {
    const board = readBoard(input?.board, presets);
    const start = input.start ? readBoard(input.start, presets) : null;
    if (start && start.format !== board.format) fail("The demo start uses a different field.");
    return { board, start };
  }

  function readFile(raw, presets) {
    if (typeof raw !== "string" || raw.length > 2_000_000) fail("Choose a Sideline file smaller than 2 MB.");
    let doc;
    try { doc = JSON.parse(raw); } catch { fail("This file is not valid JSON."); }
    if (doc.version !== 1) fail("This file version is not supported by this Sideline release.");
    if (doc.kind === "sideline-board") return { kind: doc.kind, name: text(doc.name, 80) ? doc.name : "Imported board", snapshot: readSnapshot(doc.snapshot, presets) };
    if (doc.kind === "sideline-playbook") {
      if (!Array.isArray(doc.boards) || doc.boards.length > 100) fail("A playbook can import at most 100 boards at once.");
      return { kind: doc.kind, boards: doc.boards.map((b) => ({ name: text(b.name, 80) ? b.name : "Imported board", snapshot: readSnapshot(b.snapshot, presets) })) };
    }
    if (doc.kind === "sideline-team") return { kind: doc.kind, team: readTeam(doc.team, presets) };
    fail("Choose a Sideline board, playbook or team file.");
  }

  function newTeam(presets) {
    const format = presets["9v9"] ? "9v9" : Object.keys(presets)[0];
    return { id: id(), name: "My team", format, formation: presets[format].defaultFormation, color: "#ffcb54", roster: [], assignments: Array(presets[format].playerCount).fill(null), shortHanded: false };
  }

  function readTeam(input, presets) {
    if (!input || !text(input.id) || !input.id || !Object.hasOwn(presets, input.format) || !text(input.name, 48) || !color(input.color)) fail("Invalid team settings.");
    const preset = presets[input.format];
    if (!Object.hasOwn(preset.formations, input.formation) || !Array.isArray(input.roster) || input.roster.length > 40) fail("Invalid roster or formation.");
    const team = copy(input), ids = new Set();
    for (const p of team.roster) {
      if (!text(p.id) || !p.id || ids.has(p.id) || !text(p.name, 48) || !p.name.trim() || !Number.isInteger(p.number) || p.number < 0 || p.number > 99 || typeof p.available !== "boolean") fail("Invalid roster player.");
      if (p.role != null && (!text(p.role, 24) || (p.role && !Object.hasOwn(preset.positions, p.role)))) fail("Invalid preferred role.");
      ids.add(p.id);
    }
    if (!Array.isArray(team.assignments) || team.assignments.length !== preset.playerCount || team.assignments.some((v) => v != null && !ids.has(v))) fail("Invalid lineup assignments.");
    const assigned = team.assignments.filter(Boolean);
    if (new Set(assigned).size !== assigned.length) fail("A player cannot occupy two starting positions.");
    if (team.lineups != null) {
      if (!Array.isArray(team.lineups) || team.lineups.length > 30) fail("Invalid saved lineups.");
      const lineupIds = new Set();
      for (const saved of team.lineups) {
        const field = Object.hasOwn(presets, saved.format) && presets[saved.format];
        if (!field || !text(saved.id) || !saved.id || lineupIds.has(saved.id) || !text(saved.name, 80) || !saved.name.trim() || !Object.hasOwn(field.formations, saved.formation) || !Array.isArray(saved.assignments) || saved.assignments.length !== field.playerCount || saved.assignments.some((pid) => pid != null && !ids.has(pid))) fail("Invalid saved lineup.");
        lineupIds.add(saved.id);
        if (!Array.isArray(saved.available) || saved.available.some((pid) => !ids.has(pid)) || new Set(saved.assignments.filter(Boolean)).size !== saved.assignments.filter(Boolean).length) fail("Invalid saved lineup players.");
      }
    }
    return team;
  }

  function lineup(team, presets) {
    const valid = readTeam(team, presets), players = valid.assignments.map((pid) => valid.roster.find((p) => p.id === pid) || null);
    if (!team.name.trim()) fail("Give this team a name before applying it.");
    if (!players[0]) fail("Assign a goalkeeper first.");
    if (players.some((p) => p && !p.available)) fail("An unavailable player is still in the lineup.");
    if (players.some((p) => !p) && !valid.shortHanded) fail("Fill every starting position, or choose a short-handed setup.");
    const numbers = players.filter(Boolean).map((p) => p.number);
    if (new Set(numbers).size !== numbers.length) fail("Starting players need different jersey numbers.");
    const assigned = new Set(valid.assignments);
    return { players, bench: valid.roster.filter((p) => p.available && !assigned.has(p.id)), unavailable: valid.roster.filter((p) => !p.available) };
  }

  function changeShape(team, format, formation, presets) {
    const previous = presets[team.format].formationPositions[team.formation];
    const slots = presets[format].formationPositions[formation];
    const result = copy(team);
    result.assignments = slots.map((role) => team.assignments[previous.indexOf(role)] || null);
    result.format = format; result.formation = formation;
    return result;
  }

  function assign(team, slot, playerId) {
    const next = copy(team), old = next.assignments[slot], elsewhere = next.assignments.indexOf(playerId);
    if (playerId && elsewhere >= 0 && elsewhere !== slot) next.assignments[elsewhere] = old || null;
    next.assignments[slot] = playerId || null;
    return next;
  }

  function copyTeam(team, presets) {
    const result = readTeam(team, presets), remap = new Map(result.roster.map((p) => [p.id, id()]));
    result.id = id(); result.roster.forEach((p) => { p.id = remap.get(p.id); });
    result.assignments = result.assignments.map((pid) => remap.get(pid) || null);
    for (const saved of result.lineups || []) { saved.id = id(); saved.assignments = saved.assignments.map((pid) => remap.get(pid) || null); saved.available = saved.available.map((pid) => remap.get(pid)); }
    result.activeLineup = "";
    return result;
  }

  const api = { copy, id, color, readBoard, readSnapshot, readFile, newTeam, readTeam, lineup, changeShape, assign, copyTeam };
  root.SIDELINE_DATA = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

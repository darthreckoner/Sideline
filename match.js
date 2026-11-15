// Match time is derived from timestamps, never from timer ticks. All durations are ms.
(function (root) {
  "use strict";
  // Position lines and sides drive "who most likely takes this spot" for grouped subs.
  const LINES = { GK: "Goalkeeper", LB: "Defense", LCB: "Defense", CB: "Defense", RCB: "Defense", RB: "Defense",
    CDM: "Midfield", LM: "Midfield", LCM: "Midfield", CM: "Midfield", RCM: "Midfield", RM: "Midfield", CAM: "Midfield",
    LW: "Attack", LF: "Attack", ST: "Attack", RF: "Attack", RW: "Attack" };
  const side = (code) => code === "GK" ? "" : code[0] === "L" ? "L" : code[0] === "R" ? "R" : "C";
  // How well a player who plays `positions` fits the open spot `role`: exact > same line > same side.
  function fit(positions, role) {
    if (!role || !positions?.length) return 0;
    return Math.max(...positions.map((code) => code === role ? 10 : (LINES[code] && LINES[code] === LINES[role] ? 4 : 0) + (side(code) && side(code) === side(role) ? 2 : 0)));
  }
  // Pair players going on with the spots coming free so the total fit is highest.
  // Ties keep tap order, so players without positions pair exactly as tapped.
  // offSlots: slot indexes in tap order; onIds: roster ids in tap order; roles: the formation's slot positions.
  function bestPairs(m, offSlots, onIds, roles = []) {
    const n = offSlots.length;
    if (n !== onIds.length || !n) return [];
    const positions = (id) => m.roster.find((p) => p.id === id)?.positions || [];
    const score = (i, j) => fit(positions(onIds[j]), roles[offSlots[i]]) * 100 - (i === j ? 0 : 1);
    // Exact assignment over subsets (n is at most the number of players on the field).
    const best = new Map([[0, { total: 0, picks: [] }]]);
    for (let i = 0; i < n; i++) {
      for (const [mask, value] of [...best].filter(([mask]) => popcount(mask) === i)) {
        for (let j = 0; j < n; j++) {
          if (mask & (1 << j)) continue;
          const next = mask | (1 << j), total = value.total + score(i, j);
          if (!best.has(next) || best.get(next).total < total) best.set(next, { total, picks: [...value.picks, j] });
        }
      }
    }
    return best.get((1 << n) - 1).picks.map((j, i) => ({ slot: offSlots[i], incoming: onIds[j] }));
  }
  const popcount = (x) => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };
  function create({ id, team, side, halfMinutes, season, opponent }, now = Date.now()) {
    if (!Number.isInteger(halfMinutes) || halfMinutes < 1 || halfMinutes > 90) throw Error("Choose a half length from 1 to 90 minutes.");
    const roster = team.roster.filter((p) => p.available).map((p) => ({ id: p.id, name: p.name, number: p.number, positions: [...(p.positions || (p.role ? [p.role] : []))] }));
    const slots = team.assignments.slice();
    if (new Set(slots.filter(Boolean)).size !== slots.filter(Boolean).length || !slots.some(Boolean) || slots.filter(Boolean).some((id) => !roster.some((p) => p.id === id))) throw Error("Apply an available starting lineup first.");
    return { id, teamId: team.id, teamName: team.name, side, format: team.format, formation: team.formation, season, opponent, date: now, halfMs: halfMinutes * 60000,
      half: 1, phase: "ready", running: false, since: null, elapsed: 0, roster, slots, time: Object.fromEntries(roster.map((p) => [p.id, 0])), goals: [], saves: [], substitutions: [] };
  }
  function elapsed(m, now = Date.now()) { return m.elapsed + (m.running ? Math.max(0, now - m.since) : 0); }
  function times(m, now = Date.now()) {
    const result = { ...m.time }, delta = m.running ? Math.max(0, now - m.since) : 0;
    for (const id of m.slots.filter(Boolean)) result[id] = (result[id] || 0) + delta;
    return result;
  }
  function settle(m, now) { m.time = times(m, now); m.elapsed = elapsed(m, now); m.since = m.running ? now : null; }
  function toggle(m, now = Date.now()) {
    if (["halftime", "finished"].includes(m.phase)) throw Error("This half has ended.");
    settle(m, now); m.running = !m.running; m.since = m.running ? now : null; m.phase = "playing";
  }
  function endHalf(m, now = Date.now()) {
    if (m.phase !== "playing") throw Error("Begin the half first.");
    settle(m, now); m.running = false; m.since = null; m.phase = m.half === 1 ? "halftime" : "finished";
  }
  function secondHalf(m, now = Date.now()) {
    if (m.phase !== "halftime") throw Error("End the first half first.");
    m.half = 2; m.elapsed = 0; m.running = true; m.since = now; m.phase = "playing";
  }
  function clock(m, now = Date.now()) {
    const duration = elapsed(m, now);
    return { main: (m.half - 1) * m.halfMs + Math.min(duration, m.halfMs), stoppage: Math.max(0, duration - m.halfMs) };
  }
  // Several subs made together share one group and one moment, so time stays exact
  // and the whole group can be undone. pairs: [{ slot, incoming }].
  function substituteMany(m, pairs, now = Date.now()) {
    if (m.phase === "finished") throw Error("The match is finished.");
    const invalid = Error("Choose an on-field player and a bench player.");
    if (!Array.isArray(pairs) || !pairs.length) throw invalid;
    const slots = pairs.map((p) => p.slot), incoming = pairs.map((p) => p.incoming);
    if (new Set(slots).size !== slots.length || new Set(incoming).size !== incoming.length) throw invalid;
    for (const { slot, incoming: id } of pairs) {
      if (!Number.isInteger(slot) || slot < 0 || slot >= m.slots.length || !m.slots[slot] || m.slots.includes(id) || !m.roster.some((p) => p.id === id)) throw invalid;
    }
    settle(m, now);
    const group = Math.max(0, ...m.substitutions.map((s) => s.group || 0)) + 1;
    for (const { slot, incoming: id } of pairs) {
      m.substitutions.push({ outgoing: m.slots[slot], incoming: id, half: m.half, elapsed: m.elapsed, group });
      m.slots[slot] = id;
    }
    return group;
  }
  function substitute(m, slot, incoming, now = Date.now()) { return substituteMany(m, [{ slot, incoming }], now); }
  function lastSubs(m) {
    const last = m.substitutions.at(-1);
    return last?.group ? m.substitutions.filter((s) => s.group === last.group) : [];
  }
  // Undo the most recent group as if it never happened: the players who came on
  // give back the time since, and the players who went off get it.
  function undoSubs(m, now = Date.now()) {
    const group = lastSubs(m);
    if (m.phase === "finished" || !group.length) throw Error("There are no subs to undo.");
    if (group[0].half !== m.half) throw Error("Subs from the first half can't be undone now.");
    if (group.some((s) => !m.slots.includes(s.incoming) || m.slots.includes(s.outgoing))) throw Error("Those players have moved since. Make the change as new subs.");
    settle(m, now);
    const delta = Math.max(0, m.elapsed - group[0].elapsed);
    for (const s of group) {
      m.slots[m.slots.indexOf(s.incoming)] = s.outgoing;
      m.time[s.incoming] = Math.max(0, (m.time[s.incoming] || 0) - delta);
      m.time[s.outgoing] = (m.time[s.outgoing] || 0) + delta;
    }
    m.substitutions = m.substitutions.filter((s) => s.group !== group[0].group);
  }
  function swapPositions(m, first, second) {
    if (m.phase === "finished") throw Error("The match is finished.");
    if (![first, second].every(slot => Number.isInteger(slot) && slot >= 0 && slot < m.slots.length && m.slots[slot]) || first === second) throw Error("Choose two different on-field players.");
    [m.slots[first], m.slots[second]] = [m.slots[second], m.slots[first]];
  }
  function goal(m, playerId, now = Date.now()) {
    if (m.phase !== "playing") throw Error("Begin a half to record a goal.");
    if (playerId !== null && !m.roster.some((p) => p.id === playerId)) throw Error("Choose a scorer.");
    m.goals.push({ playerId, half: m.half, elapsed: elapsed(m, now) });
  }
  // An assist is optional and belongs to one of your goals, never the scorer's own.
  function assist(m, goal, playerId) {
    if (!goal || goal.playerId === null) throw Error("Only your team's goals have assists.");
    if (playerId !== null && (playerId === goal.playerId || !m.roster.some((p) => p.id === playerId))) throw Error("Choose a different player for the assist.");
    if (playerId === null) delete goal.assistId; else goal.assistId = playerId;
  }
  // Slot 0 is the goalkeeper in every formation, so a save goes to whoever is in goal now.
  function save(m, now = Date.now()) {
    if (m.phase !== "playing") throw Error("Begin a half to record a save.");
    const keeper = m.slots[0];
    if (!keeper) throw Error("No goalkeeper is on the field.");
    (m.saves ||= []).push({ playerId: keeper, half: m.half, elapsed: elapsed(m, now) });
    return keeper;
  }
  function totals(matches) {
    const players = new Map();
    for (const m of matches) for (const p of m.roster) {
      const row = players.get(p.id) || { ...p, games: 0, ms: 0, goals: 0, assists: 0, saves: 0 };
      const time = m.time[p.id] || 0;
      row.games += Number(time > 0); row.ms += time; row.goals += m.goals.filter((g) => g.playerId === p.id).length;
      row.assists += m.goals.filter((g) => g.assistId === p.id).length;
      row.saves += (m.saves || []).filter((s) => s.playerId === p.id).length;
      players.set(p.id, row);
    }
    return [...players.values()];
  }
  const api = { LINES, fit, bestPairs, create, elapsed, times, toggle, endHalf, secondHalf, clock, substitute, swapPositions, substituteMany, lastSubs, undoSubs, goal, assist, save, totals };
  root.SIDELINE_MATCH = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

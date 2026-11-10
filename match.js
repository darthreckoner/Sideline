// Match time is derived from timestamps, never from timer ticks. All durations are ms.
(function (root) {
  "use strict";
  function create({ id, team, side, halfMinutes, season, opponent }, now = Date.now()) {
    if (!Number.isInteger(halfMinutes) || halfMinutes < 1 || halfMinutes > 90) throw Error("Choose a half length from 1 to 90 minutes.");
    const roster = team.roster.filter((p) => p.available).map((p) => ({ id: p.id, name: p.name, number: p.number }));
    const slots = team.assignments.slice();
    if (new Set(slots.filter(Boolean)).size !== slots.filter(Boolean).length || !slots.some(Boolean) || slots.filter(Boolean).some((id) => !roster.some((p) => p.id === id))) throw Error("Apply an available starting lineup first.");
    return { id, teamId: team.id, teamName: team.name, side, format: team.format, formation: team.formation, season, opponent, date: now, halfMs: halfMinutes * 60000,
      half: 1, phase: "ready", running: false, since: null, elapsed: 0, roster, slots, time: Object.fromEntries(roster.map((p) => [p.id, 0])), goals: [], substitutions: [] };
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
  function substitute(m, slot, incoming, now = Date.now()) {
    if (m.phase === "finished") throw Error("The match is finished.");
    if (!Number.isInteger(slot) || slot < 0 || slot >= m.slots.length || !m.slots[slot] || m.slots.includes(incoming) || !m.roster.some((p) => p.id === incoming)) throw Error("Choose an on-field player and a bench player.");
    settle(m, now);
    m.substitutions.push({ outgoing: m.slots[slot], incoming, half: m.half, elapsed: m.elapsed });
    m.slots[slot] = incoming;
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
  function totals(matches) {
    const players = new Map();
    for (const m of matches) for (const p of m.roster) {
      const row = players.get(p.id) || { ...p, games: 0, ms: 0, goals: 0 };
      const time = m.time[p.id] || 0;
      row.games += Number(time > 0); row.ms += time; row.goals += m.goals.filter((g) => g.playerId === p.id).length;
      players.set(p.id, row);
    }
    return [...players.values()];
  }
  const api = { create, elapsed, times, toggle, endHalf, secondHalf, clock, substitute, swapPositions, goal, totals };
  root.SIDELINE_MATCH = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

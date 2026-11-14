const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../match.js');
const make = () => M.create({ id: 'match', team: { id: 'team', name: 'Team', format: '7v7', formation: 'shape', roster: ['a','b','c'].map((id, i) => ({ id, name: id, number: i, available: true })), assignments: ['a','b'] }, side: 'home', halfMinutes: 25, season: 'Fall', opponent: 'Visitors' }, 0);
test('clock caps regulation, separates stoppage and resumes second half at 25:00', () => {
  const m = make(); M.toggle(m, 1000);
  assert.deepEqual(M.clock(m, 1561000), { main: 1500000, stoppage: 60000 });
  M.endHalf(m, 1561000);
  assert.equal(M.times(m, 9999999).a, 1560000);
  M.secondHalf(m, 2000000);
  assert.deepEqual(M.clock(m, 2000000), { main: 1500000, stoppage: 0 });
  assert.deepEqual(M.clock(m, 3560000), { main: 3000000, stoppage: 60000 });
  M.endHalf(m, 3560000); assert.equal(m.phase, 'finished');
  assert.equal(m.time.a, 3120000);
});
test('subs transfer time at the exact swap and keep the game clock running', () => {
  const m = make(); M.toggle(m, 0); M.substitute(m, 0, 'c', 60000);
  assert.equal(m.running, true); assert.equal(M.elapsed(m, 120000), 120000);
  assert.deepEqual(M.times(m, 120000), { a: 60000, b: 120000, c: 60000 });
  M.substitute(m, 0, 'a', 120000); M.toggle(m, 180000);
  assert.deepEqual(M.times(m, 240000), { a: 120000, b: 180000, c: 60000 });
});
test('pause and halftime exclude wall time, including paused substitutions', () => {
  const m = make(); M.toggle(m, 100); M.toggle(m, 60100); M.substitute(m, 1, 'c', 80000);
  M.toggle(m, 100000); M.endHalf(m, 160000);
  assert.deepEqual(m.time, { a: 120000, b: 60000, c: 60000 });
  assert.equal(M.elapsed(m, 999999), 120000);
});
test('serialized running matches recover elapsed and player time without ticking', () => {
  const m = make(); M.toggle(m, 0); const restored = JSON.parse(JSON.stringify(m));
  assert.equal(M.elapsed(restored, 120000), 120000);
  assert.deepEqual(M.times(restored, 120000), { a: 120000, b: 120000, c: 0 });
});
test('goals, match totals and season aggregation retain stable player identities', () => {
  const m = make(); M.toggle(m, 0); M.goal(m, 'a', 20000); M.goal(m, null, 30000); M.endHalf(m, 60000);
  M.secondHalf(m, 70000); M.endHalf(m, 130000);
  const totals = M.totals([m, structuredClone(m)]);
  assert.deepEqual(totals.find(p => p.id === 'a'), { id:'a', name:'a', number:0, games:2, ms:240000, goals:2, assists:0, saves:0 });
  assert.equal(totals.find(p => p.id === 'c').games, 0);
});
test('invalid substitutions and finished match actions cannot change the ledger', () => {
  const m = make(); assert.throws(() => M.substitute(m, 0, 'b', 0)); assert.throws(() => M.substitute(m, -1, 'c', 0));
  M.toggle(m, 0); M.endHalf(m, 1000); M.secondHalf(m, 2000); M.endHalf(m, 3000);
  const before = structuredClone(m);
  assert.throws(() => M.substitute(m, 0, 'c', 4000)); assert.throws(() => M.goal(m, 'a', 4000)); assert.throws(() => M.toggle(m, 4000));
  assert.deepEqual(m, before);
});

test('position swaps preserve membership, running time and substitution history', () => {
  const m = make(); M.toggle(m, 1000);
  const before = structuredClone(m);
  M.swapPositions(m, 0, 1);
  assert.deepEqual(m.slots, ['b', 'a']);
  assert.deepEqual({...m, slots: before.slots}, before);
  assert.deepEqual(M.times(m, 61000), {a:60000,b:60000,c:0});
  const restored = JSON.parse(JSON.stringify(m));
  assert.deepEqual(restored.slots, ['b','a']);
  for (const pair of [[0,0],[-1,1],[0,2],[0,0.5]]) assert.throws(() => M.swapPositions(m, ...pair));
  M.endHalf(m, 61000); M.secondHalf(m, 62000); M.endHalf(m, 63000);
  assert.throws(() => M.swapPositions(m, 0, 1));
});
test('saves go to whoever is in goal, follow keeper swaps and count in totals', () => {
  const m = make();
  assert.throws(() => M.save(m, 0), /Begin a half/);
  M.toggle(m, 0); assert.equal(M.save(m, 30000), 'a');
  M.swapPositions(m, 0, 1); assert.equal(M.save(m, 60000), 'b');
  M.substitute(m, 0, 'c', 90000); assert.equal(M.save(m, 95000), 'c');
  assert.deepEqual(m.saves.map((s) => [s.playerId, s.half, s.elapsed]), [['a', 1, 30000], ['b', 1, 60000], ['c', 1, 95000]]);
  const old = JSON.parse(JSON.stringify(m)); delete old.saves; // Matches saved before saves existed.
  const rows = Object.fromEntries(M.totals([m, old]).map((p) => [p.id, p.saves]));
  assert.deepEqual(rows, { a: 1, b: 1, c: 1 });
  m.slots[0] = null; assert.throws(() => M.save(m, 99000), /No goalkeeper/);
});
test('assists attach to your own goals, never the scorer, and count in totals', () => {
  const m = make(); M.toggle(m, 0); M.goal(m, 'a', 10000); M.goal(m, null, 20000);
  assert.throws(() => M.assist(m, m.goals[0], 'a'), /different player/);
  assert.throws(() => M.assist(m, m.goals[1], 'b'), /your team's goals/);
  assert.throws(() => M.assist(m, m.goals[0], 'zzz'), /different player/);
  M.assist(m, m.goals[0], 'c'); // A substitute can be credited.
  assert.equal(m.goals[0].assistId, 'c');
  const rows = Object.fromEntries(M.totals([m]).map((p) => [p.id, [p.goals, p.assists]]));
  assert.deepEqual(rows, { a: [1, 0], b: [0, 0], c: [0, 1] });
  M.assist(m, m.goals[0], null); assert.equal('assistId' in m.goals[0], false);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("./helpers/app.cjs");

const offside = (a) => JSON.parse(a.run("JSON.stringify([...offsidePlayers()].sort())"));
const zones = (a) => JSON.parse(a.run("JSON.stringify(offsideState())"));
const move = (a, id, x, y = null) => a.run(`(() => { const p = board.players.find(p => p.id === ${JSON.stringify(id)}); p.x = ${x}; ${y == null ? "" : `p.y = ${y};`} })()`);

test("offside toggle is off by default, undoable, and saved with the board", async () => {
  const a = await app();
  assert.deepEqual(zones(a), []);
  a.get("show-offside").onclick();
  assert.equal(a.get("show-offside").attributes["aria-pressed"], "true");
  assert.equal(a.state().board.offside, true);
  assert.equal(zones(a).length, 2);
  const roundTrip = JSON.parse(a.run("JSON.stringify(window.SIDELINE_DATA.readSnapshot(snapshot(), window.SIDELINE_PRESETS))"));
  assert.equal(roundTrip.board.offside, true);
  assert.throws(() => a.run('const bad = snapshot(); bad.board.offside = "yes"; window.SIDELINE_DATA.readSnapshot(bad, window.SIDELINE_PRESETS)'), /offside/i);
  a.get("undo").onclick();
  assert.equal(a.get("show-offside").attributes["aria-pressed"], "false");
  assert.deepEqual(zones(a), []);
});

test("the line follows the second-last defender and flags attackers beyond it", async () => {
  const a = await app();
  a.get("show-offside").onclick();
  // Default kickoff shape: nobody is offside and each line sits on the deepest outfield defender.
  assert.deepEqual(offside(a), []);
  const away = a.state().board.players.filter((p) => p.team === "away").map((p) => p.x).sort((x, y) => y - x);
  assert.equal(zones(a).find((z) => z.team === "home").line, away[1]);
  // Put the ball in Away's half so only the defender sets Home's line.
  a.run("board.ball = { x: 600, y: 300, carrier: null }");
  move(a, "h1", away[1] + 20);
  assert.deepEqual(offside(a), ["h1"]);
  move(a, "h1", away[1]); // level is onside
  assert.deepEqual(offside(a), []);
  // The defender stepping up drags the line with them.
  const deepest = a.run(`board.players.filter(p => p.team === "away").sort((p, q) => q.x - p.x)[1].id`);
  move(a, deepest, 650);
  assert.equal(zones(a).find((z) => z.team === "home").line, a.run(`Math.max(...board.players.filter(p => p.team === "away" && p.id !== board.players.filter(q => q.team === "away").sort((p, q) => q.x - p.x)[0].id).map(p => p.x))`));
  assert.deepEqual(offside(a), ["h1"]);
});

test("away attacks the left goal, and halfway, the ball and hidden players are respected", async () => {
  const a = await app();
  a.get("show-offside").onclick();
  const home = a.state().board.players.filter((p) => p.team === "home").map((p) => p.x).sort((x, y) => x - y);
  a.run("board.ball = { x: 400, y: 300, carrier: null }");
  move(a, "a2", home[1] - 20);
  assert.deepEqual(offside(a), ["a2"]);
  // Ahead of the ball → behind the ball is onside.
  a.run(`board.ball = { x: ${home[1] - 40}, y: 300, carrier: null }`);
  assert.deepEqual(offside(a), []);
  // Never offside in your own half, even with defenders pushed up past halfway.
  a.run("board.ball = { x: 200, y: 300, carrier: null }");
  for (const p of a.state().board.players.filter((p) => p.team === "away")) move(a, p.id, 300);
  for (const p of a.state().board.players.filter((p) => p.team === "home")) move(a, p.id, Math.min(p.x, 450));
  move(a, "h1", 520);
  assert.deepEqual(offside(a), ["h1"]);
  move(a, "h1", 480);
  assert.deepEqual(offside(a), []);
  a.run('window.SIDELINE_BOARD.options({visibility:{h1:false}})');
  assert.deepEqual(offside(a), []);
});

test("activities don't show offside, and the setting survives a formation change", async () => {
  const a = await app();
  a.get("show-offside").onclick();
  a.run('applyFormation("home", "3-2-3")');
  assert.equal(a.state().board.offside, true);
  a.run('resetFormation("3-3-2")');
  assert.equal(a.state().board.offside, true);
  assert.equal(zones(a).length, 2);
  a.run("window.SIDELINE_BOARD.openActivity(window.SIDELINE_SITUATIONS[1])");
  assert.deepEqual(zones(a), []);
});

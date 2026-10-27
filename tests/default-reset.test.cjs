const test = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("./helpers/app.cjs");

test("Reset restores default positions without a saved start and can be undone", async () => {
  const a = await app(), initial = a.state().board;
  assert.equal(a.get("reset-start").disabled, false);
  a.run(`board.players.find(p => p.id === "h1").x = 600;
    board.players.find(p => p.id === "h1").n = 23;
    board.players.find(p => p.id === "h1").display = "number";
    board.players.find(p => p.id === "a4").y = 200;
    board.players.find(p => p.id === "a4").hidden = true;
    board.ball = {x: 100, y: 200, carrier: null};
    board.ink = [{type:"arrow", a:{x:100,y:100}, b:{x:200,y:200}}];
    board.colors.home = "#ef4444"; setMode("pen")`);
  const before = a.state();
  a.get("reset-start").onclick();
  const reset = a.state();
  assert.equal(reset.start, null);
  for (const p of reset.board.players) {
    const original = initial.players.find((item) => item.id === p.id);
    assert.deepEqual([p.x, p.y], [original.x, original.y]);
  }
  assert.deepEqual(reset.board.ball, initial.ball);
  assert.deepEqual(reset.board.ink, before.board.ink);
  assert.deepEqual(reset.board.colors, before.board.colors);
  assert.equal(reset.board.players.find((p) => p.id === "h1").n, 23);
  assert.equal(reset.board.players.find((p) => p.id === "h1").display, "number");
  assert.equal(reset.board.players.find((p) => p.id === "a4").hidden, true);
  assert.equal(a.run("mode"), "move");
  a.get("undo").onclick(); assert.deepEqual(a.state(), before);
  a.get("redo").onclick(); assert.deepEqual(a.state(), reset);
});

test("Reset uses each selected formation and preserves short-handed lineup slots", async () => {
  const a = await app(); await a.run('setFormat("7v7")');
  a.run('applyFormation("away", "3-2-1")');
  const team = a.run(`(() => { const t = window.SIDELINE_DATA.newTeam(window.SIDELINE_PRESETS);
    t.format = "7v7"; t.formation = "2-3-1";
    t.roster = Array.from({length:7}, (_,i) => ({id:"r"+i,name:"Player "+i,number:i+1,available:true}));
    t.assignments = t.roster.map(p => p.id); t.assignments[4] = null; t.shortHanded = true; return t; })()`);
  a.run(`window.SIDELINE_BOARD.applyLineup(${JSON.stringify(team)}, "home")`);
  a.run('for (const p of board.players) { p.x = 120; p.y = 210; } board.ball = {x:500,y:310,carrier:null}');
  const before = a.state();
  const home = JSON.parse(a.run('JSON.stringify(makeBoard(preset, "2-3-1").players.filter(p => p.team === "home"))'));
  const away = JSON.parse(a.run('JSON.stringify(makeBoard(preset, "3-2-1").players.filter(p => p.team === "away"))'));
  a.get("reset-start").onclick();
  const result = a.state().board;
  assert.equal(result.players.length, 13);
  assert.ok(!result.players.some((p) => p.id === "h4"));
  for (const p of result.players) {
    const slot = [...home, ...away].find((item) => item.id === p.id);
    assert.deepEqual([p.x, p.y], [slot.x, slot.y]);
    assert.equal(p.rosterId, before.board.players.find((item) => item.id === p.id).rosterId);
  }
  const carrier = result.players.find((p) => p.id === result.ball.carrier);
  assert.ok(carrier && carrier.team === "home" && !carrier.hidden);
  assert.doesNotThrow(() => a.run('window.SIDELINE_DATA.readSnapshot(snapshot(), window.SIDELINE_PRESETS)'));
});

test("Reset supports older saved boards with nonstandard player IDs", async () => {
  const a = await app(), initial = a.state().board;
  a.run('delete board.formation; board.players.forEach((p,i) => { p.id = "legacy-"+i; p.x = 100; p.y = 100; }); board.ball = {x:500,y:310,carrier:null}');
  const saved = a.state();
  a.run(`window.SIDELINE_BOARD.install(${JSON.stringify(saved)}, "", false)`);
  a.get("reset-start").onclick();
  const reset = a.state().board;
  for (let i = 0; i < reset.players.length; i++) {
    assert.equal(reset.players[i].id, `legacy-${i}`);
    assert.deepEqual([reset.players[i].x, reset.players[i].y], [initial.players[i].x, initial.players[i].y]);
  }
  assert.equal(reset.ball.carrier, "legacy-5");
});

test("Reset an activity without a saved start uses its own original positions", async () => {
  const a = await app(); a.run('window.SIDELINE_BOARD.openActivity(window.SIDELINE_SITUATIONS[3]); start = null');
  const original = a.state().board;
  a.run('for (const p of board.players) { p.x = 200; p.y = 200; } board.ink = [{type:"arrow",a:{x:100,y:100},b:{x:300,y:300}}]');
  const before = a.state();
  a.get("reset-start").onclick();
  const result = a.state().board;
  assert.equal(result.players.length, original.players.length);
  for (const p of result.players) {
    const source = original.players.find((item) => item.id === p.id);
    assert.deepEqual([p.x, p.y], [source.x, source.y]);
  }
  assert.deepEqual(result.markings, original.markings);
  assert.deepEqual(result.ink, before.board.ink);
  assert.equal(result.ball.carrier, original.ball.carrier);
  a.get("undo").onclick(); assert.deepEqual(a.state(), before);
});

test("Reset leaves the ball loose if no default-team player is visible", async () => {
  const a = await app(), initial = a.state().board;
  a.run('for (const p of board.players) if (p.team === "home") p.hidden = true; board.ball = {x:100,y:100,carrier:null}');
  a.get("reset-start").onclick();
  assert.deepEqual(a.state().board.ball, {x:initial.ball.x, y:initial.ball.y, carrier:null});
  assert.doesNotThrow(() => a.run('window.SIDELINE_DATA.readSnapshot(snapshot(), window.SIDELINE_PRESETS)'));
});

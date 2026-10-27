const test = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("./helpers/app.cjs");

const edges = (a) => JSON.parse(a.run('JSON.stringify(shapeSegments().map(([p,q]) => [p.id,q.id].sort()).sort((a,b) => a.join(":").localeCompare(b.join(":"))))'));
const pointer = (a, type, x, y) => a.get("board").listeners[type]({ clientX: x, clientY: y, pointerId: 1, button: 0, preventDefault() {} });

test("offensive triangles stay connected to the same players during a drag and survive undo", async () => {
  const a = await app();
  a.get("lines-offense").onclick();
  const original = a.state(), connections = edges(a);
  assert.ok(original.board.shapeLines.triangles.length > 0);
  assert.equal(new Set(original.board.shapeLines.triangles.flat()).size, 9);
  assert.equal(a.get("show-lines").attributes["aria-pressed"], "true");
  pointer(a, "pointerdown", 245, 120);
  pointer(a, "pointermove", 560, 245);
  assert.deepEqual(edges(a), connections);
  assert.deepEqual(a.state().board.shapeLines.triangles, original.board.shapeLines.triangles);
  assert.equal(a.run('shapeSegments().flat().find(p => p.id === "h1").x'), 560);
  pointer(a, "pointerup", 560, 245);
  a.get("undo").onclick(); assert.deepEqual(a.state(), original);
  a.get("redo").onclick(); assert.deepEqual(edges(a), connections);
  a.get("show-lines").onclick(); assert.equal(edges(a).length, 0);
  a.get("show-lines").onclick(); assert.ok(edges(a).length > 0);
});

test("defensive lines join position groups for the selected side without rearranging as players move", async () => {
  const a = await app();
  a.get("show-lines").onclick();
  assert.deepEqual(edges(a), [["h1", "h2"], ["h2", "h3"], ["h4", "h5"], ["h5", "h6"], ["h7", "h8"]]);
  pointer(a, "pointerdown", 245, 120); pointer(a, "pointermove", 270, 520); pointer(a, "pointerup", 270, 520);
  assert.deepEqual(edges(a), [["h1", "h2"], ["h2", "h3"], ["h4", "h5"], ["h5", "h6"], ["h7", "h8"]]);
  a.get("board-teaching-team").value = "away"; a.get("board-teaching-team").onchange();
  assert.deepEqual(edges(a), [["a2", "a3"], ["a3", "a4"], ["a5", "a6"], ["a6", "a7"], ["a8", "a9"]]);
  assert.equal(a.run('markerStyle(board.players.find(p => p.team === "away")).highlight'), true);
  assert.ok(a.run('markerStyle(board.players.find(p => p.team === "away")).radius > markerStyle(board.players.find(p => p.team === "home")).radius'));
  assert.ok(a.run('markerStyle(board.players.find(p => p.team === "home")).alpha < 1'));
  a.run('window.SIDELINE_BOARD.options({visibility:{a3:false}})');
  assert.ok(edges(a).every((edge) => !edge.includes("a3")));
});

test("saved line connections round-trip and reject invalid player references", async () => {
  const a = await app(); a.get("lines-offense").onclick(); a.get("capture").onclick();
  const saved = a.state();
  const roundTrip = JSON.parse(a.run('JSON.stringify(window.SIDELINE_DATA.readSnapshot(snapshot(), window.SIDELINE_PRESETS))'));
  assert.deepEqual(roundTrip, saved);
  a.run('board.players.find(p => p.id === "h1").x = 500');
  a.get("reset-start").onclick(); assert.deepEqual(a.state(), saved);
  assert.throws(() => a.run('const bad = snapshot(); bad.board.shapeLines.triangles[0][0] = "missing"; window.SIDELINE_DATA.readSnapshot(bad, window.SIDELINE_PRESETS)'), /triangle players/i);
  assert.throws(() => a.run('bad.board.shapeLines.triangles[0][0] = "a1"; window.SIDELINE_DATA.readSnapshot(bad, window.SIDELINE_PRESETS)'), /triangle players/i);
  const legacy = a.state(); delete legacy.board.shapeLines; delete legacy.start.shapeLines;
  assert.doesNotThrow(() => a.run(`window.SIDELINE_DATA.readSnapshot(${JSON.stringify(legacy)}, window.SIDELINE_PRESETS)`));
});

test("triangles rebuild for visibility and lineups, while activities do not imply formation lines", async () => {
  const a = await app(); a.get("lines-offense").onclick();
  a.run('window.SIDELINE_BOARD.options({visibility:{h1:false}})');
  assert.ok(a.state().board.shapeLines.triangles.every((ids) => !ids.includes("h1")));
  const team = a.run(`(() => { const t = window.SIDELINE_DATA.newTeam(window.SIDELINE_PRESETS); t.roster = Array.from({length:9}, (_,i) => ({id:"r"+i,name:"Player "+i,number:i+1,available:true})); t.assignments = t.roster.map(p => p.id); return t; })()`);
  a.run(`window.SIDELINE_BOARD.applyLineup(${JSON.stringify(team)}, "away")`);
  assert.equal(a.state().board.teachingTeam, "away");
  assert.ok(a.state().board.shapeLines.triangles.every((ids) => ids.every((id) => id.startsWith("a"))));
  a.run('window.SIDELINE_BOARD.openActivity(window.SIDELINE_SITUATIONS[1])');
  a.get("lines-defense").onclick(); assert.equal(edges(a).length, 0);
  a.get("lines-offense").onclick(); assert.ok(edges(a).length > 0);
  assert.equal(a.run('triangulate([{id:"x",x:0,y:0},{id:"y",x:1,y:0},{id:"z",x:2,y:0}]).length'), 0);
});

test("line groups follow formation roles in 9v9 and 7v7", async () => {
  const a = await app(); a.get("lines-defense").onclick();
  a.run('applyFormation("home", "3-2-3")');
  assert.deepEqual(edges(a), [["h1", "h2"], ["h2", "h3"], ["h4", "h5"], ["h6", "h7"], ["h7", "h8"]]);
  a.run('board.players.find(p => p.id === "h1").position = "ST"; applyFormation("home", "3-3-2")');
  assert.equal(a.state().board.players.find((p) => p.id === "h1").position, "ST");
  await a.run('setFormat("7v7")'); a.get("show-lines").onclick();
  assert.deepEqual(edges(a), [["h1", "h2"], ["h3", "h4"], ["h4", "h5"]]);
});

test("formation changes preserve short-handed player identities and valid connections", async () => {
  const a = await app();
  const team = a.run(`(() => { const t = window.SIDELINE_DATA.newTeam(window.SIDELINE_PRESETS); t.roster = Array.from({length:9}, (_,i) => ({id:"r"+i,name:"Player "+i,number:i+1,available:true})); t.assignments = t.roster.map(p => p.id); t.assignments[2] = null; t.shortHanded = true; return t; })()`);
  a.run(`window.SIDELINE_BOARD.applyLineup(${JSON.stringify(team)}, "home")`);
  a.get("lines-offense").onclick();
  const ids = a.state().board.players.filter((p) => p.team === "home").map((p) => p.id).sort();
  a.run('applyFormation("home", "3-2-3")');
  const board = a.state().board;
  assert.deepEqual(board.players.filter((p) => p.team === "home").map((p) => p.id).sort(), ids);
  assert.equal(new Set(board.players.map((p) => p.id)).size, board.players.length);
  assert.ok(board.shapeLines.triangles.every((triangle) => triangle.every((id) => ids.includes(id))));
  assert.doesNotThrow(() => a.run('window.SIDELINE_DATA.readSnapshot(snapshot(), window.SIDELINE_PRESETS)'));
});

test("overlapping markers select the teaching team that is drawn on top", async () => {
  const a = await app();
  a.run('const home = board.players.find(p => p.id === "h1"), away = board.players.find(p => p.id === "a2"); away.x = home.x; away.y = home.y; board.teachingTeam = "away"');
  assert.equal(a.run('hitPlayer({x:245,y:120}).id'), "a2");
  a.run('board.teachingTeam = "home"');
  assert.equal(a.run('hitPlayer({x:245,y:120}).id'), "h1");
});

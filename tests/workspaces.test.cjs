const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const D = require("../data.js");
const { app } = require("./helpers/app.cjs");
const root = path.join(__dirname, "..");
const presets = Object.fromEntries(["9v9", "7v7"].map((format) => [format, JSON.parse(fs.readFileSync(path.join(root, `presets/soccer-${format}.json`)))]));

function team(format = "9v9") {
  const result = D.newTeam(presets);
  result.name = "Test team"; result.format = format; result.formation = presets[format].defaultFormation;
  result.roster = Array.from({ length: 12 }, (_, i) => ({ id: `person-${i}`, name: `Player ${i + 1}`, number: i + 1, available: true }));
  result.assignments = result.roster.slice(0, presets[format].playerCount).map((p) => p.id);
  return result;
}

test("the runtime pack contains only five verified FIFA youth activities with source metadata", async () => {
  const a = await app();
  const catalog = JSON.parse(a.run("JSON.stringify(window.SIDELINE_SITUATIONS)"));
  assert.deepEqual(catalog.map((s) => s.id), ["A01", "A02", "A03", "A04", "A05"]);
  assert.deepEqual(catalog.map((s) => s.players.length), [4, 10, 12, 12, 4]);
  assert.ok(catalog.every((s) => s.source.url.startsWith("https://www.fifatrainingcentre.com/") && s.section && s.checked && s.changes && s.conditions));
  assert.equal(catalog[4].ages, "U-10");
  assert.ok(catalog.slice(0, 4).every((s) => s.ages === "8–12"));
  assert.equal(catalog[1].markings.filter((m) => m.type === "gate").length, 2);
  assert.equal(catalog[3].players.filter((p) => p.position === "T").length, 2);
  assert.equal(catalog[4].markings.filter((m) => m.type === "goal").length, 4);
  assert.equal(catalog[4].players.filter((p) => p.position === "OFF").length, 1);
});

test("each native activity opens with a captured start, repeats, and is undoable", async () => {
  const a = await app();
  for (let i = 0; i < 5; i++) {
    const before = a.state();
    a.run(`window.SIDELINE_BOARD.openActivity(window.SIDELINE_SITUATIONS[${i}])`);
    const opened = a.state();
    assert.deepEqual(opened.board, opened.start);
    assert.equal(opened.board.format, "9v9"); // Canvas preset never expands the native activity size.
    assert.equal(opened.board.players.length, [4, 10, 12, 12, 4][i]);
    a.run("checkpoint(); board.players[0].x += 20; draw()");
    a.get("reset-start").onclick();
    assert.deepEqual(a.state().board, opened.start);
    a.run(`window.SIDELINE_BOARD.install(${JSON.stringify(before)}, "", false)`);
    a.run(`window.SIDELINE_BOARD.openActivity(window.SIDELINE_SITUATIONS[${i}])`);
    a.get("undo").onclick();
    assert.deepEqual(a.state(), before);
  }
});

test("default field leaves an activity in the current format and Undo restores it", async () => {
  for (const [format, count, formation] of [["9v9", 18, "3-3-2"], ["7v7", 14, "2-3-1"]]) {
    const a = await app();
    await a.run(`setFormat(${JSON.stringify(format)})`);
    a.run(`board.colors.home = "#ef4444"; window.SIDELINE_BOARD.openActivity(window.SIDELINE_SITUATIONS[4]);
      checkpoint(); board.view = "attack"; board.ink = [{type:"arrow",a:{x:100,y:100},b:{x:200,y:200}}]; setMode("pen")`);
    const activity = a.state();

    a.get("default-field").onclick();
    const field = a.state();
    assert.equal(field.board.format, format);
    assert.equal(field.board.formation, formation);
    assert.equal(field.board.players.length, count);
    assert.deepEqual(field.board.colors, activity.board.colors);
    assert.equal(field.board.activity, undefined);
    assert.equal(field.board.markings, undefined);
    assert.equal(field.board.view, undefined);
    assert.deepEqual(field.board.ink, []);
    assert.equal(field.start, null);
    assert.equal(a.run("mode"), "move");

    a.get("undo").onclick();
    assert.deepEqual(a.state(), activity);
    a.get("redo").onclick();
    assert.deepEqual(a.state(), field);
    a.get("default-field").onclick();
    assert.deepEqual(a.state(), field);
  }
});

test("board files preserve source identity, labels, markings, guides, and demonstration start", async () => {
  const a = await app(); a.run("window.SIDELINE_BOARD.openActivity(window.SIDELINE_SITUATIONS[3])");
  a.run('window.SIDELINE_BOARD.options({guides:"lanes",view:"attack"})');
  const state = a.state();
  const file = D.readFile(JSON.stringify({ kind: "sideline-board", version: 1, name: "Target", snapshot: state }), presets);
  assert.deepEqual(file.snapshot, state);
  assert.equal(file.snapshot.board.players.filter((p) => p.position === "T").length, 2);
  assert.equal(file.snapshot.board.activity.id, "A04");
});

test("invalid imports fail completely without changing the active board", async () => {
  const a = await app(), before = a.state();
  const malformed = [
    (s) => { s.board.players[0].x = Infinity; },
    (s) => { s.board.players[1].id = s.board.players[0].id; },
    (s) => { s.board.ball.carrier = "missing"; },
    (s) => { s.board.activity = { id: "unsourced-triangle", title: "Triangle" }; },
    (s) => { s.board.activity = { id: "A01", title: "Pass", revision: 999 }; },
    (s) => { s.start = { ...s.board, format: "7v7" }; },
    (s) => { s.board.formation = "made-up"; },
  ];
  for (const change of malformed) {
    const snapshot = structuredClone(before); change(snapshot);
    assert.throws(() => D.readSnapshot(snapshot, presets));
    assert.deepEqual(a.state(), before);
  }
  assert.throws(() => D.readFile(JSON.stringify({ kind: "sideline-board", version: 999, snapshot: before }), presets), /version/);
  assert.throws(() => D.readFile(" ".repeat(2_000_001), presets), /2 MB/);
});

test("lineup assignments swap stable identities and keep starters separate from available bench", () => {
  let t = team(); const identity = t.roster[1].id;
  t = D.assign(t, 0, identity);
  assert.equal(t.assignments[0], identity); assert.equal(t.assignments[1], "person-0");
  t.roster[1].name = "Renamed"; t.roster[1].number = 22;
  assert.equal(D.lineup(t, presets).players[0].name, "Renamed");
  assert.equal(D.lineup(t, presets).bench.length, 3);
  t.roster[1].available = false;
  assert.throws(() => D.lineup(t, presets), /unavailable/);
  t.assignments[0] = null;
  assert.throws(() => D.lineup(t, presets), /goalkeeper/);
});

test("lineup validation catches duplicated numbers and requires explicit short-handed acceptance", () => {
  const t = team(); t.roster[1].number = t.roster[0].number;
  assert.throws(() => D.lineup(t, presets), /different jersey/);
  t.roster[1].number = 2; t.assignments[3] = null;
  assert.throws(() => D.lineup(t, presets), /short-handed/);
  t.shortHanded = true; assert.equal(D.lineup(t, presets).players.filter(Boolean).length, 8);
  t.assignments[4] = t.assignments[2]; assert.throws(() => D.lineup(t, presets), /two starting/);
});

test("changing from 9v9 to 7v7 retains the roster and only compatible slot assignments", () => {
  const t = team(), next = D.changeShape(t, "7v7", "2-3-1", presets);
  assert.equal(next.roster.length, 12); assert.equal(next.assignments.length, 7);
  assert.equal(next.assignments[0], t.assignments[0]);
  assert.equal(new Set(next.assignments.filter(Boolean)).size, next.assignments.filter(Boolean).length);
  assert.deepEqual(t, teamWithSameIdentity(t));
  function teamWithSameIdentity(original) { return { ...team(), id: original.id }; }
});

test("applying a lineup preserves the opposite side and Undo restores cross-format boards and demo starts", async () => {
  const a = await app(), t = team();
  a.run('board.players.find(p => p.id === "a2").x = 780; board.ink = [{type:"arrow",kind:"run",a:{x:100,y:100},b:{x:300,y:100}}]');
  a.get("capture").onclick(); const before = a.state(), away = before.board.players.filter((p) => p.team === "away");
  a.run(`window.SIDELINE_BOARD.applyLineup(${JSON.stringify(t)}, "home")`);
  assert.deepEqual(a.state().board.players.filter((p) => p.team === "away"), away);
  assert.equal(a.state().board.players.find((p) => p.id === "h0").rosterId, t.roster[0].id);
  assert.equal(a.state().start, null); assert.deepEqual(a.state().board.ink, before.board.ink);
  a.get("undo").onclick(); assert.deepEqual(a.state(), before);
  a.run(`window.SIDELINE_BOARD.applyLineup(${JSON.stringify(team("7v7"))}, "home")`);
  assert.equal(a.state().board.format, "7v7"); assert.equal(a.state().board.players.length, 14);
  a.get("undo").onclick(); assert.deepEqual(a.state(), before); assert.equal(a.run("preset.id"), "9v9");
  a.get("redo").onclick(); assert.equal(a.run("preset.id"), "7v7");
});

test("hiding the carrier releases possession, ignores hidden hit targets, and Undo restores it", async () => {
  const a = await app(), before = a.state(), carrier = before.board.ball.carrier;
  a.run(`window.SIDELINE_BOARD.options({visibility:{${JSON.stringify(carrier)}:false}})`);
  assert.equal(a.state().board.ball.carrier, null);
  const p = a.state().board.players.find((p) => p.id === carrier);
  assert.notEqual(a.run(`hitPlayer({x:${p.x},y:${p.y}}, 1)?.id`), carrier);
  a.get("undo").onclick(); assert.deepEqual(a.state(), before);
});

test("half-field inverse coordinates remain correct in portrait, landscape, and both attack directions", async () => {
  const a = await app(), original = a.state().board.players;
  for (const [width, height] of [[667, 300], [375, 510]]) for (const side of ["home", "away"]) for (const view of ["attack", "defense"]) {
    a.get("board").clientWidth = width; a.get("board").clientHeight = height;
    a.run(`board.view=${JSON.stringify(view)};board.teachingTeam=${JSON.stringify(side)}`);
    const g = JSON.parse(a.run("JSON.stringify(geometry())")), world = { x: g.view.x + 180, y: 230 };
    const pixel = g.rot ? { x: g.ox + world.y * g.scale, y: g.oy + (g.view.width - (world.x - g.view.x)) * g.scale } : { x: g.ox + (world.x - g.view.x) * g.scale, y: g.oy + world.y * g.scale };
    const result = JSON.parse(a.run(`JSON.stringify(at({clientX:${pixel.x},clientY:${pixel.y}}))`));
    assert.ok(Math.abs(result.x - world.x) < 1e-8 && Math.abs(result.y - world.y) < 1e-8);
  }
  assert.deepEqual(a.state().board.players, original);
});

test("cancelled drags restore the board and history instead of recovering an unfinished gesture", async () => {
  const a = await app(), before = a.state();
  const event = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, button: 0, preventDefault() {} });
  a.get("board").listeners.pointerdown(event(245, 120));
  a.get("board").listeners.pointermove(event(350, 200));
  assert.notDeepEqual(a.state(), before);
  a.get("board").listeners.pointercancel(event(350, 200));
  assert.deepEqual(a.state(), before); assert.equal(a.run("undo.length"), 0);
});

test("Pass and Run marks keep their meaning through drawing, serialization and reset", async () => {
  const a = await app(); a.run('setMode("arrow")'); a.get("arrow-run").onclick();
  const event = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, button: 0, preventDefault() {} });
  a.get("board").listeners.pointerdown(event(300, 200)); a.get("board").listeners.pointermove(event(500, 220)); a.get("board").listeners.pointerup(event(500, 220));
  assert.equal(a.state().board.ink[0].kind, "run");
  a.get("capture").onclick(); a.get("clear").onclick(); a.get("reset-start").onclick();
  assert.equal(D.readSnapshot(a.state(), presets).board.ink[0].kind, "run");
  a.renderedLabels.length = 0; a.run("contents(ctx)"); assert.ok(a.renderedLabels.includes("Run"));
});

test("storage writes wait for transaction commit and reject an abort after request success", async () => {
  let openRequest, tx, request;
  const sandbox = { window: {}, indexedDB: { open: () => (openRequest = {}) } };
  vm.runInNewContext(fs.readFileSync(path.join(root, "storage.js"), "utf8"), sandbox);
  openRequest.result = { transaction: () => (tx = { objectStore: () => ({ put: () => (request = {}) }) }) };
  openRequest.onsuccess();
  let done = false;
  const write = sandbox.window.SIDELINE_STORE.run("boards", "put", { slot: 1 }); write.then(() => { done = true; }, () => {});
  await Promise.resolve(); request.result = 1; request.onsuccess(); await Promise.resolve();
  assert.equal(done, false);
  tx.error = Error("Quota failure"); tx.onabort(); await assert.rejects(write, /Quota failure/);
  const success = sandbox.window.SIDELINE_STORE.run("boards", "put", { slot: 2 }); await Promise.resolve(); request.onsuccess(); tx.oncomplete(); await success;
});

test("team-file copies remap saved lineups and never share identities or edits with the original", () => {
  const original = team();
  original.lineups = [{ id: "saved", name: "First half", format: original.format, formation: original.formation, assignments: structuredClone(original.assignments), available: original.roster.map((p) => p.id), shortHanded: false }];
  const decoded = D.readFile(JSON.stringify({ kind: "sideline-team", version: 1, team: original }), presets);
  const copied = D.copyTeam(decoded.team, presets);
  assert.notEqual(copied.id, original.id); assert.notEqual(copied.roster[0].id, original.roster[0].id);
  assert.equal(copied.lineups[0].assignments[0], copied.roster[0].id);
  assert.ok(copied.lineups[0].available.includes(copied.roster[11].id));
  copied.roster[0].name = "Changed"; assert.equal(original.roster[0].name, "Player 1");
  assert.equal(D.lineup(copied, presets).bench.length, 3);
});

test("an invalid later playbook entry rejects the entire import and preserves every legacy board", async () => {
  const a = await app(), before = a.state();
  const invalid = structuredClone(before); invalid.board.players[0].n = 100;
  assert.throws(() => D.readFile(JSON.stringify({ kind: "sideline-playbook", version: 1, boards: [{ name: "Valid", snapshot: before }, { name: "Invalid", snapshot: invalid }] }), presets), /label/);
  assert.deepEqual(a.state(), before);
  const legacy = structuredClone(before);
  delete legacy.board.formation; legacy.board.players.forEach((p) => { delete p.position; delete p.display; });
  legacy.board.players[0].x = 110;
  a.run(`window.SIDELINE_BOARD.install(${JSON.stringify(legacy)}, "", false)`);
  assert.equal(a.state().board.players[0].x, 110); assert.equal(a.state().board.players[0].position, "GK");
});

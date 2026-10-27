const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");

// Lightweight DOM adapter runs the actual application handlers without a browser dependency.
const { app } = require("./helpers/app.cjs");

test("opens as 9v9, with a goalkeeper per team and registered formation choices", async () => {
  const a = await app();
  const { board } = a.state();
  assert.equal(board.format, "9v9");
  assert.equal(board.players.length, 18);
  assert.equal(board.formation, "3-3-2");
  for (const team of ["home", "away"]) {
    const players = board.players.filter((p) => p.team === team);
    assert.deepEqual(players.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(players.map((p) => p.position), ["GK", "LB", "CB", "RB", "LM", "CM", "RM", "LF", "RF"]);
    assert.ok(players.every((p) => p.display === "position"));
  }
  assert.equal(board.players[0].x, 65);
  assert.equal(board.players[9].x, 935);
  assert.deepEqual(a.get("formation").children.map((o) => o.value), ["3-3-2", "3-2-3"]);
  assert.equal(a.get("reset-start").disabled, false);
});

test("demonstration restores custom positions, ball, and ink repeatedly; Undo restores the demo", async () => {
  const a = await app();
  a.run('board.players[2].x = 330; board.ball = {x: 120, y: 150, carrier: null}; board.ink = [{type:"arrow",a:{x:100,y:100},b:{x:200,y:200}}]; setMode("pen")');
  a.get("capture").onclick();
  const baseline = a.state();
  assert.equal(a.run("mode"), "move");
  a.run('checkpoint(); board.players[2].x = 700; board.ball.carrier = "h4"; board.ink = []; setMode("arrow")');
  const demonstrated = a.state();
  a.get("reset-start").onclick();
  assert.deepEqual(a.state().board, baseline.board);
  assert.equal(a.run("mode"), "move");
  a.get("undo").onclick();
  assert.deepEqual(a.state(), demonstrated);
  a.get("reset-start").onclick();
  assert.deepEqual(a.state().board, baseline.board);
  assert.deepEqual(a.state().start, baseline.board);
});

test("formation change resets setup, preserves colors, and Undo restores board and demo start", async () => {
  const a = await app();
  a.run('board.colors.home = "#ef4444"; board.players[3].y = 250; board.ink = [{type:"arrow",a:{x:50,y:80},b:{x:300,y:80}}]');
  a.get("capture").onclick();
  const before = a.state();
  a.get("formation").value = "3-2-3";
  a.get("formation").onchange();
  assert.equal(a.state().board.formation, "3-2-3");
  assert.equal(a.state().board.players[7].x, 680);
  assert.equal(a.state().board.colors.home, "#ef4444");
  assert.equal(a.state().board.ink.length, 0);
  assert.equal(a.state().start, null);
  assert.equal(a.get("reset-start").disabled, false);
  a.get("undo").onclick();
  assert.deepEqual(a.state(), before);
  assert.equal(a.get("formation").value, "3-3-2");
  a.get("redo").onclick();
  a.run("board.players[7].x = 100");
  a.get("reset-formation").onclick();
  assert.equal(a.state().board.players[7].x, 680);
});

test("7v7 offers its own formations and remains usable after switching back to 9v9", async () => {
  const a = await app();
  await a.run('setFormat("7v7")');
  assert.equal(a.state().board.players.length, 14);
  assert.deepEqual(a.get("formation").children.map((o) => o.value), ["2-3-1", "3-2-1"]);
  a.run('resetFormation("3-2-1")');
  assert.equal(a.state().board.players[1].y, 120);
  await a.run('setFormat("9v9")');
  assert.equal(a.state().board.players.length, 18);
});

test("legacy saved positions survive menu synchronization and use the default reset formation", async () => {
  const a = await app();
  a.run("delete board.formation; board.players[0].x = 210; syncMenu()");
  assert.equal(a.state().board.players[0].x, 210);
  assert.equal(a.get("formation").value, "3-3-2");
  a.get("reset-formation").onclick();
  assert.equal(a.state().board.players[0].x, 65);
  a.get("undo").onclick();
  assert.equal(a.state().board.players[0].x, 210);
});

test("a different-sized sport preset supplies its renderer and dimensions without changing controls", async () => {
  const a = await app();
  a.run(`window.SIDELINE_FIELDS.fixture = (c, f) => { window.rendered = [f.width, f.height]; };
    window.SIDELINE_PRESETS.fixture = { id: "fixture", name: "Test court", field: {type:"fixture",width:800,height:1000},
      formations: {start:[[60,500],[300,500]]}, defaultFormation:"start", playerCount:2 };`);
  await a.run('setFormat("fixture")');
  assert.equal(a.state().board.players.length, 4);
  assert.equal(a.state().board.players[2].x, 740);
  assert.equal(a.run("P.h"), 1000);
  assert.equal(a.run("window.rendered.join(',')"), "800,1000");
  a.get("capture").onclick();
  a.run("board.players[0].x = 400");
  a.get("reset-start").onclick();
  assert.equal(a.state().board.players[0].x, 60);
});

test("touch-style drags move a player and the ball independently and Undo reverses them", async () => {
  const a = await app();
  const board = a.get("board");
  const send = (type, x, y) => board.listeners[type]({ pointerId: 1, clientX: x, clientY: y, preventDefault() {} });
  const drag = (x, y, toX, toY) => { send("pointerdown", x, y); send("pointermove", toX, toY); send("pointerup", toX, toY); };
  drag(245, 120, 300, 160);
  assert.equal(a.state().board.players[1].x, 300);
  assert.equal(a.state().board.ink.length, 0);
  a.get("capture").onclick();
  drag(454, 276, 530, 320);
  assert.equal(a.state().board.ball.carrier, null);
  assert.equal(a.state().board.ball.x, 530);
  a.get("undo").onclick();
  assert.equal(a.state().board.ball.carrier, "h5");
  a.get("reset-start").onclick();
  assert.equal(a.state().board.players[1].x, 300);
});

function pointer(a, type, x = 245, y = 120, overrides = {}) {
  a.get("board").listeners[type]({ pointerId: 1, button: 0, pointerType: "touch", clientX: x, clientY: y, preventDefault() {}, ...overrides });
}
function applyLabel(a) { a.get("player-form").listeners.submit({ preventDefault() {} }); }

test("a stationary hold opens the chosen player's editor and its release never passes or drags", async () => {
  const a = await app();
  const before = a.state();
  pointer(a, "pointerdown");
  a.advance(549);
  assert.ok(!a.get("playerDialog").open);
  a.advance(1);
  assert.equal(a.get("playerDialog").open, true);
  assert.equal(a.get("player-title").textContent, "Home · LB");
  assert.equal(a.get("player-position").value, "LB");
  assert.equal(a.get("position-field").hidden, false);
  assert.equal(a.get("number-field").hidden, true);
  pointer(a, "pointermove", 450, 250);
  pointer(a, "pointerup", 450, 250);
  assert.deepEqual(a.state(), before);
  assert.equal(a.run("undo.length"), 0);
});

test("short taps still pass; dragging and cancelled gestures never open the player menu", async () => {
  const tapped = await app();
  pointer(tapped, "pointerdown"); tapped.advance(150); pointer(tapped, "pointerup"); tapped.advance(1000);
  assert.equal(tapped.state().board.ball.carrier, "h1");
  assert.equal(tapped.get("message").textContent, "Pass CM → LB");
  assert.ok(!tapped.get("playerDialog").open);

  for (const action of ["drag", "pointercancel", "lostpointercapture", "mode", "menu", "undo"]) {
    const a = await app(); pointer(a, "pointerdown"); a.advance(250);
    if (action === "drag") pointer(a, "pointermove", 280, 170);
    else if (action === "mode") a.run('setMode("pen")');
    else if (action === "menu") a.get("menu").onclick();
    else if (action === "undo") { a.run("checkpoint()"); a.get("undo").onclick(); }
    else pointer(a, action);
    a.advance(1000);
    assert.ok(!a.get("playerDialog").open, action);
    assert.equal(a.state().board.ball.carrier, "h5", action);
    if (action === "drag") assert.equal(a.state().board.players[1].x, 280);
  }
});

test("holding the ball or drawing across a player does not open the editor", async () => {
  const a = await app();
  pointer(a, "pointerdown", 454, 276); a.advance(600); pointer(a, "pointerup", 454, 276);
  assert.ok(!a.get("playerDialog").open);
  assert.equal(a.run("ballSelected"), true);
  a.run('setMode("arrow")');
  pointer(a, "pointerdown"); a.advance(600); pointer(a, "pointermove", 400, 160); pointer(a, "pointerup", 400, 160);
  assert.ok(!a.get("playerDialog").open);
  assert.equal(a.state().board.ink.length, 1);
});

test("one player's number or position can be edited, undone, and redone without changing its identity", async () => {
  const a = await app();
  const original = a.state();
  pointer(a, "pointerdown"); a.advance(550); pointer(a, "pointerup");
  a.get("label-number").onclick();
  assert.equal(a.get("number-field").hidden, false);
  assert.equal(a.get("player-position").disabled, true);
  a.get("player-number").value = "23";
  applyLabel(a);
  const numbered = a.state().board.players[1];
  assert.equal(numbered.id, "h1");
  assert.equal(numbered.display, "number");
  assert.equal(numbered.n, 23);
  assert.equal(numbered.position, "LB");
  assert.equal(a.run("playerLabel(board.players[1])"), "23");
  assert.deepEqual(a.state().board.players[10], original.board.players[10]);
  assert.equal(a.get("playerDialog").open, false);
  assert.equal(a.run("undo.length"), 1);
  a.get("undo").onclick(); assert.deepEqual(a.state(), original);
  a.get("redo").onclick(); assert.equal(a.state().board.players[1].n, 23);

  pointer(a, "pointerdown"); a.advance(550); pointer(a, "pointerup");
  a.get("label-position").onclick();
  a.get("player-position").value = "ST";
  applyLabel(a);
  assert.equal(a.state().board.players[1].display, "position");
  assert.equal(a.run("playerLabel(board.players[1])"), "ST");
  assert.equal(a.state().board.players[1].n, 23);
});

test("cancelling a draft or applying unchanged values does not alter the board or history", async () => {
  const a = await app(); const before = a.state();
  pointer(a, "pointerdown"); a.advance(550); pointer(a, "pointerup");
  a.get("label-number").onclick(); a.get("player-number").value = "88";
  a.get("player-close").onclick();
  assert.deepEqual(a.state(), before);
  assert.equal(a.run("undo.length"), 0);
  pointer(a, "pointerdown"); a.advance(550); pointer(a, "pointerup"); applyLabel(a);
  assert.deepEqual(a.state(), before);
  assert.equal(a.run("undo.length"), 0);
});

test("number input rejects blank, fractional, negative, and oversized values", async () => {
  const a = await app(); const before = a.state();
  pointer(a, "pointerdown"); a.advance(550); pointer(a, "pointerup");
  a.get("label-number").onclick();
  for (const value of ["", "1.5", "-1", "100", "1e1"]) {
    a.get("player-number").value = value; applyLabel(a);
    assert.deepEqual(a.state(), before);
    assert.equal(a.get("playerDialog").open, true);
    assert.match(a.get("player-error").textContent, /0 to 99/);
  }
  a.get("player-number").value = "0"; applyLabel(a);
  assert.equal(a.state().board.players[1].n, 0);
});

test("saved label choices and demo baselines round-trip; old boards gain positions without moving players", async () => {
  const a = await app();
  a.run('board.players[1].n = 23; board.players[1].display = "number"; board.players[2].position = "ST"');
  a.get("capture").onclick();
  const before = a.state();
  a.run('const saved = JSON.parse(JSON.stringify(snapshot())); board = withPlayerLabels(saved.board, preset); start = withPlayerLabels(saved.start, preset)');
  assert.deepEqual(a.state(), before);
  a.run('board.players[1].x = 550; board.players[2].position = "CB"');
  a.get("reset-start").onclick();
  assert.deepEqual(a.state().board, before.board);
  a.run('for (const p of board.players) { delete p.display; delete p.position; } delete board.formation; board.players[1].x = 500; board = withPlayerLabels(board, preset)');
  assert.equal(a.state().board.players[1].position, "LB");
  assert.equal(a.state().board.players[1].display, "position");
  assert.equal(a.state().board.players[1].n, 23);
  assert.equal(a.state().board.players[1].x, 500);
});

test("screen and exported board rendering use each player's chosen display", async () => {
  const a = await app();
  a.run('board.players[1].display = "number"; board.players[1].n = 23');
  for (const live of [true, false]) {
    a.renderedLabels.length = 0;
    a.run(`contents(ctx, { live: ${live} })`);
    assert.equal(a.renderedLabels.length, 18);
    assert.deepEqual(a.renderedLabels.slice(9, 13), ["GK", "23", "CB", "RB"]); // teaching team is drawn last
  }
});

test("mouse right-click opens the same label editor without starting a drag", async () => {
  const a = await app(); const before = a.state();
  pointer(a, "pointerdown", 245, 120, { button: 2, pointerType: "mouse" });
  pointer(a, "contextmenu", 245, 120, { button: 2, pointerType: "mouse" });
  assert.equal(a.get("playerDialog").open, true);
  assert.equal(a.get("player-title").textContent, "Home · LB");
  assert.deepEqual(a.state(), before);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");

// Lightweight DOM adapter runs the actual application handlers without a browser dependency.
async function app() {
  const elements = new Map();
  const context = new Proxy({}, { get: (_, key) => key === "measureText" ? () => ({ width: 80 }) : () => {} });
  function element() {
    const classes = new Set();
    return {
      dataset: {}, style: {}, attributes: {}, children: [], listeners: {}, value: "",
      clientWidth: 1000, clientHeight: 620,
      classList: {
        add: (name) => classes.add(name), remove: (name) => classes.delete(name),
        toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
      },
      setAttribute(name, value) { this.attributes[name] = value; },
      append(child) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      querySelectorAll() { return this.children; },
      addEventListener(name, handler) { this.listeners[name] = handler; },
      getContext: () => context,
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      setPointerCapture() {}, close() {}, showModal() {},
    };
  }
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const modes = ["move", "arrow", "pen", "erase"].map((mode) => {
    const button = element(); button.dataset.mode = mode; return button;
  });
  const sandbox = {
    window: {}, document: {
      getElementById: get, createElement: element, addEventListener() {},
      querySelectorAll: (selector) => selector === "[data-mode]" ? modes : get("formatSeg").children,
    },
    structuredClone, console, performance, devicePixelRatio: 1,
    setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame() {},
    navigator: {}, location: { protocol: "file:" },
    matchMedia: () => ({ matches: false }), addEventListener() {},
    ResizeObserver: class { observe() {} },
    indexedDB: { open: () => ({}) },
  };
  const env = vm.createContext(sandbox);
  const run = (code) => vm.runInContext(code, env);
  for (const file of ["presets/soccer-field.js", "presets/soccer-9v9.js", "presets/soccer-7v7.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), env, { filename: file });
  }
  await run("Promise.resolve()");
  return { run, get, state: () => JSON.parse(run("JSON.stringify(snapshot())")) };
}

test("opens as 9v9, with a goalkeeper per team and registered formation choices", async () => {
  const a = await app();
  const { board } = a.state();
  assert.equal(board.format, "9v9");
  assert.equal(board.players.length, 18);
  assert.equal(board.formation, "3-3-2");
  for (const team of ["home", "away"]) {
    const players = board.players.filter((p) => p.team === team);
    assert.deepEqual(players.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
  assert.equal(board.players[0].x, 65);
  assert.equal(board.players[9].x, 935);
  assert.deepEqual(a.get("formation").children.map((o) => o.value), ["3-3-2", "3-2-3"]);
  assert.equal(a.get("reset-start").disabled, true);
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
  assert.equal(a.get("reset-start").disabled, true);
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

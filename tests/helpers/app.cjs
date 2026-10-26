const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "../..");
async function app() {
  const elements = new Map();
  const renderedLabels = [];
  const context = new Proxy({}, { get: (_, key) => key === "measureText" ? () => ({ width: 80 }) : key === "fillText" ? (text) => renderedLabels.push(text) : () => {} });
  const timers = new Map();
  let now = 0, timerId = 0;
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.time <= end).sort((a, b) => a[1].time - b[1].time)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].time; next[1].handler();
    }
    now = end;
  }
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
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 288, height: 280 }),
      setPointerCapture(id) { this.pointer = id; },
      hasPointerCapture(id) { return this.pointer === id; },
      releasePointerCapture() { this.pointer = null; },
      close() { this.open = false; this.listeners.close?.({}); },
      showModal() { this.open = true; },
      focus() {}, select() {},
    };
  }
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const modes = ["move", "arrow", "pen", "erase"].map((mode) => {
    const button = element(); button.dataset.mode = mode; return button;
  });
  const labelModes = ["position", "number"].map((mode) => {
    const button = get("label-" + mode); button.dataset.labelMode = mode; return button;
  });
  const sandbox = {
    window: { innerWidth: 1000, innerHeight: 620 }, document: {
      getElementById: get, createElement: element, addEventListener() {},
      querySelectorAll: (selector) => selector === "[data-mode]" ? modes : selector === "[data-label-mode]" ? labelModes : get("formatSeg").children,
    },
    structuredClone, console, performance, devicePixelRatio: 1,
    setTimeout: (handler, ms) => { const id = ++timerId; timers.set(id, {handler, time: now + ms}); return id; },
    clearTimeout: (id) => timers.delete(id), requestAnimationFrame() {},
    navigator: {}, location: { protocol: "file:" },
    matchMedia: () => ({ matches: false }), addEventListener() {},
    ResizeObserver: class { observe() {} },
    indexedDB: { open: () => ({}) },
  };
  const env = vm.createContext(sandbox);
  const run = (code) => vm.runInContext(code, env);
  for (const file of ["presets/soccer-field.js", "presets/soccer-9v9.js", "presets/soccer-7v7.js", "data.js", "coaching/situations.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), env, { filename: file });
  }
  await run("Promise.resolve()");
  return { run, get, advance, renderedLabels, state: () => JSON.parse(run("JSON.stringify(snapshot())")) };
}

module.exports = { app };

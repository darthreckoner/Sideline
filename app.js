// Sideline — shared single-canvas coaching board.
// Presets supply dimensions, formations and a field renderer; controls are sport-independent.

const $ = (id) => document.getElementById(id);
const canvas = $("board");
const ctx = canvas.getContext("2d");

const P = {
  get w() { return preset?.field.width || 1000; },
  get h() { return preset?.field.height || 620; },
};
const R = 28;                // player dot radius (field units)
const BALL_R = 15;
const BALL_OFF = 34;         // ball offset from its carrier
const PLAYER_HIT = 46;       // touch radius for players
const BALL_HIT_FREE = 34;    // touch radius for a loose ball
const BALL_HIT_CARRIED = 24; // smaller so it doesn't steal the carrier's touches
const DROP_RADIUS = 44;      // dropping the ball this close to a player gives it to them
const DRAG_THRESHOLD = 9;    // CSS px before a touch counts as a drag

const SWATCHES = [
  "#ffcb54", "#ff9f1c", "#ef4444", "#ff7eb6", "#a78bfa",
  "#2563eb", "#5dc2ff", "#1e3a8a", "#ffffff", "#1d1d1f",
];
const DEFAULT_COLORS = { home: "#ffcb54", away: "#5dc2ff" };
const TEAM = { home: "Home", away: "Away" };

let preset = null;
let board = null;
let mode = "move";
let undo = [];
let redo = [];
let start = null;
let gesture = null;
let ballSelected = false;
let anim = null;
let installPrompt = null;
let toastTimer = null;

const clone = (v) => structuredClone(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dpr = () => Math.min(devicePixelRatio || 1, 3);

function note(text, ms = 2600) {
  const m = $("message");
  m.textContent = text;
  m.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => m.classList.remove("show"), ms);
}

// ---------- history ----------

const snapshot = () => ({ board: clone(board), start: clone(start) });

function checkpoint() {
  undo.push(snapshot());
  if (undo.length > 80) undo.shift();
  redo = [];
  updateButtons();
}

function restore(s) {
  board = clone(s.board);
  start = clone(s.start);
  ballSelected = false;
  anim = null;
  syncMenu();
  updateButtons();
  draw();
}

function historyStep(from, to) {
  if (!from.length) return;
  to.push(snapshot());
  restore(from.pop());
}

function updateButtons() {
  $("undo").disabled = !undo.length;
  $("redo").disabled = !redo.length;
  $("reset-start").disabled = !start;
}

// ---------- board model ----------

function makeBoard(data, formation = data.defaultFormation) {
  const home = data.formations[formation].map(([x, y], i) => ({
    id: "h" + i, n: i + 1, team: "home", x, y,
  }));
  const away = home.map((p) => ({ ...p, id: "a" + p.n, team: "away", x: data.field.width - p.x, y: data.field.height - p.y }));
  const centre = { x: data.field.width / 2, y: data.field.height / 2 };
  const kicker = home.reduce((best, p) => (dist(p, centre) < dist(best, centre) ? p : best));
  return {
    format: data.id,
    formation,
    players: [...home, ...away],
    ball: { x: kicker.x, y: kicker.y, carrier: kicker.id },
    ink: [],
    colors: { ...DEFAULT_COLORS },
  };
}

async function loadPreset(format) {
  const data = window.SIDELINE_PRESETS?.[format];
  if (!data) throw Error(`Preset ${format} unavailable`);
  if (!window.SIDELINE_FIELDS?.[data.field.type]) throw Error(`Field renderer ${data.field.type} unavailable`);
  return clone(data);
}

async function setFormat(format) {
  preset = await loadPreset(format);
  board = makeBoard(preset);
  start = null;
  undo = [];
  redo = [];
  ballSelected = false;
  anim = null;
  setMode("move");
  syncMenu();
  updateButtons();
  draw();
}

const carrierOf = () => board.players.find((p) => p.id === board.ball.carrier) || null;

function restingBall() {
  const c = carrierOf();
  return c ? { x: c.x + BALL_OFF, y: c.y - BALL_OFF } : { x: board.ball.x, y: board.ball.y };
}

function ballPos() {
  const to = restingBall();
  if (!anim) return to;
  const t = Math.min(1, (performance.now() - anim.t0) / anim.dur);
  const e = 1 - Math.pow(1 - t, 3);
  return { x: anim.from.x + (to.x - anim.from.x) * e, y: anim.from.y + (to.y - anim.from.y) * e };
}

function animateBall(from) {
  anim = { from, t0: performance.now(), dur: 260 };
  const step = () => {
    if (!anim) return;
    draw();
    if (performance.now() - anim.t0 < anim.dur) requestAnimationFrame(step);
    else { anim = null; draw(); }
  };
  requestAnimationFrame(step);
}

function giveBall(player, message) {
  const from = ballPos();
  checkpoint();
  board.ball.carrier = player.id;
  animateBall(from);
  note(message);
}

function placeBall(point) {
  const from = ballPos();
  checkpoint();
  const p = limit(point);
  board.ball = { x: p.x, y: p.y, carrier: null };
  animateBall(from);
  note("Loose ball.");
}

// ---------- geometry (landscape = field sideways, portrait = field upright) ----------

function geometry() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const rot = h > w * 1.05;
  const fw = rot ? P.h : P.w;
  const fh = rot ? P.w : P.h;
  const scale = Math.min(w / fw, h / fh);
  return { w, h, rot, scale, ox: (w - fw * scale) / 2, oy: (h - fh * scale) / 2 };
}

function at(e) {
  const r = canvas.getBoundingClientRect();
  const g = geometry();
  const sx = (e.clientX - r.left - g.ox) / g.scale;
  const sy = (e.clientY - r.top - g.oy) / g.scale;
  return g.rot ? { x: P.w - sy, y: sx } : { x: sx, y: sy };
}

const limit = (p) => ({ x: clamp(p.x, R + 2, P.w - R - 2), y: clamp(p.y, R + 2, P.h - R - 2) });

function resize() {
  const d = dpr();
  canvas.width = Math.round(canvas.clientWidth * d);
  canvas.height = Math.round(canvas.clientHeight * d);
  draw();
}

// ---------- rendering ----------

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

function pitch(c) {
  window.SIDELINE_FIELDS[preset.field.type](c, preset.field);
}

function arrow(c, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 8) return;
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  const an = Math.atan2(dy, dx), head = 24;
  c.beginPath();
  c.moveTo(b.x, b.y); c.lineTo(b.x - head * Math.cos(an - 0.5), b.y - head * Math.sin(an - 0.5));
  c.moveTo(b.x, b.y); c.lineTo(b.x - head * Math.cos(an + 0.5), b.y - head * Math.sin(an + 0.5));
  c.stroke();
}

function strokeInk(c, ink) {
  if (ink.type === "arrow") return arrow(c, ink.a, ink.b);
  if (ink.points.length < 2) return;
  c.beginPath();
  ink.points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
}

function label(c, text, x, y, color, rot) {
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(Math.PI / 2); // keep numbers upright when the field is turned
  c.fillStyle = color;
  c.font = "bold 30px system-ui, -apple-system, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, 0, 2);
  c.restore();
}

// opts.live = on-screen (shows selection); false for exported images.
function contents(c, { rot = false, live = false } = {}) {
  pitch(c);
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = "#fff7a8";
  c.lineWidth = 7;
  for (const ink of board.ink) strokeInk(c, ink);
  if (live && gesture?.ink) strokeInk(c, gesture.ink);

  for (const p of board.players) {
    const fill = board.colors[p.team];
    const dark = isDark(fill);
    c.beginPath();
    c.arc(p.x, p.y, R, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = dark ? "#f4f7ef" : "#0f2e24";
    c.stroke();
    label(c, String(p.n), p.x, p.y, dark ? "#ffffff" : "#0b241e", rot);
  }

  const b = ballPos();
  if (live && ballSelected) {
    c.beginPath();
    c.arc(b.x, b.y, BALL_R + 10, 0, Math.PI * 2);
    c.fillStyle = "#fff7a855";
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = "#fff7a8";
    c.stroke();
  }
  c.beginPath();
  c.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
  c.fillStyle = "#ffffff";
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = "#16222b";
  c.stroke();
  c.beginPath();
  c.arc(b.x, b.y, 5, 0, Math.PI * 2);
  c.fillStyle = "#16222b";
  c.fill();
}

function draw() {
  if (!board || !preset) return;
  const d = dpr();
  const g = geometry();
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = "#0b2a22";
  ctx.fillRect(0, 0, g.w, g.h);
  ctx.save();
  ctx.translate(g.ox, g.oy);
  ctx.scale(g.scale, g.scale);
  if (g.rot) { ctx.translate(0, P.w); ctx.rotate(-Math.PI / 2); }
  contents(ctx, { rot: g.rot, live: true });
  ctx.restore();

  if (start) {
    // On-screen only; never part of the exported PNG.
    const txt = "● START SET";
    ctx.font = "700 11px system-ui, -apple-system, sans-serif";
    const tw = ctx.measureText(txt).width;
    const x = g.ox + 8, y = g.oy + g.h - 2 * g.oy - 30;
    ctx.fillStyle = "rgba(6,22,17,0.8)";
    ctx.beginPath();
    ctx.roundRect(x, y, tw + 16, 22, 11);
    ctx.fill();
    ctx.fillStyle = "#d9f99d";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(txt, x + 8, y + 11.5);
  }
}

// ---------- input ----------

function hitPlayer(point, radius = PLAYER_HIT) {
  let best = null, bestD = radius;
  for (const p of board.players) {
    const d = dist(point, p);
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}

function hitBall(point) {
  const r = board.ball.carrier ? BALL_HIT_CARRIED : BALL_HIT_FREE;
  return dist(point, ballPos()) < r;
}

canvas.addEventListener("pointerdown", (e) => {
  if (!board) return;
  e.preventDefault();
  if (gesture) return; // one finger at a time
  canvas.setPointerCapture(e.pointerId);
  const p = at(e);
  gesture = { origin: p, cx: e.clientX, cy: e.clientY, pointer: e.pointerId, moved: false };
  if (mode === "move") {
    if (hitBall(p)) gesture.ball = true; // the ball wins over nearby players
    else gesture.target = hitPlayer(p);
  } else if (mode === "arrow") {
    gesture.ink = { type: "arrow", a: p, b: p };
  } else if (mode === "pen") {
    gesture.ink = { type: "pen", points: [p] };
  } else if (mode === "erase") {
    gesture.before = snapshot();
    eraseAt(p);
  }
  draw();
});

canvas.addEventListener("pointermove", (e) => {
  if (!gesture || gesture.pointer !== e.pointerId) return;
  const p = at(e);
  if (!gesture.moved && Math.hypot(e.clientX - gesture.cx, e.clientY - gesture.cy) > DRAG_THRESHOLD) {
    gesture.moved = true;
  }
  if (mode === "move") {
    if (!gesture.moved || !(gesture.target || gesture.ball)) return;
    if (!gesture.started) {
      checkpoint();
      gesture.started = true;
      ballSelected = false;
      anim = null;
      if (gesture.ball) {
        const bp = restingBall();
        board.ball = { x: bp.x, y: bp.y, carrier: null };
        gesture.grab = { dx: bp.x - gesture.origin.x, dy: bp.y - gesture.origin.y };
      } else {
        gesture.grab = { dx: gesture.target.x - gesture.origin.x, dy: gesture.target.y - gesture.origin.y };
      }
    }
    const dest = limit({ x: p.x + gesture.grab.dx, y: p.y + gesture.grab.dy });
    const obj = gesture.ball ? board.ball : gesture.target;
    obj.x = dest.x;
    obj.y = dest.y;
  } else if (mode === "arrow") {
    gesture.ink.b = p;
  } else if (mode === "pen") {
    gesture.ink.points.push(p);
  } else if (mode === "erase") {
    eraseAt(p);
  }
  draw();
});

canvas.addEventListener("pointerup", (e) => {
  if (!gesture || gesture.pointer !== e.pointerId) return;
  const g = gesture;
  gesture = null;
  if (mode === "move") {
    if (g.started && g.ball) {
      const near = hitPlayer(board.ball, DROP_RADIUS);
      if (near) {
        board.ball.carrier = near.id;
        note(`${TEAM[near.team]} #${near.n} has the ball.`);
      }
    } else if (!g.moved) {
      handleTap(g);
    }
  } else if (mode === "arrow" && dist(g.ink.a, g.ink.b) > 12) {
    checkpoint();
    board.ink.push(g.ink);
  } else if (mode === "pen" && g.ink.points.length > 1) {
    checkpoint();
    board.ink.push(g.ink);
  }
  draw();
});

const cancelGesture = () => { gesture = null; draw(); };
canvas.addEventListener("pointercancel", cancelGesture);
canvas.addEventListener("lostpointercapture", (e) => {
  if (gesture && gesture.pointer === e.pointerId) cancelGesture();
});

function handleTap(g) {
  if (g.ball) {
    ballSelected = !ballSelected;
    if (ballSelected) note("Ball selected. Tap any player, or an open spot.");
    return;
  }
  const player = g.target;
  if (ballSelected) {
    ballSelected = false;
    if (player) giveBall(player, `${TEAM[player.team]} #${player.n} has the ball.`);
    else placeBall(g.origin);
    return;
  }
  if (!player) return;
  const c = carrierOf();
  if (!c) note("Loose ball. Tap the ball, then a player.");
  else if (player.id === c.id) note(`#${c.n} has the ball. Tap a teammate to pass.`);
  else if (player.team === c.team) giveBall(player, `Pass #${c.n} → #${player.n}`);
  else note("Other team. To switch possession, tap the ball, then the player.");
}

function distSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function eraseAt(p) {
  const before = board.ink.length;
  board.ink = board.ink.filter((i) =>
    i.type === "arrow" ? distSeg(p, i.a, i.b) > 30 : !i.points.some((q) => dist(p, q) < 30));
  if (before !== board.ink.length && !gesture.started) {
    undo.push(gesture.before);
    redo = [];
    gesture.started = true;
    updateButtons();
  }
}

// ---------- controls ----------

function setMode(next) {
  mode = next;
  ballSelected = false;
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    const selected = btn.dataset.mode === mode;
    btn.classList.toggle("active", selected);
    btn.setAttribute("aria-pressed", String(selected));
  });
}

document.querySelectorAll("[data-mode]").forEach((btn) =>
  btn.addEventListener("click", () => {
    setMode(btn.dataset.mode);
    note({ move: "Move: drag anything, tap a teammate to pass.", arrow: "Swipe to place an arrow.",
      pen: "Swipe to draw.", erase: "Touch a line to erase it." }[mode]);
    draw();
  }));

$("undo").onclick = () => historyStep(undo, redo);
$("redo").onclick = () => historyStep(redo, undo);

$("clear").onclick = () => {
  if (!board.ink.length) return note("No drawings to clear.");
  checkpoint();
  board.ink = [];
  draw();
  note("Drawings cleared.");
};

$("capture").onclick = () => {
  checkpoint();
  start = clone(board);
  setMode("move");
  updateButtons();
  draw();
  note("Start set. Run the play, then tap Reset.");
};

$("reset-start").onclick = () => {
  if (!start) return;
  checkpoint();
  board = clone(start);
  setMode("move");
  anim = null;
  syncMenu();
  draw();
  note("Back to start. Undo brings the demo back.");
};

// Menu: format, formation and colors. Choices come from the registered presets.
for (const data of Object.values(window.SIDELINE_PRESETS)) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.format = data.id;
  button.textContent = data.name;
  $("formatSeg").append(button);
}

function syncMenu() {
  if (!board) return;
  canvas.setAttribute("aria-label", `Interactive ${preset.name} coaching board`);
  document.querySelectorAll("[data-format]").forEach((b) => {
    const selected = b.dataset.format === board.format;
    b.classList.toggle("on", selected);
    b.setAttribute("aria-pressed", String(selected));
  });
  const choices = $("formation");
  if (choices.dataset.format !== board.format) {
    choices.replaceChildren();
    for (const name of Object.keys(preset.formations)) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      choices.append(option);
    }
    choices.dataset.format = board.format;
  }
  // Older saved boards did not record a formation; their positions stay untouched.
  choices.value = board.formation || preset.defaultFormation;
  for (const team of ["home", "away"]) {
    $("sw-" + team).querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.color === board.colors[team]));
  }
}

function resetFormation(formation) {
  checkpoint();
  const colors = { ...board.colors };
  board = makeBoard(preset, formation);
  board.colors = colors;
  start = null;
  anim = null;
  setMode("move");
  syncMenu();
  updateButtons();
  draw();
  note(`${formation} formation ready. Undo restores your previous board.`);
}

$("formation").onchange = () => resetFormation($("formation").value);
$("reset-formation").onclick = () => {
  resetFormation(board.formation || preset.defaultFormation);
  $("menuDialog").close();
};

for (const team of ["home", "away"]) {
  const row = $("sw-" + team);
  for (const color of SWATCHES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.color = color;
    b.style.background = color;
    b.setAttribute("aria-label", `${TEAM[team]} color ${color}`);
    b.onclick = () => {
      if (board.colors[team] === color) return;
      checkpoint();
      const other = team === "home" ? "away" : "home";
      if (board.colors[other] === color) board.colors[other] = board.colors[team]; // never two teams the same color
      board.colors[team] = color;
      syncMenu();
      draw();
    };
    row.append(b);
  }
}

document.querySelectorAll("[data-format]").forEach((btn) =>
  btn.addEventListener("click", async () => {
    const format = btn.dataset.format;
    if (format === board.format) return;
    if (undo.length && !confirm("Switch format? Your unsaved board will be replaced.")) return;
    const colors = { ...board.colors };
    await setFormat(format);
    board.colors = colors; // keep the team's colors across formats
    syncMenu();
    draw();
    $("menuDialog").close();
    note(`${preset.name} ready.`);
  }));

$("menu").onclick = () => { syncMenu(); $("menuDialog").showModal(); };
$("help").onclick = () => { $("menuDialog").close(); $("helpDialog").showModal(); };

// ---------- saved boards (IndexedDB) ----------

const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open("sideline-boards", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("boards", { keyPath: "slot" });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function dbop(method, data) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("boards", method === "getAll" ? "readonly" : "readwrite");
    const s = tx.objectStore("boards");
    const req = method === "put" ? s.put(data) : method === "delete" ? s.delete(data) : s.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function slots() {
  const entries = await dbop("getAll");
  return Array.from({ length: 5 }, (_, slot) => ({ slot, entry: entries.find((e) => e.slot === slot) }));
}

async function renderSlots() {
  const root = $("slots");
  root.replaceChildren();
  for (const { slot, entry } of await slots()) {
    const el = document.createElement("div");
    el.className = "slot";
    const cap = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = `${slot + 1}. ${entry ? entry.name : "Empty"}`;
    const when = document.createElement("small");
    when.textContent = entry ? `${entry.board.format} · ${new Date(entry.updated).toLocaleDateString()}` : "Available";
    cap.append(name, when);
    el.append(cap);
    if (entry) {
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = "Open";
      open.onclick = async () => {
        if (undo.length && !confirm("Open this board? Your unsaved board will be replaced.")) return;
        preset = await loadPreset(entry.board.format);
        board = clone(entry.board);
        start = clone(entry.start);
        undo = [];
        redo = [];
        ballSelected = false;
        anim = null;
        setMode("move");
        syncMenu();
        updateButtons();
        draw();
        $("savesDialog").close();
        note(`Opened “${entry.name}”.`);
      };
      const overwrite = document.createElement("button");
      overwrite.type = "button";
      overwrite.textContent = "Replace";
      overwrite.onclick = () => saveTo(slot, entry);
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Delete";
      del.className = "delete";
      del.onclick = async () => {
        if (confirm(`Delete “${entry.name}”?`)) { await dbop("delete", slot); renderSlots(); }
      };
      el.append(open, overwrite, del);
    } else {
      const save = document.createElement("button");
      save.type = "button";
      save.textContent = "Save here";
      save.onclick = () => saveTo(slot);
      el.append(save);
    }
    root.append(el);
  }
}

async function saveTo(slot, existing) {
  const name = prompt("Name this board (e.g. Corner kick)", existing?.name || "");
  if (!name?.trim()) return;
  await dbop("put", {
    slot,
    name: name.trim().slice(0, 40),
    board: clone(board),
    start: clone(start),
    updated: Date.now(),
  });
  note(`Saved “${name.trim()}”.`);
  if ($("savesDialog").open) renderSlots();
}

async function openSaves() {
  try {
    await renderSlots();
    $("savesDialog").showModal();
  } catch {
    alert("This browser has blocked local storage. Try Safari (not Private mode) or add Sideline to your Home Screen.");
  }
}

$("load").onclick = () => { $("menuDialog").close(); openSaves(); };

$("save").onclick = async () => {
  try {
    const empty = (await slots()).find((s) => !s.entry);
    if (empty) await saveTo(empty.slot);
    else { note("All five slots used. Pick one to replace."); openSaves(); }
  } catch {
    alert("Unable to save: this browser has blocked local storage.");
  }
};

// ---------- PNG export ----------

function imageFile() {
  const off = document.createElement("canvas");
  off.width = 1600;
  off.height = Math.round(off.width * P.h / P.w);
  const c = off.getContext("2d");
  c.scale(off.width / P.w, off.width / P.w);
  contents(c, { rot: false, live: false });
  return new Promise((resolve) =>
    off.toBlob((b) => resolve(new File([b], `sideline-${board.format}.png`, { type: "image/png" })), "image/png"));
}

$("share").onclick = async () => {
  try {
    const file = await imageFile();
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file] });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 12000);
      note("Image downloaded.");
    }
  } catch (e) {
    if (e.name !== "AbortError") alert("Couldn't share the image. Please try again.");
  }
};

// ---------- install / lifecycle ----------

const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (standalone) $("install").hidden = true;

addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });

$("install").onclick = async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
  } else {
    alert("On iPhone or iPad: tap Safari's Share button, then “Add to Home Screen”.");
  }
};

document.addEventListener("gesturestart", (e) => e.preventDefault()); // block iOS pinch-zoom
new ResizeObserver(resize).observe(canvas);

(async () => {
  try {
    await setFormat("9v9");
    resize();
    note("Tap a teammate to pass. Drag anything to move it.", 4500);
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  } catch (err) {
    note("Couldn't load the field presets. Check the presets folder is next to index.html.", 10000);
    console.error(err);
  }
})();

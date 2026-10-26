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
const PLAYER_HOLD_MS = 550; // a stationary hold opens the player's label menu

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
let editingPlayerId = null;
let editingLabelMode = "position";
let playerMenuAnchor = null;
let arrowKind = "pass";

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
  if (board?.activity) board.activity.edited = true;
  updateButtons();
}

function restore(s) {
  cancelGesture();
  board = clone(s.board);
  start = clone(s.start);
  preset = clone(window.SIDELINE_PRESETS[board.format]);
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
    position: data.formationPositions?.[formation]?.[i] || "",
    display: data.formationPositions?.[formation]?.[i] ? "position" : "number",
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

function withPlayerLabels(saved, data) {
  if (!saved) return null;
  const result = clone(saved);
  const slots = { home: 0, away: 0 };
  const positions = data.formationPositions?.[result.formation || data.defaultFormation] || [];
  for (const player of result.players) {
    const slot = slots[player.team]++;
    player.position ||= positions[slot] || "";
    player.display ||= player.position ? "position" : "number";
  }
  return result;
}

const playerLabel = (player) => player.display === "position" && player.position ? player.position : String(player.n);
const playerName = (player) => player.display === "position" && player.position ? player.position : `#${player.n}`;

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

const carrierOf = () => board.players.find((p) => p.id === board.ball.carrier && !p.hidden) || null;

function restingBall() {
  const c = carrierOf();
  return c ? { x: clamp(c.x + BALL_OFF, BALL_R, P.w - BALL_R), y: clamp(c.y - BALL_OFF, BALL_R, P.h - BALL_R) } : { x: board.ball.x, y: board.ball.y };
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

function fieldView() {
  const away = board?.teachingTeam === "away";
  const half = board?.view === "attack" ? !away : board?.view === "defense" ? away : null;
  return half == null ? { x: 0, y: 0, width: P.w, height: P.h } : { x: half ? P.w / 2 : 0, y: 0, width: P.w / 2, height: P.h };
}

function geometry() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const rot = h > w * 1.05;
  const view = fieldView();
  const fw = rot ? view.height : view.width;
  const fh = rot ? view.width : view.height;
  const scale = Math.min(w / fw, h / fh);
  return { w, h, rot, scale, view, ox: (w - fw * scale) / 2, oy: (h - fh * scale) / 2 };
}

function at(e) {
  const r = canvas.getBoundingClientRect();
  const g = geometry();
  const sx = (e.clientX - r.left - g.ox) / g.scale;
  const sy = (e.clientY - r.top - g.oy) / g.scale;
  return g.rot ? { x: g.view.x + g.view.width - sy, y: g.view.y + sx } : { x: g.view.x + sx, y: g.view.y + sy };
}

const limit = (p) => ({ x: clamp(p.x, R + 2, P.w - R - 2), y: clamp(p.y, R + 2, P.h - R - 2) });

function resize() {
  const d = dpr();
  canvas.width = Math.round(canvas.clientWidth * d);
  canvas.height = Math.round(canvas.clientHeight * d);
  draw();
  if ($("playerDialog").open) positionPlayerMenu();
}

// ---------- rendering ----------

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

function pitch(c) {
  if (board?.activity) { c.fillStyle = "#1c6749"; c.fillRect(0, 0, P.w, P.h); return; }
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
  if (ink.type === "arrow") {
    c.save(); c.setLineDash(ink.kind === "run" ? [18, 12] : []);
    arrow(c, ink.a, ink.b); c.restore(); return;
  }
  if (ink.points.length < 2) return;
  c.beginPath();
  ink.points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
}

function label(c, text, x, y, color, rot) {
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(Math.PI / 2); // keep labels upright when the field is turned
  c.fillStyle = color;
  const size = text.length > 2 ? 20 : text.length === 2 ? 25 : 30;
  c.font = `bold ${size}px system-ui, -apple-system, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, 0, 2, R * 2 - 10);
  c.restore();
}

// opts.live = on-screen (shows selection); false for exported images.
function contents(c, { rot = false, live = false } = {}) {
  pitch(c);
  c.save();
  c.strokeStyle = "#d9f99d99"; c.lineWidth = 3; c.setLineDash([12, 10]);
  if (board.guides === "thirds") for (const k of [1, 2]) { c.beginPath(); c.moveTo(P.w * k / 3, 15); c.lineTo(P.w * k / 3, P.h - 15); c.stroke(); }
  if (board.guides === "lanes") for (const k of [1, 2]) { c.beginPath(); c.moveTo(15, P.h * k / 3); c.lineTo(P.w - 15, P.h * k / 3); c.stroke(); }
  c.setLineDash([]);
  for (const mark of board.markings || []) {
    c.strokeStyle = "#ffd784"; c.lineWidth = mark.type === "gate" || mark.type === "goal" ? 10 : 4;
    if (mark.type === "rect") c.strokeRect(mark.a.x, mark.a.y, mark.b.x - mark.a.x, mark.b.y - mark.a.y);
    else { c.beginPath(); c.moveTo(mark.a.x, mark.a.y); c.lineTo(mark.b.x, mark.b.y); c.stroke(); }
    if (mark.type === "gate") for (const p of [mark.a, mark.b]) { c.beginPath(); c.arc(p.x, p.y, 10, 0, Math.PI * 2); c.fillStyle = "#ffcb54"; c.fill(); }
  }
  c.restore();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = "#fff7a8";
  c.lineWidth = 7;
  for (const ink of board.ink) strokeInk(c, ink);
  if (live && gesture?.ink) strokeInk(c, gesture.ink);

  for (const p of board.players) {
    if (p.hidden) continue;
    const fill = board.colors[p.team];
    const dark = isDark(fill);
    c.beginPath();
    c.arc(p.x, p.y, R, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = dark ? "#f4f7ef" : "#0f2e24";
    c.stroke();
    label(c, playerLabel(p), p.x, p.y, dark ? "#ffffff" : "#0b241e", rot);
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
  const kinds = new Set(board.ink.filter((i) => i.type === "arrow").map((i) => i.kind).filter(Boolean));
  if (kinds.size) {
    c.save(); c.fillStyle = "#08251de8"; c.fillRect(20, P.h - 72, 145, 54); c.strokeStyle = "#fff7a8"; c.lineWidth = 4;
    c.font = "18px system-ui"; c.fillStyle = "#eef5ea";
    let y = P.h - 50;
    for (const kind of kinds) { c.setLineDash(kind === "run" ? [9, 6] : []); c.beginPath(); c.moveTo(30, y); c.lineTo(75, y); c.stroke(); c.fillText(kind === "run" ? "Run" : "Pass", 86, y + 5); y += 23; }
    c.restore();
  }
}

function draw() {
  if (!board || !preset) return;
  if (!gesture) window.SIDELINE_WORKSPACE?.boardChanged();
  const d = dpr();
  const g = geometry();
  if (!g.w || !g.h) return;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = "#0b2a22";
  ctx.fillRect(0, 0, g.w, g.h);
  ctx.save();
  ctx.translate(g.ox, g.oy);
  ctx.scale(g.scale, g.scale);
  if (g.rot) { ctx.translate(0, g.view.width); ctx.rotate(-Math.PI / 2); }
  ctx.translate(-g.view.x, -g.view.y);
  ctx.beginPath(); ctx.rect(g.view.x, g.view.y, g.view.width, g.view.height); ctx.clip();
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
    if (p.hidden) continue;
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
  if (!board || (e.button != null && e.button !== 0)) return;
  e.preventDefault();
  if (gesture) return; // one finger at a time
  canvas.setPointerCapture(e.pointerId);
  const p = at(e);
  gesture = { origin: p, cx: e.clientX, cy: e.clientY, pointer: e.pointerId, moved: false, before: snapshot(), undoBefore: [...undo], redoBefore: [...redo] };
  if (mode === "move") {
    if (hitBall(p)) gesture.ball = true; // the ball wins over nearby players
    else gesture.target = hitPlayer(p);
    if (gesture.target) {
      const held = gesture;
      held.holdTimer = setTimeout(() => {
        if (gesture !== held || held.moved) return;
        openPlayerMenu(held.target, held.cx, held.cy);
      }, PLAYER_HOLD_MS);
    }
  } else if (mode === "arrow") {
    gesture.ink = { type: "arrow", kind: arrowKind, a: limit(p), b: limit(p) };
  } else if (mode === "pen") {
    gesture.ink = { type: "pen", points: [limit(p)] };
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
    clearTimeout(gesture.holdTimer);
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
    gesture.ink.b = limit(p);
  } else if (mode === "pen") {
    if (gesture.ink.points.length < 4000) gesture.ink.points.push(limit(p));
  } else if (mode === "erase") {
    eraseAt(p);
  }
  draw();
});

canvas.addEventListener("pointerup", (e) => {
  if (!gesture || gesture.pointer !== e.pointerId) return;
  const g = gesture;
  clearTimeout(g.holdTimer);
  gesture = null;
  if (mode === "move") {
    if (g.started && g.ball) {
      const near = hitPlayer(board.ball, DROP_RADIUS);
      if (near) {
        board.ball.carrier = near.id;
        note(`${TEAM[near.team]} ${playerName(near)} has the ball.`);
      }
    } else if (!g.moved) {
      handleTap(g);
    }
  } else if (mode === "arrow" && dist(g.ink.a, g.ink.b) > 12) {
    if (board.ink.length >= 200) { note("This board has 200 drawings. Clear ink before adding more."); draw(); return; }
    checkpoint();
    board.ink.push(g.ink);
  } else if (mode === "pen" && g.ink.points.length > 1) {
    if (board.ink.length >= 200) { note("This board has 200 drawings. Clear ink before adding more."); draw(); return; }
    checkpoint();
    board.ink.push(g.ink);
  }
  draw();
});

function cancelGesture() {
  const g = gesture;
  gesture = null;
  if (g?.started && g.before) { board = clone(g.before.board); start = clone(g.before.start); undo = g.undoBefore; redo = g.redoBefore; updateButtons(); }
  clearTimeout(g?.holdTimer);
  if (g && canvas.hasPointerCapture(g.pointer)) canvas.releasePointerCapture(g.pointer);
  draw();
}
canvas.addEventListener("pointercancel", (e) => {
  if (gesture?.pointer === e.pointerId) cancelGesture();
});
canvas.addEventListener("lostpointercapture", (e) => {
  if (gesture && gesture.pointer === e.pointerId) cancelGesture();
});
// A mouse right-click offers the same editor. Touch uses the stationary hold above.
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (mode !== "move" || e.pointerType === "touch") return;
  const point = at(e);
  const player = !hitBall(point) && hitPlayer(point);
  if (player) openPlayerMenu(player, e.clientX, e.clientY);
});
document.addEventListener("visibilitychange", () => { if (document.hidden) cancelGesture(); });
addEventListener("blur", cancelGesture);

function handleTap(g) {
  if (g.ball) {
    ballSelected = !ballSelected;
    if (ballSelected) note("Ball selected. Tap any player, or an open spot.");
    return;
  }
  const player = g.target;
  if (ballSelected) {
    ballSelected = false;
    if (player) giveBall(player, `${TEAM[player.team]} ${playerName(player)} has the ball.`);
    else placeBall(g.origin);
    return;
  }
  if (!player) return;
  const c = carrierOf();
  if (!c) note("Loose ball. Tap the ball, then a player.");
  else if (player.id === c.id) note(`${playerName(c)} has the ball. Tap a teammate to pass.`);
  else if (player.team === c.team) giveBall(player, `Pass ${playerName(c)} → ${playerName(player)}`);
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
  cancelGesture();
  mode = next;
  ballSelected = false;
  $("arrow-style").hidden = next !== "arrow";
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    const selected = btn.dataset.mode === mode;
    btn.classList.toggle("active", selected);
    btn.setAttribute("aria-pressed", String(selected));
  });
}

document.querySelectorAll("[data-mode]").forEach((btn) =>
  btn.addEventListener("click", () => {
    setMode(btn.dataset.mode);
    note({ move: "Drag to move, tap to pass, hold a player to edit its label.", arrow: "Swipe to place an arrow.",
      pen: "Swipe to draw.", erase: "Touch a line to erase it." }[mode]);
    draw();
  }));

// ---------- per-player label menu ----------

function positionPlayerMenu() {
  if (!playerMenuAnchor || !$("playerDialog").open) return;
  const dialog = $("playerDialog");
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  dialog.style.maxHeight = `${Math.max(120, height - 24)}px`;
  const rect = dialog.getBoundingClientRect();
  dialog.style.left = `${clamp(playerMenuAnchor.x + 12, left + 12, Math.max(left + 12, left + width - rect.width - 12))}px`;
  dialog.style.top = `${clamp(playerMenuAnchor.y + 12, top + 12, Math.max(top + 12, top + height - rect.height - 12))}px`;
}

function setLabelMode(next) {
  editingLabelMode = next;
  document.querySelectorAll("[data-label-mode]").forEach((button) => {
    const selected = button.dataset.labelMode === next;
    button.classList.toggle("on", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $("position-field").hidden = next !== "position";
  $("number-field").hidden = next !== "number";
  $("player-position").disabled = next !== "position";
  $("player-number").disabled = next !== "number";
  $("player-error").textContent = "";
  positionPlayerMenu();
}

function openPlayerMenu(player, x, y) {
  // Consume the held gesture before showing UI: releasing must not pass or drag.
  cancelGesture();
  ballSelected = false;
  editingPlayerId = player.id;
  playerMenuAnchor = { x, y };
  $("player-title").textContent = `${TEAM[player.team]} · ${playerName(player)}`;
  const choices = $("player-position");
  choices.replaceChildren();
  for (const [value, name] of Object.entries(preset.positions || {})) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value} — ${name}`;
    choices.append(option);
  }
  if (player.position && !Object.hasOwn(preset.positions || {}, player.position)) {
    const option = document.createElement("option"); option.value = player.position;
    option.textContent = player.position === "T" ? "T — End-zone target" : player.position === "OFF" ? "OFF — Inactive defender" : player.position;
    choices.append(option);
  }
  $("label-position").disabled = !choices.children.length;
  choices.value = player.position || Object.keys(preset.positions || {})[0] || "";
  $("player-number").value = String(player.n);
  setLabelMode(player.display === "position" && choices.children.length ? "position" : "number");
  $("playerDialog").showModal();
  positionPlayerMenu();
  draw();
}

document.querySelectorAll("[data-label-mode]").forEach((button) => {
  button.onclick = () => {
    setLabelMode(button.dataset.labelMode);
    const field = $(editingLabelMode === "position" ? "player-position" : "player-number");
    field.focus();
    if (editingLabelMode === "number") field.select();
  };
});
$("player-close").onclick = () => $("playerDialog").close();
$("playerDialog").addEventListener("close", () => { editingPlayerId = null; playerMenuAnchor = null; });
$("player-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const player = board.players.find((p) => p.id === editingPlayerId);
  if (!player) return $("playerDialog").close();
  const position = $("player-position").value;
  const rawNumber = $("player-number").value.trim();
  if (editingLabelMode === "number" && !/^\d{1,2}$/.test(rawNumber)) {
    $("player-error").textContent = "Choose a whole number from 0 to 99.";
    return;
  }
  if (editingLabelMode === "position" && position !== player.position && !Object.hasOwn(preset.positions || {}, position)) return;
  const valueChanged = editingLabelMode === "position" ? position !== player.position : Number(rawNumber) !== player.n;
  if (player.display !== editingLabelMode || valueChanged) {
    checkpoint();
    player.display = editingLabelMode;
    if (editingLabelMode === "position") player.position = position;
    else player.n = Number(rawNumber);
  }
  $("playerDialog").close();
  draw();
  note(`${TEAM[player.team]} player now shows ${playerName(player)}.`);
});
window.visualViewport?.addEventListener("resize", positionPlayerMenu);
window.visualViewport?.addEventListener("scroll", positionPlayerMenu);

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
  canvas.setAttribute("aria-label", board.activity ? `${board.activity.title} activity illustration` : `Interactive ${preset.name} coaching board`);
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
  choices.value = board.formations?.[$("setup-side").value] || board.formation || preset.defaultFormation;
  for (const team of ["home", "away"]) {
    $("sw-" + team).querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.color === board.colors[team]));
  }
}

function resetFormation(formation, message = `${formation} formation ready. Undo restores your previous board.`) {
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
  note(message);
}

$("default-field").onclick = () => {
  if (!board?.activity) return;
  resetFormation(preset.defaultFormation, "Default field ready. Tap Undo to return to your activity.");
  $("tab-board").focus({ preventScroll: true });
};

function applyFormation(side, formation) {
  if (board.activity) return resetFormation(formation);
  checkpoint();
  const other = side === "home" ? "away" : "home";
  board.formations = { home: board.formation || preset.defaultFormation, away: board.formation || preset.defaultFormation, ...board.formations, [side]: formation };
  const replacement = makeBoard(preset, formation).players.filter((p) => p.team === side);
  const original = board.players.filter((p) => p.team === side);
  board.players = [...board.players.filter((p) => p.team === other), ...replacement.map((p, i) => ({ ...original[i], ...p, id: original[i]?.id || p.id, n: original[i]?.n ?? p.n, position: original[i]?.position || p.position, display: original[i]?.display || p.display }))];
  board.formation = board.formations.home;
  start = null; anim = null; setMode("move"); syncMenu(); updateButtons(); draw();
  note(`${TEAM[side]} ${formation} ready. Set start for a new demonstration.`);
}

$("formation").onchange = () => {
  const side = $("setup-side").value;
  if (side === "home" || side === "away") applyFormation(side, $("formation").value);
  else resetFormation($("formation").value);
};
$("setup-side").onchange = syncMenu;
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
    if (undo.length && !(await (window.SIDELINE_WORKSPACE?.confirm("Switch field format? This creates a fresh board. Undo will restore your current board.", "Change format") ?? Promise.resolve(confirm("Switch format? Your unsaved board will be replaced."))))) return;
    const before = snapshot(), history = [...undo];
    const colors = { ...board.colors };
    await setFormat(format);
    undo = [...history, before];
    board.colors = colors; // keep the team's colors across formats
    syncMenu();
    draw();
    updateButtons();
    $("menuDialog").close();
    note(`${preset.name} ready.`);
  }));

$("menu").onclick = () => { cancelGesture(); syncMenu(); $("menuDialog").showModal(); };
$("help").onclick = () => { $("menuDialog").close(); $("helpDialog").showModal(); };

// Saved boards and local recovery are owned by workspace.js.
$("save").onclick = () => window.SIDELINE_WORKSPACE?.saveBoard();
$("load").onclick = () => { $("menuDialog").close(); window.SIDELINE_WORKSPACE?.openPlaybook(); };

// ---------- PNG export ----------

function imageFile() {
  const off = document.createElement("canvas");
  const view = fieldView();
  off.width = 1600;
  const fieldHeight = Math.round(off.width * view.height / view.width);
  off.height = fieldHeight + (board.activity ? 90 : 0);
  const c = off.getContext("2d");
  c.save(); c.scale(off.width / view.width, off.width / view.width); c.translate(-view.x, -view.y);
  c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
  const previousAnimation = anim;
  try { anim = null; contents(c, { rot: false, live: false }); } finally { anim = previousAnimation; }
  c.restore();
  if (board.activity) {
    const activity = window.SIDELINE_SITUATIONS?.find((s) => s.id === board.activity.id);
    c.fillStyle = "#0b2a22"; c.fillRect(0, fieldHeight, off.width, 90); c.fillStyle = "#eef5ea"; c.font = "22px system-ui";
    c.fillText(`${activity?.title || board.activity.title} · Original Sideline illustration`, 20, fieldHeight + 32, 1560);
    c.font = "16px system-ui"; c.fillText(`Source: ${activity?.source.publisher || "FIFA"} · ${activity?.source.title || ""} · ${activity?.ages || ""} · ${activity?.source.url || ""}`, 20, fieldHeight + 65, 1560);
  }
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

function installSnapshot(next, message = "Board opened. Undo restores the previous board.", recordHistory = true) {
  const valid = window.SIDELINE_DATA.readSnapshot(next, window.SIDELINE_PRESETS);
  cancelGesture();
  if (recordHistory) checkpoint(); else { undo = []; redo = []; }
  valid.board = withPlayerLabels(valid.board, window.SIDELINE_PRESETS[valid.board.format]);
  valid.start = withPlayerLabels(valid.start, window.SIDELINE_PRESETS[valid.board.format]);
  restore(valid); setMode("move");
  if (message) note(message);
  else { clearTimeout(toastTimer); $("message").classList.remove("show"); }
}

function openActivity(activity) {
  const next = makeBoard(preset);
  next.players = clone(activity.players);
  next.markings = clone(activity.markings);
  next.ball = { x: next.players[0].x, y: next.players[0].y, carrier: next.players[0].id };
  next.activity = { id: activity.id, title: activity.title, revision: 1, edited: false };
  next.view = "full"; next.guides = "none";
  next.colors = clone(board.colors);
  installSnapshot({ board: next, start: clone(next) }, "");
}

function applyLineup(team, side) {
  const data = window.SIDELINE_DATA;
  const lineup = data.lineup(team, window.SIDELINE_PRESETS), target = window.SIDELINE_PRESETS[team.format];
  const fresh = board.format !== team.format || !!board.activity;
  const next = fresh ? makeBoard(target) : clone(board);
  const oldCarrier = carrierOf(), previousBall = restingBall();
  const markerSide = makeBoard(target, team.formation).players.filter((p) => p.team === side);
  const selected = markerSide.flatMap((p, i) => lineup.players[i] ? [{ ...p, n: lineup.players[i].number, name: lineup.players[i].name, rosterId: lineup.players[i].id, sourceTeamId: team.id }] : []);
  next.players = [...next.players.filter((p) => p.team !== side), ...selected];
  next.teamNames = { ...next.teamNames, [side]: team.name };
  next.colors[side] = team.color;
  const other = side === "home" ? "away" : "home";
  if (next.colors[other] === team.color) next.colors[other] = SWATCHES.find((c) => c !== team.color);
  next.formations = { home: next.formation || target.defaultFormation, away: next.formation || target.defaultFormation, ...next.formations, [side]: team.formation };
  next.formation = next.formations.home;
  if (fresh) next.ball = { x: selected[0].x, y: selected[0].y, carrier: selected[0].id };
  else if (oldCarrier?.team === side) {
    const same = selected.find((p) => oldCarrier.rosterId && p.rosterId === oldCarrier.rosterId);
    next.ball = { ...previousBall, carrier: same?.id || null };
  }
  installSnapshot({ board: next, start: null }, `${team.name} applied. Tap Set start for a new demonstration.`);
}

function updateBoardOptions(values) {
  cancelGesture(); checkpoint();
  for (const key of ["view", "guides", "teachingTeam"]) if (values[key] != null) board[key] = values[key];
  if (values.visibility) {
    const ball = restingBall();
    for (const p of board.players) if (Object.hasOwn(values.visibility, p.id)) p.hidden = !values.visibility[p.id];
    if (board.players.find((p) => p.id === board.ball.carrier)?.hidden) board.ball = { ...ball, carrier: null };
  }
  draw();
}

function previewBoard(targetCanvas, value) {
  const previous = { board, preset, anim };
  try {
    board = value; preset = window.SIDELINE_PRESETS[value.format]; anim = null;
    const c = targetCanvas.getContext("2d");
    c.save(); c.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    c.scale(targetCanvas.width / P.w, targetCanvas.height / P.h); contents(c); c.restore();
  } finally { board = previous.board; preset = previous.preset; anim = previous.anim; }
}

window.SIDELINE_BOARD = { snapshot, install: installSnapshot, openActivity, applyLineup, options: updateBoardOptions, preview: previewBoard, redraw: resize, cancel: cancelGesture, make: makeBoard, imageFile,
  arrow(kind) { arrowKind = kind; $("arrow-pass").classList.toggle("on", kind === "pass"); $("arrow-run").classList.toggle("on", kind === "run"); $("arrow-pass").setAttribute("aria-pressed", String(kind === "pass")); $("arrow-run").setAttribute("aria-pressed", String(kind === "run")); },
};
$("arrow-pass").onclick = () => window.SIDELINE_BOARD.arrow("pass");
$("arrow-run").onclick = () => window.SIDELINE_BOARD.arrow("run");

window.SIDELINE_READY = (async () => {
  try {
    await setFormat("9v9");
    resize();
    note("Drag to move · tap to pass · hold a player to edit", 4500);
    const localPreview = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("preview");
    if ("serviceWorker" in navigator && location.protocol !== "file:" && !localPreview) {
      $("offline-status").textContent = "Preparing offline files…";
      navigator.serviceWorker.register("./sw.js").then(() => navigator.serviceWorker.ready).then(() => {
        const update = () => { $("offline-status").textContent = navigator.serviceWorker.controller ? "Offline files ready on this device." : "Offline files saved. Close and reopen Sideline to finish setup."; };
        update(); navigator.serviceWorker.addEventListener("controllerchange", update);
      }).catch((error) => { $("offline-status").textContent = "Offline setup did not complete. Reopen online to retry."; console.warn("Sideline offline setup:", error.message); });
    } else if (localPreview) {
      $("offline-status").textContent = "Local preview · offline installation skipped.";
    }
  } catch (err) {
    note("Couldn't load the field presets. Check the presets folder is next to index.html.", 10000);
    console.error(err);
  }
})();

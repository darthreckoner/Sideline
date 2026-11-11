// Persistent match ledger and UI. Board history cannot rewrite match membership.
(function () {
  "use strict";
  const M = window.SIDELINE_MATCH, B = window.SIDELINE_BOARD, W = window.SIDELINE_WORKSPACE, S = window.SIDELINE_STORE;
  const $ = (id) => document.getElementById(id);
  const node = (tag, text) => { const n = document.createElement(tag); if (text != null) n.textContent = text; return n; };
  const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  let active = null, matches = [], seasons = {}, pickedField = null, pickedBench = null, writing = Promise.resolve(), loaded = false;
  let dialogMode = null, benchSignature = null, fieldSignature = null, lastSwap = "";
  function persist() {
    const value = structuredClone({ key: "matches", active, matches, seasons });
    writing = writing.catch(() => {}).then(() => S.run("workspace", "put", value));
    writing.catch(() => W.notice("Match could not save. Keep this window open and export match records from Details."));
    return writing;
  }
  function act(fn) { try { fn(); persist(); render(); } catch (e) { W.notice(e.message); } }
  function button(parent, text, fn) { const b = node("button", text); b.type = "button"; b.onclick = async () => { try { await fn(); } catch (e) { W.notice(e.message); } }; parent.append(b); return b; }
  function field(label, type, value) { const l = node("label", label), input = node("input"); input.type = type; input.value = value; l.append(input); $("match-body").append(l); return input; }
  function kitColor(label, value) {
    const group = node("fieldset"); group.className = "kit-color";
    group.append(node("legend", label));
    const swatches = node("div"); swatches.className = "swatches";
    const customLabel = node("label", "Custom color"), input = node("input");
    input.type = "color"; input.value = value; input.setAttribute("aria-label", label);
    customLabel.className = "custom-kit-color"; customLabel.append(input);
    const refresh = () => {
      for (const b of swatches.children) { const selected = b.dataset.color === input.value; b.classList.toggle("on", selected); b.setAttribute("aria-pressed", String(selected)); }
    };
    for (const [color, name] of window.SIDELINE_DATA.palette) {
      const b = button(swatches, "", () => { input.value = color; refresh(); });
      b.dataset.color = color; b.style.background = color;
      b.setAttribute("aria-label", `${label}: ${name}`); b.title = name;
    }
    input.oninput = input.onchange = refresh;
    group.append(swatches, customLabel); $("match-body").append(group); refresh();
    return { get value() { return input.value; }, set value(color) { input.value = color; refresh(); } };
  }
  function show(mode, title) { dialogMode = mode; $("match-title").textContent = title; $("match-body").replaceChildren(); if (!$("matchDialog").open) $("matchDialog").showModal(); }
  let pitchState = null;
  function context() {
    const team = active ? { id:active.teamId, name:active.teamName, format:active.format, formation:active.formation, roster:active.roster, assignments:active.slots, color:active.color || "#ffcb54" } : W.currentTeam();
    const side = active?.side || "home";
    const board = B.make(window.SIDELINE_PRESETS[team.format], team.formation);
    board.teachingTeam = side; board.colors[side] = team.color;
    if (active?.opponentColor) board.colors[side === "home" ? "away" : "home"] = active.opponentColor;
    const markers = board.players.filter(p=>p.team === side);
    board.players = board.players.filter(p=>p.team !== side);
    markers.forEach((marker,i)=>{
      const person = team.roster.find(p=>p.id === team.assignments[i]);
      if (person) board.players.push({...marker, rosterId:person.id, n:person.number, name:person.name, sourceTeamId:team.id, lineupSlot:i, display:"number"});
    });
    board.ball = {x:500,y:310,carrier:null};
    return {team, side, board, markers:board.players.filter(p=>p.team === side)};
  }
  function renderPitch() {
    if (!W.ready) return;
    const canvas = $("match-pitch"), box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const {board, team, side} = context(); pitchState = board;
    // Only your players matter during a match; opponents are generic formation markers.
    board.players = board.players.filter((p) => p.team === side);
    const ratio = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.round(box.width * ratio); canvas.height = Math.round(box.height * ratio);
    B.preview(canvas, board, { selectedRoster: pickedField == null ? null : active?.slots[pickedField] });
    $("match-context").textContent = active ? `${active.teamName} vs ${active.opponent}` : `${team.name} - current Team lineup`;
    const ownHome = !active || active.side === "home";
    $("match-team-name").textContent = ownHome ? team.name : active.opponent;
    $("match-opponent-name").textContent = ownHome ? active?.opponent || "Opponent" : team.name;
    $("match-team-name").style.setProperty("--team-color", board.colors.home);
    $("match-opponent-name").style.setProperty("--team-color", board.colors.away);
  }
  function setup() {
    if (!loaded) return W.notice("Opening match records…");
    if (active) return details();
    const { team, markers, board } = context();
    show("setup", "Match setup");
    if (!team.roster.length || !markers.length) { $("match-body").append(node("p", "Choose your starters in Team before starting a match.")); button($("match-body"), "Open Team", () => { $("matchDialog").close(); W.switchTab("team"); }); return; }
    $("match-body").append(node("p", team.name));
    const opponent = field("Opponent", "text", ""); opponent.maxLength = 80;
    const venueLabel = node("label", "My team plays"), venue = node("select");
    for (const [value, text] of [["home", "Home"], ["away", "Away"]]) { const o = node("option", text); o.value = value; venue.append(o); }
    venue.setAttribute("aria-label", "My team plays");
    venueLabel.append(venue); $("match-body").append(venueLabel);
    const ownColor = kitColor("My team color", team.color);
    const opponentColor = kitColor("Opponent color", board.colors.away);
    venue.onchange = () => { ownColor.value = venue.value === "home" ? team.color : team.awayColor || "#ffffff"; };
    const half = field("Minutes per half", "number", 25); half.min = 1; half.max = 90;
    const season = field("Season", "text", seasons[team.id]?.at(-1) || String(new Date().getFullYear())); season.maxLength = 80;
    const footer = node("div"); footer.className = "dialog-footer"; $("match-body").append(footer);
    const prepare = button(footer, "Prepare match", async () => {
      try {
        const name = season.value.trim(); if (!name) throw Error("Name the season first.");
        window.SIDELINE_DATA.lineup(team, window.SIDELINE_PRESETS);
        // create() copies the validated Team lineup; subsequent Team edits do not change the match.
        const prepared = M.create({ id: window.SIDELINE_DATA.id(), team, side: venue.value, halfMinutes: Number(half.value), season: name, opponent: opponent.value.trim() || "Opponent" });
        prepared.color = ownColor.value;
        prepared.opponentColor = opponentColor.value;
        active = prepared; seasons[team.id] ||= []; if (!seasons[team.id].includes(name)) seasons[team.id].push(name);
        await persist(); $("matchDialog").close(); pickedField = pickedBench = null; render();
      } catch (e) { W.notice(e.message); }
    });
    prepare.classList.add("accent");
  }
  function selection() {
    if (pickedField == null || !pickedBench) return renderBench();
    if (active) {
      const outgoing = active.roster.find(p=>p.id===active.slots[pickedField]);
      const incoming = active.roster.find(p=>p.id===pickedBench);
      act(() => { M.substitute(active, pickedField, pickedBench); lastSwap = `On: #${incoming.number} ${incoming.name}. Off: #${outgoing.number} ${outgoing.name}.`; });
    }
    else {
      W.notice("Prepare the match before making substitutions.");
    }
    pickedField = pickedBench = null; render();
  }
  function chooseField(slot) {
    if (!active) return;
    if (pickedField != null && pickedField !== slot && !pickedBench) {
      const first = active.roster.find(p => p.id === active.slots[pickedField]);
      const second = active.roster.find(p => p.id === active.slots[slot]);
      act(() => {
        M.swapPositions(active, pickedField, slot);
        lastSwap = `Swapped positions: #${first.number} ${first.name} and #${second.number} ${second.name}.`;
      });
      pickedField = pickedBench = null;
      render();
      return;
    }
    pickedField = pickedField === slot ? null : slot;
    selection();
    renderPitch();
  }
  function renderBench() {
    const { team, markers } = context();
    const roster = active?.roster || team?.roster.filter((p) => p.available) || [];
    const slots = active?.slots || markers.map((p) => p.rosterId);
    const bench = roster.filter((p) => !slots.includes(p.id));
    $("sideline").hidden = !active;
    const selected = roster.find(p=>p.id === (pickedField != null ? slots[pickedField] : pickedBench));
    const hint = selected ? `#${selected.number} ${selected.name}: ${pickedField != null ? "choose another on-field player or a substitute" : "choose an on-field player"}` : "Tap two players to swap positions, or a player and a substitute";
    $("match-selection").textContent = active ? (selected ? hint : lastSwap || "Tap two players to swap positions, or a player and a substitute") : "Prepare a match to enable substitutions.";
    const key = JSON.stringify([slots, roster.map(p=>[p.id,p.number,p.name]), pickedField]);
    if (key !== fieldSignature) {
      fieldSignature = key; const list = $("match-field-players"); list.replaceChildren();
      slots.forEach((id,i)=>{const p=roster.find(p=>p.id===id); if(p) { const b=button(list, `#${p.number} ${p.name}`,()=>{ chooseField(i); }); b.setAttribute("aria-pressed",String(i===pickedField)); }});
    }
    $("sub-hint").textContent = hint;
    $("cancel-sub").hidden = pickedField == null && !pickedBench;
    const root = $("sideline-players");
    const signature = JSON.stringify([bench.map(p => [p.id, p.number, p.name]), pickedBench, !!roster.length]);
    if (signature === benchSignature) return;
    benchSignature = signature;
    root.replaceChildren();
    for (const p of bench) { const b = button(root, `#${p.number} ${p.name}`, () => { pickedBench = pickedBench === p.id ? null : p.id; selection(); }); b.setAttribute("aria-pressed", String(pickedBench === p.id)); }
    if (!bench.length && roster.length) root.append(node("small", "No subs"));
  }
  const phaseText = () => active.phase === "ready" ? "Ready for kickoff" : active.phase === "halftime" ? "Halftime" : active.running ? "Running" : "Paused";
  function tick() {
    if (!active) return;
    const c = M.clock(active);
    $("match-phase").textContent = phaseText();
    $("match-clock").textContent = `${active.half === 1 ? "1st" : "2nd"} ${fmt(c.main)}`;
    $("match-stoppage").textContent = c.stoppage || M.elapsed(active) >= active.halfMs ? `+${fmt(c.stoppage)}` : "";
    if (dialogMode === "details" && $("matchDialog").open) {
      const times = M.times(active);
      for (const el of document.querySelectorAll("[data-player-time]")) el.textContent = fmt(times[el.dataset.playerTime] || 0);
    }
  }
  function render() {
    const hasStarters = context().markers.length > 0;
    $("match-view").dataset.state = active ? "live" : "idle";
    $("match-view").dataset.phase = active?.phase || "";
    $("match-prereq").hidden = !!active;
    $("match-prereq-text").textContent = hasStarters ? "Lineup ready. Add the opponent, kit colors and half length to get ready for kickoff." : "Choose your starters in Team first.";
    $("match-prereq").querySelector("button").hidden = hasStarters;
    document.querySelector(".match-layout").hidden = !active && !hasStarters;
    renderPitch(); renderBench();
    $("open-match").hidden = !!active;
    for (const id of ["match-toggle", "match-end", "match-goal", "match-details"]) $(id).hidden = !active;
    if (!active) { $("match-phase").textContent = "Not started"; lastSwap = ""; pickedField = pickedBench = null; $("match-clock").textContent = $("match-stoppage").textContent = $("match-score").textContent = ""; return; }
    $("match-toggle").textContent = active.phase === "ready" ? "Begin first half" : active.phase === "halftime" ? "Begin second half" : active.running ? "Pause" : "Resume";
    $("match-end").hidden = active.phase !== "playing";
    $("match-end").textContent = active.half === 1 ? "End of half" : "End match";
    $("match-goal").disabled = active.phase !== "playing";
    const ownGoals = active.goals.filter(g => g.playerId !== null).length;
    const opponentGoals = active.goals.filter(g => g.playerId === null).length;
    $("match-score").textContent = active.side === "away" ? `${opponentGoals} \u2013 ${ownGoals}` : `${ownGoals} \u2013 ${opponentGoals}`;
    tick();
  }
  function goals() {
    show("goals", "Record a goal");
    for (const onField of [true,false]) {
      const people = active.roster.filter(p=>active.slots.includes(p.id)===onField);
      if (!people.length) continue;
      const grid = node("div"); grid.className = "pick-grid";
      $("match-body").append(node("h3", onField ? "On field" : "Substitutes"), grid);
      for (const p of people) button(grid, `#${p.number} ${p.name}`, () => { act(() => M.goal(active, p.id)); $("matchDialog").close(); });
    }
    const other = node("div"); other.className = "pick-opponent"; $("match-body").append(other);
    button(other, "Opponent goal", () => { act(() => M.goal(active, null)); $("matchDialog").close(); }).style.setProperty("--team-color", active.opponentColor || "#59b7e8");
  }
  function table(parent, rows, live = false) {
    const wrap = node("div"); wrap.className = "stat-scroll";
    const table = node("table"), head = node("tr");
    for (const title of ["Player", "Games", "Time played", "Goals"]) head.append(node("th", title)); table.append(head);
    for (const p of rows) { const row = node("tr"); const identity = node("td", `#${p.number} ${p.name}`); identity.title = identity.textContent; row.append(identity, node("td", p.games)); const time = node("td", fmt(p.ms)); if (live) time.dataset.playerTime = p.id; row.append(time, node("td", p.goals)); table.append(row); }
    wrap.append(table); parent.append(wrap);
  }
  function details() {
    if (!active) return setup();
    show("details", `${active.teamName} vs ${active.opponent}`);
    const body = $("match-body"); body.append(node("p", `${active.season} · ${phaseText()}`));
    const view = { ...active, time: M.times(active) }; table(body, M.totals([view]), true);
    body.append(node("h3", "Goals — tap to correct"));
    active.goals.forEach((g, i) => button(body, `${g.playerId === null ? "Opponent" : active.roster.find((p) => p.id === g.playerId)?.name} · Half ${g.half} ${fmt(g.elapsed)} · Remove`, async () => {
      if (await W.confirm("Remove this goal from the score and player stats?", "Remove goal")) { act(() => active.goals.splice(i, 1)); details(); }
    }));
    button(body, "Export match records", exportRecords);
    button(body, "Discard this match", async () => { if (await W.confirm("Discard this match and its recorded time and goals?", "Discard")) { active = null; await persist(); $("matchDialog").close(); render(); } }).classList.add("danger");
  }
  function exportRecords() {
    const a = node("a"), url = URL.createObjectURL(new Blob([JSON.stringify({ kind: "sideline-matches", version: 1, active, matches, seasons }, null, 2)], { type: "application/json" }));
    a.href = url; a.download = "sideline-matches.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function stats(season) {
    show("stats", `${W.currentTeam().name} statistics`);
    const body = $("match-body"), teamId = W.currentTeam().id;
    const label = node("label", "Season"), picker = node("select"); label.append(picker); body.append(label);
    const names = [...new Set([...(seasons[teamId] || []), ...matches.filter((m) => m.teamId === teamId).map((m) => m.season)])];
    for (const name of names) { const o = node("option", name); o.value = name; picker.append(o); }
    if (names.length) picker.value = names.includes(season) ? season : names.at(-1);
    const content = node("div"); body.append(content);
    const draw = () => {
      content.replaceChildren();
      const list = matches.filter((m) => m.teamId === teamId && m.season === picker.value);
      content.append(node("h3", "Season totals")); table(content, M.totals(list));
      if (!list.length) content.append(node("p", "Completed matches will appear here."));
      for (const m of list.slice().reverse()) {
        const score = `${m.goals.filter((g) => g.playerId !== null).length}–${m.goals.filter((g) => g.playerId === null).length}`;
        const d = node("details"), summary = node("summary", `${new Date(m.date).toLocaleDateString()} · ${m.opponent} · ${score}`); d.append(summary); table(d, M.totals([m])); content.append(d);
        button(d, "Add missed goal", () => {
          show("correction", "Add a missed goal");
          const choices = [...m.roster, { id: null, name: "Opponent", number: "" }];
          for (const p of choices) button($("match-body"), p.name, async () => { m.goals.push({ playerId: p.id, half: null, elapsed: null, corrected: true }); await persist(); stats(m.season); });
        });
        m.goals.forEach((g, i) => button(d, `${g.playerId === null ? "Opponent" : m.roster.find((p) => p.id === g.playerId)?.name} goal · Remove`, async () => {
          if (await W.confirm("Remove this goal from this game and season totals?", "Remove goal")) { m.goals.splice(i, 1); await persist(); draw(); }
        }));
        button(d, "Delete this match", async () => {
          if (!(await W.confirm(`Delete the match against ${m.opponent}? Its time and goals will be removed from season totals. This can't be undone.`, "Delete match"))) return;
          matches = matches.filter((x) => x !== m); await persist(); draw();
        }).classList.add("danger");
      }
    };
    picker.onchange = draw; draw(); button(body, "Export match records", exportRecords);
  }
  $("open-match").onclick = setup; $("match-details").onclick = details; $("team-stats").onclick = () => stats();
  $("match-close").onclick = () => $("matchDialog").close(); $("matchDialog").addEventListener("close", () => { dialogMode = null; });
  $("cancel-sub").onclick = () => { pickedField = pickedBench = null; lastSwap = "Selection cancelled."; renderBench(); renderPitch(); };
  $("match-goal").onclick = goals;
  $("match-toggle").onclick = () => act(() => active.phase === "halftime" ? M.secondHalf(active) : M.toggle(active));
  $("match-end").onclick = async () => {
    if (!(await W.confirm(active.half === 1 ? "End the first half and pause all player timers?" : "End this match and save its statistics?", active.half === 1 ? "End of half" : "End match"))) return;
    try {
      M.endHalf(active);
      if (active.phase === "finished") { matches.push(structuredClone(active)); active = null; }
      await persist(); render();
      if (!active) W.notice("Match saved. View it in Team → Game & season stats.");
    } catch (e) { W.notice(e.message); }
  };
  $("match-pitch").addEventListener("click", (event)=>{
    if (!active || !pitchState) return;
    // Inverse of the fitted, possibly upright field drawn by B.preview.
    const field = window.SIDELINE_PRESETS[pitchState.format].field, canvas = $("match-pitch"), r = canvas.getBoundingClientRect(), rot = r.height > r.width;
    const fw = rot ? field.height : field.width, fh = rot ? field.width : field.height;
    const scale = Math.min(r.width / fw, r.height / fh);
    const sx = (event.clientX - r.left - (r.width - fw * scale) / 2) / scale;
    const sy = (event.clientY - r.top - (r.height - fh * scale) / 2) / scale;
    const x = rot ? field.width - sy : sx, y = rot ? sx : sy;
    const player = pitchState.players.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (player && Math.hypot(player.x - x, player.y - y) < 46) chooseField(active.slots.indexOf(player.rosterId));
  });
  new ResizeObserver(renderPitch).observe($("match-pitch"));
  window.SIDELINE_MATCH_UI = { get selectedRoster() { return pickedField == null ? null : active?.slots[pickedField]; }, refresh: render, get active() { return active; }, flush: () => writing };
  async function loadRecords() {
    if (loaded) return;
    try {
      const saved = await S.run("workspace", "get", "matches");
      if (saved) { active = saved.active; matches = saved.matches || []; seasons = saved.seasons || {}; }
      loaded = true;
      render();
      setInterval(tick, 250);
    } catch (e) { W.notice("Match records could not open. Reload before starting another match."); }
  }
  addEventListener("sideline-workspace-ready", loadRecords, { once: true });
  if (W.ready) loadRecords();
})();

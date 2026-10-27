// App workspaces and persistence. The canvas remains one long-lived board instance.
(function () {
  "use strict";
  const D = window.SIDELINE_DATA, Store = window.SIDELINE_STORE, B = window.SIDELINE_BOARD;
  const presets = window.SIDELINE_PRESETS, situations = window.SIDELINE_SITUATIONS;
  const el = (id) => document.getElementById(id);
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  let activeTab = "board", collection = "situations", teams = [], selectedTeam = null;
  let ready = false, draftTimer, teamTimer, noticeTimer, draftSerial = "", writingDraft = Promise.resolve();
  let pendingName = null, editingPlayer = null, playbookRevision = 0;

  function notice(text) {
    el("app-notice").textContent = text; el("app-notice").hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { el("app-notice").hidden = true; }, 4500);
  }
  function storageStatus(text, error = false, channel = "both") {
    const targets = channel === "board" ? ["save-status"] : channel === "team" ? ["team-status"] : ["save-status", "team-status"];
    for (const name of targets) { el(name).textContent = text; el(name).classList.toggle("error", error); }
  }
  function failure(error, channel = "both") { storageStatus("Couldn't save · export a backup", true, channel); notice(error.message || "Sideline couldn't save on this device. Export a file to keep your work."); }
  async function confirmChange(message, accept = "Continue") {
    const dialog = el("confirmDialog");
    if (dialog.open) return false;
    el("confirm-message").textContent = message; el("confirm-accept").textContent = accept;
    dialog.returnValue = "cancel"; dialog.showModal();
    return new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue === "accept"), { once: true }));
  }
  function chooseName(title, current, callback) {
    pendingName = callback; el("name-title").textContent = title; el("board-name").value = current || ""; el("name-error").textContent = "";
    el("nameDialog").showModal(); el("board-name").focus(); el("board-name").select();
  }
  el("name-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = el("board-name").value.trim(); if (!name || !pendingName) return;
    const submit = el("name-form").querySelector("button[type=submit]"); submit.disabled = true;
    try { await pendingName(name); pendingName = null; el("nameDialog").close(); }
    catch (error) { el("name-error").textContent = error.message || "The save failed. Your board is still open."; failure(error); }
    finally { submit.disabled = false; }
  });
  el("nameDialog").addEventListener("close", () => { pendingName = null; });
  document.querySelectorAll("[data-close]").forEach((button) => button.onclick = () => el(button.dataset.close).close());

  function switchTab(tab, moveFocus = true) {
    if (!["board", "coaching", "team"].includes(tab)) return;
    B.cancel();
    if (el("menuDialog").open) el("menuDialog").close();
    activeTab = tab;
    if (location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
    for (const name of ["board", "coaching", "team"]) {
      el(`${name}-view`).hidden = name !== tab;
      el(`tab-${name}`).setAttribute("aria-selected", String(name === tab));
      el(`tab-${name}`).tabIndex = name === tab ? 0 : -1;
    }
    if (tab === "board") B.redraw();
    if (tab === "coaching") { syncAids(); if (collection === "playbook") renderPlaybook(); }
    if (moveFocus) {
      if (tab === "board") el("tab-board").focus();
      else el(`${tab}-view`).querySelector("h1").focus({ preventScroll: true });
    }
  }
  document.querySelectorAll("[data-tab]").forEach((button, index, buttons) => {
    button.onclick = () => switchTab(button.dataset.tab);
    button.onkeydown = (event) => {
      const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
      if (next != null) { event.preventDefault(); switchTab(buttons[next].dataset.tab, false); buttons[next].focus(); }
    };
  });
  document.querySelectorAll("[data-open-tab]").forEach((button) => button.onclick = () => switchTab(button.dataset.openTab));
  addEventListener("hashchange", () => { const tab = location.hash.slice(1); if (tab !== activeTab) switchTab(["board", "coaching", "team"].includes(tab) ? tab : "board"); });

  function updateCue() {
    const state = B.snapshot().board, activity = situations.find((s) => s.id === state.activity?.id);
    el("activity-controls").hidden = !activity;
    if (!activity) return;
    el("active-lesson-title").textContent = `${activity.title} · ${activity.ages} · ${activity.size}`;
    el("active-lesson-cue").textContent = activity.cue;
    el("active-lesson-question").textContent = activity.question;
    el("active-lesson-source").onclick = () => showSource(activity, state.activity.edited);
  }
  function boardChanged() {
    if (!ready) return;
    updateCue();
    const serial = JSON.stringify(B.snapshot());
    if (serial === draftSerial) return;
    draftSerial = serial; storageStatus("Saving on this device…", false, "board");
    clearTimeout(draftTimer); draftTimer = setTimeout(() => persistDraft(serial), 250);
  }
  function persistDraft(serial = JSON.stringify(B.snapshot())) {
    clearTimeout(draftTimer);
    // Serialize writes so an earlier transaction cannot report success after a later failure.
    writingDraft = writingDraft.catch(() => {}).then(() => Store.run("workspace", "put", { key: "current", snapshot: JSON.parse(serial), updated: Date.now() }));
    writingDraft.then(() => { if (serial === draftSerial) storageStatus("Saved on this device", false, "board"); }).catch((error) => { draftSerial = ""; failure(error, "board"); });
    return writingDraft;
  }
  async function persistTeams() {
    clearTimeout(teamTimer); teamTimer = null;
    try { await Store.run("workspace", "put", { key: "teams", teams: D.copy(teams), selectedTeam }); storageStatus("Saved on this device", false, "team"); }
    catch (error) { failure(error, "team"); throw error; }
  }
  function scheduleTeamSave() {
    storageStatus("Saving on this device…", false, "team"); clearTimeout(teamTimer); teamTimer = setTimeout(() => persistTeams().catch(() => {}), 250);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden || !ready) return;
    B.cancel(); if (draftTimer) persistDraft().catch(() => {}); if (teamTimer) persistTeams().catch(() => {});
  });

  function showSource(activity, edited = false) {
    const body = el("source-details"); body.replaceChildren();
    const reference = create("div", "source-reference");
    reference.append(create("h3", "", activity.source.publisher), create("p", "", activity.source.title));
    reference.append(create("p", "quiet", `${activity.ages} · ${activity.size} · Published ${activity.source.date}`));
    reference.append(create("p", "quiet", activity.section));
    if (activity.source.coach) reference.append(create("p", "quiet", `Source coach: ${activity.source.coach}`));
    const link = create("a", "", "Read the original FIFA lesson ↗"); link.href = activity.source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; reference.append(link);
    body.append(reference, create("h3", "", "How to play"), create("p", "", activity.conditions), create("h3", "", "What this board shows"), create("p", "", activity.changes), create("p", "quiet", activity.adaptation), create("p", "quiet", `${edited ? "This is your copy; any changes you make are your own. " : ""}Source checked ${activity.checked}. You can read these details offline, but the FIFA link needs internet.`));
    el("sourceDialog").showModal();
  }
  function activitySnapshot(activity) {
    const value = B.make(presets["9v9"]);
    value.activity = { id: activity.id, title: activity.title, revision: 1, edited: false };
    value.players = D.copy(activity.players); value.markings = D.copy(activity.markings); value.ink = [];
    value.ball = { x: value.players[0].x, y: value.players[0].y, carrier: value.players[0].id };
    return value;
  }
  function renderSituations() {
    const age = el("age-filter").value, topic = el("topic-filter").value;
    const list = situations.filter((s) => (age === "all" || (age === "u10" ? s.ages === "U-10" : s.ages === "8–12")) && (topic === "all" || s.topic === topic));
    const root = el("situation-list"); root.replaceChildren();
    for (const activity of list) {
      const card = create("article", "situation-card"), image = create("canvas"); image.width = 1000; image.height = 620; image.setAttribute("aria-label", `${activity.title} schematic preview`);
      card.append(create("p", "meta", `${activity.ages} · ${activity.size}`), create("h2", "", activity.title), image, create("p", "", activity.cue), create("p", "question", activity.question));
      const actions = create("div", "button-row"), open = create("button", "accent", "Open on board"), source = create("button", "", "How to play & source");
      open.onclick = () => { B.openActivity(activity); el("active-lesson").open = false; switchTab("board"); };
      source.onclick = () => showSource(activity);
      actions.append(open, source); card.append(actions); root.append(card); B.preview(image, activitySnapshot(activity));
    }
    el("situation-count").textContent = `${list.length} ${list.length === 1 ? "activity" : "activities"}`;
    el("situation-empty").hidden = !!list.length;
  }
  el("age-filter").onchange = el("topic-filter").onchange = renderSituations;
  function syncAids() {
    const board = B.snapshot().board;
    el("teaching-team").value = board.teachingTeam || "home"; el("guide-choice").value = board.guides || "none"; el("view-choice").value = board.view || "full";
    const root = el("visible-players"); root.replaceChildren();
    for (const player of board.players) {
      const label = create("label"), input = create("input"); input.type = "checkbox"; input.checked = !player.hidden;
      input.onchange = () => B.options({ visibility: { [player.id]: input.checked } });
      label.append(input, create("span", "", `${player.team === "home" ? "Home" : "Away"} ${player.position || "#" + player.n}`)); root.append(label);
    }
  }
  el("teaching-team").onchange = () => B.options({ teachingTeam: el("teaching-team").value });
  el("guide-choice").onchange = () => B.options({ guides: el("guide-choice").value });
  el("view-choice").onchange = () => B.options({ view: el("view-choice").value });
  el("show-all-players").onclick = () => { B.options({ visibility: Object.fromEntries(B.snapshot().board.players.map((p) => [p.id, true])) }); syncAids(); };
  el("hide-opponents").onclick = () => { const board = B.snapshot().board; B.options({ visibility: Object.fromEntries(board.players.filter((p) => p.team !== (board.teachingTeam || "home")).map((p) => [p.id, false])) }); syncAids(); };
  el("full-field").onclick = () => { B.options({ view: "full" }); el("menuDialog").close(); };

  function setCollection(name) {
    collection = name;
    el("situations-panel").hidden = name !== "situations"; el("playbook-panel").hidden = name !== "playbook";
    for (const n of ["situations", "playbook"]) { el(`show-${n}`).classList.toggle("on", n === name); el(`show-${n}`).setAttribute("aria-pressed", String(n === name)); }
    if (name === "playbook") renderPlaybook();
  }
  el("show-situations").onclick = () => setCollection("situations"); el("show-playbook").onclick = () => setCollection("playbook");
  function openPlaybook() { setCollection("playbook"); switchTab("coaching"); }
  async function saveRecord(record) { await Store.run("boards", "put", record); notice("Board saved on this device."); if (collection === "playbook") await renderPlaybook(); }
  function saveBoard() {
    try {
      const snapshot = D.readSnapshot(B.snapshot(), presets);
      if (snapshot.board.activity) snapshot.board.activity.edited = true;
      chooseName("Save board to playbook", snapshot.board.activity?.title || "", (name) => saveRecord({ slot: D.id(), name, board: snapshot.board, start: snapshot.start, updated: Date.now() }));
    } catch (error) { notice(error.message); }
  }
  async function renderPlaybook() {
    const revision = ++playbookRevision;
    try {
      const records = await Store.run("boards", "getAll");
      if (revision !== playbookRevision) return;
      const query = el("playbook-search").value.trim().toLowerCase();
      const list = records.filter((s) => `${s.name} ${s.board.activity?.title || ""} ${s.board.format}`.toLowerCase().includes(query)).sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || b.updated - a.updated);
      const root = el("playbook-list"); root.replaceChildren(); el("playbook-empty").hidden = !!list.length;
      for (const record of list) {
        const row = create("article", "playbook-row"), image = create("canvas"); image.width = 400; image.height = 248;
        const description = create("div", "description"), actions = create("div", "actions");
        description.append(create("strong", "", record.name), create("small", "", `${record.board.activity?.title || record.board.format} · ${new Date(record.updated).toLocaleDateString()}`));
        const action = (label, handler) => { const button = create("button", "", label); button.onclick = async () => { try { await handler(); } catch (error) { failure(error); } }; actions.append(button); };
        action("Open", () => { B.install(D.readSnapshot(record, presets)); switchTab("board"); });
        action(record.favorite ? "★" : "☆", () => saveRecord({ ...record, favorite: !record.favorite }));
        action("Rename", () => chooseName("Rename board", record.name, (name) => saveRecord({ ...record, name, updated: Date.now() })));
        action("Copy", () => saveRecord({ ...D.copy(record), slot: D.id(), name: `${record.name} copy`.slice(0, 80), updated: Date.now() }));
        action("Export", () => exportJSON({ kind: "sideline-board", version: 1, name: record.name, snapshot: D.readSnapshot(record, presets) }, "sideline-board.json"));
        action("Delete", async () => { if (await confirmChange(`Delete "${record.name}" from this device? Export it first if you want a backup.`, "Delete board")) { await Store.run("boards", "delete", record.slot); await renderPlaybook(); } });
        row.append(image, description, actions); root.append(row); B.preview(image, record.board);
      }
    } catch (error) { failure(error); }
  }
  el("playbook-search").oninput = renderPlaybook;

  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = create("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 12000);
  }
  async function exportJSON(doc, filename) {
    const raw = JSON.stringify(doc, null, 2);
    if (raw.length > 2_000_000 || (doc.kind === "sideline-playbook" && doc.boards.length > 100)) throw Error("This backup is too large for one import. Export boards individually, or reduce the drawings.");
    const file = new File([raw], filename, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try { await navigator.share({ files: [file] }); return; } catch (error) { if (error.name === "AbortError") return; }
    }
    download(file, filename); notice("Editable file downloaded.");
  }
  el("export-board").onclick = async () => { try { await exportJSON({ kind: "sideline-board", version: 1, name: B.snapshot().board.activity?.title || "Soccer board", snapshot: D.readSnapshot(B.snapshot(), presets) }, "sideline-board.json"); } catch (error) { notice(error.message); } };
  el("export-playbook").onclick = async () => {
    try { const records = await Store.run("boards", "getAll"); await exportJSON({ kind: "sideline-playbook", version: 1, boards: records.map((r) => ({ name: r.name, snapshot: D.readSnapshot(r, presets) })) }, "sideline-playbook.json"); } catch (error) { failure(error); }
  };
  document.querySelectorAll(".import-file").forEach((button) => button.onclick = () => el("import-input").click());
  el("import-input").onchange = async () => {
    const file = el("import-input").files[0]; el("import-input").value = ""; if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error("Choose a Sideline file smaller than 2 MB.");
      const doc = D.readFile(await file.text(), presets);
      const description = doc.kind === "sideline-board" ? `Open "${doc.name}"? Tap Undo to bring back your current board.` : doc.kind === "sideline-team" ? `Import "${doc.team.name}" as a new team? Your board won't change.` : `Import ${doc.boards.length} boards as copies in your playbook?`;
      if (!(await confirmChange(description, "Import"))) return;
      if (doc.kind === "sideline-board") { B.install(doc.snapshot); switchTab("board"); }
      else if (doc.kind === "sideline-team") {
        const team = D.copyTeam(doc.team, presets);
        const nextTeams = [...teams, team]; clearTimeout(teamTimer); teamTimer = null;
        await Store.run("workspace", "put", { key: "teams", teams: nextTeams, selectedTeam: team.id });
        teams = nextTeams; selectedTeam = team.id; storageStatus("Saved on this device", false, "team"); renderTeam(); switchTab("team");
      } else {
        await Store.putAll("boards", doc.boards.map((item) => ({ slot: D.id(), name: item.name, ...item.snapshot, updated: Date.now() })));
        openPlaybook();
      }
      notice(doc.kind === "sideline-board" ? "Board opened. Tap Undo to bring back your previous board." : "Imported a copy.");
    } catch (error) { notice(error.message || "Could not import this file."); }
  };

  const currentTeam = () => teams.find((t) => t.id === selectedTeam);
  function setCurrentTeam(value) { teams[teams.findIndex((t) => t.id === selectedTeam)] = value; }
  function renderTeam() {
    const team = currentTeam(); if (!team) return;
    const picker = el("team-picker"); picker.replaceChildren();
    for (const t of teams) { const option = create("option", "", t.name || "Unnamed team"); option.value = t.id; picker.append(option); } picker.value = team.id;
    el("team-name").value = team.name; el("team-format").value = team.format; el("team-color").value = team.color;
    const options = el("team-formation"); options.replaceChildren();
    for (const formation of Object.keys(presets[team.format].formations)) { const option = create("option", "", formation); option.value = formation; options.append(option); } options.value = team.formation;
    const savedChoices = el("saved-lineups"); savedChoices.replaceChildren();
    const draft = create("option", "", "Current lineup draft"); draft.value = ""; savedChoices.append(draft);
    for (const saved of team.lineups || []) { const option = create("option", "", `${saved.name} · ${saved.format} ${saved.formation}`); option.value = saved.id; savedChoices.append(option); }
    savedChoices.value = team.activeLineup || "";
    const assigned = new Set(team.assignments), roster = el("roster-list"); roster.replaceChildren();
    el("roster-count").textContent = `${team.roster.length} players`; el("roster-empty").hidden = !!team.roster.length;
    for (const player of team.roster) {
      const row = create("div", "roster-row"), available = create("input"); available.type = "checkbox"; available.checked = player.available; available.setAttribute("aria-label", `${player.name} available for this lineup`);
      available.onchange = () => { player.available = available.checked; team.activeLineup = ""; if (!player.available) team.assignments = team.assignments.map((pid) => pid === player.id ? null : pid); renderTeam(); scheduleTeamSave(); };
      const person = create("div", "person"); person.append(create("strong", "", `#${player.number} ${player.name}`), create("small", "", `${!player.available ? "Unavailable" : assigned.has(player.id) ? "Starting" : "Bench"}${player.role ? " · Try " + player.role : ""}`));
      const edit = create("button", "", "Edit"); edit.setAttribute("aria-label", `Edit ${player.name}`); edit.onclick = () => openPlayer(player);
      const remove = create("button", "delete", "Remove"); remove.setAttribute("aria-label", `Remove ${player.name}`);
      remove.onclick = async () => { if (await confirmChange(`Remove ${player.name} from this team? Your saved boards won't change.`, "Remove player")) { team.roster = team.roster.filter((p) => p.id !== player.id); team.assignments = team.assignments.map((pid) => pid === player.id ? null : pid); for (const saved of team.lineups || []) { saved.assignments = saved.assignments.map((pid) => pid === player.id ? null : pid); saved.available = saved.available.filter((pid) => pid !== player.id); } team.activeLineup = ""; renderTeam(); scheduleTeamSave(); } };
      row.append(available, person, edit, remove); roster.append(row);
    }
    const slots = el("lineup-slots"); slots.replaceChildren();
    presets[team.format].formationPositions[team.formation].forEach((role, i) => {
      const label = create("label"), select = create("select"), empty = create("option", "", "Choose player"); empty.value = ""; select.append(empty);
      for (const p of team.roster.filter((p) => p.available)) { const option = create("option", "", `#${p.number} ${p.name}`); option.value = p.id; select.append(option); }
      select.value = team.assignments[i] || ""; select.setAttribute("aria-label", `Starting ${role}`);
      select.onchange = () => { setCurrentTeam({ ...D.assign(currentTeam(), i, select.value), activeLineup: "" }); renderTeam(); scheduleTeamSave(); };
      label.append(create("span", "", role), select); slots.append(label);
    });
    const bench = team.roster.filter((p) => p.available && !assigned.has(p.id));
    const starters = team.assignments.filter(Boolean).length;
    el("lineup-count").textContent = `${starters} starting · ${bench.length} bench`;
    el("bench-list").replaceChildren(...(bench.length ? bench.map((p) => create("span", "bench-chip", `#${p.number} ${p.name}`)) : [create("span", "quiet", "No available bench players")]));
    el("short-handed").checked = !!team.shortHanded;
    const preview = B.make(presets[team.format], team.formation);
    preview.players = preview.players.filter((p) => p.team === "home").flatMap((p, i) => {
      const rosterPlayer = team.roster.find((r) => r.id === team.assignments[i]);
      return rosterPlayer ? [{ ...p, n: rosterPlayer.number, display: "number" }] : [];
    });
    preview.colors.home = team.color;
    preview.ball = { x: 500, y: 310, carrier: null };
    B.preview(el("lineup-preview"), preview);
    el("lineup-error").textContent = "";
  }
  el("team-picker").onchange = () => { selectedTeam = el("team-picker").value; renderTeam(); scheduleTeamSave(); };
  el("new-team").onclick = () => { const team = D.newTeam(presets); teams.push(team); selectedTeam = team.id; renderTeam(); scheduleTeamSave(); el("team-settings").open = true; el("team-name").focus(); el("team-name").select(); };
  el("copy-team").onclick = () => { const copied = D.copyTeam(currentTeam(), presets); copied.name = `${copied.name} copy`.slice(0, 48); teams.push(copied); selectedTeam = copied.id; renderTeam(); scheduleTeamSave(); };
  el("delete-team").onclick = async () => { if (await confirmChange(`Delete "${currentTeam().name}" and its roster from this device? Your saved boards won't change.`, "Delete team")) { teams = teams.filter((t) => t.id !== selectedTeam); if (!teams.length) teams.push(D.newTeam(presets)); selectedTeam = teams[0].id; renderTeam(); scheduleTeamSave(); } };
  el("save-lineup").onclick = () => chooseName("Save lineup as", "", async (name) => {
    const team = D.copy(currentTeam()); team.lineups ||= [];
    if (team.lineups.length >= 30) throw Error("This team already has 30 saved lineups. Export it before making another team copy.");
    const saved = { id: D.id(), name, format: team.format, formation: team.formation, assignments: D.copy(team.assignments), available: team.roster.filter((p) => p.available).map((p) => p.id), shortHanded: !!team.shortHanded };
    team.lineups.push(saved); team.activeLineup = saved.id;
    const nextTeams = teams.map((t) => t.id === team.id ? team : t); clearTimeout(teamTimer); teamTimer = null;
    await Store.run("workspace", "put", { key: "teams", teams: nextTeams, selectedTeam });
    teams = nextTeams; renderTeam(); storageStatus("Saved on this device", false, "team"); notice("Lineup saved. Apply it when ready.");
  });
  el("saved-lineups").onchange = () => {
    const team = currentTeam(), saved = team.lineups?.find((s) => s.id === el("saved-lineups").value); if (!saved) { team.activeLineup = ""; return; }
    team.format = saved.format; team.formation = saved.formation; team.assignments = D.copy(saved.assignments); team.shortHanded = !!saved.shortHanded; team.activeLineup = saved.id;
    team.roster.forEach((p) => { p.available = saved.available.includes(p.id); }); renderTeam(); scheduleTeamSave(); notice("Saved lineup opened in Team. Your board is unchanged.");
  };
  el("reset-availability").onclick = () => { currentTeam().roster.forEach((p) => { p.available = true; }); currentTeam().activeLineup = ""; renderTeam(); scheduleTeamSave(); };
  el("team-name").oninput = () => { currentTeam().name = el("team-name").value; scheduleTeamSave(); };
  el("team-name").onchange = () => renderTeam();
  function changeTeamShape() {
    const team = currentTeam(), format = el("team-format").value;
    const formation = team.format === format ? el("team-formation").value : presets[format].defaultFormation;
    setCurrentTeam({ ...D.changeShape(team, format, formation, presets), activeLineup: "" }); renderTeam(); scheduleTeamSave(); notice("Check your lineup for the new formation. Your board hasn't changed.");
  }
  el("team-format").onchange = el("team-formation").onchange = changeTeamShape;
  const colorNames = ["Gold", "Orange", "Red", "Pink", "Violet", "Blue", "Sky", "Navy", "White", "Black"];
  ["#ffcb54", "#ff9f1c", "#ef4444", "#ff7eb6", "#a78bfa", "#2563eb", "#5dc2ff", "#1e3a8a", "#ffffff", "#1d1d1f"].forEach((color, i) => { const option = create("option", "", colorNames[i]); option.value = color; el("team-color").append(option); });
  el("team-color").onchange = () => { currentTeam().color = el("team-color").value; renderTeam(); scheduleTeamSave(); };
  el("short-handed").onchange = () => { currentTeam().shortHanded = el("short-handed").checked; currentTeam().activeLineup = ""; scheduleTeamSave(); };
  for (const section of ["roster", "lineup"]) el(`team-${section}-tab`).onclick = () => {
    el("team-view").dataset.section = section;
    for (const name of ["roster", "lineup"]) { el(`team-${name}-tab`).classList.toggle("on", name === section); el(`team-${name}-tab`).setAttribute("aria-pressed", String(name === section)); }
  };
  function openPlayer(player) {
    editingPlayer = player?.id || null; el("roster-title").textContent = player ? "Edit player" : "Add player";
    el("roster-name").value = player?.name || "";
    const numbers = new Set(currentTeam().roster.map((p) => p.number));
    el("roster-number").value = player?.number ?? Array.from({ length: 100 }, (_, i) => i + 1).find((n) => n <= 99 && !numbers.has(n)) ?? 0;
    const roles = el("roster-role"); roles.replaceChildren(); const any = create("option", "", "Any role"); any.value = ""; roles.append(any);
    for (const [value, name] of Object.entries(presets[currentTeam().format].positions)) { const option = create("option", "", `${value} · ${name}`); option.value = value; roles.append(option); } roles.value = player?.role || "";
    el("roster-error").textContent = ""; el("rosterDialog").showModal(); el("roster-name").focus();
  }
  el("add-player").onclick = () => openPlayer();
  el("roster-form").onsubmit = (event) => {
    event.preventDefault(); const team = currentTeam(), name = el("roster-name").value.trim(), raw = el("roster-number").value;
    if (!name || !/^\d{1,2}$/.test(raw)) { el("roster-error").textContent = "Enter a name and whole jersey number from 0 to 99."; return; }
    if (team.roster.some((p) => p.id !== editingPlayer && p.number === Number(raw))) { el("roster-error").textContent = "That jersey number is already in this roster."; return; }
    if (editingPlayer) { const player = team.roster.find((p) => p.id === editingPlayer); player.name = name; player.number = Number(raw); player.role = el("roster-role").value; }
    else { if (team.roster.length >= 40) { el("roster-error").textContent = "This team already has 40 players."; return; } team.roster.push({ id: D.id(), name, number: Number(raw), available: true, role: el("roster-role").value }); }
    el("rosterDialog").close(); renderTeam(); scheduleTeamSave();
  };
  el("apply-lineup").onclick = async () => {
    try {
      const team = D.copy(currentTeam()), side = el("apply-side").value, plan = D.lineup(team, presets), board = B.snapshot().board;
      const fresh = board.format !== team.format || board.activity;
      const warning = fresh ? "This starts a full-team board and clears the current drawings and activity." : "The other team's positions and your drawings will stay as they are.";
      const message = `Apply ${team.name} to ${side === "home" ? "Home" : "Away"}? ${team.format}, ${team.formation}, ${plan.players.filter(Boolean).length} starting and ${plan.bench.length} on the bench. ${warning} Your saved starting point will be cleared. Tap Undo to bring back your previous board.`;
      if (!(await confirmChange(message, "Apply to board"))) return;
      try { await persistTeams(); } catch { /* Keep the unsaved team in memory; applying is still useful. */ }
      B.applyLineup(team, side); switchTab("board");
    } catch (error) { el("lineup-error").textContent = error.message; }
  };
  el("export-team").onclick = () => { try { exportJSON({ kind: "sideline-team", version: 1, team: D.readTeam(currentTeam(), presets) }, "sideline-team.json").catch(failure); } catch (error) { notice(error.message); } };

  window.SIDELINE_WORKSPACE = { boardChanged, saveBoard, openPlaybook, confirm: confirmChange, switchTab, notice, flush: () => Promise.all([persistDraft(), persistTeams()]) };
  (async function boot() {
    await window.SIDELINE_READY;
    try {
      const [savedDraft, savedTeams] = await Promise.all([Store.run("workspace", "get", "current"), Store.run("workspace", "get", "teams")]);
      if (savedDraft) B.install(D.readSnapshot(savedDraft.snapshot, presets), "Recovered your last board draft.", false);
      if (savedTeams) { teams = savedTeams.teams.map((team) => D.readTeam(team, presets)); selectedTeam = savedTeams.selectedTeam; }
      storageStatus("Saved on this device");
    } catch (error) { failure(error); }
    if (!teams.length) teams = [D.newTeam(presets)];
    if (!teams.some((t) => t.id === selectedTeam)) selectedTeam = teams[0].id;
    renderTeam(); renderSituations(); updateCue();
    ready = true; draftSerial = JSON.stringify(B.snapshot());
    const requested = location.hash.slice(1); switchTab(["board", "coaching", "team"].includes(requested) ? requested : "board", false);
    window.SIDELINE_RELEASE_NOTES.start();
  })().catch((error) => { console.error(error); notice("A workspace could not open. Your existing local saves have not been removed."); });
})();

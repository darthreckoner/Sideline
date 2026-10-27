// The notes belong to the release loaded by this page, not a waiting worker.
(function () {
  "use strict";
  const releases = window.SIDELINE_RELEASES;
  const current = releases[releases.length - 1];
  const store = window.SIDELINE_STORE;
  const el = (id) => document.getElementById(id);
  const dialog = el("releaseDialog");
  const prefix = "release-seen:";
  let pending = null, opened = false, startPromise = null, waitingFor = null, dismissing = false;

  function versionParts(value) {
    if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) return null;
    const parts = value.split(".").map(Number);
    return parts.every(Number.isSafeInteger) ? parts : null;
  }
  function compareVersions(a, b) {
    const x = versionParts(a), y = versionParts(b);
    if (!x || !y) return null;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return 0;
  }
  function lastAcknowledged(records) {
    let last = null;
    for (const record of records) {
      if (typeof record?.key !== "string" || !record.key.startsWith(prefix)) continue;
      const version = record.key.slice(prefix.length);
      if (versionParts(version) && (last === null || compareVersions(version, last) > 0)) last = version;
    }
    return last;
  }
  function render(entries, storageUnavailable) {
    const list = el("release-list");
    list.replaceChildren();
    for (const release of entries.slice().reverse()) {
      const section = document.createElement("section"); section.className = "release-section";
      const heading = document.createElement("h3"); heading.textContent = `Version ${release.version}`;
      const items = document.createElement("ul");
      for (const change of release.changes) {
        const item = document.createElement("li"); item.textContent = change; items.append(item);
      }
      section.append(heading, items); list.append(section);
    }
    const warning = el("release-storage-error");
    warning.hidden = !storageUnavailable;
    warning.textContent = storageUnavailable ? "Sideline couldn't check what's already been seen. This may appear again if the device can't save it." : "";
  }
  function open(entries, storageUnavailable = false) {
    if (dialog.open) return;
    opened = true; pending = null;
    render(entries, storageUnavailable); dialog.showModal();
  }
  function showPending() {
    if (!pending || opened) return;
    const other = document.querySelector("dialog[open]");
    if (other) {
      if (waitingFor !== other) {
        waitingFor = other;
        other.addEventListener("close", () => { waitingFor = null; showPending(); }, { once: true });
      }
      return;
    }
    open(pending.entries, pending.storageUnavailable);
  }
  async function checkForNotes() {
    let last = null, storageUnavailable = false;
    try { last = lastAcknowledged(await store.run("workspace", "getAll")); }
    catch { storageUnavailable = true; }
    if (opened || (last && compareVersions(last, current.version) >= 0)) return;
    const entries = last ? releases.filter((release) => compareVersions(release.version, last) > 0) : [current];
    if (entries.length) { pending = { entries, storageUnavailable }; showPending(); }
  }
  function start() {
    if (!startPromise) startPromise = checkForNotes();
    return startPromise;
  }

  el("show-release-notes").onclick = async () => {
    el("menuDialog").close();
    await start();
    if (!dialog.open) open(pending?.entries || [current], pending?.storageUnavailable || false);
  };
  async function dismiss() {
    if (dismissing || !dialog.open) return;
    dismissing = true;
    // Each version has its own key: an older open tab cannot overwrite a newer acknowledgment.
    try { await store.run("workspace", "put", { key: prefix + current.version }); }
    catch {
      window.SIDELINE_WORKSPACE?.notice("Couldn't remember that you closed What's new. It may appear again next time.");
    }
    dialog.close(); dismissing = false;
  }
  el("release-close").onclick = dismiss;
  el("release-dismiss").onclick = dismiss;
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); return dismiss(); });

  const subject = `Sideline feedback (v${current.version})`;
  const body = `Hi,\n\nI'd like to share this feedback about Sideline:\n\n\nSideline version: ${current.version}`;
  el("send-feedback").href = `mailto:darthreckoner@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.SIDELINE_RELEASE_NOTES = { start };
})();

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const releaseCode = fs.readFileSync(path.join(root, "release-notes.js"), "utf8");
const releaseData = fs.readFileSync(path.join(root, "releases.js"), "utf8");

function harness({ versions = ["0.5.6"], records = new Map(), unavailable = false, failWrite = false, read = null } = {}) {
  const elements = new Map();
  const messages = [];
  function element(tag = "div") {
    const listeners = new Map();
    return {
      tag, children: [], open: false, hidden: false, textContent: "", className: "",
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(name, fn, options = {}) {
        const entries = listeners.get(name) || [];
        entries.push({ fn, once: options.once }); listeners.set(name, entries);
      },
      async dispatch(name, event) {
        const entries = listeners.get(name) || [];
        listeners.set(name, entries.filter((entry) => !entry.once));
        await Promise.all(entries.map((entry) => entry.fn(event)));
      },
      showModal() { this.open = true; },
      close() {
        if (!this.open) return;
        this.open = false;
        const entries = listeners.get("close") || [];
        listeners.set("close", entries.filter((entry) => !entry.once));
        for (const entry of entries) entry.fn();
      },
    };
  }
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const store = {
    async run(table, method, value) {
      assert.equal(table, "workspace");
      if (unavailable) throw Error("Storage unavailable");
      if (method === "getAll") return read ? read() : [...records.values()];
      if (method === "put") { if (failWrite) throw Error("Storage full"); records.set(value.key, value); return value.key; }
      throw Error(`Unexpected storage method: ${method}`);
    },
  };
  const releases = versions.map((version) => ({ version, changes: [`Changes in ${version}`] }));
  const document = {
    getElementById: get,
    createElement: element,
    querySelector: (selector) => {
      assert.equal(selector, "dialog[open]");
      return [get("menuDialog"), get("otherDialog"), get("releaseDialog")].find((item) => item.open) || null;
    },
  };
  const window = { SIDELINE_RELEASES: releases, SIDELINE_STORE: store, SIDELINE_WORKSPACE: { notice: (message) => messages.push(message) } };
  vm.runInNewContext(releaseCode, { window, document, encodeURIComponent }, { filename: "release-notes.js" });
  return { get, window, records, messages };
}

function displayedVersions(h) {
  return h.get("release-list").children.map((section) => section.children[0].textContent);
}

test("first visit shows the latest release, dismissal survives reopening, and notes can be reopened", async () => {
  const records = new Map();
  const first = harness({ records });
  await first.window.SIDELINE_RELEASE_NOTES.start();
  assert.equal(first.get("releaseDialog").open, true);
  assert.deepEqual(displayedVersions(first), ["Version 0.5.6"]);
  await first.get("release-dismiss").onclick();
  assert.ok(records.has("release-seen:0.5.6"));

  const reopened = harness({ records });
  await reopened.window.SIDELINE_RELEASE_NOTES.start();
  assert.equal(reopened.get("releaseDialog").open, false);
  reopened.get("menuDialog").showModal();
  await reopened.get("show-release-notes").onclick();
  assert.equal(reopened.get("menuDialog").open, false);
  assert.equal(reopened.get("releaseDialog").open, true);
  await reopened.get("release-close").onclick();
  assert.equal(reopened.get("releaseDialog").open, false);
});

test("a newer release shows all retained changes since the last dismissal", async () => {
  const board = { key: "current", snapshot: { players: ["kept"] } };
  const records = new Map([["release-seen:0.5.6", { key: "release-seen:0.5.6" }], ["current", board]]);
  const h = harness({ versions: ["0.5.6", "0.5.7", "0.5.10"], records });
  await h.window.SIDELINE_RELEASE_NOTES.start();
  assert.deepEqual(displayedVersions(h), ["Version 0.5.10", "Version 0.5.7"]);
  let prevented = false;
  await h.get("releaseDialog").dispatch("cancel", { preventDefault() { prevented = true; } });
  assert.equal(prevented, true); // Escape waits for the acknowledgment before closing.
  assert.ok(records.has("release-seen:0.5.10"));
  assert.equal(records.get("current"), board);
  const reopened = harness({ versions: ["0.5.6", "0.5.7", "0.5.10"], records });
  await reopened.window.SIDELINE_RELEASE_NOTES.start();
  assert.equal(reopened.get("releaseDialog").open, false);
});

test("an old tab cannot undo a newer dismissal or make an older release pop up", async () => {
  const records = new Map();
  const older = harness({ versions: ["0.5.6"], records });
  const newer = harness({ versions: ["0.5.6", "0.5.7"], records });
  await older.window.SIDELINE_RELEASE_NOTES.start();
  await newer.window.SIDELINE_RELEASE_NOTES.start();
  await newer.get("release-dismiss").onclick();
  await older.get("release-dismiss").onclick();
  const reopened = harness({ versions: ["0.5.6", "0.5.7"], records });
  await reopened.window.SIDELINE_RELEASE_NOTES.start();
  assert.equal(reopened.get("releaseDialog").open, false);
  const rolledBack = harness({ versions: ["0.5.6"], records });
  await rolledBack.window.SIDELINE_RELEASE_NOTES.start();
  assert.equal(rolledBack.get("releaseDialog").open, false);
});

test("the automatic notice waits for another dialog and manual opening keeps missed changes", async () => {
  const records = new Map([["release-seen:0.5.6", { key: "release-seen:0.5.6" }]]);
  const h = harness({ versions: ["0.5.6", "0.5.7", "0.5.8"], records });
  h.get("menuDialog").showModal();
  await h.window.SIDELINE_RELEASE_NOTES.start();
  assert.equal(h.get("releaseDialog").open, false);
  await h.get("show-release-notes").onclick();
  assert.equal(h.get("releaseDialog").open, true);
  assert.deepEqual(displayedVersions(h), ["Version 0.5.8", "Version 0.5.7"]);
  await h.get("release-dismiss").onclick();
  assert.ok(records.has("release-seen:0.5.8"));
});

test("failure to read or save the acknowledgment leaves the dialog usable and explains the limitation", async () => {
  const h = harness({ unavailable: true });
  await h.window.SIDELINE_RELEASE_NOTES.start();
  assert.equal(h.get("releaseDialog").open, true);
  assert.equal(h.get("release-storage-error").hidden, false);
  await h.get("release-dismiss").onclick();
  assert.equal(h.get("releaseDialog").open, false);
  assert.match(h.messages[0], /may appear again/i);
});

test("a failed dismissal write closes the dialog and warns that it may return", async () => {
  const h = harness({ failWrite: true });
  await h.window.SIDELINE_RELEASE_NOTES.start();
  await h.get("release-dismiss").onclick();
  assert.equal(h.get("releaseDialog").open, false);
  assert.match(h.messages[0], /may appear again/i);
});

test("the automatic notice opens after another dialog closes", async () => {
  const h = harness();
  h.get("otherDialog").showModal();
  await h.window.SIDELINE_RELEASE_NOTES.start();
  assert.equal(h.get("releaseDialog").open, false);
  h.get("otherDialog").close();
  assert.equal(h.get("releaseDialog").open, true);
});

test("manual opening during a slow storage read retains all missed releases", async () => {
  const records = new Map([["release-seen:0.5.6", { key: "release-seen:0.5.6" }]]);
  let finishRead;
  const h = harness({ versions: ["0.5.6", "0.5.7", "0.5.8"], records, read: () => new Promise((resolve) => { finishRead = resolve; }) });
  const starting = h.window.SIDELINE_RELEASE_NOTES.start();
  h.get("menuDialog").showModal();
  const manual = h.get("show-release-notes").onclick();
  finishRead([...records.values()]);
  await Promise.all([starting, manual]);
  assert.deepEqual(displayedVersions(h), ["Version 0.5.8", "Version 0.5.7"]);
});

test("feedback opens an editable email with the current version and no board contents", () => {
  const h = harness();
  const email = new URL(h.get("send-feedback").href);
  assert.equal(email.protocol, "mailto:");
  assert.equal(email.pathname, "darthreckoner@gmail.com");
  assert.equal(email.searchParams.get("subject"), "Sideline feedback (v0.5.6)");
  assert.match(email.searchParams.get("body"), /Sideline version: 0\.5\.6/);
  assert.doesNotMatch(email.searchParams.get("body"), /roster|players|saved board/i);
});

test("release entries are ordered, usable, and match the offline cache version", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(releaseData, sandbox);
  const entries = sandbox.window.SIDELINE_RELEASES;
  assert.ok(entries.length > 0);
  const asParts = (version) => {
    assert.match(version, /^\d+\.\d+\.\d+$/);
    return version.split(".").map(Number);
  };
  let previous;
  for (const entry of entries) {
    const parts = asParts(entry.version);
    assert.ok(entry.changes.length && entry.changes.every((change) => typeof change === "string" && change.trim()));
    if (previous) assert.ok(parts.some((part, index) => part > previous[index] && parts.slice(0, index).every((n, i) => n === previous[i])), "Release versions must increase");
    previous = parts;
  }
  const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const cache = worker.match(/const CACHE = "sideline-v([^"]+)"/);
  assert.ok(cache);
  assert.equal(cache[1], entries[entries.length - 1].version);
});

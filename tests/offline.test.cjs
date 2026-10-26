const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");

function worker() {
  const handlers = {};
  const stores = new Map([["another-app", new Map()], ["sideline-old", new Map()]]);
  const scope = "https://example.test/Sideline/";
  let fetches = 0, forcedActivations = 0;
  const sandbox = {
    URL, Request, Response,
    self: {
      registration: { scope },
      addEventListener: (name, fn) => { handlers[name] = fn; },
      clients: { claim: async () => {} },
      skipWaiting: () => { forcedActivations++; },
    },
    fetch: async () => { fetches++; throw Error("Offline"); },
    caches: {
      keys: async () => [...stores.keys()],
      delete: async (key) => stores.delete(key),
      open: async (name) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name);
        return {
          addAll: async (requests) => {
            const entries = requests.map((request) => {
              assert.equal(request.cache, "reload", "New releases must not precache stale HTTP responses");
              const file = "./" + request.url.slice(scope.length);
              const local = file === "./" ? "index.html" : file;
              return [new URL(file, scope).href, fs.readFileSync(path.join(root, local))];
            });
            entries.forEach(([url, bytes]) => store.set(url, bytes));
          },
          match: async (request) => {
            const url = new URL(request.url || request, scope); url.search = "";
            const bytes = store.get(url.href);
            return bytes && new Response(bytes);
          },
        };
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "sw.js"), "utf8"), sandbox);
  const lifecycle = async (name) => {
    let promise; handlers[name]({ waitUntil: (value) => { promise = value; } }); await promise;
  };
  return {
    stores, scope, lifecycle,
    forcedActivations: () => forcedActivations,
    fetches: () => fetches,
    request: (url, method = "GET") => {
      let response;
      handlers.fetch({ request: { url, method }, respondWith: (value) => { response = value; } });
      return response;
    },
  };
}

test("a complete offline install contains every referenced script, stylesheet, and icon", async () => {
  const w = worker();
  await w.lifecycle("install");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const paths = [...html.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)].map((match) => match[1]);
  paths.push("./icons/icon-512.png");
  for (const file of paths) {
    const response = await w.request(new URL(file, w.scope).href);
    assert.equal(response.status, 200, file);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(path.join(root, file)));
  }
  assert.equal(w.fetches(), 0);
});

test("offline navigation works with query strings without requesting the network", async () => {
  const w = worker(); await w.lifecycle("install");
  const response = await w.request(w.scope + "?from=homescreen");
  assert.match(await response.text(), /id="reset-formation"/);
  assert.equal(w.fetches(), 0);
});

test("updates wait for old sessions and cleanup preserves other apps' caches", async () => {
  const w = worker(); await w.lifecycle("install");
  assert.equal(w.forcedActivations(), 0);
  await w.lifecycle("activate");
  assert.ok(w.stores.has("another-app"));
  assert.equal(w.stores.has("sideline-old"), false);
  assert.equal([...w.stores.keys()].filter((key) => key.startsWith("sideline-")).length, 1);
});

test("the worker leaves unrelated pages, unknown assets, and writes alone", async () => {
  const w = worker(); await w.lifecycle("install");
  assert.equal(w.request("https://example.test/other-app/"), undefined);
  assert.equal(w.request(w.scope + "missing.js"), undefined);
  assert.equal(w.request(w.scope, "POST"), undefined);
});

test("runtime presets match JSON sources and all formations contain the stated player count", () => {
  const sandbox = { window: {} };
  for (const format of ["9v9", "7v7"]) {
    const file = "presets/soccer-" + format;
    vm.runInNewContext(fs.readFileSync(path.join(root, file + ".js"), "utf8"), sandbox);
    const data = JSON.parse(fs.readFileSync(path.join(root, file + ".json"), "utf8"));
    assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.SIDELINE_PRESETS[format])), data);
    for (const positions of Object.values(data.formations)) {
      assert.equal(positions.length, data.playerCount);
      assert.ok(positions.every(([x, y]) => x >= 0 && x <= data.field.width && y >= 0 && y <= data.field.height));
    }
  }
});

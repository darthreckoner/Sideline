// Run with Playwright available on NODE_PATH. Uses an ephemeral local server.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const evidence = process.env.SIDELINE_EVIDENCE;
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try { const bytes = fs.readFileSync(file); response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); response.end(bytes); }
  catch { response.writeHead(404).end(); }
});

async function swipe(session, x, y, endY) {
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i++) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (endY - y) * i / 12 }] });
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function run() {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const failures = [], errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    // iOS keeps the layout viewport while its keyboard shrinks/pans the visual
    // viewport. Desktop emulation cannot open that native keyboard, so replay
    // its viewport events against the actual application and rendered dialog.
    const viewport = new EventTarget();
    Object.assign(viewport, { width: innerWidth, height: innerHeight, offsetLeft: 0, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    window.setVisibleViewport = (width, height, left = 0, top = 0) => {
      Object.assign(viewport, { width, height, offsetLeft: left, offsetTop: top });
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    };
  });
  async function check(name, fn) {
    try { await fn(); console.log("PASS " + name); }
    catch (error) { failures.push(name + ": " + error.message); console.error("FAIL " + failures.at(-1)); }
  }
  async function screenshot(name, clip) {
    if (!evidence) return;
    fs.mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, name + ".png"), ...(clip ? { clip } : {}) });
  }
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/?preview=1`);
    await page.locator("#releaseDialog[open]").waitFor();
    await page.locator("#release-dismiss").click();
    await page.locator("#tab-team").click();
    await page.locator("#team-lineup-tab").click();
    await page.locator("#lineup-preview").evaluate((node) => {
      const scroller = document.getElementById("team-view");
      scroller.scrollTop += node.getBoundingClientRect().top - 210;
    });
    const session = await context.newCDPSession(page);
    await check("first upward swipe over lineup preview scrolls to assignments", async () => {
      const before = await page.locator("#team-view").evaluate((node) => node.scrollTop);
      const box = await page.locator("#lineup-preview").boundingBox();
      await swipe(session, box.x + box.width / 2, Math.min(box.y + box.height - 15, 610), box.y + 15);
      await page.waitForTimeout(150);
      const after = await page.locator("#team-view").evaluate((node) => node.scrollTop);
      assert.ok(after > before + 40, `scrollTop stayed ${before} → ${after}`);
    });
    await screenshot("lineup-first-swipe");
    for (const width of [320, 430]) await check(`lineup preview scrolls on first swipe at width ${width}`, async () => {
      await page.setViewportSize({ width, height: 700 });
      await page.locator("#lineup-preview").evaluate((node) => {
        const scroller = document.getElementById("team-view");
        scroller.scrollTop += node.getBoundingClientRect().top - 210;
      });
      const before = await page.locator("#team-view").evaluate((node) => node.scrollTop);
      const box = await page.locator("#lineup-preview").boundingBox();
      await swipe(session, box.x + box.width / 2, box.y + box.height - 15, box.y + 15);
      await page.waitForTimeout(150);
      assert.ok(await page.locator("#team-view").evaluate((node) => node.scrollTop) > before + 40);
    });
    await page.locator("#tab-board").click();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => setVisibleViewport(844, 390));
    async function playerPoint() {
      return page.evaluate(() => {
        const player = window.SIDELINE_BOARD.snapshot().board.players[0];
        const g = geometry(), box = document.getElementById("board").getBoundingClientRect();
        return { x: box.left + g.ox + (player.x - g.view.x) * g.scale, y: box.top + g.oy + (player.y - g.view.y) * g.scale };
      });
    }
    await check("short portrait empty-field touch swipe scrolls without changing board", async () => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.evaluate(() => { document.getElementById("board-view").scrollTop = 0; });
      const before = await page.evaluate(() => JSON.stringify(SIDELINE_BOARD.snapshot()));
      const start = await page.locator("#board").evaluate(n => { const r=n.getBoundingClientRect(); return {x:r.left+8,y:r.top+150}; });
      await swipe(session, start.x, start.y, start.y - 100);
      assert.ok(await page.locator("#board-view").evaluate(n=>n.scrollTop)>50);
      assert.equal(await page.evaluate(() => JSON.stringify(SIDELINE_BOARD.snapshot())), before);
      await page.setViewportSize({ width: 844, height: 390 });
      await page.evaluate(() => { document.getElementById("board-view").scrollTop = 0; });
    });
    await check("board still consumes touch drags and Undo restores the player", async () => {
      const before = await page.evaluate(() => window.SIDELINE_BOARD.snapshot().board.players[0]);
      const point = await playerPoint();
      await swipe(session, point.x, point.y, point.y + 45);
      assert.ok(await page.evaluate((start) => Math.abs(window.SIDELINE_BOARD.snapshot().board.players[0].y - start.y) > 20, before));
      await page.locator("#undo").click();
      assert.deepEqual(await page.evaluate(() => window.SIDELINE_BOARD.snapshot().board.players[0]), before);
    });
    const point = await playerPoint();
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(650);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.locator("#playerDialog[open]").waitFor();
    await page.locator("#label-number").click();
    await page.locator("#player-number").focus();
    await page.evaluate(() => setVisibleViewport(844, 155));
    await check("landscape player editor fits above numeric keyboard", async () => {
      const box = await page.locator("#playerDialog").boundingBox();
      assert.ok(box.y >= 8 && box.y + box.height <= 147, `dialog bounds ${JSON.stringify(box)} exceed visible height 155`);
      assert.equal(await page.locator("#player-number").evaluate((node) => {
        const a = node.getBoundingClientRect(), b = document.getElementById("playerDialog").getBoundingClientRect();
        return a.top >= b.top && a.bottom <= b.bottom;
      }), true, "focused number is clipped inside the dialog");
    });
    await screenshot("player-number-keyboard", { x: 0, y: 0, width: 844, height: 155 });
    for (const [width, height, offset] of [[667, 130, 0], [844, 190, 40], [932, 155, 25]]) {
      await check(`keyboard viewport ${width}×${height} at offset ${offset}`, async () => {
        await page.setViewportSize({ width, height: 430 });
        await page.evaluate(([w, h, y]) => setVisibleViewport(w, h, 0, y), [width, height, offset]);
        const dialog = await page.locator("#playerDialog").boundingBox();
        const number = await page.locator("#player-number").boundingBox();
        const apply = await page.locator("#player-form button[type=submit]").boundingBox();
        assert.ok(dialog.y >= offset + 8 && dialog.y + dialog.height <= offset + height - 8, `dialog ${JSON.stringify(dialog)}`);
        for (const box of [number, apply]) assert.ok(box.y >= dialog.y && box.y + box.height <= dialog.y + dialog.height, `control ${JSON.stringify(box)}`);
        await screenshot(`keyboard-${width}x${height}-offset${offset}`, { x: 0, y: offset, width, height });
      });
    }
    await check("rotating to portrait keeps the focused number visible", async () => {
      await page.setViewportSize({ width: 390, height: 700 });
      await page.evaluate(() => setVisibleViewport(390, 300, 0, 40));
      const dialog = await page.locator("#playerDialog").boundingBox();
      const number = await page.locator("#player-number").boundingBox();
      assert.ok(dialog.y >= 48 && dialog.y + dialog.height <= 332);
      assert.ok(number.y >= dialog.y && number.y + number.height <= dialog.y + dialog.height);
      assert.equal(await page.locator("#playerDialog").evaluate((node) => node.classList.contains("compact")), false);
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => setVisibleViewport(844, 155));
    await check("number and Apply remain reachable with keyboard open", async () => {
      await page.locator("#player-number").fill("29");
      const apply = page.locator("#player-form button[type=submit]");
      await apply.scrollIntoViewIfNeeded();
      const box = await apply.boundingBox();
      assert.ok(box.y >= 8 && box.y + box.height <= 147, `Apply bounds ${JSON.stringify(box)} are under keyboard`);
      await apply.click();
      assert.equal(await page.evaluate(() => window.SIDELINE_BOARD.snapshot().board.players[0].n), 29);
    });
    await check("keyboard dismissal restores the full editor", async () => {
      await page.evaluate(() => setVisibleViewport(844, 390));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const point = await playerPoint();
      await page.evaluate(({ x, y }) => document.getElementById("board").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y })), point);
      await page.locator("#playerDialog[open]").waitFor();
      assert.equal(await page.locator("#playerDialog").evaluate((node) => node.classList.contains("compact")), false);
      await screenshot("player-editor-keyboard-dismissed");
      await page.locator("#player-close").click();
    });
    await check("current release reopens offline with the mobile fixes", async () => {
      await page.evaluate(() => window.SIDELINE_WORKSPACE.flush());
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      await context.setOffline(true);
      try {
        await page.reload();
        await page.waitForFunction(() => document.getElementById("save-status").textContent === "Saved on this device");
        assert.equal(await page.evaluate(() => window.SIDELINE_RELEASES.at(-1).version), "0.6.0");
        assert.equal(await page.evaluate(() => window.SIDELINE_BOARD.snapshot().board.players[0].n), 29);
        await page.setViewportSize({ width: 390, height: 700 });
        await page.locator("#tab-team").click();
        await page.locator("#team-lineup-tab").click();
        await page.locator("#lineup-preview").evaluate((node) => {
          const scroller = document.getElementById("team-view");
          scroller.scrollTop += node.getBoundingClientRect().top - 210;
        });
        const before = await page.locator("#team-view").evaluate((node) => node.scrollTop);
        const box = await page.locator("#lineup-preview").boundingBox();
        await swipe(session, box.x + box.width / 2, box.y + box.height - 15, box.y + 15);
        await page.waitForTimeout(150);
        assert.ok(await page.locator("#team-view").evaluate((node) => node.scrollTop) > before + 40);
      } finally { await context.setOffline(false); }
    });
    assert.deepEqual(errors, [], "browser errors");
    if (failures.length) throw Error(failures.join("\n"));
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; server.close(); });

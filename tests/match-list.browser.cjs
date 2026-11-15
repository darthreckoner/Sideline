// Match List view: grouped subs, exact undo, reload and phone fit, in a real browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + (new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(fs.readFileSync(file)); } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [width, height] of [[390, 844], [844, 390]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(6000);
      const url = `http://127.0.0.1:${server.address().port}/?preview=1`;
      async function ready() { await page.waitForFunction(() => window.SIDELINE_MATCH_UI && document.querySelector('#team-picker').options.length > 0); if (await page.locator('#releaseDialog').evaluate(d => d.open)) await page.locator('#release-dismiss').click(); }
      await page.clock.install();
      await page.goto(url); await ready();
      await page.evaluate(async () => {
        const team = SIDELINE_DATA.newTeam(SIDELINE_PRESETS); team.name = 'Homewood U12 - Red'; team.formation = '3-4-1';
        team.roster = Array.from({ length: 15 }, (_, i) => ({ id: `r${i}`, name: `Player ${i + 1}`, number: i + 1, available: true }));
        team.roster[12].positions = ['RB', 'RM']; team.roster[13].positions = ['ST']; // #13 and #14 play these spots
        team.assignments = team.roster.slice(0, 9).map(p => p.id);
        await SIDELINE_STORE.run('workspace', 'put', { key: 'teams', teams: [team], selectedTeam: team.id });
      });
      await page.reload(); await ready();
      await page.locator('#tab-match').click(); await page.locator('#open-match').click();
      await page.getByLabel('Opponent', { exact: true }).fill('AL Rush FP');
      await page.getByRole('button', { name: 'Prepare match', exact: true }).click();
      await page.locator('#matchDialog').waitFor({ state: 'hidden' });
      // List opens first; the scoreboard still names both teams.
      assert.equal(await page.locator('#match-list').isVisible(), true);
      assert.equal(await page.locator('#match-pitch').isVisible(), false);
      assert.equal(await page.locator('#match-opponent-name').textContent(), 'AL Rush FP');
      const L = page.locator('#match-list');
      const rows = L.locator('.list-group').first().locator('.list-player');
      assert.equal(await rows.count(), 9);
      assert.match(await rows.nth(4).textContent(), /LM.*#5 Player 5/);
      await page.locator('#match-toggle').click();
      await page.clock.fastForward(10 * 60000); await page.clock.runFor(300);
      assert.match(await rows.first().locator('.list-time').textContent(), /^10:0\d$/, 'times tick in the list');
      // Three off, then three on; pairs follow tap order, Confirm waits for equal counts.
      for (const n of [5, 6, 7]) await L.locator('.list-player', { hasText: `#${n} Player ${n}` }).click();
      for (const n of [12, 10]) await L.locator('.list-player', { hasText: `#${n} Player ${n}` }).click();
      assert.equal(await page.getByRole('button', { name: 'Confirm 3 subs' }).isDisabled(), true);
      await L.locator('.list-player', { hasText: '#14 Player 14' }).click();
      assert.deepEqual(await L.locator('.sub-pair').allTextContents(), ['#12 on for #5 · LM', '#10 on for #6 · LCM', '#14 on for #7 · RCM'], 'no positions: tap order');
      const confirm = page.getByRole('button', { name: 'Confirm 3 subs' });
      const box = await confirm.boundingBox();
      assert.ok(box && box.y + box.height <= height - 50, 'Confirm stays on screen above the tabs');
      await confirm.click();
      let m = await page.evaluate(() => structuredClone(SIDELINE_MATCH_UI.active));
      assert.deepEqual([m.slots[4], m.slots[5], m.slots[6]], ['r11', 'r9', 'r13']);
      assert.equal(new Set(m.substitutions.map(s => s.elapsed)).size, 1, 'one moment for the whole group');
      assert.match(await L.locator('.last-change').textContent(), /#12 Player 12 on for #5 Player 5.*#14 Player 14 on for #7 Player 7/);
      // Least-played bench first: the players just subbed off now have time, so they sort last.
      const bench = await L.locator('.list-group').nth(1).locator('.list-name').allTextContents();
      assert.deepEqual(bench.slice(-3).sort(), ['#5 Player 5', '#6 Player 6', '#7 Player 7']);
      // Undo after 2 minutes hands the time back exactly.
      await page.clock.fastForward(2 * 60000); await page.clock.runFor(300);
      await page.getByRole('button', { name: 'Undo these 3 subs' }).click(); await page.locator('#confirm-accept').click();
      await page.waitForFunction(() => SIDELINE_MATCH_UI.active.substitutions.length === 0);
      m = await page.evaluate(() => ({ ...structuredClone(SIDELINE_MATCH_UI.active), now: SIDELINE_MATCH.times(SIDELINE_MATCH_UI.active) }));
      assert.deepEqual([m.slots[4], m.slots[5], m.slots[6]], ['r4', 'r5', 'r6']);
      assert.equal(m.substitutions.length, 0);
      assert.equal(m.now.r11, 0); assert.equal(m.now.r4, m.now.r0, 'undone player keeps full time');
      // Players with positions go to their best-fitting spot, whatever order they were tapped in.
      for (const n of [4, 9]) await L.locator('.list-player', { hasText: `#${n} Player ${n}` }).click(); // RB, ST off
      for (const n of [14, 13]) await L.locator('.list-player', { hasText: `#${n} Player ${n}` }).click(); // ST player tapped first
      assert.deepEqual(await L.locator('.sub-pair').allTextContents(), ['#13 on for #4 · RB', '#14 on for #9 · ST']);
      assert.match(await L.locator('.sub-bar').textContent(), /Matched to the positions they play/);
      await page.getByRole('button', { name: 'Confirm 2 subs' }).click();
      m = await page.evaluate(() => structuredClone(SIDELINE_MATCH_UI.active));
      assert.deepEqual([m.slots[3], m.slots[8]], ['r12', 'r13']);
      // The List view survives a reload, and Field is one tap away.
      await page.evaluate(() => SIDELINE_MATCH_UI.flush()); await page.reload(); await ready(); await page.locator('#tab-match').click();
      assert.equal(await page.locator('#match-list').isVisible(), true);
      assert.equal(await page.locator('#match-opponent-name').textContent(), 'AL Rush FP');
      await page.locator('#match-show-field').click();
      assert.equal(await page.locator('#match-pitch').isVisible(), true);
      assert.equal(await page.locator('#match-list').isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scrolling');
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS List view: grouped subs by position fit or tap order, exact undo, live times, reload and Field toggle at phone sizes');
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });

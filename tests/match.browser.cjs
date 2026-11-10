// Real browser workflow against isolated local storage, with a controlled clock.
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
  const page = await browser.newPage({ viewport: { width: 844, height: 500 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(6000);
  const url = `http://127.0.0.1:${server.address().port}/?preview=1`;
  const accept = async () => page.locator('#confirm-accept').click();
  async function ready() { await page.waitForFunction(() => window.SIDELINE_MATCH_UI && document.querySelector('#team-picker').options.length > 0); if (await page.locator('#releaseDialog').evaluate(d => d.open)) await page.locator('#release-dismiss').click(); }
  async function fieldTap(index = 0) {
    const pt = await page.evaluate((index) => { const m=SIDELINE_MATCH_UI.active; const p=SIDELINE_BOARD.make(SIDELINE_PRESETS[m.format],m.formation).players.filter(p=>p.team===m.side)[index]; const b=document.querySelector('#match-pitch').getBoundingClientRect(),rot=b.height>b.width,scale=Math.min(b.width/(rot?620:1000),b.height/(rot?1000:620));return {x:b.left+(b.width-(rot?620:1000)*scale)/2+(rot?p.y:p.x)*scale,y:b.top+(b.height-(rot?1000:620)*scale)/2+(rot?1000-p.x:p.y)*scale}; }, index);
    await page.mouse.click(pt.x, pt.y);
  }
  try {
    await page.clock.install();
    await page.goto(url); await ready();
    assert.equal(await page.locator('#board-view').isVisible(), true);
    assert.deepEqual(await page.locator('.app-tabs [data-tab]').evaluateAll(ns=>ns.map(n=>n.dataset.tab)),['board','team','match','coaching']);
    await page.evaluate(async () => {
      const team = SIDELINE_DATA.newTeam(SIDELINE_PRESETS); team.name = 'Review United';
      team.roster = Array.from({length:11}, (_, i) => ({ id:`r${i}`, name:`Player ${i+1}`, number:i+1, available:true })); team.assignments = team.roster.slice(0,9).map(p=>p.id);
      await SIDELINE_STORE.run('workspace','put',{key:'teams',teams:[team],selectedTeam:team.id});
    });
    await page.reload(); await ready();
    await page.locator('#tab-team').click(); await page.locator('#team-lineup-tab').click();
    await page.locator('.team-management > summary').click();
    await page.locator('#set-default-lineup').click();
    await page.locator('#tab-board').click(); await page.locator('#menu').click(); await page.locator('#board-default').click();
    await page.locator('#tab-match').click();
    await page.locator('#open-match').click();
    await page.getByLabel('Opponent', {exact:true}).fill('Visitors'); await page.getByLabel('Season', {exact:true}).fill('Fall 2026');
    await page.getByRole('button',{name:'Prepare match',exact:true}).click();
    await page.locator('#match-toggle').click();
    await page.clock.fastForward(26*60000); await page.clock.runFor(300);
    assert.match(await page.locator('#match-clock').textContent(), /25:00/); assert.match(await page.locator('#match-stoppage').textContent(), /1:00/);
    if (process.env.SIDELINE_EVIDENCE) {
      fs.mkdirSync(process.env.SIDELINE_EVIDENCE,{recursive:true});
      await page.screenshot({path:path.join(process.env.SIDELINE_EVIDENCE,'match-stoppage.png')});
    }
    await fieldTap(); await page.locator('#sideline-players button').filter({hasText:'Player 10',exact:true}).click();
    const subState = await page.evaluate(()=>structuredClone(SIDELINE_MATCH_UI.active));
    await page.locator('#tab-board').click(); await page.locator('#reset-start').click(); await page.locator('#undo').click();
    await page.locator('#tab-match').click();
    assert.deepEqual(await page.evaluate(()=>SIDELINE_MATCH_UI.active.slots),subState.slots);
    assert.equal(await page.evaluate(()=>SIDELINE_MATCH_UI.active.slots[0]),'r9');
    await page.evaluate(()=>Promise.all([SIDELINE_MATCH_UI.flush(),SIDELINE_WORKSPACE.flush()]));
    await page.reload(); await ready(); await page.waitForFunction(()=>SIDELINE_MATCH_UI.active?.running);
    await page.locator('#tab-match').click();
    await page.clock.fastForward(60000);
    await page.locator('#match-goal').click(); await page.locator('#match-body').getByRole('button',{name:'#1 Player 1',exact:true}).click();
    await page.locator('#tab-board').click(); await page.clock.fastForward(60000); await page.locator('#tab-match').click();
    const first = await page.evaluate(()=>structuredClone(SIDELINE_MATCH_UI.active));
    assert.equal(first.goals.length,1); assert.ok(first.substitutions.length === 1);
    await page.locator('#match-end').click(); await accept();
    await page.clock.fastForward(5*60000);
    assert.equal(await page.locator('#match-toggle').textContent(),'Begin second half');
    await page.locator('#match-toggle').click(); assert.match(await page.locator('#match-clock').textContent(),/25:00/);
    await page.clock.fastForward(26*60000); await page.clock.runFor(300);
    assert.match(await page.locator('#match-clock').textContent(),/50:00/); assert.match(await page.locator('#match-stoppage').textContent(),/1:00/);
    await page.locator('#match-toggle').click(); // save a paused match and recover it
    await page.evaluate(()=>SIDELINE_MATCH_UI.flush()); await page.reload(); await ready();
    await page.waitForFunction(()=>SIDELINE_MATCH_UI.active?.half === 2);
    await page.locator('#tab-match').click(); assert.equal(await page.locator('#match-toggle').textContent(),'Resume');
    await page.locator('#match-end').click(); await accept();
    await page.waitForFunction(()=>!SIDELINE_MATCH_UI.active);
    await page.locator('#tab-team').click(); await page.locator('.team-management').evaluate(d => d.open = true); await page.locator('#team-stats').click();
    assert.ok((await page.locator('#match-body').textContent()).includes('Fall 2026'));
    assert.ok((await page.locator('#match-body').textContent()).includes('Visitors'));
    await page.locator('#match-body details summary').click();
    await page.getByRole('button',{name:/Player 1 goal/,exact:true}).click(); await accept();
    await page.waitForFunction(()=>!document.querySelector('#match-body').textContent.includes('Player 1 goal'));
    await page.locator('#match-body details summary').click();
    await page.getByRole('button',{name:'Add missed goal',exact:true}).click();
    await page.getByRole('button',{name:'Player 2',exact:true}).click();
    const history = await page.evaluate(async()=> (await SIDELINE_STORE.run('workspace','get','matches')).matches);
    assert.equal(history[0].goals[0].playerId,'r1');
    await page.locator('#match-close').click();
    console.log('PASS match preparation, sideline swaps, stoppage, halves, goals, tab switching, reload and season stats');
    // Saved play baseline is session-only until explicit overwrite.
    await page.locator('#tab-board').click(); await page.locator('#save').click(); await page.locator('#board-name').fill('Review play'); await page.locator('#name-form button[type=submit]').click();
    await page.evaluate(()=>{ const s=SIDELINE_BOARD.snapshot(); s.board.players[0].x+=40; SIDELINE_BOARD.install(s); });
    await page.locator('#capture').click();
    await page.locator('#save').click(); assert.match(await page.locator('#confirm-message').textContent(), /Overwrite existing play/);
    await page.locator('#confirmDialog button[value=cancel]').first().click();
    const before = await page.evaluate(async()=> (await SIDELINE_STORE.run('boards','getAll'))[0]);
    await page.locator('#save').click(); await accept(); await page.waitForFunction(()=>document.querySelector('#app-notice').textContent === 'Play updated');
    const after = await page.evaluate(async()=> (await SIDELINE_STORE.run('boards','getAll'))[0]);
    assert.equal(after.start.players[0].x, before.start.players[0].x+40);
    for (const size of [{width:375,height:667},{width:844,height:390},{width:320,height:568}]) {
      await page.setViewportSize(size); await page.locator('#tab-board').click();
      const rects = await page.evaluate(()=>['#board','#tab-match'].map(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {w:r.width,h:r.height,b:r.bottom,r:r.right};}));
      assert.ok(rects.every(r=>r.w>0 && r.h>0 && (r.b<=size.height+1 || size.height>size.width && size.height<=700) && r.r<=size.width+1));
      if (process.env.SIDELINE_EVIDENCE) { fs.mkdirSync(process.env.SIDELINE_EVIDENCE,{recursive:true}); await page.screenshot({path:path.join(process.env.SIDELINE_EVIDENCE,`board-${size.width}.png`)}); }
    }
    console.log('PASS explicit play overwrite and board/navigation bounds at three mobile sizes');
    assert.deepEqual(errors, []);
  } catch (e) { console.log('STATE', await page.evaluate(()=>({hash:location.hash,hidden:[...document.querySelectorAll('[role=tabpanel]')].map(n=>[n.id,n.hidden]),notice:document.querySelector('#app-notice').textContent})),errors); throw e; } finally { await browser.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});

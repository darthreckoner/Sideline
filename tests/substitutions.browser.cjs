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
    await page.evaluate(({x,y})=>{const v=document.getElementById('match-view'),bar=document.getElementById('match-strip').getBoundingClientRect(),nav=document.querySelector('.app-tabs').getBoundingClientRect();if(y>nav.top-10)v.scrollTop+=y-nav.top+30;else if(y<bar.bottom+10)v.scrollTop-=bar.bottom+30-y;},pt);
    const fresh = await page.evaluate((index)=>{const m=SIDELINE_MATCH_UI.active,p=SIDELINE_BOARD.make(SIDELINE_PRESETS[m.format],m.formation).players.filter(p=>p.team===m.side)[index],b=document.querySelector('#match-pitch').getBoundingClientRect(),rot=b.height>b.width,scale=Math.min(b.width/(rot?620:1000),b.height/(rot?1000:620));return {x:b.left+(b.width-(rot?620:1000)*scale)/2+(rot?p.y:p.x)*scale,y:b.top+(b.height-(rot?1000:620)*scale)/2+(rot?1000-p.x:p.y)*scale};},index);
    await page.mouse.click(fresh.x, fresh.y);
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
    await page.locator('#set-default-lineup').click();
    await page.evaluate(()=>{
      const saved=SIDELINE_BOARD.snapshot();
      saved.board.players.filter(p=>p.team==='away').forEach(p=>p.display='number');
      SIDELINE_BOARD.install(saved);
    });
    await page.locator('#tab-board').click(); await page.locator('#menu').click(); await page.locator('#board-default').click();
    assert.ok(await page.evaluate(()=>SIDELINE_BOARD.snapshot().board.players.filter(p=>p.team==='away').every(p=>p.display==='position')));

    await page.locator('#tab-match').click();
    await page.locator('#open-match').click();
    await page.getByLabel('Opponent', {exact:true}).fill('Visitors'); await page.getByLabel('Season', {exact:true}).fill('Fall 2026');
    await page.getByRole('button',{name:'Prepare match',exact:true}).click();
    await page.locator('#matchDialog').waitFor({state:'hidden'});

    for (const width of [320,390]) {
      await page.setViewportSize({width,height:844});
      await page.locator('#match-details').click();
      assert.match(await page.locator('#match-body > p').first().textContent(), /Ready for kickoff/);
      const scroller=page.locator('#match-body .stat-scroll').first();
      const before=await scroller.locator('td').first().boundingBox();
      await scroller.evaluate(n=>n.scrollLeft=n.scrollWidth);
      const after=await scroller.locator('td').first().boundingBox();
      assert.ok(Math.abs(after.x-before.x)<2, 'player identity must stay visible while metrics scroll');
      await page.locator('#match-close').click();
    }
    await page.setViewportSize({width:844,height:500});
    await fieldTap();
    const selectedImage = await page.locator('#match-pitch').evaluate(c=>c.toDataURL());
    await page.locator('#cancel-sub').click();
    assert.equal(await page.evaluate(()=>SIDELINE_MATCH_UI.selectedRoster), null);
    assert.notEqual(await page.locator('#match-pitch').evaluate(c=>c.toDataURL()),selectedImage,'Cancel must repaint selection ring');
    await page.locator('#field-player-picker summary').click();
    await page.locator('#match-field-players button').first().focus();
    await page.keyboard.press('Enter');
    assert.ok(await page.evaluate(()=>SIDELINE_MATCH_UI.selectedRoster));
    assert.match(await page.locator('#sub-hint').textContent(), /#1 Player 1/);
    await page.locator('#cancel-sub').click();
    await page.locator('#field-player-picker summary').click();
    // Both canvas taps and accessible buttons exchange occupied slots.
    const slotsBefore = await page.evaluate(()=>SIDELINE_MATCH_UI.active.slots.slice());
    await fieldTap(1); await fieldTap(2);
    let slotsAfter = await page.evaluate(()=>SIDELINE_MATCH_UI.active.slots.slice());
    assert.equal(slotsAfter[1], slotsBefore[2]); assert.equal(slotsAfter[2], slotsBefore[1]);
    assert.match(await page.locator('#match-selection').textContent(), /Swapped positions/);
    await page.locator('#field-player-picker summary').click();
    await page.locator('#match-field-players button').nth(1).click();
    await page.locator('#match-field-players button').nth(2).click();
    assert.deepEqual(await page.evaluate(()=>SIDELINE_MATCH_UI.active.slots), slotsBefore);
    await page.locator('#match-field-players button').first().click();
    await page.locator('#match-field-players button').first().click();
    assert.equal(await page.evaluate(()=>SIDELINE_MATCH_UI.selectedRoster), null);
    await page.locator('#field-player-picker summary').click();
    await page.setViewportSize({width:1238,height:800});
    assert.equal(await page.locator('#match-view').evaluate(el=>el.scrollHeight > el.clientHeight+1), false, 'desktop match fits without page scrolling');
    const heading = await page.locator('.match-controls .page-heading').boundingBox();
    const broadcast = await page.locator('.match-broadcast').boundingBox();
    const actions = await page.locator('.match-actions').boundingBox();
    assert.ok(heading.x + heading.width <= broadcast.x);
    assert.ok(broadcast.x + broadcast.width <= actions.x);
    const strip = await page.locator('#match-strip').boundingBox();
    const layout = await page.locator('.match-layout').boundingBox();
    assert.ok(Math.abs(strip.width-layout.width)<2, 'header spans match area');
    assert.equal(await page.locator('#match-team-name').textContent(), 'Review United');
    assert.equal(await page.locator('#match-opponent-name').textContent(), 'Visitors');
    await page.locator('#match-view').evaluate(el=>el.scrollTop=0);
    if (process.env.SIDELINE_EVIDENCE) await page.screenshot({path:path.join(process.env.SIDELINE_EVIDENCE,'match-header-desktop.png')});
    await page.setViewportSize({width:844,height:500});
    const boardBefore = await page.evaluate(()=>JSON.stringify(SIDELINE_BOARD.snapshot()));
    await page.locator('#tab-board').click();
    await page.locator('[data-mode="pen"]').click();
    await page.locator('#tab-match').click();
    await page.locator('#sideline-players button').first().click();
    const before = await page.evaluate(()=>SIDELINE_MATCH_UI.active.slots[0]);
    await fieldTap();
    assert.notEqual(await page.evaluate(()=>SIDELINE_MATCH_UI.active.slots[0]),before);
    assert.equal(await page.evaluate(()=>SIDELINE_MATCH_UI.active.phase),'ready');
    assert.equal(await page.evaluate(()=>JSON.stringify(SIDELINE_BOARD.snapshot())),boardBefore);
    for (const size of [{width:390,height:844},{width:320,height:568}]) {
      await page.setViewportSize(size);
      assert.equal(await page.locator('#match-view').evaluate(el=>el.scrollHeight > el.clientHeight+1), false, 'phone match fits without page scrolling');
      await page.locator('#match-pitch').scrollIntoViewIfNeeded();
      const old = await page.evaluate(()=>SIDELINE_MATCH_UI.active.slots[0]);
      // Select field first so scrolling to the bench does not move the pitch target.
      await fieldTap();
      await page.locator('#sideline-players button').first().click();
      assert.notEqual(await page.evaluate(()=>SIDELINE_MATCH_UI.active.slots[0]),old);
      const sticky=await page.locator('#match-strip').boundingBox();
      assert.ok(sticky.y>=0 && sticky.y+sticky.height<size.height-52,'match status stays visible at bench');
      const tabs=await page.locator('.app-tabs').boundingBox();
      assert.ok(tabs.y>=0 && tabs.y+tabs.height<=size.height);
      if (process.env.SIDELINE_EVIDENCE) {
        await page.locator('#match-pitch').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(process.env.SIDELINE_EVIDENCE,`match-${size.width}.png`)});
      }
    }
    await page.locator('#match-details').click();
    await page.getByRole('button',{name:'Discard this match',exact:true}).click();
    await accept();
    await page.locator('#matchDialog').waitFor({state:'hidden'});
    await page.locator('#tab-team').click();
    await page.locator('#open-team-settings').click();
    await page.locator('#team-color').selectOption('#ef4444');
    await page.locator('#team-away-color').selectOption('#ffffff');
    await page.evaluate(()=>SIDELINE_WORKSPACE.flush());
    await page.locator('#tab-match').click();
    await page.locator('#open-match').click();
    assert.equal(await page.getByLabel('My team color',{exact:true}).inputValue(), '#ef4444');
    await page.getByLabel('My team plays',{exact:true}).selectOption('away');
    assert.equal(await page.getByLabel('My team color',{exact:true}).inputValue(), '#ffffff');
    await page.getByLabel('My team plays',{exact:true}).selectOption('home');
    assert.equal(await page.getByLabel('My team color',{exact:true}).inputValue(), '#ef4444');
    await page.getByLabel('My team plays',{exact:true}).selectOption('away');
    await page.getByRole('button',{name:'My team color: Orange',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'My team color: Orange',exact:true}).getAttribute('aria-pressed'),'true');
    await page.getByLabel('Opponent color',{exact:true}).fill('#2563eb');
    await page.getByLabel('Opponent',{exact:true}).fill('Home Hosts');
    await page.getByRole('button',{name:'Prepare match',exact:true}).click();
    await page.evaluate(()=>SIDELINE_MATCH_UI.flush());
    await page.reload(); await ready(); await page.locator('#tab-match').click();
    assert.deepEqual(await page.evaluate(()=>[SIDELINE_MATCH_UI.active.side,SIDELINE_MATCH_UI.active.color,SIDELINE_MATCH_UI.active.opponentColor]),['away','#ff9f1c','#2563eb']);
    assert.equal(await page.locator('#match-team-name').textContent(),'Home Hosts');
    assert.equal(await page.locator('#match-opponent-name').textContent(),'Review United');
    assert.equal(await page.locator('#match-team-name').evaluate(e=>e.style.getPropertyValue('--team-color')),'#2563eb');
    assert.equal(await page.locator('#match-opponent-name').evaluate(e=>e.style.getPropertyValue('--team-color')),'#ff9f1c');
    assert.deepEqual(await page.evaluate(()=>[SIDELINE_WORKSPACE.currentTeam().color,SIDELINE_WORKSPACE.currentTeam().awayColor]),['#ef4444','#ffffff']);
    await page.locator('#match-toggle').click();
    await page.locator('#match-goal').click();
    await page.getByRole('button',{name:'#1 Player 1',exact:true}).click();
    assert.equal(await page.locator('#match-score').textContent(),'0 \u2013 1');
    console.log('PASS home/away kit defaults, match overrides, reload, home-first scoreboard and saved-team isolation');
    console.log('PASS pre-kickoff Match substitutions independent of Board drawing mode and Board state');
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});

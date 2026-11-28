// Portfolio game checks (web/portfolio.html) against a running preview:
//   npm run build && npx vite preview --port 4173 &     then     node tests/portfolio_check.cjs [screenshot dir]
const { chromium, devices } = require('playwright');
(async () => {
  const out = process.argv[2] || 'docs/screenshots'; const base = process.env.BASE || 'http://127.0.0.1:4173'; const res = [];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 820 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + '/portfolio.html'); await p.waitForSelector('.title-screen', { timeout: 60000 }); await p.waitForTimeout(7000);
  const T = () => p.evaluate(() => document.querySelector('.title-screen')?.innerText || '');
  res.push(['title screen: name, tagline and Start flying', /Arjun Behl/.test(await T()) && /I build software and AI-powered tools/.test(await T()) && /Start flying/.test(await T())]);
  res.push(['no website chrome: no search bar, landmark strip or minimap', await p.evaluate(() => ['.top', '.strip', '.bottom-left'].every((s) => { const e = document.querySelector(s); return !e || getComputedStyle(e).display === 'none'; }))]);
  res.push(['six stops in the tracker: one Projects stop, Education and Skills separate', await p.locator('.quest-item').count() === 6 && /Projects/.test(await p.locator('.quest-list').textContent()) && /Education/.test(await p.locator('.quest-list').textContent()) && /Skills/.test(await p.locator('.quest-list').textContent())]);
  await p.screenshot({ path: out + '/portfolio_title.png' });
  await p.keyboard.press('Enter');                                   // Start flying has focus
  await p.waitForFunction(() => window.__tinyWaterloo.actor.active, null, { timeout: 60000 });
  await p.waitForTimeout(3500);
  res.push(['Enter starts the flight', await p.evaluate(() => !document.querySelector('.title-screen') && window.__tinyWaterloo.actor.active)]);
  // a mouse click on a UI button in flight used to leave focus on it, so WASD, L and Escape stopped flying the goose
  const heading = () => p.evaluate(() => window.__tinyWaterloo.actor.debug.getState().heading);
  await p.locator('.music-toggle').click(); await p.waitForTimeout(300);
  const h0 = await heading(); await p.keyboard.down('a'); await p.waitForTimeout(700); await p.keyboard.up('a');
  res.push(['after clicking mute in flight the keys still steer the goose', Math.abs(await heading() - h0) > 0.3 && await p.evaluate(() => document.activeElement?.id === 'stage')]);
  // fly over three stops (teleport = same code path as flying there)
  const flyTo = (id) => p.evaluate(async (id) => {
    const t = window.__tinyWaterloo, s = t.landmarks.find((l) => l.id === id), f = t.map.frame;
    const st = t.actor.debug.getState();
    const here = t.map.getView(); const dx = s.canvas[0] - here.cx, dy = s.canvas[1] - here.cy;
    // move in world metres by the canvas offset (right = +x canvas, canvas y is foreshortened by sqrt 2)
    const m = t.map.manifest.camera, k = m.meters_per_px, R = m.right_enu, U = m.up_enu;
    const wx = st.x + (dx * R[0] - dy * Math.SQRT2 * U[0] / Math.hypot(U[0], U[1])) * k, wy = st.y + (dx * R[1] - dy * Math.SQRT2 * U[1] / Math.hypot(U[0], U[1])) * k;
    await t.actor.debug.teleport(wx, wy, st.z, st.heading);
  }, id);
  for (const id of ['about', 'education', 'projects']) {
    await flyTo(id);
    await p.waitForTimeout(2200);
  }
  const count = await p.locator('.quest-count').innerText();
  res.push(['flying over stops finds them (3 / 6)', /^3 \/ 6$/.test(count.trim())]);
  res.push(['pointer names the next stop with a distance', /· \d+ m/.test(await p.locator('.quest-next').innerText())]);
  await p.screenshot({ path: out + '/portfolio_flight.png' });
  // Land next to Projects. The goose has been flying on since it got there, straight toward Education (276 px away),
  // and the screenshot takes a while under software GL, so go back first: landing opens the nearest stop's card.
  await flyTo('projects'); await p.waitForTimeout(500);
  await p.keyboard.press('l'); await p.waitForTimeout(3000);
  const card = await p.locator('#ui .panel:not([hidden])').first().innerText().catch(() => '');
  res.push(['landing at Projects shows all three projects', /CrisisRoom/i.test(card) && /1st Place/.test(card) && /Rhythm/i.test(card) && /Top 10 Finalist/.test(card) && /Dune Rush/i.test(card)]);
  const hrefs = await p.locator('#ui .panel .stop-link a').evaluateAll((as) => as.map((a) => a.href));
  res.push(['links: GitHub for all three, Devpost for CrisisRoom and Rhythm only', hrefs.filter((u) => u.includes('github.com')).length === 3 && hrefs.filter((u) => u.includes('devpost.com')).length === 2 && hrefs.includes('https://devpost.com/software/crisisroom-36paq9') && hrefs.includes('https://devpost.com/software/rhythm-i0k9fv')]);
  const panelText = () => p.locator('#ui .panel:not([hidden])').first().innerText().catch(() => '');
  // shortcuts: no flying needed
  await p.keyboard.press('Escape'); await p.keyboard.press('5'); await p.waitForTimeout(2500);
  res.push(['key 5 jumps to Skills and opens it', /Skills/.test(await panelText()) && /Languages/i.test(await panelText())]);
  await p.locator('.quest-item', { hasText: 'Contact' }).click(); await p.waitForTimeout(2500);
  res.push(['clicking a stop in the tracker opens it (Contact) and marks it found', /arjun\.behl\.2003@gmail\.com/.test(await panelText()) && /^5 \/ 6$/.test((await p.locator('.quest-count').textContent()).trim())]);
  await p.evaluate(() => { window.__tinyWaterloo.actor.start(); }); await p.waitForFunction(() => window.__tinyWaterloo.actor.active, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  await p.keyboard.press('3'); await p.waitForTimeout(3500);
  res.push(['key 3 in flight lands and opens Experience', await p.evaluate(() => !window.__tinyWaterloo.actor.active) && /Teaching Assistant/i.test(await panelText())]);
  res.push(['no project screenshots in cards', await p.locator('#ui .panel img').count() === 0]);
  await p.screenshot({ path: out + '/portfolio_stop.png' });
  await p.reload(); await p.waitForSelector('.title-screen'); await p.waitForTimeout(1500);
  res.push(['progress is remembered after a reload (6 / 6, "Continue flying")', /^6 \/ 6$/.test((await p.locator('.quest-count').textContent()).trim()) && /Continue flying/.test(await T())]);
  await p.locator('.title-look').click(); await p.waitForTimeout(2500);
  res.push(['title screen "Skip the flight" opens the first stop without flying', await p.evaluate(() => !document.querySelector('.title-screen') && !window.__tinyWaterloo.actor.active) && /About Arjun/.test(await panelText())]);
  res.push(['no page errors', errs.length === 0]);
  const m = await b.newPage({ ...devices['iPhone 13'] });
  await m.goto(base + '/portfolio.html'); await m.waitForSelector('.title-screen'); await m.waitForTimeout(5000);
  res.push(['phone: title fits, no horizontal overflow', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.querySelector('.title-start').getBoundingClientRect().bottom < innerHeight)]);
  await m.screenshot({ path: out + '/portfolio_phone.png' });
  // landscape phone: everything on the title can be reached, and in flight nothing covers the touch flight pad
  const hits = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return r.bottom <= innerHeight && r.right <= innerWidth && !!hit && (hit === el || el.contains(hit));
  }), sel);
  const ml = await b.newPage({ ...devices['iPhone 13 landscape'] });
  await ml.goto(base + '/portfolio.html'); await ml.waitForSelector('.title-start:not([disabled])', { timeout: 60000 }); await ml.waitForTimeout(1500);
  res.push(['landscape phone: Start, Skip and the contact links are on screen and tappable', (await hits(ml, '.title-start, .title-look, .title-links a')).every(Boolean)]);
  await ml.evaluate(() => document.querySelector('.title-start').click());
  await ml.waitForFunction(() => window.__tinyWaterloo.actor.active && !document.querySelector('.title-screen'), null, { timeout: 90000 }); await ml.waitForTimeout(1500);
  const pad = await hits(ml, '.gh-pad-btn, .gh-land, .music-toggle');
  res.push(['landscape phone: every flight pad button, Land and mute take a tap at their centre', pad.length === 8 && pad.every(Boolean)]);
  await ml.close();
  let fail = 0; for (const [n, ok] of res) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) fail++; }
  if (errs.length) console.log(errs.slice(0, 3));
  console.log(`${res.length - fail}/${res.length} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();

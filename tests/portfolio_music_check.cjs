// Run against a production preview: node tests/portfolio_music_check.cjs
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const base = process.env.BASE || 'http://127.0.0.1:4173';
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  let passed = 0;
  const check = (name, condition) => { assert.ok(condition, name); passed++; console.log(`PASS ${name}`); };
  const state = () => page.locator('.portfolio-music').evaluate((audio) => ({
    paused: audio.paused, time: audio.currentTime, duration: audio.duration,
    volume: audio.volume, loop: audio.loop, error: audio.error?.message,
  }));
  try {
    await page.goto(`${base}/portfolio.html`);
    await page.waitForSelector('.title-screen');
    check('music waits for a visitor gesture', (await state()).paused && !requests.some((url) => url.includes('campus-daydream.mp3')));
    await page.locator('.title-look').click();
    await page.waitForFunction(() => {
      const audio = document.querySelector('.portfolio-music');
      return audio && !audio.paused && audio.currentTime > 0.1;
    });
    const playing = await state();
    check('entering through Skip starts real decoded audio', playing.duration > 30 && !playing.error);
    check('background track loops at a quiet volume', playing.loop && playing.volume === 0.22);
    await page.getByRole('button', { name: 'Pause background music', exact: true }).click();
    check('music can be paused and preference is saved', (await state()).paused && await page.evaluate(() => localStorage.getItem('arjunPortfolio.music.v1') === 'off'));
    await page.reload();
    await page.locator('.title-look').click();
    check('muted preference survives reloading and entering', (await state()).paused);
    await page.getByRole('button', { name: 'Play background music', exact: true }).click();
    await page.waitForFunction(() => {
      const audio = document.querySelector('.portfolio-music');
      return !audio.paused && Number.isFinite(audio.duration) && audio.readyState >= 2;
    });
    check('music can be enabled again', await page.getByRole('button', { name: 'Pause background music', exact: true }).getAttribute('aria-pressed') === 'true');
    await page.locator('.portfolio-music').evaluate((audio) => { audio.currentTime = audio.duration - 0.2; });
    await page.waitForFunction(() => {
      const audio = document.querySelector('.portfolio-music');
      return !audio.paused && audio.currentTime < 2;
    });
    check('track wraps to its beginning at the end', true);

    const phone = await browser.newPage({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    await phone.goto(`${base}/portfolio.html`);
    await phone.waitForSelector('.music-toggle');
    check('music toggle is visible and accessible on a phone', await phone.locator('.music-toggle').evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight && rect.height >= 44;
    }));
    await phone.locator('.title-start').click();
    await phone.waitForFunction(() => !document.querySelector('.portfolio-music').paused);
    check('Start flying also starts music on a phone', true);
    await phone.close();

    const failure = await browser.newPage();
    const failureErrors = [];
    failure.on('pageerror', (error) => failureErrors.push(error.message));
    await failure.route('**/audio/campus-daydream.mp3', (route) => route.abort());
    await failure.goto(`${base}/portfolio.html`);
    await failure.locator('.title-look').click();
    await failure.waitForFunction(() => document.querySelector('.portfolio-music').error !== null);
    check('failed audio leaves stop navigation usable', await failure.locator('.quest-item').count() === 6 && await failure.getByRole('button', { name: 'Play background music', exact: true }).isVisible() && failureErrors.length === 0);
    check('music interactions produce no page errors', errors.length === 0);
    console.log(`${passed}/${passed} music checks passed`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

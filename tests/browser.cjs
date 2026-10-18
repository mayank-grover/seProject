const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('http://127.0.0.1:5173');
  await page.waitForSelector('.room-card');
  assert.equal(await page.locator('.room-card').count(), 6);
  await page.screenshot({ path: '/tmp/stillspace-mobile-light.png', fullPage: true });
  await page.locator('#test-toggle').click();
  await page.locator('[data-preset="morning"]').click();
  assert.equal(await page.locator('#sim-date').inputValue(), '2026-10-19');
  assert.equal(await page.locator('#sim-time').inputValue(), '10:30');
  await page.locator('#time-dial').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#sim-time').inputValue(), '10:35');
  await page.keyboard.press('Shift+ArrowLeft');
  assert.equal(await page.locator('#sim-time').inputValue(), '09:35');
  const dial = await page.locator('#time-dial').boundingBox();
  await page.mouse.move(dial.x + dial.width / 2, dial.y + 10);
  await page.mouse.down();
  await page.mouse.move(dial.x + dial.width - 10, dial.y + dial.height / 2, { steps: 10 });
  await page.mouse.up();
  assert.equal(await page.locator('#sim-time').inputValue(), '06:00');
  await page.locator('[data-preset="morning"]').click();
  await page.screenshot({ path: '/tmp/stillspace-time-tester.png', fullPage: true });
  await page.locator('#apply-time').click();
  assert.match(await page.locator('#time-context-label').innerText(), /Mon.*10:30/);
  await page.locator('[data-filter="free"]').click();
  assert.ok((await page.locator('.room-card').count()) > 0);
  assert.equal(await page.locator('.room-status.busy').count(), 0);
  await page.locator('[data-filter="all"]').click();
  await page.locator('#search').fill('L 405');
  assert.equal(await page.locator('.room-card').count(), 1);
  await page.locator('[data-room]').first().click();
  assert.ok((await page.locator('.schedule-event').count()) > 0);
  await page.locator('[data-source]').first().click();
  await page.waitForFunction(
    () =>
      document.querySelector('.source-photo')?.complete &&
      document.querySelector('.source-photo')?.naturalWidth > 0,
  );
  await page.locator('#zoom-scan').click();
  assert.ok(
    await page.locator('.source-photo').evaluate((image) => image.classList.contains('zoomed')),
  );
  await page.evaluate(() => window.stillspaceBack());
  assert.equal(await page.locator('#source-dialog').isVisible(), false);
  await page.locator('[data-note="locked"]').click();
  assert.match(await page.locator('#local-note').innerText(), /locked/);
  await page.locator('#room-dialog [data-close]').click();
  await page.locator('[data-save]').click();
  await page.locator('[data-view="saved"]').click();
  assert.equal(await page.locator('.room-card').count(), 1);
  await page.reload();
  await page.waitForSelector('.room-card');
  assert.equal(await page.locator('#saved-count').innerText(), '1');
  await page.locator('[data-view="timetable"]').click();
  await page.locator('#week-room').selectOption('L405');
  await page.locator('[data-week-day="2"]').click();
  assert.match(await page.locator('.week-label').innerText(), /Tuesday/);
  await page.locator('#week-branch').selectOption({ label: 'CSE AI · Semester 3' });
  await page.locator('[data-view="sources"]').click();
  assert.equal(await page.locator('.source-row').count(), 11);
  const download = page.waitForEvent('download');
  await page.locator('#export-json').click();
  assert.equal((await download).suggestedFilename(), 'stillspace-timetable.json');
  await page.locator('[data-view="explore"]').click();
  await page.locator('#test-toggle').click();
  await page.locator('[data-preset="weekend"]').click();
  await page.locator('#apply-time').click();
  await page.locator('[data-filter="free"]').click();
  assert.ok(await page.locator('.empty-state').isVisible());
  await page.locator('[data-filter="all"]').click();
  await page.locator('#test-toggle').click();
  await page.locator('#sim-date').fill('2027-01-05');
  await page.locator('#sim-date').dispatchEvent('change');
  await page.locator('#apply-time').click();
  assert.match(await page.locator('.room-status').first().innerText(), /Outside source period/);
  await page.locator('#test-toggle').click();
  await page.locator('#reset-time').click();
  assert.match(await page.locator('#time-context-label').innerText(), /Now/);
  await page.locator('#appearance').click();
  await page.locator('[data-theme="dark"]').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.locator('#reduce-transparency').check();
  assert.ok(await page.locator('html').evaluate((html) => html.classList.contains('solid-glass')));
  await page.locator('#appearance-dialog [data-close]').click();
  await page.screenshot({ path: '/tmp/stillspace-mobile-dark.png', fullPage: true });
  await page.reload();
  await page.waitForSelector('.room-card');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  // The APK has no Internet permission; the web UI must not need remote assets either.
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.reload();
  await page.waitForSelector('.room-card');
  assert.ok(requests.every((url) => url.startsWith('http://127.0.0.1:5173/')));
  for (const width of [320, 360, 390, 412, 600, 1000]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      `overflow at ${width}`,
    );
  }
  assert.equal(errors.length, 0);
  console.log(
    JSON.stringify({
      passed: [
        'load',
        'time presets',
        'keyboard dial',
        'pointer dial',
        'interval filters',
        'details',
        'source scans and zoom',
        'Android back callback',
        'private notes',
        'saved persistence',
        'weekly room and branch',
        'JSON export',
        'weekend unknown',
        'source window',
        'real time reset',
        'dark theme',
        'reduce transparency',
        'theme persistence',
        'no remote assets',
        'six viewport widths',
      ],
      browserErrors: errors,
    }),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

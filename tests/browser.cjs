const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
  });
  let errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:5173');
  await page.waitForSelector('.room-card');
  assert.equal(await page.locator('.room-card').count(), 6);
  await page.screenshot({ path: '/tmp/stillspace-desktop.png', fullPage: true });
  await page.locator('#test-toggle').click();
  await page.locator('[data-preset="morning"]').click();
  assert.equal(await page.locator('#sim-date').inputValue(), '2026-10-19');
  assert.equal(await page.locator('#sim-time').inputValue(), '10:30');
  assert.match(await page.locator('#results-summary').innerText(), /Monday.*10:30/);
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
  await page.locator('[data-filter="free"]').click();
  assert.ok((await page.locator('.room-card').count()) > 0);
  assert.equal(await page.locator('.room-status.busy').count(), 0);
  await page.screenshot({ path: '/tmp/stillspace-testing.png', fullPage: true });
  await page.locator('[data-filter="all"]').click();
  await page.locator('#search').fill('L 405');
  assert.equal(await page.locator('.room-card').count(), 1);
  await page.locator('[data-room]').first().click();
  assert.ok((await page.locator('.schedule-event').count()) > 0);
  await page.locator('[data-source]').first().click();
  assert.ok(await page.locator('#source-dialog').isVisible());
  await page.waitForFunction(
    () =>
      document.querySelector('.source-photo')?.complete &&
      document.querySelector('.source-photo')?.naturalWidth > 0,
  );
  await page.locator('#source-dialog [data-close]').click();
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
  assert.equal(await page.locator('.week-table tbody tr').count(), 10);
  await page.locator('#week-branch').selectOption({ label: 'CSE AI · Semester 3' });
  await page.locator('[data-view="sources"]').click();
  assert.equal(await page.locator('.source-row').count(), 11);
  const download = page.waitForEvent('download');
  await page.locator('#export-json').click();
  assert.equal((await download).suggestedFilename(), 'stillspace-timetable.json');
  await page.locator('[data-view="explore"]').click();
  await page.locator('#test-toggle').click();
  await page.locator('[data-preset="weekend"]').click();
  await page.locator('[data-filter="free"]').click();
  assert.ok(await page.locator('.empty-state').isVisible());
  await page.locator('[data-filter="all"]').click();
  await page.locator('#sim-date').fill('2027-01-05');
  await page.locator('#sim-date').dispatchEvent('change');
  assert.match(await page.locator('.room-status').first().innerText(), /Outside source period/);
  await page.locator('#reset-time').click();
  assert.equal(await page.locator('#test-toggle').getAttribute('aria-pressed'), 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/stillspace-mobile.png', fullPage: true });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await page.locator('#test-toggle').click();
  await page.locator('[data-preset="morning"]').click();
  await page.screenshot({ path: '/tmp/stillspace-mobile-testing.png', fullPage: true });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  assert.equal(errors.length, 0);
  console.log(
    JSON.stringify({
      passed: [
        'load',
        'simulated date/time',
        'keyboard slider',
        'pointer slider',
        'interval filters',
        'room details',
        'source scans',
        'private notes',
        'saved persistence',
        'weekly branches',
        'JSON download',
        'weekend unknown',
        'source window',
        'real time reset',
        'mobile layout',
      ],
      browserErrors: errors,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

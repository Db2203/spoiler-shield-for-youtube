'use strict';

/*
 * Thumbnail blur, click to reveal, strict mode and the persisted counter.
 * All content is fictional.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, hook, openFixture, waitUntilSettled, waitFor, By } = require('./helpers/browser');

const TILE = 'ytd-rich-item-renderer';
const BASE = {
  enabled: true,
  strongKeywords: ['Zorblax Quest 9', 'pizza'],
  weakKeywords: ['Zorblax', 'Quest'],
  blockedChannels: [],
  blurThumbnails: false,
  strictMode: false,
};

let server;
let driver;

test.before(async () => {
  server = await startServer();
  driver = await launchBrowser();
});

test.after(async () => {
  if (driver) await driver.quit();
  if (server) await server.close();
});

async function loadHome(settings) {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'setSettings', settings);
  await waitUntilSettled(driver, TILE);
}

// Computed filter of the thumbnail image inside a tile, plus the reveal flag.
async function thumbState(id) {
  return driver.executeScript(function (id) {
    const tile = document.querySelector(`[data-mock-id="${id}"]`);
    const img = tile.querySelector('ytd-thumbnail img, .shortsLockupViewModelHostThumbnailContainer img');
    return { filter: getComputedStyle(img).filter, revealed: tile.hasAttribute('data-sb-reveal') };
  }, id);
}

test('thumbnails are sharp by default and blurred when the option is on', async () => {
  await loadHome(BASE);
  assert.equal((await thumbState('v1')).filter, 'none');

  await hook(driver, 'setSettings', { blurThumbnails: true });
  await waitFor(driver, async () => (await thumbState('v1')).filter !== 'none', 'blur applied live');
  assert.match((await thumbState('v1')).filter, /blur/);
  assert.match((await thumbState('sh1')).filter, /blur/, 'Shorts shelf thumbnails too');
});

test('the first click on a blurred thumbnail reveals it without navigating, the second opens it', async () => {
  await loadHome(Object.assign({}, BASE, { blurThumbnails: true }));
  const before = await driver.getCurrentUrl();
  const thumb = await driver.findElement(By.css('[data-mock-id="v1"] ytd-thumbnail img'));
  await thumb.click();
  await waitFor(driver, async () => (await thumbState('v1')).revealed, 'tile revealed');
  assert.equal((await thumbState('v1')).filter, 'none');
  assert.equal(await driver.getCurrentUrl(), before, 'first click did not navigate');
  assert.equal((await thumbState('v6')).revealed, false, 'other tiles stay blurred');

  await driver.findElement(By.css('[data-mock-id="v1"] ytd-thumbnail img')).click();
  await waitFor(driver, async () => (await driver.getCurrentUrl()).includes('/watch?v=v1'), 'second click navigated');
});

test('a revealed tile is blurred again when it is recycled with new content', async () => {
  await loadHome(Object.assign({}, BASE, { blurThumbnails: true }));
  await driver.findElement(By.css('[data-mock-id="v6"] ytd-thumbnail img')).click();
  await waitFor(driver, async () => (await thumbState('v6')).revealed, 'tile revealed');
  await driver.executeScript(function () {
    window.YTMock.recycle('v6', { id: 'v6', title: 'Sunset time-lapse', channel: 'Trail Mix', handle: 'trailmix' });
  });
  await waitFor(driver, async () => !(await thumbState('v6')).revealed, 'reveal dropped after recycle');
});

test('strict mode keeps thumbnails blurred and lets the click through', async () => {
  await loadHome(Object.assign({}, BASE, { blurThumbnails: true, strictMode: true }));
  await driver.findElement(By.css('[data-mock-id="v1"] ytd-thumbnail img')).click();
  await waitFor(driver, async () => (await driver.getCurrentUrl()).includes('/watch?v=v1'), 'click navigated normally');
  await driver.navigate().back();
  await waitUntilSettled(driver, TILE);
  assert.match((await thumbState('v1')).filter, /blur/);
  assert.equal((await thumbState('v1')).revealed, false);
});

test('turning strict mode on clears existing reveals', async () => {
  await loadHome(Object.assign({}, BASE, { blurThumbnails: true, strictMode: false }));
  await driver.findElement(By.css('[data-mock-id="v1"] ytd-thumbnail img')).click();
  await waitFor(driver, async () => (await thumbState('v1')).revealed, 'tile revealed');
  await hook(driver, 'setSettings', { strictMode: true });
  await waitFor(driver, async () => !(await thumbState('v1')).revealed, 'reveal cleared');
  assert.match((await thumbState('v1')).filter, /blur/);
});

test('the all-time hidden counter is persisted to storage', async () => {
  await hook(driver, 'resetStorage');
  await loadHome(BASE);
  await waitFor(driver, async () => (await hook(driver, 'getStats')).hiddenTotal >= 5, 'stats flushed');
  const pageCount = (await hook(driver, 'getState')).hiddenCount;
  assert.equal(pageCount, 5);
});

'use strict';

/*
 * Home page: keyword hiding, infinite scroll, element recycling, SPA
 * navigation, the on/off switch, the hidden counter, and fail-closed
 * behaviour when the scanner breaks. All content is fictional.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, hook, openFixture, visibilityMap, waitUntilSettled, waitFor } = require('./helpers/browser');

const TILE = 'ytd-rich-item-renderer';
const TEST_SETTINGS = {
  enabled: true,
  strongKeywords: ['Zorblax Quest 9', 'pizza'],
  weakKeywords: ['Zorblax', 'Quest'],
  blockedChannels: [],
};

// Expected verdicts for the tiles declared in home.html.
const EXPECTED = {
  v1: 'visible', // Baking sourdough at home
  v2: 'hidden', // strong phrase
  v3: 'hidden', // strong word
  v4: 'visible', // one weak keyword only
  v5: 'hidden', // two different weak keywords
  v6: 'visible',
  v7: 'visible',
  v8: 'visible',
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

async function loadHome() {
  await openFixture(driver, server.url('home.html'));
  await hook(driver, 'setSettings', TEST_SETTINGS);
  await waitUntilSettled(driver, TILE);
}

function assertVerdicts(map, expected) {
  for (const [id, verdict] of Object.entries(expected)) {
    assert.ok(map[id], `tile ${id} is present`);
    assert.equal(map[id].hidden, verdict === 'hidden', `tile ${id} should be ${verdict} (got ${JSON.stringify(map[id])})`);
    if (verdict === 'hidden') assert.equal(map[id].display, 'none', `tile ${id} is removed from layout`);
  }
}

test('tiles are hidden by strong keywords or two weak keywords, others stay visible', async () => {
  await loadHome();
  const map = await visibilityMap(driver, TILE);
  assertVerdicts(map, EXPECTED);
  assert.equal(Object.keys(map).length, 8);
});

test('hidden counter reports each hidden tile once', async () => {
  await loadHome();
  const state = await hook(driver, 'getState');
  assert.equal(state.hiddenCount, 3);
  assert.equal(state.enabled, true);
});

test('tiles appended by infinite scroll are invisible before being checked, then decided', async () => {
  await loadHome();
  const batch = [
    { id: 'n1', title: 'Repotting a fern', channel: 'Plant Pal', handle: 'plantpal' },
    { id: 'n2', title: 'Pizza oven build, part one', channel: 'Backyard Builds', handle: 'backyardbuilds' },
    { id: 'n3', title: 'Zorblax quest speedrun attempts', channel: 'Fast Fingers', handle: 'fastfingers' },
  ];
  // Insert and read computed style in the same script, before any observer
  // callback can run: the fail-closed CSS must already hide the new tiles.
  const immediate = await driver.executeScript(function (items) {
    window.YTMock.addItems(items);
    const out = {};
    for (const item of items) {
      const el = document.querySelector(`[data-mock-id="${item.id}"]`);
      out[item.id] = getComputedStyle(el).visibility;
    }
    return out;
  }, batch);
  assert.deepEqual(immediate, { n1: 'hidden', n2: 'hidden', n3: 'hidden' });

  await waitUntilSettled(driver, TILE);
  const map = await visibilityMap(driver, TILE);
  assertVerdicts(map, { n1: 'visible', n2: 'hidden', n3: 'hidden' });
  assert.equal((await hook(driver, 'getState')).hiddenCount, 5);
});

test('a recycled tile is re-checked when its content changes in place', async () => {
  await loadHome();
  await driver.executeScript(function () {
    window.YTMock.recycle('v1', { id: 'v1', title: 'Pizza dough from scratch', channel: 'Kitchen Corner', handle: 'kitchencorner' });
  });
  await waitFor(driver, async () => (await visibilityMap(driver, TILE)).v1.hidden, 'recycled tile hidden');

  await driver.executeScript(function () {
    window.YTMock.recycle('v1', { id: 'v1', title: 'Baking sourdough at home', channel: 'Kitchen Corner', handle: 'kitchencorner' });
  });
  await waitFor(driver, async () => !(await visibilityMap(driver, TILE)).v1.hidden, 'recycled tile visible again');

  // A hidden tile recycled into safe content becomes visible.
  await driver.executeScript(function () {
    window.YTMock.recycle('v2', { id: 'v2', title: 'Knitting a scarf', channel: 'Game Gossip', handle: 'gamegossip' });
  });
  await waitFor(driver, async () => !(await visibilityMap(driver, TILE)).v2.hidden, 'previously hidden tile visible');
});

test('SPA navigation re-renders and new content is filtered', async () => {
  await loadHome();
  await driver.executeScript(function () {
    window.YTMock.navigate([
      { id: 's1', title: 'Stargazing basics', channel: 'Night Sky', handle: 'nightsky' },
      { id: 's2', title: 'Zorblax Quest 9 ending discussion', channel: 'Game Gossip', handle: 'gamegossip' },
    ]);
  });
  await waitUntilSettled(driver, TILE);
  const map = await visibilityMap(driver, TILE);
  assertVerdicts(map, { s1: 'visible', s2: 'hidden' });
  assert.equal(map.v1, undefined, 'old tiles are gone');
});

test('switching off reveals everything and switching on hides again', async () => {
  await loadHome();
  await hook(driver, 'setSettings', { enabled: false });
  await waitFor(driver, async () => {
    const map = await visibilityMap(driver, TILE);
    return Object.values(map).every((v) => !v.hidden);
  }, 'all tiles visible when off');

  await hook(driver, 'setSettings', { enabled: true });
  await waitUntilSettled(driver, TILE);
  assertVerdicts(await visibilityMap(driver, TILE), EXPECTED);
});

test('keyword changes apply live without reloading', async () => {
  await loadHome();
  await hook(driver, 'setSettings', { strongKeywords: ['sourdough'], weakKeywords: [] });
  await waitFor(driver, async () => {
    const map = await visibilityMap(driver, TILE);
    return map.v1.hidden && !map.v2.hidden && !map.v3.hidden && !map.v5.hidden;
  }, 'new keyword list applied');
});

test('fail closed: when every check throws, new tiles stay hidden', async () => {
  await loadHome();
  await hook(driver, 'injectFailure', 'throw');
  await driver.executeScript(function () {
    window.YTMock.addItems([{ id: 'f1', title: 'Harmless gardening tips', channel: 'Plant Pal', handle: 'plantpal' }]);
  });
  await driver.sleep(2500); // longer than the safety sweep interval
  const map = await visibilityMap(driver, TILE);
  assert.equal(map.f1.hidden, true, 'safe tile stays hidden because the scanner is broken');
  assert.equal(map.f1.mark, null, 'no mark was applied');
});

test('fail closed: when the scanner stops entirely, new tiles stay hidden', async () => {
  await loadHome();
  await hook(driver, 'injectFailure', 'dead');
  await driver.executeScript(function () {
    window.YTMock.addItems([{ id: 'd1', title: 'Harmless gardening tips', channel: 'Plant Pal', handle: 'plantpal' }]);
    window.YTMock.fireNavigation();
  });
  await driver.sleep(2500);
  const map = await visibilityMap(driver, TILE);
  assert.equal(map.d1.hidden, true);
  assert.equal(map.d1.mark, null);
});

'use strict';

/*
 * Search results: classic result rows plus the newer "lockup" tiles.
 * Also proves that a keyword only present in the description still hides.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, hook, openFixture, visibilityMap, waitUntilSettled, waitFor } = require('./helpers/browser');

const RESULT = 'ytd-video-renderer';
const LOCKUP = 'yt-lockup-view-model';
const TEST_SETTINGS = {
  enabled: true,
  strongKeywords: ['Zorblax Quest 9', 'pizza'],
  weakKeywords: ['Zorblax', 'Quest'],
  blockedChannels: [],
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

async function loadSearch() {
  await openFixture(driver, server.url('search.html'));
  await hook(driver, 'setSettings', TEST_SETTINGS);
  await waitUntilSettled(driver, `${RESULT},${LOCKUP}`);
}

test('search result rows are filtered, including matches found only in the description', async () => {
  await loadSearch();
  const map = await visibilityMap(driver, RESULT);
  assert.equal(map.r1.hidden, false, 'plain cooking video stays');
  assert.equal(map.r2.hidden, true, 'keyword in description only');
  assert.equal(map.r3.hidden, true, 'strong phrase in title');
  assert.equal(map.r4.hidden, false, 'single weak keyword is not enough');
  assert.equal(map.r5.hidden, true, 'two weak keywords');
});

test('lockup tiles in the side shelf are filtered too', async () => {
  await loadSearch();
  const map = await visibilityMap(driver, LOCKUP);
  assert.equal(map.l1.hidden, false);
  assert.equal(map.l2.hidden, true);
  assert.equal(map.l3.hidden, true);
});

test('a recycled lockup tile is re-checked', async () => {
  await loadSearch();
  await driver.executeScript(function () {
    window.YTMock.recycle('l1', { id: 'l1', title: 'Pizza dough tutorial', channel: 'Keys and Chords', handle: 'keysandchords' });
  });
  await waitFor(driver, async () => (await visibilityMap(driver, LOCKUP)).l1.hidden, 'lockup hidden after recycle');
});

test('search suggestions mentioning blocked keywords are hidden as they appear', async () => {
  await loadSearch();
  // Rows are inserted and inspected in the same script: they must already be
  // invisible before the scanner has had a chance to run.
  const immediate = await driver.executeScript(function () {
    window.YTMock.showSuggestions([
      { id: 'g1', text: 'cooking for beginners' },
      { id: 'g2', text: 'cooking pizza at home' },
      { id: 'g3', text: 'zorblax quest 9 cooking minigame' },
    ]);
    const out = {};
    for (const el of document.querySelectorAll('[data-mock-suggestions] [role="option"]')) {
      out[el.getAttribute('data-mock-id')] = getComputedStyle(el).visibility;
    }
    return out;
  });
  assert.deepEqual(immediate, { g1: 'hidden', g2: 'hidden', g3: 'hidden' });
  await waitUntilSettled(driver, '[data-mock-suggestions] [role="option"]');
  const map = await visibilityMap(driver, '[data-mock-suggestions] [role="option"]');
  assert.equal(map.g1.hidden, false);
  assert.equal(map.g2.hidden, true);
  assert.equal(map.g3.hidden, true);
});

test('hidden counter covers both tile kinds', async () => {
  await loadSearch();
  const state = await hook(driver, 'getState');
  assert.equal(state.hiddenCount, 5);
});

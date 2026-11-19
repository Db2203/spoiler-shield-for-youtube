'use strict';

/*
 * Channel blocklist: tiles from blocked channels disappear everywhere, and a
 * blocked channel's own page is covered. All content is fictional.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, hook, openFixture, visibilityMap, waitUntilSettled, waitFor } = require('./helpers/browser');

const TILE = 'ytd-rich-item-renderer';
const BASE = {
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

async function pageStatus() {
  return driver.executeScript('return document.documentElement.getAttribute("data-sb-watch")');
}

async function waitForStatus(expected) {
  await waitFor(driver, async () => (await pageStatus()) === expected, `page status should become ${expected}`);
}

test('tiles from a blocked handle are hidden on the home page', async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'setSettings', Object.assign({}, BASE, { blockedChannels: ['@GameGossip'] }));
  await waitUntilSettled(driver, TILE);
  const map = await visibilityMap(driver, TILE);
  assert.equal(map.v7.hidden, true, 'safe title but blocked channel');
  assert.equal(map.v1.hidden, false);
  assert.equal(map.v6.hidden, false);
});

test('a channel can also be blocked by display name', async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'setSettings', Object.assign({}, BASE, { blockedChannels: ['Game Gossip'] }));
  await waitUntilSettled(driver, TILE);
  const map = await visibilityMap(driver, TILE);
  assert.equal(map.v7.hidden, true);
  assert.equal(map.v8.hidden, false);
});

test('a blocked channel page is covered, other channel pages are not', async () => {
  await openFixture(driver, server.url('/@gamegossip'));
  await hook(driver, 'setSettings', Object.assign({}, BASE, { blockedChannels: ['@gamegossip'] }));
  await waitForStatus('blocked');
  const reason = await driver.executeScript('return document.querySelector("#sb-overlay-reason").textContent');
  assert.match(reason, /blocklist/);

  await openFixture(driver, server.url('/@kitchencorner'));
  await waitForStatus('ok');
  const map = await visibilityMap(driver, TILE);
  assert.equal(map.ch1.hidden, false);
  assert.equal(map.ch2.hidden, true, 'keyword tiles still filtered on a channel page');
});

test('a channel whose name matches a keyword is covered', async () => {
  await openFixture(driver, server.url('/@pizzapalace'));
  await hook(driver, 'setSettings', BASE);
  await waitForStatus('blocked');
  const reason = await driver.executeScript('return document.querySelector("#sb-overlay-reason").textContent');
  assert.match(reason, /pizza/);
});

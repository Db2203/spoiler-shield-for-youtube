'use strict';

/*
 * Community posts. All content is fictional.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, hook, openFixture, visibilityMap, waitUntilSettled } = require('./helpers/browser');

const POST = 'ytd-backstage-post-thread-renderer';
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

test('community posts mentioning blocked keywords are hidden', async () => {
  await openFixture(driver, server.url('/@gamegossip/community'));
  await hook(driver, 'setSettings', TEST_SETTINGS);
  await waitUntilSettled(driver, POST);
  const map = await visibilityMap(driver, POST);
  assert.equal(map.p1.hidden, false);
  assert.equal(map.p2.hidden, true);
  assert.equal(map.p3.hidden, true);
  assert.equal(map.p4.hidden, false);
});

test('posts from a blocked channel are hidden regardless of text', async () => {
  await openFixture(driver, server.url('/@gamegossip/community'));
  await hook(driver, 'setSettings', Object.assign({}, TEST_SETTINGS, { blockedChannels: ['@lorelibrary'] }));
  await waitUntilSettled(driver, POST);
  const map = await visibilityMap(driver, POST);
  assert.equal(map.p4.hidden, true);
  assert.equal(map.p1.hidden, false);
});

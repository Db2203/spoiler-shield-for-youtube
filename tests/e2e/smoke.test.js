'use strict';

/*
 * Smoke test: Firefox starts headless, the test build installs, the content
 * script runs on a fixture page and the default settings are in place.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, hook, openFixture } = require('./helpers/browser');

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

test('content script runs on the fixture page with default settings', async () => {
  await openFixture(driver, server.url('home.html'));
  await hook(driver, 'resetStorage');
  const settings = await hook(driver, 'getSettings');
  assert.equal(settings.enabled, true);
  assert.ok(settings.strongKeywords.length >= 10);
  assert.ok(settings.weakKeywords.length >= 3);
  const state = await hook(driver, 'getState');
  assert.equal(state.started, true);
  assert.equal(state.enabled, true);
});

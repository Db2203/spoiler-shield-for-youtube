'use strict';

/*
 * Shorts: shelf tiles on the home page and the Shorts player. All content is
 * fictional.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, hook, openFixture, visibilityMap, waitUntilSettled, waitFor } = require('./helpers/browser');

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

async function pageStatus() {
  return driver.executeScript('return document.documentElement.getAttribute("data-sb-watch")');
}

async function waitForStatus(expected) {
  await waitFor(driver, async () => (await pageStatus()) === expected, `page status should become ${expected}`);
}

test('Shorts shelf tiles on the home page are filtered', async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'setSettings', TEST_SETTINGS);
  await waitUntilSettled(driver, 'ytm-shorts-lockup-view-model-v2');
  const map = await visibilityMap(driver, 'ytm-shorts-lockup-view-model-v2');
  assert.equal(map.sh1.hidden, false);
  assert.equal(map.sh2.hidden, true);
  assert.equal(map.sh3.hidden, true);
  assert.equal(map.sh4.hidden, false);
});

test('a safe Short plays normally', async () => {
  await openFixture(driver, server.url('/shorts/s1'));
  await hook(driver, 'setSettings', TEST_SETTINGS);
  await waitForStatus('ok');
  const result = await driver.executeScript(function () {
    const reel = document.querySelector('ytd-reel-video-renderer[is-active]');
    const video = reel.querySelector('video');
    video.play().catch(function () {});
    return { visible: getComputedStyle(reel).visibility === 'visible' && getComputedStyle(reel).display !== 'none', playing: !video.paused };
  });
  assert.deepEqual(result, { visible: true, playing: true });
});

test('a matching Short is blocked and its playback stopped', async () => {
  await openFixture(driver, server.url('/shorts/s2'));
  await hook(driver, 'setSettings', TEST_SETTINGS);
  await waitForStatus('blocked');
  const result = await driver.executeScript(function () {
    const reel = document.querySelector('ytd-reel-video-renderer[data-mock-id="s2"]');
    const video = reel.querySelector('video');
    video.play().catch(function () {});
    return { display: getComputedStyle(reel).display, paused: video.paused, overlay: getComputedStyle(document.getElementById('sb-overlay')).display };
  });
  assert.equal(result.display, 'none');
  assert.equal(result.overlay, 'flex');
  await waitFor(driver, async () => driver.executeScript('return document.querySelector(\'ytd-reel-video-renderer[data-mock-id="s2"] video\').paused'), 'video paused again');
});

test('scrolling from a safe Short to a matching one blocks, and onwards unblocks', async () => {
  await openFixture(driver, server.url('/shorts/s1'));
  await hook(driver, 'setSettings', TEST_SETTINGS);
  await waitForStatus('ok');
  await driver.executeScript('window.YTMock.activateReel("s2")');
  await waitForStatus('blocked');
  await driver.executeScript('window.YTMock.activateReel("s3")');
  await waitForStatus('ok');
});

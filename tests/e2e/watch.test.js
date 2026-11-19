'use strict';

/*
 * Watch page: blocking a matching video with the "Go back" overlay, pausing
 * playback, in-page navigation between videos, the channel blocklist, strict
 * mode, plus sidebar tiles, comments and end screens. All content is fictional.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, hook, openFixture, visibilityMap, waitUntilSettled, waitFor, By } = require('./helpers/browser');

const TEST_SETTINGS = {
  enabled: true,
  strongKeywords: ['Zorblax Quest 9', 'pizza'],
  weakKeywords: ['Zorblax', 'Quest'],
  blockedChannels: [],
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

async function pageStatus() {
  return driver.executeScript('return document.documentElement.getAttribute("data-sb-watch")');
}

async function waitForStatus(expected) {
  await waitFor(driver, async () => (await pageStatus()) === expected, `page status should become ${expected}`);
}

async function loadWatch(id, settings = TEST_SETTINGS) {
  await openFixture(driver, server.url('/watch?v=' + id));
  await hook(driver, 'setSettings', settings);
}

async function playerState() {
  return driver.executeScript(function () {
    const video = document.querySelector('video');
    const flexy = document.querySelector('ytd-watch-flexy');
    const overlay = document.getElementById('sb-overlay');
    return {
      paused: video.paused,
      flexyVisibility: getComputedStyle(flexy).visibility,
      overlayDisplay: overlay ? getComputedStyle(overlay).display : 'none',
      reason: overlay ? overlay.querySelector('#sb-overlay-reason').textContent : '',
    };
  });
}

test('a safe video is marked ok, stays visible and can play', async () => {
  await loadWatch('w1');
  await waitForStatus('ok');
  const playing = await driver.executeScript(function () {
    const video = document.querySelector('video');
    video.play().catch(function () {});
    return !video.paused;
  });
  assert.equal(playing, true, 'play() is not interfered with on a safe video');
  const state = await playerState();
  assert.equal(state.flexyVisibility, 'visible');
  assert.equal(state.overlayDisplay, 'none');
});

test('a matching video is blocked: overlay shown, playback stopped and kept stopped', async () => {
  await loadWatch('w2');
  await waitForStatus('blocked');
  const state = await playerState();
  assert.equal(state.overlayDisplay, 'flex');
  assert.equal(state.flexyVisibility, 'hidden');
  assert.equal(state.paused, true);
  assert.match(state.reason, /pizza/);

  const pausedAgain = await driver.executeAsyncScript(function (done) {
    const video = document.querySelector('video');
    video.play().catch(function () {});
    setTimeout(function () {
      done(video.paused);
    }, 100);
  });
  assert.equal(pausedAgain, true, 'play() while blocked is immediately paused again');
});

test('a keyword hidden in the description is enough to block', async () => {
  await loadWatch('w4');
  await waitForStatus('blocked');
  assert.match((await playerState()).reason, /Zorblax Quest 9/);
});

test('"Go back" returns to the previous page', async () => {
  await openFixture(driver, server.url('/'));
  await loadWatch('w2');
  await waitForStatus('blocked');
  await driver.findElement(By.css('#sb-go-back')).click();
  await waitFor(driver, async () => (await driver.getCurrentUrl()) === server.url('/'), 'navigated back to the home page');
});

test('in-page navigation: player hidden while pending, then blocked, then ok again', async () => {
  await loadWatch('w1');
  await waitForStatus('ok');

  // Navigate to the matching video with delayed data. Immediately after the
  // URL changes the page must be pending and the player invisible.
  const pending = await driver.executeAsyncScript(function (done) {
    window.YTMock.navigateWatch('w2', 600);
    setTimeout(function () {
      done({
        status: document.documentElement.getAttribute('data-sb-watch'),
        flexy: getComputedStyle(document.querySelector('ytd-watch-flexy')).visibility,
      });
    }, 100);
  });
  assert.equal(pending.status, 'pending');
  assert.equal(pending.flexy, 'hidden');

  await waitForStatus('blocked');
  assert.equal((await playerState()).overlayDisplay, 'flex');

  await driver.executeScript('window.YTMock.navigateWatch("w1")');
  await waitForStatus('ok');
  assert.equal((await playerState()).overlayDisplay, 'none');
});

test('a video from a blocked channel is blocked with a channel reason', async () => {
  await loadWatch('w3', Object.assign({}, TEST_SETTINGS, { blockedChannels: ['@gamegossip'] }));
  await waitForStatus('blocked');
  assert.match((await playerState()).reason, /blocklist/);
  await hook(driver, 'setSettings', { blockedChannels: [] });
  await waitForStatus('ok');
});

test('"Show anyway" reveals the page unless strict mode is on', async () => {
  await loadWatch('w2');
  await waitForStatus('blocked');
  await driver.findElement(By.css('#sb-show-anyway')).click();
  await waitForStatus('ok');

  await loadWatch('w2', Object.assign({}, TEST_SETTINGS, { strictMode: true }));
  await waitForStatus('blocked');
  const display = await driver.executeScript('return getComputedStyle(document.querySelector("#sb-show-anyway")).display');
  assert.equal(display, 'none');
  await hook(driver, 'setSettings', { strictMode: false });
});

test('sidebar tiles, end screen cards and the end video wall are filtered', async () => {
  await loadWatch('w1');
  await waitForStatus('ok');
  await waitUntilSettled(driver, 'yt-lockup-view-model, .ytp-ce-element, .ytp-videowall-still');
  const sidebar = await visibilityMap(driver, 'yt-lockup-view-model');
  assert.equal(sidebar.sb1.hidden, false);
  assert.equal(sidebar.sb2.hidden, true);
  assert.equal(sidebar.sb3.hidden, true, 'two weak keywords');
  const endscreen = await visibilityMap(driver, '.ytp-ce-element, .ytp-videowall-still');
  assert.equal(endscreen.e1.hidden, false);
  assert.equal(endscreen.e2.hidden, true);
  assert.equal(endscreen.e3.hidden, false);
  assert.equal(endscreen.e4.hidden, true);
});

test('comments that load later are filtered, including threads with a matching reply', async () => {
  await loadWatch('w1');
  await waitForStatus('ok');
  await driver.executeScript('window.YTMock.loadComments()');
  await waitUntilSettled(driver, 'ytd-comment-thread-renderer, ytd-comment-view-model');
  const threads = await visibilityMap(driver, 'ytd-comment-thread-renderer');
  assert.equal(threads.c1.hidden, false);
  assert.equal(threads.c2.hidden, true, 'matching top-level comment');
  assert.equal(threads.c3.hidden, true, 'a matching reply hides the whole thread');
  assert.equal(threads.c4.hidden, false);
  const replies = await visibilityMap(driver, 'ytd-comment-view-model');
  assert.equal(replies.c1r1.hidden, false);
  assert.equal(replies.c3r1.hidden, true);
});

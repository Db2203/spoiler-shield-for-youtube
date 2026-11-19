'use strict';

/*
 * Options page: list editing, presets, behaviour options, statistics and the
 * first-run welcome section.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, openOptions, closeTab, hook, openFixture, visibilityMap, waitUntilSettled, waitFor, By } = require('./helpers/browser');

const TILE = 'ytd-rich-item-renderer';

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

async function setTextarea(id, text) {
  await driver.executeScript(
    function (id, text) {
      const el = document.getElementById(id);
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    id,
    text
  );
}

async function waitSaved() {
  await waitFor(driver, async () => (await driver.findElement(By.id('status')).getText()) === 'Saved', 'saved status');
}

test('options page shows the default lists and hides the welcome section', async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'resetStorage');
  await openOptions(driver);
  assert.match(await driver.findElement(By.id('strong')).getAttribute('value'), /^GTA\n/);
  assert.equal(await driver.findElement(By.id('welcome')).isDisplayed(), false);
  const checked = await driver.findElement(By.css('input[name="pageMatch"]:checked')).getAttribute('value');
  assert.equal(checked, 'all');
  await closeTab(driver);
});

test('the welcome section is shown when opened with #welcome', async () => {
  await openOptions(driver, '#welcome');
  assert.equal(await driver.findElement(By.id('welcome')).isDisplayed(), true);
  await closeTab(driver);
});

test('edits are saved and applied to an open page', async () => {
  await openOptions(driver);
  await setTextarea('strong', 'pizza\nZorblax Quest 9');
  await setTextarea('weak', 'Zorblax\nQuest');
  await setTextarea('channels', '@gamegossip');
  await waitSaved();
  await closeTab(driver);

  await openFixture(driver, server.url('/'));
  const settings = await hook(driver, 'getSettings');
  assert.deepEqual(settings.strongKeywords, ['pizza', 'Zorblax Quest 9']);
  assert.deepEqual(settings.weakKeywords, ['Zorblax', 'Quest']);
  assert.deepEqual(settings.blockedChannels, ['@gamegossip']);
  await waitUntilSettled(driver, TILE);
  const map = await visibilityMap(driver, TILE);
  assert.equal(map.v3.hidden, true, 'pizza');
  assert.equal(map.v7.hidden, true, 'blocked channel');
  assert.equal(map.v1.hidden, false);
});

test('the GTA 6 preset button restores the default keyword lists', async () => {
  await openOptions(driver);
  await driver.findElement(By.css('[data-preset="gta6"]')).click();
  await waitFor(driver, async () => (await driver.findElement(By.id('strong')).getAttribute('value')).startsWith('GTA\n'), 'defaults shown');
  await closeTab(driver);
  await openFixture(driver, server.url('/'));
  const settings = await hook(driver, 'getSettings');
  assert.equal(settings.strongKeywords.length, 10);
  assert.deepEqual(settings.weakKeywords, ['Rockstar', 'Lucia', 'Jason']);
  assert.deepEqual(settings.blockedChannels, ['@gamegossip'], 'preset leaves channels alone');
});

test('behaviour options and the page-match mode write to storage', async () => {
  await openOptions(driver);
  await driver.findElement(By.id('blur')).click();
  await driver.findElement(By.id('strict')).click();
  await driver.findElement(By.css('input[name="pageMatch"][value="title"]')).click();
  await waitSaved();
  await closeTab(driver);
  await openFixture(driver, server.url('/'));
  const settings = await hook(driver, 'getSettings');
  assert.equal(settings.blurThumbnails, true);
  assert.equal(settings.strictMode, true);
  assert.equal(settings.pageMatch, 'title');
  await hook(driver, 'setSettings', { blurThumbnails: false, strictMode: false, pageMatch: 'all', blockedChannels: [] });
});

test('the statistics counter can be reset', async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'setSettings', { strongKeywords: ['pizza'], weakKeywords: [] });
  await waitFor(driver, async () => (await hook(driver, 'getStats')).hiddenTotal > 0, 'stats flushed');
  await openOptions(driver);
  await waitFor(driver, async () => (await driver.findElement(By.id('count-total')).getText()) !== '0', 'total shown');
  await driver.findElement(By.id('reset-stats')).click();
  await waitFor(driver, async () => (await driver.findElement(By.id('count-total')).getText()) === '0', 'total reset');
  await closeTab(driver);
});

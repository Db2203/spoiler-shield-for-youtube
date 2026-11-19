'use strict';

/*
 * Settings popup, opened as a regular extension page in its own tab.
 * Changes made in the popup must land in storage and reach a YouTube tab.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, openPopup, closeTab, hook, openFixture, visibilityMap, waitUntilSettled, waitFor, By } = require('./helpers/browser');

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

test('popup shows the default keyword lists', async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'resetStorage');
  await openPopup(driver);
  const strong = await driver.findElement(By.id('strong')).getAttribute('value');
  assert.match(strong, /^GTA\n/);
  assert.equal(await driver.findElement(By.id('enabled')).isSelected(), true);
  assert.equal(await driver.findElement(By.id('blur')).isSelected(), false);
  await closeTab(driver);
});

test('edits in the popup are saved and applied to an open page', async () => {
  await openPopup(driver);
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

test('the on/off switch and the option checkboxes write to storage', async () => {
  await openPopup(driver);
  await driver.findElement(By.css('label.switch')).click(); // the input itself is visually hidden
  await driver.findElement(By.id('blur')).click();
  await driver.findElement(By.id('strict')).click();
  await waitFor(driver, async () => (await driver.findElement(By.id('enabled-label')).getText()) === 'Off', 'label updated');
  await closeTab(driver);

  await openFixture(driver, server.url('/'));
  const settings = await hook(driver, 'getSettings');
  assert.equal(settings.enabled, false);
  assert.equal(settings.blurThumbnails, true);
  assert.equal(settings.strictMode, true);
  const map = await visibilityMap(driver, TILE);
  assert.equal(Object.values(map).every((v) => !v.hidden), true, 'nothing hidden while off');
  await hook(driver, 'setSettings', { enabled: true, blurThumbnails: false, strictMode: false });
});

test('"Restore default keywords" puts the default lists back', async () => {
  await openPopup(driver);
  await setTextarea('strong', 'only this');
  await waitSaved();
  await driver.findElement(By.id('reset')).click();
  await waitFor(driver, async () => (await driver.findElement(By.id('strong')).getAttribute('value')).startsWith('GTA\n'), 'defaults shown');
  await closeTab(driver);

  await openFixture(driver, server.url('/'));
  const settings = await hook(driver, 'getSettings');
  assert.equal(settings.strongKeywords.length >= 10, true);
});

test('popup shows the all-time hidden count', async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'setSettings', { strongKeywords: ['pizza', 'Zorblax Quest 9'], weakKeywords: ['Zorblax', 'Quest'], blockedChannels: [] });
  await waitUntilSettled(driver, TILE);
  await waitFor(driver, async () => (await hook(driver, 'getStats')).hiddenTotal > 0, 'stats flushed');
  const total = (await hook(driver, 'getStats')).hiddenTotal;

  await openPopup(driver);
  await waitFor(driver, async () => (await driver.findElement(By.id('count-total')).getText()) === String(total), 'total shown');
  await closeTab(driver);
});

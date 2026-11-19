'use strict';

/*
 * Popup: quick switches, counts and the link to the options page.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, openPopup, closeTab, extensionUrl, hook, openFixture, visibilityMap, waitUntilSettled, waitFor, By } = require('./helpers/browser');

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

test('popup shows the state of the default settings', async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'resetStorage');
  await openPopup(driver);
  assert.equal(await driver.findElement(By.id('enabled')).isSelected(), true);
  assert.equal(await driver.findElement(By.id('blur')).isSelected(), false);
  assert.equal(await driver.findElement(By.id('strict')).isSelected(), false);
  assert.equal(await driver.findElement(By.id('strong-count')).getText(), '10');
  assert.equal(await driver.findElement(By.id('weak-count')).getText(), '3');
  assert.equal(await driver.findElement(By.id('channel-count')).getText(), '0');
  await closeTab(driver);
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

test('popup reflects list sizes and the all-time hidden count', async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'setSettings', { strongKeywords: ['pizza', 'Zorblax Quest 9'], weakKeywords: ['Zorblax', 'Quest'], blockedChannels: ['@gamegossip'] });
  await waitUntilSettled(driver, TILE);
  await waitFor(driver, async () => (await hook(driver, 'getStats')).hiddenTotal > 0, 'stats flushed');
  const total = (await hook(driver, 'getStats')).hiddenTotal;

  await openPopup(driver);
  assert.equal(await driver.findElement(By.id('strong-count')).getText(), '2');
  assert.equal(await driver.findElement(By.id('weak-count')).getText(), '2');
  assert.equal(await driver.findElement(By.id('channel-count')).getText(), '1');
  await waitFor(driver, async () => (await driver.findElement(By.id('count-total')).getText()) === String(total), 'total shown');
  await closeTab(driver);
});

test('"Manage keywords and channels" opens the options page', async () => {
  await openPopup(driver);
  const before = new Set(await driver.getAllWindowHandles());
  await driver.findElement(By.id('manage')).click();
  await waitFor(driver, async () => {
    for (const handle of await driver.getAllWindowHandles()) {
      if (before.has(handle)) continue;
      await driver.switchTo().window(handle);
      if ((await driver.getCurrentUrl()).startsWith(extensionUrl('options/options.html'))) return true;
    }
    return false;
  }, 'options page opened');
  await closeTab(driver);
  // The popup tab closes itself after opening the options page; make sure
  // we are back on a fixture tab for the next test.
  const handles = await driver.getAllWindowHandles();
  await driver.switchTo().window(handles[0]);
});

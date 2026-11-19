'use strict';

/*
 * Starts headless Firefox with the test build installed as a temporary add-on
 * and provides small helpers for talking to the page and the content script.
 *
 * Environment overrides:
 *   FIREFOX_BIN       path to firefox.exe / firefox binary
 *   GECKODRIVER_PATH  path to a geckodriver binary (otherwise Selenium Manager fetches one)
 *   SB_HEADED=1       run with a visible window
 */

const fs = require('node:fs');
const path = require('node:path');
const { Builder, By, until } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { buildTestExtension } = require('./build-extension');

const WINDOWS_FIREFOX = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const DEFAULT_TIMEOUT_MS = 10000;

// Pinning the internal UUID lets tests open moz-extension:// pages (the popup).
const ADDON_ID = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'extension', 'manifest.json'), 'utf8'))
  .browser_specific_settings.gecko.id;
const ADDON_UUID = '7c1d2b2e-5b1a-4e8c-9f3a-2f6e1a9d0c11';

function firefoxBinary() {
  if (process.env.FIREFOX_BIN) return process.env.FIREFOX_BIN;
  if (process.platform === 'win32' && fs.existsSync(WINDOWS_FIREFOX)) return WINDOWS_FIREFOX;
  return null;
}

async function launchBrowser() {
  // Lets openPopup() run a script in Firefox's chrome context. Firefox inherits
  // this from geckodriver, which inherits it from this process.
  process.env.MOZ_REMOTE_ALLOW_SYSTEM_ACCESS = '1';
  const extensionDir = buildTestExtension();
  const options = new firefox.Options()
    .setPreference('extensions.originControls.grantByDefault', true)
    .setPreference('extensions.webextensions.uuids', JSON.stringify({ [ADDON_ID]: ADDON_UUID }))
    .setPreference('devtools.console.stdout.content', true)
    .setPreference('browser.cache.disk.enable', false)
    .setPreference('browser.cache.memory.enable', false)
    .setPreference('media.autoplay.default', 0)
    .setPreference('media.autoplay.blocking_policy', 0);
  if (!process.env.SB_HEADED) options.addArguments('-headless');
  const binary = firefoxBinary();
  if (binary) options.setBinary(binary);

  let builder = new Builder().forBrowser('firefox').setFirefoxOptions(options);
  if (process.env.GECKODRIVER_PATH) {
    builder = builder.setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER_PATH));
  }
  const driver = await builder.build();
  await driver.installAddon(extensionDir, true);
  return driver;
}

function popupUrl() {
  return `moz-extension://${ADDON_UUID}/popup/popup.html`;
}

// Marionette refuses to navigate a content tab to moz-extension://, so the
// popup page is opened in a new tab from Firefox's privileged (chrome)
// context, then the driver switches to that tab.
async function openPopup(driver) {
  const url = popupUrl();
  const before = new Set(await driver.getAllWindowHandles());
  await driver.setContext(firefox.Context.CHROME);
  try {
    await driver.executeScript(function (url) {
      const win = Services.wm.getMostRecentWindow('navigator:browser');
      win.gBrowser.selectedTab = win.gBrowser.addTab(url, {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    }, url);
  } finally {
    await driver.setContext(firefox.Context.CONTENT);
  }
  await driver.wait(async () => (await driver.getAllWindowHandles()).length > before.size, 5000, 'popup tab opened');
  const handle = (await driver.getAllWindowHandles()).find((h) => !before.has(h));
  await driver.switchTo().window(handle);
  await driver.wait(async () => (await driver.getCurrentUrl()) === url, 5000, 'popup tab loaded');
  await driver.wait(async () => driver.executeScript('return document.getElementById("strong").value.length > 0'), 5000, 'popup rendered');
  return handle;
}

// Closes the current tab and returns to the first remaining one.
async function closeTab(driver) {
  await driver.close();
  const handles = await driver.getAllWindowHandles();
  await driver.switchTo().window(handles[0]);
}

// Sends a command to the test-only hook script inside the content script.
async function hook(driver, cmd, payload = null) {
  const reply = await driver.executeAsyncScript(
    function (cmd, payload, done) {
      const id = Math.random().toString(36).slice(2);
      function onMessage(event) {
        const data = event.data;
        if (!data || data.type !== 'sb-test-result' || data.id !== id) return;
        window.removeEventListener('message', onMessage);
        done(data);
      }
      window.addEventListener('message', onMessage);
      window.postMessage({ type: 'sb-test', id: id, cmd: cmd, payload: payload }, '*');
    },
    cmd,
    payload
  );
  if (reply.error) throw new Error(`test hook "${cmd}" failed: ${reply.error}`);
  return reply.result;
}

async function openFixture(driver, url) {
  await driver.get(url);
  await driver.wait(until.elementLocated(By.css('html[data-sb-test-hooks="ready"]')), DEFAULT_TIMEOUT_MS);
}

// Computed visibility of every element matching `selector`, keyed by data-mock-id.
async function visibilityMap(driver, selector) {
  return driver.executeScript(function (selector) {
    const out = {};
    for (const el of document.querySelectorAll(selector)) {
      const style = getComputedStyle(el);
      const key = el.getAttribute('data-mock-id') || el.id || el.tagName.toLowerCase();
      out[key] = {
        display: style.display,
        visibility: style.visibility,
        mark: el.getAttribute('data-sb'),
        hidden: style.display === 'none' || style.visibility === 'hidden',
      };
    }
    return out;
  }, selector);
}

// Waits until no candidate container is left unmarked (or the timeout hits).
async function waitUntilSettled(driver, selector, timeout = DEFAULT_TIMEOUT_MS) {
  await driver.wait(async () => {
    const pending = await driver.executeScript(function (selector) {
      let count = 0;
      for (const el of document.querySelectorAll(selector)) if (!el.hasAttribute('data-sb')) count += 1;
      return count;
    }, selector);
    return pending === 0;
  }, timeout, `candidates still unmarked after ${timeout}ms: ${selector}`);
}

async function waitFor(driver, predicate, message, timeout = DEFAULT_TIMEOUT_MS) {
  await driver.wait(predicate, timeout, message);
}

module.exports = {
  launchBrowser,
  popupUrl,
  openPopup,
  closeTab,
  hook,
  openFixture,
  visibilityMap,
  waitUntilSettled,
  waitFor,
  By,
  until,
};

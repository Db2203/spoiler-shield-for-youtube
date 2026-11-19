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
const { Builder, By, until } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { buildTestExtension } = require('./build-extension');

const WINDOWS_FIREFOX = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const DEFAULT_TIMEOUT_MS = 10000;

function firefoxBinary() {
  if (process.env.FIREFOX_BIN) return process.env.FIREFOX_BIN;
  if (process.platform === 'win32' && fs.existsSync(WINDOWS_FIREFOX)) return WINDOWS_FIREFOX;
  return null;
}

async function launchBrowser() {
  const extensionDir = buildTestExtension();
  const options = new firefox.Options()
    .setPreference('extensions.originControls.grantByDefault', true)
    .setPreference('devtools.console.stdout.content', true)
    .setPreference('browser.cache.disk.enable', false)
    .setPreference('browser.cache.memory.enable', false);
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

module.exports = { launchBrowser, hook, openFixture, visibilityMap, waitUntilSettled, waitFor, By, until };

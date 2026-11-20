'use strict';

/*
 * Captures the README screenshots from the mock pages (never from YouTube).
 * Usage: npm run screenshots
 */

const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./server');
const { launchBrowser, openPopup, openOptions, closeTab, hook, openFixture, waitUntilSettled, waitFor, By } = require('./browser');

// Mock-page renders are not committed; only the options page shot is used by the README.
const DOCS_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots');
const OUT_DIR = path.join(DOCS_DIR, 'mock');
const SETTINGS = {
  enabled: true,
  strongKeywords: ['Zorblax Quest 9', 'pizza'],
  weakKeywords: ['Zorblax', 'Quest'],
  blockedChannels: [],
  blurThumbnails: false,
  strictMode: false,
};

async function shot(driver, name, dir = OUT_DIR) {
  const png = await driver.takeScreenshot();
  fs.writeFileSync(path.join(dir, name), Buffer.from(png, 'base64'));
  console.log('wrote', path.relative(DOCS_DIR, path.join(dir, name)));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const driver = await launchBrowser();
  try {
    await driver.manage().window().setRect({ width: 1280, height: 800 });

    // Home page: matching tiles are gone, the grid closes up.
    await openFixture(driver, server.url('/'));
    await hook(driver, 'setSettings', SETTINGS);
    await waitUntilSettled(driver, 'ytd-rich-item-renderer');
    await shot(driver, 'home-filtered.png');

    // Same page with thumbnail blur on and one tile revealed.
    await hook(driver, 'setSettings', { blurThumbnails: true });
    await driver.findElement(By.css('[data-mock-id="v1"] ytd-thumbnail img')).click();
    await waitFor(driver, async () => driver.executeScript('return document.querySelector(\'[data-mock-id="v1"]\').hasAttribute("data-sb-reveal")'), 'revealed');
    await shot(driver, 'home-blurred.png');
    await hook(driver, 'setSettings', { blurThumbnails: false });

    // Blocked video page.
    await openFixture(driver, server.url('/watch?v=w2'));
    await waitFor(driver, async () => (await driver.executeScript('return document.documentElement.getAttribute("data-sb-watch")')) === 'blocked', 'blocked');
    await shot(driver, 'watch-blocked.png');

    // Popup.
    await driver.sleep(1500); // let the content script flush its hidden count to storage
    // Show the real default lists on the settings screenshots.
    require(path.join(__dirname, '..', '..', '..', 'extension', 'content', 'settings.js'));
    const defaults = globalThis.SpoilerBlocker.settings.DEFAULTS;
    await hook(driver, 'setSettings', { strongKeywords: [...defaults.strongKeywords], weakKeywords: [...defaults.weakKeywords] });

    // Options page with the welcome section.
    await driver.manage().window().setRect({ width: 1000, height: 1100 });
    await openOptions(driver, '#welcome');
    await shot(driver, 'options.png', DOCS_DIR);
    await closeTab(driver);

    // Popup.
    await driver.manage().window().setRect({ width: 380, height: 430 });
    await openPopup(driver);
    await driver.sleep(400); // let the switch animation finish
    await shot(driver, 'popup.png');
  } finally {
    await driver.quit();
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

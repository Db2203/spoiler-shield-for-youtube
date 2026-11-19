'use strict';

/*
 * Store screenshots taken on the real YouTube site with the extension active,
 * using the harmless keyword "pizza". Output goes to docs/screenshots/real/,
 * which is git-ignored because the images show third-party content.
 *
 * The script never prints page text; it only reports what it captured and
 * the extension state it verified before each shot.
 *
 * Usage: node scripts/real-youtube-screenshots.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, hook, By, until } = require(path.join(__dirname, '..', 'tests', 'e2e', 'helpers', 'browser'));

const YT = 'https://www.youtube.com';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots', 'real');
const QUERY = 'pasta pizza';
const SETTINGS = {
  enabled: true,
  strongKeywords: ['GTA', 'GTA 6', 'GTA6', 'GTA VI', 'GTAVI', 'Grand Theft Auto', 'Leonida', 'Vice City', 'Jason Duval', 'Lucia Caminos', 'pizza'],
  weakKeywords: ['Rockstar', 'Lucia', 'Jason'],
  blockedChannels: [],
  blurThumbnails: false,
  strictMode: false,
};

async function shot(driver, name, note) {
  const png = await driver.takeScreenshot();
  fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(png, 'base64'));
  console.log('wrote', name, '|', note);
}

async function open(driver, url) {
  await driver.get(url);
  await driver.wait(until.elementLocated(By.css('html[data-sb-test-hooks="ready"]')), 20000);
}

async function settled(driver, selector) {
  await driver.wait(async () => {
    return driver.executeScript(function (selector) {
      const all = document.querySelectorAll(selector);
      if (all.length === 0) return false;
      for (const el of all) if (!el.hasAttribute('data-sb')) return false;
      return true;
    }, selector);
  }, 20000, 'results settled');
}

async function counts(driver, selector) {
  return driver.executeScript(function (selector) {
    let hidden = 0;
    let visible = 0;
    for (const el of document.querySelectorAll(selector)) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') hidden += 1;
      else visible += 1;
    }
    return { hidden, visible };
  }, selector);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const driver = await launchBrowser();
  try {
    await driver.manage().window().setRect({ width: 1280, height: 800 });
    const RESULTS = 'ytd-video-renderer, yt-lockup-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2';

    // 1. Search results: off, then on.
    await open(driver, YT + '/results?search_query=' + encodeURIComponent(QUERY));
    await hook(driver, 'setSettings', Object.assign({}, SETTINGS, { enabled: false }));
    await driver.wait(until.elementLocated(By.css(RESULTS)), 30000);
    await driver.sleep(3000);
    await driver.executeScript('window.scrollTo(0, 0)');
    const before = await counts(driver, RESULTS);
    await shot(driver, '1-search-before.png', `shield off, ${before.visible} results visible`);

    await hook(driver, 'setSettings', { enabled: true });
    await settled(driver, RESULTS);
    await driver.sleep(1000);
    const after = await counts(driver, RESULTS);
    await shot(driver, '2-search-after.png', `shield on, ${after.hidden} hidden, ${after.visible} visible`);

    // 3. Blur with one tile revealed.
    await hook(driver, 'setSettings', { blurThumbnails: true });
    await driver.sleep(500);
    // Click the image itself, as a user would.
    const first = await driver.findElements(By.css('ytd-video-renderer[data-sb="ok"] ytd-thumbnail img, yt-lockup-view-model[data-sb="ok"] yt-thumbnail-view-model img'));
    if (first.length) await driver.executeScript('arguments[0].click()', first[0]);
    await driver.sleep(800);
    const revealed = await driver.executeScript('return document.querySelectorAll("[data-sb-reveal]").length');
    await shot(driver, '3-search-blurred.png', `blur on, ${revealed} tile revealed`);
    await hook(driver, 'setSettings', { blurThumbnails: false });

    // 4. Blocked video page. Pick a hidden result's plain video link.
    const href = await driver.executeScript(function () {
      for (const el of document.querySelectorAll('ytd-video-renderer[data-sb="hide"], yt-lockup-view-model[data-sb="hide"]')) {
        for (const a of el.querySelectorAll('a[href^="/watch?v="]')) {
          const h = a.getAttribute('href');
          if (!/[?&]list=/.test(h)) return h;
        }
      }
      return null;
    });
    if (href) {
      await open(driver, YT + href);
      await driver.wait(async () => (await driver.executeScript('return document.documentElement.getAttribute("data-sb-watch")')) === 'blocked', 20000, 'blocked');
      await driver.sleep(1500);
      await shot(driver, '4-video-blocked.png', 'blocked page with Go back overlay');
    } else {
      console.log('skipped 4-video-blocked.png: no hidden video link in results');
    }
  } finally {
    await driver.quit();
  }
  console.log('done:', OUT_DIR);
}

main().catch((err) => {
  console.error('fatal:', err.message.split('\n')[0]);
  process.exit(1);
});

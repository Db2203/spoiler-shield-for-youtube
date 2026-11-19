'use strict';

/*
 * Performance guard: a burst of 500 tiles must be decided within the same
 * microtask checkpoint as their insertion, and quickly.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');
const { launchBrowser, hook, openFixture, waitUntilSettled } = require('./helpers/browser');

const TILE = 'ytd-rich-item-renderer';
const TILE_COUNT = 500;
const BUDGET_MS = 1500;

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

test(`${TILE_COUNT} tiles inserted at once are all marked before the next task, within ${BUDGET_MS}ms`, async () => {
  await openFixture(driver, server.url('/'));
  await hook(driver, 'setSettings', {
    enabled: true,
    strongKeywords: ['Zorblax Quest 9', 'pizza'],
    weakKeywords: ['Zorblax', 'Quest'],
    blockedChannels: [],
    blurThumbnails: true,
  });
  await waitUntilSettled(driver, TILE);

  const result = await driver.executeAsyncScript(
    function (count, done) {
      const titles = ['Baking sourdough at home', 'Best pizza in the city', 'Zorblax lore explained', 'Zorblax community quest update', 'Morning cycling route'];
      const items = [];
      for (let i = 0; i < count; i += 1) {
        items.push({ id: 'perf' + i, title: titles[i % titles.length] + ' #' + i, channel: 'Channel ' + (i % 17), handle: 'channel' + (i % 17) });
      }
      const start = performance.now();
      window.YTMock.addItems(items);
      // Mutation observers run at the microtask checkpoint right after this
      // script's task; a setTimeout(0) lands in the next task.
      setTimeout(function () {
        const elapsed = performance.now() - start;
        let unmarked = 0;
        let hidden = 0;
        for (const el of document.querySelectorAll('ytd-rich-item-renderer[data-mock-id^="perf"]')) {
          if (!el.hasAttribute('data-sb')) unmarked += 1;
          if (el.getAttribute('data-sb') === 'hide') hidden += 1;
        }
        done({ elapsed: elapsed, unmarked: unmarked, hidden: hidden });
      }, 0);
    },
    TILE_COUNT
  );

  assert.equal(result.unmarked, 0, 'every new tile was decided before the next task');
  assert.equal(result.hidden, TILE_COUNT * 2 / 5, 'two of every five generated titles match');
  assert.ok(result.elapsed < BUDGET_MS, `took ${Math.round(result.elapsed)}ms, budget ${BUDGET_MS}ms`);
  console.log(`# ${TILE_COUNT} tiles decided in ${Math.round(result.elapsed)}ms`);
});

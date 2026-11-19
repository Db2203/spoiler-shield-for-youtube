'use strict';

/*
 * Runs the manual checklist (docs/manual-testing.md) against the real YouTube
 * site in headless Firefox with the extension loaded, using the harmless
 * keyword "pizza".
 *
 * SPOILER SAFETY: this script never prints page text. It reports structure
 * only: how many candidate items were found, how many were checked, how many
 * were hidden, and whether any visible item still contains the keyword.
 * Videos, Shorts and channels are chosen from search results by link only.
 *
 * Usage: node scripts/real-youtube-check.js
 */

const path = require('node:path');
const { launchBrowser, hook, By, until } = require(path.join(__dirname, '..', 'tests', 'e2e', 'helpers', 'browser'));

const YT = 'https://www.youtube.com';
const KEYWORD = 'pizza';
const SETTINGS = {
  enabled: true,
  strongKeywords: ['GTA', 'GTA 6', 'GTA6', 'GTA VI', 'GTAVI', 'Grand Theft Auto', 'Leonida', 'Vice City', 'Jason Duval', 'Lucia Caminos', KEYWORD],
  weakKeywords: ['Rockstar', 'Lucia', 'Jason'],
  blockedChannels: [],
  blurThumbnails: false,
  strictMode: false,
};

const CANDIDATES = {
  tiles: 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model',
  shorts: 'ytd-reel-item-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2',
  comments: 'ytd-comment-thread-renderer, ytd-comment-view-model, ytd-comment-renderer',
  posts: 'ytd-backstage-post-thread-renderer, ytd-post-renderer',
  suggestions: '.ytSuggestionComponentSuggestion, .sbsb_c, [role="listbox"] > [role="option"], [role="listbox"] > li',
};

const results = [];
function record(step, where, outcome, detail) {
  results.push({ step, where, outcome, detail: detail || '' });
  console.log(`${String(step).padStart(2)}  ${outcome.padEnd(11)} ${where.padEnd(28)} ${detail || ''}`);
}

// Structural audit of candidate containers on the current page. Never returns text.
async function audit(driver, selector) {
  return driver.executeScript(
    function (selector, keyword) {
      const re = new RegExp('(?<![\\p{L}\\p{N}])' + keyword + '(?![\\p{L}\\p{N}])', 'iu');
      const out = { found: 0, unchecked: 0, hidden: 0, visible: 0, leaks: 0 };
      for (const el of document.querySelectorAll(selector)) {
        out.found += 1;
        const mark = el.getAttribute('data-sb');
        const style = getComputedStyle(el);
        const invisible = style.display === 'none' || style.visibility === 'hidden';
        if (!mark) out.unchecked += 1;
        if (mark === 'hide') out.hidden += 1;
        if (!invisible) {
          out.visible += 1;
          const parts = [el.textContent || ''];
          for (const n of el.querySelectorAll('[aria-label],[title],img[alt]')) {
            parts.push(n.getAttribute('aria-label') || '', n.getAttribute('title') || '', n.getAttribute('alt') || '');
          }
          if (re.test(parts.join('\n'))) out.leaks += 1;
        }
      }
      return out;
    },
    selector,
    KEYWORD
  );
}

function summarize(a) {
  return `found ${a.found}, hidden ${a.hidden}, visible ${a.visible}, unchecked ${a.unchecked}, leaks ${a.leaks}`;
}

function verdict(a, needSome = true) {
  if (needSome && a.found === 0) return 'NO ITEMS';
  if (a.leaks > 0 || a.unchecked > 0) return 'FAIL';
  return 'PASS';
}

async function pageStatus(driver) {
  return driver.executeScript('return document.documentElement.getAttribute("data-sb-watch")');
}

async function waitForAny(driver, selector, timeout = 15000) {
  try {
    await driver.wait(until.elementLocated(By.css(selector)), timeout);
    return true;
  } catch (_) {
    return false;
  }
}

async function settle(driver, ms = 1500) {
  await driver.sleep(ms);
}

async function scrollDown(driver, times) {
  for (let i = 0; i < times; i += 1) {
    await driver.executeScript('window.scrollBy(0, document.documentElement.clientHeight * 2)');
    await settle(driver, 1500);
  }
}

// Hrefs of hidden/visible items of a kind, structure only (never text).
async function hrefs(driver, selector, mark, pattern, exclude) {
  return driver.executeScript(
    function (selector, mark, pattern, exclude) {
      const re = new RegExp(pattern);
      const skip = exclude ? new RegExp(exclude) : null;
      const out = [];
      for (const el of document.querySelectorAll(selector)) {
        if (el.getAttribute('data-sb') !== mark) continue;
        for (const a of el.querySelectorAll('a[href]')) {
          const href = a.getAttribute('href');
          if (re.test(href) && !(skip && skip.test(href)) && !out.includes(href)) out.push(href);
        }
      }
      return out;
    },
    selector,
    mark,
    pattern,
    exclude || null
  );
}

// Plain video links only: a playlist link lands on a video that need not match.
const WATCH_LINK = '^/watch\\?v=';
const PLAYLIST_LINK = '[?&]list=';

async function open(driver, url) {
  await driver.get(url);
  await driver.wait(until.elementLocated(By.css('html[data-sb-test-hooks="ready"]')), 20000);
}

async function main() {
  const driver = await launchBrowser();
  const picks = { pizzaWatch: null, safeWatch: null, pizzaShort: null, safeShort: null, pizzaChannel: null, safeChannel: null };
  try {
    await driver.manage().window().setRect({ width: 1280, height: 900 });
    await open(driver, YT + '/');
    await hook(driver, 'setSettings', SETTINGS);

    /* 1-3: Home page, infinite scroll, Shorts shelf */
    try {
      await open(driver, YT + '/');
      const has = await waitForAny(driver, CANDIDATES.tiles);
      await settle(driver, 2000);
      const first = await audit(driver, CANDIDATES.tiles);
      record(1, 'Home tiles', has ? verdict(first) : 'NO ITEMS', summarize(first));
      await scrollDown(driver, 6);
      const after = await audit(driver, CANDIDATES.tiles);
      record(2, 'Home after scrolling', verdict(after), summarize(after) + (after.found > first.found ? ' (grew)' : ' (did not grow)'));
      const shorts = await audit(driver, CANDIDATES.shorts);
      record(3, 'Home Shorts shelf', verdict(shorts), summarize(shorts));
    } catch (err) {
      record(1, 'Home', 'ERROR', err.message.split('\n')[0]);
    }

    /* 4: Search suggestions */
    try {
      await open(driver, YT + '/');
      const box = await driver.wait(until.elementLocated(By.css('input[name="search_query"], input#search, ytd-searchbox input')), 15000);
      await box.click();
      await box.sendKeys('piz');
      await settle(driver, 2500);
      const sug = await audit(driver, CANDIDATES.suggestions);
      if (sug.found === 0) {
        // Describe the dropdown's structure (tags and classes only) to help fix selectors.
        const shape = await driver.executeScript(function () {
          const box = document.querySelector('ytd-searchbox') || document.querySelector('form[role="search"]');
          const root = box ? box.parentElement : document.body;
          const tags = new Set();
          for (const el of root.querySelectorAll('[role="listbox"], [role="option"], ul, li')) {
            tags.add(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : ''));
          }
          return Array.from(tags).slice(0, 12).join(' | ');
        });
        record(4, 'Search suggestions', 'NO ITEMS', 'no suggestion rows matched; dropdown shape: ' + shape);
      } else {
        record(4, 'Search suggestions', verdict(sug), summarize(sug));
      }
      await box.clear();
    } catch (err) {
      record(4, 'Search suggestions', 'ERROR', err.message.split('\n')[0]);
    }

    /* 5-6: Search results */
    try {
      await open(driver, YT + '/results?search_query=' + KEYWORD);
      await waitForAny(driver, 'ytd-video-renderer, yt-lockup-view-model');
      await settle(driver, 2000);
      await scrollDown(driver, 2);
      const a = await audit(driver, CANDIDATES.tiles);
      record(5, 'Search "pizza"', verdict(a), summarize(a));
      const s = await audit(driver, CANDIDATES.shorts);
      if (s.found) record(5, 'Search "pizza" Shorts', verdict(s), summarize(s));
      picks.pizzaWatchCandidates = await hrefs(driver, 'ytd-video-renderer, yt-lockup-view-model', 'hide', WATCH_LINK, PLAYLIST_LINK);
      picks.pizzaShort = (await hrefs(driver, CANDIDATES.shorts, 'hide', '^/shorts/'))[0] || null;
      picks.pizzaChannel = (await hrefs(driver, 'ytd-video-renderer', 'hide', '^/@'))[0] || null;

      await open(driver, YT + '/results?search_query=pasta');
      await waitForAny(driver, 'ytd-video-renderer, yt-lockup-view-model');
      await settle(driver, 2000);
      await scrollDown(driver, 2);
      const b = await audit(driver, CANDIDATES.tiles);
      record(6, 'Search "pasta"', verdict(b), summarize(b));
      picks.safeWatchCandidates = await hrefs(driver, 'ytd-video-renderer, yt-lockup-view-model', 'ok', WATCH_LINK, PLAYLIST_LINK);
      picks.safeChannel = (await hrefs(driver, 'ytd-video-renderer', 'ok', '^/@'))[0] || null;

      await open(driver, YT + '/results?search_query=pasta+shorts');
      await waitForAny(driver, CANDIDATES.shorts, 10000);
      await settle(driver, 1500);
      picks.safeShort = (await hrefs(driver, CANDIDATES.shorts, 'ok', '^/shorts/'))[0] || null;
      if (!picks.pizzaShort) {
        await open(driver, YT + '/results?search_query=' + KEYWORD + '+shorts');
        await waitForAny(driver, CANDIDATES.shorts, 10000);
        await settle(driver, 1500);
        picks.pizzaShort = (await hrefs(driver, CANDIDATES.shorts, 'hide', '^/shorts/'))[0] || null;
      }
    } catch (err) {
      record(5, 'Search', 'ERROR', err.message.split('\n')[0]);
    }

    /* 7-8, 10: Safe watch page: sidebar, hover preview, comments, SPA navigation */
    try {
      // A result whose tile looked safe may still match on its own page (full
      // description, tags). Try a few until one evaluates clean.
      let st = null;
      let tried = 0;
      for (const href of picks.safeWatchCandidates || []) {
        tried += 1;
        await open(driver, YT + href);
        await driver.wait(async () => ['ok', 'blocked'].includes(await pageStatus(driver)), 20000);
        await settle(driver, 2500);
        st = await pageStatus(driver);
        if (st === 'ok') {
          picks.safeWatch = href;
          break;
        }
        if (tried >= 4) break;
      }
      if (!picks.safeWatch) throw new Error('no search result evaluated as safe on its own page (tried ' + tried + ')');
      record(7, 'Safe video page', 'PASS', 'status ok (candidates tried: ' + tried + ')');
      const side = await audit(driver, 'ytd-compact-video-renderer, yt-lockup-view-model');
      record(7, 'Watch sidebar', verdict(side), summarize(side));

      // Hover preview: hover the first visible sidebar tile for a while.
      const tile = await driver.findElements(By.css('yt-lockup-view-model[data-sb="ok"], ytd-compact-video-renderer[data-sb="ok"]'));
      if (tile.length) {
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"})', tile[0]);
        await settle(driver, 500);
        await driver.actions({ async: true }).move({ origin: tile[0] }).perform();
        await settle(driver, 3000);
        const preview = await driver.executeScript(function () {
          let shown = 0;
          let playing = 0;
          for (const el of document.querySelectorAll('ytd-video-preview, #video-preview, #inline-preview-player, ytd-moving-thumbnail-renderer')) {
            if (getComputedStyle(el).display !== 'none') shown += 1;
            for (const v of el.querySelectorAll('video')) if (!v.paused) playing += 1;
          }
          return { shown, playing };
        });
        record(7, 'Hover preview', preview.shown === 0 && preview.playing === 0 ? 'PASS' : 'FAIL', `preview containers shown ${preview.shown}, playing ${preview.playing}`);
      }

      // Comments load when scrolled into view.
      await driver.executeScript('const c = document.querySelector("ytd-comments"); if (c) c.scrollIntoView();');
      const hasComments = await waitForAny(driver, 'ytd-comment-thread-renderer', 15000);
      await scrollDown(driver, 3);
      const com = await audit(driver, CANDIDATES.comments);
      record(8, 'Comments', hasComments ? verdict(com) : 'NO ITEMS', summarize(com));

      // SPA navigation: click the first visible sidebar tile's link.
      const link = await driver.findElements(By.css('yt-lockup-view-model[data-sb="ok"] a[href^="/watch"], ytd-compact-video-renderer[data-sb="ok"] a[href^="/watch"]'));
      if (link.length) {
        const before = await driver.getCurrentUrl();
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"})', link[0]);
        await link[0].click();
        await driver.wait(async () => (await driver.getCurrentUrl()) !== before, 15000);
        await driver.wait(async () => ['ok', 'blocked'].includes(await pageStatus(driver)), 20000);
        const st2 = await pageStatus(driver);
        const overlay = await driver.executeScript('const o = document.getElementById("sb-overlay"); return o ? getComputedStyle(o).display : "none"');
        record(10, 'In-page navigation', st2 === 'ok' && overlay === 'none' ? 'PASS' : 'FAIL', 'status ' + st2 + ', overlay ' + overlay);
      }
    } catch (err) {
      record(7, 'Safe video page', 'ERROR', err.message.split('\n')[0]);
    }

    /* 9: Blocked watch page */
    try {
      if (!(picks.pizzaWatchCandidates || []).length) throw new Error('no hidden video link found in search results');
      let st = null;
      let tried = 0;
      for (const href of picks.pizzaWatchCandidates) {
        tried += 1;
        await open(driver, YT + href);
        await driver.wait(async () => ['ok', 'blocked'].includes(await pageStatus(driver)), 20000);
        await settle(driver, 2000);
        st = await pageStatus(driver);
        if (st === 'blocked' || tried >= 4) break;
      }
      const info = await driver.executeScript(function () {
        const o = document.getElementById('sb-overlay');
        const videos = Array.from(document.querySelectorAll('video'));
        return { overlay: o ? getComputedStyle(o).display : 'none', videos: videos.length, playing: videos.filter((v) => !v.paused).length };
      });
      record(9, 'Pizza video page', st === 'blocked' && info.overlay === 'flex' && info.playing === 0 ? 'PASS' : 'FAIL', `status ${st}, overlay ${info.overlay}, videos ${info.videos}, playing ${info.playing} (candidates tried: ${tried})`);
      if (st === 'blocked') {
        const before = await driver.getCurrentUrl();
        await driver.findElement(By.css('#sb-go-back')).click();
        await driver.wait(async () => (await driver.getCurrentUrl()) !== before, 15000);
        record(9, 'Go back', 'PASS', 'left the blocked page');
      }
    } catch (err) {
      record(9, 'Pizza video page', 'ERROR', err.message.split('\n')[0]);
    }

    /* 12: Shorts */
    try {
      if (picks.safeShort) {
        await open(driver, YT + picks.safeShort);
        await driver.wait(async () => ['ok', 'blocked'].includes(await pageStatus(driver)), 20000);
        record(12, 'Safe Short', (await pageStatus(driver)) === 'ok' ? 'PASS' : 'FAIL', 'status ' + (await pageStatus(driver)));
      } else {
        record(12, 'Safe Short', 'NO ITEMS', 'no safe Short link found');
      }
      if (picks.pizzaShort) {
        await open(driver, YT + picks.pizzaShort);
        await driver.wait(async () => ['ok', 'blocked'].includes(await pageStatus(driver)), 20000);
        await settle(driver, 2000);
        const st = await pageStatus(driver);
        const playing = await driver.executeScript('return Array.from(document.querySelectorAll("video")).filter(v => !v.paused).length');
        record(12, 'Pizza Short', st === 'blocked' && playing === 0 ? 'PASS' : 'FAIL', `status ${st}, playing ${playing}`);
      } else {
        record(12, 'Pizza Short', 'NO ITEMS', 'no hidden Short link found');
      }
    } catch (err) {
      record(12, 'Shorts', 'ERROR', err.message.split('\n')[0]);
    }

    /* 13-15: Channel pages, blocklist, community */
    try {
      if (!picks.safeChannel) throw new Error('no channel link found');
      const handle = picks.safeChannel.split('/')[1].split('?')[0];
      await open(driver, YT + '/' + handle + '/videos');
      await driver.wait(async () => ['ok', 'blocked', null].includes(await pageStatus(driver)), 20000);
      await waitForAny(driver, CANDIDATES.tiles, 15000);
      await settle(driver, 2000);
      const grid = await audit(driver, CANDIDATES.tiles);
      record(14, 'Channel videos tab', (await pageStatus(driver)) !== 'blocked' ? verdict(grid) : 'FAIL', 'status ' + (await pageStatus(driver)) + '; ' + summarize(grid));

      await hook(driver, 'setSettings', { blockedChannels: [handle] });
      await driver.wait(async () => (await pageStatus(driver)) === 'blocked', 15000);
      record(13, 'Blocked channel page', 'PASS', 'status blocked after adding ' + handle.length + '-character handle');
      await hook(driver, 'setSettings', { blockedChannels: [] });

      await open(driver, YT + '/' + handle + '/community');
      const hasPosts = await waitForAny(driver, CANDIDATES.posts, 10000);
      await settle(driver, 1500);
      const posts = await audit(driver, CANDIDATES.posts);
      record(15, 'Community posts', hasPosts ? verdict(posts) : 'NO ITEMS', summarize(posts));
    } catch (err) {
      record(13, 'Channel', 'ERROR', err.message.split('\n')[0]);
    }

    /* 17-18: Blur, reveal, strict */
    try {
      await open(driver, YT + '/results?search_query=pasta');
      await waitForAny(driver, 'ytd-video-renderer');
      await settle(driver, 2000);
      await hook(driver, 'setSettings', { blurThumbnails: true });
      await settle(driver, 500);
      const blur = await driver.executeScript(function () {
        const out = { tiles: 0, blurred: 0, sharp: 0 };
        for (const el of document.querySelectorAll('ytd-video-renderer[data-sb="ok"]')) {
          const img = el.querySelector('ytd-thumbnail img, yt-thumbnail-view-model img');
          if (!img) continue;
          out.tiles += 1;
          if (/blur/.test(getComputedStyle(img).filter)) out.blurred += 1;
          else out.sharp += 1;
        }
        return out;
      });
      record(17, 'Thumbnail blur', blur.tiles > 0 && blur.sharp === 0 ? 'PASS' : 'FAIL', `visible tiles ${blur.tiles}, blurred ${blur.blurred}, sharp ${blur.sharp}`);

      const THUMB_LINK = 'ytd-video-renderer[data-sb="ok"] ytd-thumbnail a, ytd-video-renderer[data-sb="ok"] yt-thumbnail-view-model';
      const thumb = await driver.findElements(By.css(THUMB_LINK));
      if (thumb.length) {
        const before = await driver.getCurrentUrl();
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"}); arguments[0].click();', thumb[0]);
        await settle(driver, 1000);
        const revealed = await driver.executeScript('return document.querySelectorAll("[data-sb-reveal]").length');
        const same = (await driver.getCurrentUrl()) === before;
        record(17, 'Click to reveal', revealed === 1 && same ? 'PASS' : 'FAIL', `revealed ${revealed}, navigated ${!same}`);

        await hook(driver, 'setSettings', { strictMode: true });
        await settle(driver, 500);
        const cleared = await driver.executeScript('return document.querySelectorAll("[data-sb-reveal]").length');
        const t2 = await driver.findElements(By.css(THUMB_LINK));
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"}); arguments[0].click();', t2[0]);
        let navigated = false;
        try {
          await driver.wait(async () => (await driver.getCurrentUrl()) !== before, 10000);
          navigated = true;
        } catch (_) {
          /* no navigation */
        }
        record(18, 'Strict mode', cleared === 0 && navigated ? 'PASS' : 'FAIL', `reveals after strict ${cleared}, click navigated ${navigated}`);
      }
      await hook(driver, 'setSettings', { blurThumbnails: false, strictMode: false });
    } catch (err) {
      record(17, 'Blur', 'ERROR', err.message.split('\n')[0]);
    }

    /* 19-20: Off switch and counters */
    try {
      await open(driver, YT + '/results?search_query=' + KEYWORD);
      await waitForAny(driver, 'ytd-video-renderer, yt-lockup-view-model');
      await settle(driver, 2000);
      const on = await audit(driver, CANDIDATES.tiles);
      const state = await hook(driver, 'getState');
      const stats = await hook(driver, 'getStats');
      record(20, 'Counters', state.hiddenCount > 0 && stats.hiddenTotal >= state.hiddenCount ? 'PASS' : 'FAIL', `page ${state.hiddenCount}, total ${stats.hiddenTotal}`);
      await hook(driver, 'setSettings', { enabled: false });
      await settle(driver, 500);
      const off = await driver.executeScript(function () {
        let invisible = 0;
        for (const el of document.querySelectorAll('ytd-video-renderer, yt-lockup-view-model')) {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') invisible += 1;
        }
        return invisible;
      });
      await hook(driver, 'setSettings', { enabled: true });
      await settle(driver, 500);
      const back = await audit(driver, CANDIDATES.tiles);
      record(19, 'Off switch', off === 0 && on.hidden > 0 && back.hidden > 0 ? 'PASS' : 'FAIL', `invisible while off ${off}, hidden before ${on.hidden}, after ${back.hidden}`);
    } catch (err) {
      record(19, 'Off switch', 'ERROR', err.message.split('\n')[0]);
    }

    record(11, 'End screens', 'SKIPPED', 'needs a video played to the end');
    record(16, 'Notifications', 'SKIPPED', 'needs a signed-in account');
  } finally {
    await driver.quit();
  }

  const fails = results.filter((r) => r.outcome === 'FAIL' || r.outcome === 'ERROR');
  console.log(`\n${results.length} checks: ${results.filter((r) => r.outcome === 'PASS').length} pass, ${fails.length} fail/error, ${results.filter((r) => r.outcome === 'NO ITEMS' || r.outcome === 'SKIPPED').length} not applicable`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((err) => {
  console.error('fatal:', err.message.split('\n')[0]);
  process.exit(2);
});

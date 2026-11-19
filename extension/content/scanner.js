/*
 * Scanner: watches the page, evaluates every candidate container and marks it
 * data-sb="ok" (safe) or data-sb="hide" (matched). Unmarked containers are
 * invisible thanks to hide.css, so any failure here leaves content hidden.
 *
 * YouTube recycles tile elements with new data, so a mutation inside an
 * already-marked container always triggers a re-check.
 */
(function (root) {
  'use strict';

  const SB = (root.SpoilerBlocker = root.SpoilerBlocker || {});

  const SWEEP_INTERVAL_MS = 1500;
  const STATS_FLUSH_MS = 1000;
  const MAX_SIGNATURES = 5000;
  const NAV_EVENTS = ['yt-navigate-finish', 'yt-page-data-updated'];

  const state = {
    started: false,
    settings: null,
    matcher: null,
    observer: null,
    sweepTimer: null,
    fullScanQueued: false,
    hiddenCount: 0,
    pendingStats: 0,
    statsTimer: null,
    signatures: new Set(),
    // Last seen text per element, so a recycled tile drops its reveal.
    lastSignature: new WeakMap(),
    // Test-only failure modes: 'throw' makes every check fail, 'dead' stops all activity.
    failure: null,
  };

  function sel() {
    return SB.selectors;
  }

  function enabled() {
    return Boolean(state.started && state.settings && state.settings.enabled && state.failure !== 'dead');
  }

  // All text that could describe a tile: its content plus accessible labels.
  function textOf(el) {
    const attrs = sel().textAttributes;
    const parts = [el.textContent || ''];
    for (const attr of attrs) {
      const value = el.getAttribute(attr);
      if (value) parts.push(value);
    }
    const query = attrs.map((a) => '[' + a + ']').join(',');
    for (const node of el.querySelectorAll(query)) {
      for (const attr of attrs) {
        const value = node.getAttribute(attr);
        if (value) parts.push(value);
      }
    }
    return parts.join('\n');
  }

  function channelsOf(el) {
    const out = [];
    for (const a of el.querySelectorAll(sel().channelLink)) {
      const href = a.getAttribute('href');
      if (href) out.push(href.replace(/^https?:\/\/[^/]+/i, ''));
    }
    for (const node of el.querySelectorAll(sel().channelName)) out.push(node.textContent);
    return out;
  }

  function evaluate(el) {
    const verdict = state.matcher.evaluate(textOf(el));
    verdict.channel = false;
    if (!verdict.hide && state.settings.blockedChannels.length > 0) {
      if (SB.matcher.channelBlocked(channelsOf(el), state.settings.blockedChannels)) {
        verdict.hide = true;
        verdict.channel = true;
      }
    }
    return verdict;
  }

  function signatureOf(el) {
    return SB.matcher.normalizeText(el.textContent).slice(0, 200);
  }

  function recordHidden(el) {
    const signature = signatureOf(el);
    if (signature && state.signatures.has(signature)) return;
    if (state.signatures.size >= MAX_SIGNATURES) state.signatures.clear();
    if (signature) state.signatures.add(signature);
    state.hiddenCount += 1;
    state.pendingStats += 1;
    scheduleStatsFlush();
  }

  function scheduleStatsFlush() {
    if (state.statsTimer) return;
    state.statsTimer = setTimeout(async () => {
      state.statsTimer = null;
      const delta = state.pendingStats;
      state.pendingStats = 0;
      if (delta <= 0) return;
      try {
        await SB.settings.addToStats(delta);
      } catch (err) {
        console.error('[SpoilerBlocker] could not update stats', err);
      }
    }, STATS_FLUSH_MS);
  }

  function pauseMediaInside(el) {
    for (const media of el.querySelectorAll('video, audio')) {
      if (!media.paused) media.pause();
    }
  }

  function check(el) {
    if (state.failure === 'throw') throw new Error('scanner failure injected by test hook');
    if (!state.matcher) return; // settings not loaded yet: element stays hidden
    const signature = signatureOf(el);
    if (state.lastSignature.get(el) !== signature) {
      state.lastSignature.set(el, signature);
      if (el.hasAttribute('data-sb-reveal')) el.removeAttribute('data-sb-reveal');
    }
    const verdict = evaluate(el);
    if (verdict.hide) {
      if (el.getAttribute('data-sb') !== 'hide') {
        el.setAttribute('data-sb', 'hide');
        recordHidden(el);
      }
      pauseMediaInside(el);
    } else if (el.getAttribute('data-sb') !== 'ok') {
      el.setAttribute('data-sb', 'ok');
    }
  }

  // Never let an exception reveal anything: on failure the mark is removed,
  // which puts the element back under the fail-closed CSS rule.
  function process(el) {
    try {
      check(el);
    } catch (err) {
      try {
        el.removeAttribute('data-sb');
      } catch (_) {
        /* ignore */
      }
      console.error('[SpoilerBlocker] check failed, item stays hidden', err);
    }
  }

  function scanAll(scope) {
    const rootNode = scope || document;
    const selector = sel().candidateSelector;
    if (rootNode.nodeType === 1 && rootNode.matches(selector)) process(rootNode);
    for (const el of rootNode.querySelectorAll(selector)) process(el);
  }

  function queueFullScan() {
    if (state.fullScanQueued) return;
    state.fullScanQueued = true;
    queueMicrotask(() => {
      state.fullScanQueued = false;
      if (enabled()) scanAll(document);
    });
  }

  // Belt and braces: anything still unmarked gets checked periodically.
  function sweep() {
    if (!enabled()) return;
    const selector = sel().candidates.map((c) => c + ':not([data-sb])').join(',');
    for (const el of document.querySelectorAll(selector)) process(el);
  }

  function collectTargets(records) {
    const selector = sel().candidateSelector;
    const targets = new Set();
    const addWithAncestors = (el) => {
      let current = el.closest(selector);
      while (current) {
        targets.add(current);
        current = current.parentElement ? current.parentElement.closest(selector) : null;
      }
    };
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches(selector)) targets.add(node);
          for (const inner of node.querySelectorAll(selector)) targets.add(inner);
        }
      }
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (target) addWithAncestors(target);
    }
    return targets;
  }

  // Runs as a microtask before the next paint, so new or changed tiles are
  // decided before they can be seen.
  function onMutations(records) {
    if (!enabled()) return;
    try {
      for (const el of collectTargets(records)) {
        if (el.isConnected) process(el);
      }
    } catch (err) {
      console.error('[SpoilerBlocker] mutation handling failed, new items stay hidden', err);
    }
  }

  function observe() {
    if (state.observer) return;
    state.observer = new MutationObserver(onMutations);
    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: sel().textAttributes.concat(['href']),
    });
  }

  // Hover previews and inline players inside tiles never get to play.
  function onPlay(event) {
    const media = event.target;
    if (!(media instanceof HTMLMediaElement) || !enabled()) return;
    const selectors = sel();
    if (media.closest(selectors.previewContainers)) {
      media.pause();
      return;
    }
    const tile = media.closest(selectors.candidateSelector);
    if (!tile) return;
    // The Shorts player reel is a candidate too; only stop it when hidden.
    if (tile.matches(selectors.anyReel)) {
      if (tile.getAttribute('data-sb') === 'hide') media.pause();
      return;
    }
    media.pause();
  }

  function clearMarks() {
    for (const el of document.querySelectorAll('[data-sb]')) el.removeAttribute('data-sb');
  }

  function applySettings(settings) {
    state.settings = settings;
    state.matcher = SB.matcher.createMatcher(settings);
    const html = document.documentElement;
    if (settings.strictMode) html.setAttribute('data-sb-strict', '');
    else html.removeAttribute('data-sb-strict');
    if (!settings.enabled) {
      html.setAttribute('data-sb-off', '');
      return;
    }
    html.removeAttribute('data-sb-off');
    if (state.started) {
      clearMarks();
      scanAll(document);
    }
  }

  function start(settings) {
    if (state.started) return;
    state.started = true;
    applySettings(settings);
    observe();
    document.addEventListener('play', onPlay, true);
    state.sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
    for (const name of NAV_EVENTS) {
      window.addEventListener(name, queueFullScan, true);
      document.addEventListener(name, queueFullScan, true);
    }
  }

  function getState() {
    return {
      started: state.started,
      enabled: enabled(),
      hiddenCount: state.hiddenCount,
      failure: state.failure,
    };
  }

  // Test hook. Simulates the scanner breaking in two ways so tests can prove
  // that content stays hidden either way.
  function injectFailure(mode) {
    state.failure = mode || 'throw';
    if (mode === 'dead') {
      if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
      }
      if (state.sweepTimer) {
        clearInterval(state.sweepTimer);
        state.sweepTimer = null;
      }
    }
  }

  SB.scanner = { start, applySettings, scanAll, getState, injectFailure, textOf, channelsOf };
})(globalThis);

/*
 * Watch guard: decides whether the page itself (a video, a Short or a channel)
 * is about blocked content. Sets data-sb-watch on <html>:
 *
 *   pending  metadata not available yet, player hidden by hide.css
 *   ok       page is fine
 *   blocked  playback stopped, page covered by the "Go back" overlay
 *
 * On watch pages the verdict waits until the rendered video id matches the
 * URL, so a stale title from the previous video is never trusted.
 */
(function (root) {
  'use strict';

  const SB = (root.SpoilerBlocker = root.SpoilerBlocker || {});

  const PENDING_FALLBACK_MS = 10000;
  const NAV_EVENTS = ['yt-navigate-start', 'yt-navigate-finish', 'yt-page-data-updated', 'popstate'];

  const state = {
    settings: null,
    matcher: null,
    page: 'other',
    status: null,
    href: null,
    initialHref: location.href,
    observer: null,
    queued: false,
    overlay: null,
    allowedHref: null,
    pausedByUs: new Set(),
    fallbackTimer: null,
    fallbackDue: false,
    lastVerdict: null,
  };

  const sel = () => SB.selectors;
  const html = () => document.documentElement;

  function pageType(url) {
    const path = url.pathname;
    if (path === '/watch') return 'watch';
    if (path.startsWith('/shorts/')) return 'shorts';
    if (/^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/.test(path)) return 'channel';
    return 'other';
  }

  function setStatus(status) {
    if (state.status === status) return;
    state.status = status;
    if (status) html().setAttribute('data-sb-watch', status);
    else html().removeAttribute('data-sb-watch');
  }

  function textOfAll(selector) {
    const parts = [];
    for (const el of document.querySelectorAll(selector)) parts.push(el.textContent);
    return parts.join('\n');
  }

  function metaText() {
    const parts = [];
    const metas = document.querySelectorAll(
      'meta[name="title"], meta[property="og:title"], meta[name="keywords"], meta[name="description"], meta[property="og:description"]'
    );
    for (const meta of metas) parts.push(meta.getAttribute('content') || '');
    return parts.join('\n');
  }

  function documentTitle() {
    const title = document.title.replace(/\s*-\s*YouTube\s*$/i, '').trim();
    return title && title.toLowerCase() !== 'youtube' ? title : '';
  }

  // Meta tags only describe the first page load; YouTube does not update
  // them on in-page navigation.
  function onInitialPage() {
    return location.href === state.initialHref;
  }

  /* ---- Pausing ---- */

  function pauseAll(remember) {
    for (const video of document.querySelectorAll('video')) {
      if (video.paused) continue;
      video.pause();
      if (remember) state.pausedByUs.add(video);
    }
  }

  function resumePaused() {
    for (const video of state.pausedByUs) {
      if (video.isConnected) video.play().catch(() => {});
    }
    state.pausedByUs.clear();
  }

  function onPlay(event) {
    const media = event.target;
    if (!(media instanceof HTMLMediaElement)) return;
    if (state.status === 'blocked') {
      media.pause();
    } else if (state.status === 'pending') {
      media.pause();
      state.pausedByUs.add(media);
    }
  }

  /* ---- Overlay ---- */

  function ensureOverlay() {
    if (state.overlay && state.overlay.isConnected) return state.overlay;
    const overlay = document.createElement('div');
    overlay.id = 'sb-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sb-overlay-title');
    overlay.innerHTML =
      '<div class="sb-card">' +
      '<svg class="sb-icon" viewBox="0 0 128 128" aria-hidden="true">' +
      '<rect x="8" y="8" width="112" height="112" rx="26" fill="#1f1f24"/>' +
      '<path d="M64 24c-22 0-38 22-38 22s16 22 38 22 38-22 38-22-16-22-38-22z" fill="none" stroke="#f2f2f2" stroke-width="8" stroke-linejoin="round"/>' +
      '<circle cx="64" cy="46" r="11" fill="#f2f2f2"/>' +
      '<path d="M28 100 L100 28" stroke="#ff5a5f" stroke-width="12" stroke-linecap="round"/></svg>' +
      '<h1 id="sb-overlay-title">Spoiler blocked</h1>' +
      '<p id="sb-overlay-reason"></p>' +
      '<div class="sb-actions">' +
      '<button type="button" id="sb-go-back">Go back</button>' +
      '<button type="button" id="sb-show-anyway" class="sb-secondary">Show anyway</button>' +
      '</div></div>';
    overlay.querySelector('#sb-go-back').addEventListener('click', goBack);
    overlay.querySelector('#sb-show-anyway').addEventListener('click', showAnyway);
    html().appendChild(overlay);
    state.overlay = overlay;
    return overlay;
  }

  function reasonFor(verdict) {
    if (verdict.channel) return 'This channel is on your blocklist.';
    const keywords = (verdict.strong || []).concat(verdict.weak || []);
    if (keywords.length === 0) return 'This page matches your blocked keywords.';
    return 'This page matches your blocked keyword' + (keywords.length > 1 ? 's' : '') + ': ' + keywords.join(', ') + '.';
  }

  function goBack() {
    if (history.length > 1) history.back();
    else location.assign('/');
  }

  function showAnyway() {
    if (state.settings && state.settings.strictMode) return;
    state.allowedHref = location.href;
    if (state.page === 'shorts') {
      const reel = document.querySelector(sel().activeReel) || document.querySelector(sel().anyReel);
      if (reel) reel.setAttribute('data-sb', 'ok');
    }
    evaluate();
  }

  /* ---- Evaluation ---- */

  function watchTitle() {
    const heading = document.querySelector(sel().watchTitle);
    const fromHeading = heading ? heading.textContent.trim() : '';
    if (fromHeading) return fromHeading;
    if (onInitialPage()) {
      const meta = document.querySelector('meta[name="title"], meta[property="og:title"]');
      const fromMeta = meta ? (meta.getAttribute('content') || '').trim() : '';
      if (fromMeta) return fromMeta;
    }
    return documentTitle();
  }

  function evaluateWatch() {
    const flexy = document.querySelector(sel().watchFlexy);
    const urlId = new URLSearchParams(location.search).get('v');
    const pageId = flexy ? flexy.getAttribute('video-id') : null;
    const stale = Boolean(pageId && urlId && pageId !== urlId);
    const title = watchTitle();
    const heading = document.querySelector(sel().watchTitle);
    // The page is only fully described once the watch container exists for
    // this video id and the heading has rendered.
    const ready = Boolean(flexy && pageId && !stale && heading && heading.textContent.trim());
    if ((stale || !title) && !state.fallbackDue) return { pending: true };

    const parts = [title, documentTitle(), textOfAll(sel().watchMetadata), textOfAll(sel().playerTitle)];
    if (onInitialPage()) parts.push(metaText());
    const verdict = state.matcher.evaluate(parts.join('\n'));
    verdict.channel = false;
    if (!verdict.hide && state.settings.blockedChannels.length > 0) {
      const channels = [];
      for (const a of document.querySelectorAll(sel().watchOwnerLinks)) channels.push(a.getAttribute('href'));
      for (const el of document.querySelectorAll(sel().watchOwnerName)) channels.push(el.textContent);
      if (SB.matcher.channelBlocked(channels, state.settings.blockedChannels)) {
        verdict.hide = true;
        verdict.channel = true;
      }
    }
    // An early decision may only ever be "blocked". "ok" waits for the full page.
    if (!verdict.hide && !ready && !state.fallbackDue) return { pending: true };
    return verdict;
  }

  // Reels are candidate containers, so the scanner has already marked them.
  function evaluateShorts() {
    const reel = document.querySelector(sel().activeReel) || document.querySelector(sel().anyReel);
    if (!reel) return state.fallbackDue ? { hide: false } : { pending: true };
    const mark = reel.getAttribute('data-sb');
    if (mark === 'hide') return { hide: true, strong: [], weak: [] };
    if (mark === 'ok') return { hide: false };
    return state.fallbackDue ? { hide: true, strong: [], weak: [] } : { pending: true };
  }

  function evaluateChannel() {
    const names = [];
    for (const el of document.querySelectorAll(sel().channelHeaderName)) names.push(el.textContent);
    if (onInitialPage()) {
      const og = document.querySelector('meta[property="og:title"]');
      if (og) names.push(og.getAttribute('content') || '');
    }
    names.push(documentTitle());
    const verdict = state.matcher.evaluate(names.join('\n'));
    verdict.channel = false;
    if (!verdict.hide && SB.matcher.channelBlocked([location.pathname].concat(names), state.settings.blockedChannels)) {
      verdict.hide = true;
      verdict.channel = true;
    }
    return verdict;
  }

  function apply(verdict) {
    if (verdict.pending) {
      setStatus('pending');
      pauseAll(true);
      return;
    }
    if (verdict.hide && state.allowedHref !== location.href) {
      state.lastVerdict = verdict;
      setStatus('blocked');
      const overlay = ensureOverlay();
      const reasonEl = overlay.querySelector('#sb-overlay-reason');
      const reason = reasonFor(verdict);
      if (reasonEl.textContent !== reason) reasonEl.textContent = reason;
      state.pausedByUs.clear();
      pauseAll(false);
      const button = overlay.querySelector('#sb-go-back');
      if (document.activeElement !== button) button.focus({ preventScroll: true });
      return;
    }
    setStatus('ok');
    resumePaused();
  }

  function onNavigation() {
    const href = location.href;
    if (href === state.href) return;
    state.href = href;
    state.page = pageType(new URL(href));
    state.fallbackDue = false;
    clearTimeout(state.fallbackTimer);
    if (state.page === 'watch' || state.page === 'shorts') {
      setStatus('pending');
      pauseAll(true);
      state.fallbackTimer = setTimeout(() => {
        state.fallbackDue = true;
        evaluate();
      }, PENDING_FALLBACK_MS);
    } else {
      setStatus(null);
      resumePaused();
    }
  }

  function evaluate() {
    state.queued = false;
    try {
      onNavigation();
      if (state.page === 'other') {
        setStatus(null);
        return;
      }
      if (!state.settings || !state.settings.enabled) return; // data-sb-off disables all CSS
      if (!state.matcher) return; // settings still loading: stays pending
      let verdict;
      if (state.page === 'watch') verdict = evaluateWatch();
      else if (state.page === 'shorts') verdict = evaluateShorts();
      else verdict = evaluateChannel();
      apply(verdict);
    } catch (err) {
      console.error('[SpoilerBlocker] page check failed, page stays hidden', err);
      if (state.page === 'watch' || state.page === 'shorts') setStatus('pending');
    }
  }

  function queueEvaluate() {
    if (state.queued) return;
    state.queued = true;
    queueMicrotask(evaluate);
  }

  // Changes inside our own overlay must not trigger another evaluation.
  function onMutations(records) {
    const overlay = state.overlay;
    for (const record of records) {
      if (!overlay || !overlay.contains(record.target)) {
        queueEvaluate();
        return;
      }
    }
  }

  /* ---- Lifecycle ---- */

  // Runs at document_start, before settings are loaded, so watch and Shorts
  // pages are hidden from the very first paint.
  function init() {
    onNavigation();
    document.addEventListener('play', onPlay, true);
    state.observer = new MutationObserver(onMutations);
    state.observer.observe(html(), {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['video-id', 'is-active', 'data-sb', 'content', 'href'],
    });
    for (const name of NAV_EVENTS) {
      window.addEventListener(name, queueEvaluate, true);
      document.addEventListener(name, queueEvaluate, true);
    }
  }

  function applySettings(settings) {
    state.settings = settings;
    state.matcher = SB.matcher.createMatcher(settings);
    state.allowedHref = null;
    evaluate();
  }

  function getState() {
    return { page: state.page, status: state.status, allowed: state.allowedHref === location.href, verdict: state.lastVerdict };
  }

  SB.watchGuard = { init, applySettings, evaluate, getState };
  init();
})(globalThis);

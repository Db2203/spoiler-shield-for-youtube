/*
 * Thumbnail blur. When enabled, hide.css blurs every thumbnail on the page
 * (html[data-sb-blur]). The first click on a blurred thumbnail reveals that
 * tile instead of opening it; the second click behaves normally. Strict mode
 * removes the reveal entirely.
 */
(function (root) {
  'use strict';

  const SB = (root.SpoilerBlocker = root.SpoilerBlocker || {});

  const state = { settings: null };

  function active() {
    const s = state.settings;
    return Boolean(s && s.enabled && s.blurThumbnails);
  }

  function revealAllowed() {
    return active() && !state.settings.strictMode;
  }

  function tileFor(target) {
    if (!(target instanceof Element)) return null;
    const thumb = target.closest(SB.selectors.thumbnailContainers);
    if (!thumb) return null;
    return thumb.closest(SB.selectors.candidateSelector) || thumb;
  }

  function onClick(event) {
    if (!revealAllowed()) return;
    const tile = tileFor(event.target);
    if (!tile || tile.hasAttribute('data-sb-reveal')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    tile.setAttribute('data-sb-reveal', '');
  }

  function onKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    onClick(event);
  }

  function clearReveals() {
    for (const el of document.querySelectorAll('[data-sb-reveal]')) el.removeAttribute('data-sb-reveal');
  }

  function applySettings(settings) {
    state.settings = settings;
    const html = document.documentElement;
    if (active()) html.setAttribute('data-sb-blur', '');
    else html.removeAttribute('data-sb-blur');
    if (!revealAllowed()) clearReveals();
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeydown, true);

  SB.blur = { applySettings, tileFor };
})(globalThis);

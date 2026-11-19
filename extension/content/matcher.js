/*
 * Keyword matcher. Pure logic with no DOM or browser dependencies so it can be
 * unit tested in Node (module.exports) and used by the content scripts
 * (globalThis.SpoilerBlocker.matcher).
 *
 * Rules:
 *  - case-insensitive, whole-word, Unicode aware
 *  - multi-word keywords match as a phrase; whitespace inside the keyword
 *    matches any amount of whitespace (including none)
 *  - one strong keyword hides; weak keywords only count when at least two
 *    distinct weak keywords match
 */
(function (root) {
  'use strict';

  const ZERO_WIDTH = /[​-‍⁠﻿­]/g;

  function normalizeText(text) {
    return String(text == null ? '' : text)
      .normalize('NFKC')
      .replace(ZERO_WIDTH, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Letters and digits form words; anything else is a boundary.
  const NOT_WORD_BEFORE = '(?<![\\p{L}\\p{N}])';
  const NOT_WORD_AFTER = '(?![\\p{L}\\p{N}])';

  function compileKeyword(keyword) {
    const clean = normalizeText(keyword);
    if (!clean) return null;
    const body = clean.split(' ').map(escapeRegExp).join('\\s*');
    return new RegExp(NOT_WORD_BEFORE + body + NOT_WORD_AFTER, 'iu');
  }

  function compileList(list) {
    const seen = new Set();
    const out = [];
    for (const keyword of Array.isArray(list) ? list : []) {
      const clean = normalizeText(keyword);
      const key = clean.toLowerCase();
      if (!clean || seen.has(key)) continue;
      seen.add(key);
      const re = compileKeyword(clean);
      if (re) out.push({ keyword: clean, re });
    }
    return out;
  }

  function createMatcher(options) {
    const opts = options || {};
    const strong = compileList(opts.strongKeywords);
    const weak = compileList(opts.weakKeywords);

    function evaluate(text) {
      const clean = normalizeText(text);
      const strongHits = [];
      const weakHits = [];
      if (clean) {
        for (const entry of strong) if (entry.re.test(clean)) strongHits.push(entry.keyword);
        for (const entry of weak) if (entry.re.test(clean)) weakHits.push(entry.keyword);
      }
      return {
        hide: strongHits.length > 0 || weakHits.length >= 2,
        strong: strongHits,
        weak: weakHits,
      };
    }

    return { evaluate, strongCount: strong.length, weakCount: weak.length };
  }

  // Channel blocklist entries may be handles ("@name", "name") or display
  // names. Candidates are hrefs/paths and display-name text found in a tile.
  function normalizeChannelEntry(entry) {
    return normalizeText(entry).replace(/^@/, '').toLowerCase();
  }

  function channelBlocked(candidates, blockedChannels) {
    const blocked = new Set((blockedChannels || []).map(normalizeChannelEntry).filter(Boolean));
    if (blocked.size === 0) return false;
    for (const raw of candidates || []) {
      const value = normalizeText(raw);
      if (!value) continue;
      // Path form: /@handle, /@handle/videos, /c/name, /user/name
      const pathMatch = value.match(/^\/?(?:@|c\/|user\/)([^/?#]+)/i);
      if (pathMatch && blocked.has(normalizeChannelEntry(pathMatch[1]))) return true;
      // Plain text form: display name or "@handle"
      if (blocked.has(normalizeChannelEntry(value))) return true;
    }
    return false;
  }

  const api = { normalizeText, compileKeyword, createMatcher, channelBlocked, normalizeChannelEntry };

  const SB = (root.SpoilerBlocker = root.SpoilerBlocker || {});
  SB.matcher = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

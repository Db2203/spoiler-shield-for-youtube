/*
 * Settings: defaults, storage access and change notifications.
 * Shared by the content scripts and the popup. Everything lives in
 * browser.storage.local; nothing ever leaves the browser.
 */
(function (root) {
  'use strict';

  const SB = (root.SpoilerBlocker = root.SpoilerBlocker || {});

  const DEFAULTS = Object.freeze({
    enabled: true,
    strongKeywords: [
      'GTA',
      'GTA 6',
      'GTA6',
      'GTA VI',
      'GTAVI',
      'Grand Theft Auto',
      'Leonida',
      'Vice City',
      'Jason Duval',
      'Lucia Caminos',
    ],
    weakKeywords: ['Rockstar', 'Lucia', 'Jason'],
    blockedChannels: [],
    blurThumbnails: false,
    strictMode: false,
  });

  const STORAGE_KEY = 'settings';
  const STATS_KEY = 'stats';

  function cleanList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of list) {
      const value = String(raw == null ? '' : raw).trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  }

  // Merge stored values over the defaults so new fields never break old installs.
  function normalize(stored) {
    const s = stored && typeof stored === 'object' ? stored : {};
    return {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULTS.enabled,
      strongKeywords: Array.isArray(s.strongKeywords) ? cleanList(s.strongKeywords) : [...DEFAULTS.strongKeywords],
      weakKeywords: Array.isArray(s.weakKeywords) ? cleanList(s.weakKeywords) : [...DEFAULTS.weakKeywords],
      blockedChannels: Array.isArray(s.blockedChannels) ? cleanList(s.blockedChannels) : [],
      blurThumbnails: typeof s.blurThumbnails === 'boolean' ? s.blurThumbnails : DEFAULTS.blurThumbnails,
      strictMode: typeof s.strictMode === 'boolean' ? s.strictMode : DEFAULTS.strictMode,
    };
  }

  async function load() {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return normalize(result[STORAGE_KEY]);
  }

  // Partial updates are merged over the current stored settings.
  async function save(partial) {
    const current = await load();
    const next = normalize(Object.assign({}, current, partial));
    await browser.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  }

  function onChange(callback) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORAGE_KEY]) return;
      callback(normalize(changes[STORAGE_KEY].newValue));
    });
  }

  async function loadStats() {
    const result = await browser.storage.local.get(STATS_KEY);
    const stats = result[STATS_KEY] || {};
    return { hiddenTotal: Number(stats.hiddenTotal) || 0 };
  }

  async function addToStats(delta) {
    const stats = await loadStats();
    stats.hiddenTotal += delta;
    await browser.storage.local.set({ [STATS_KEY]: stats });
    return stats;
  }

  SB.settings = { DEFAULTS, normalize, cleanList, load, save, onChange, loadStats, addToStats };
})(globalThis);

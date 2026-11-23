/*
 * Options page: full editors for keyword lists, blocked channels, behaviour
 * and statistics. Changes save a moment after typing stops. Opened with
 * #welcome on first install to show the introduction.
 */
(function () {
  'use strict';

  const SB = globalThis.SpoilerBlocker;
  const SAVE_DELAY_MS = 400;

  const $ = (id) => document.getElementById(id);
  const ui = {
    enabled: $('enabled'),
    enabledLabel: $('enabled-label'),
    welcome: $('welcome'),
    strong: $('strong'),
    weak: $('weak'),
    channels: $('channels'),
    blur: $('blur'),
    strict: $('strict'),
    pageMatch: Array.from(document.querySelectorAll('input[name="pageMatch"]')),
    countTotal: $('count-total'),
    resetStats: $('reset-stats'),
    status: $('status'),
    version: $('version'),
    homepage: $('homepage'),
  };

  let saveTimer = null;
  let statusTimer = null;

  function linesOf(textarea) {
    return textarea.value.split(/\r?\n/);
  }

  function render(settings) {
    ui.enabled.checked = settings.enabled;
    ui.enabledLabel.textContent = settings.enabled ? 'On' : 'Off';
    document.body.dataset.enabled = String(settings.enabled);
    if (document.activeElement !== ui.strong) ui.strong.value = settings.strongKeywords.join('\n');
    if (document.activeElement !== ui.weak) ui.weak.value = settings.weakKeywords.join('\n');
    if (document.activeElement !== ui.channels) ui.channels.value = settings.blockedChannels.join('\n');
    ui.blur.checked = settings.blurThumbnails;
    ui.strict.checked = settings.strictMode;
    for (const radio of ui.pageMatch) radio.checked = radio.value === settings.pageMatch;
  }

  function showStatus(text) {
    ui.status.textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      ui.status.textContent = '';
    }, 1500);
  }

  async function save(partial) {
    try {
      const next = await SB.settings.save(partial);
      render(next);
      showStatus('Saved');
      return next;
    } catch (err) {
      showStatus('Could not save');
      console.error(err);
      return null;
    }
  }

  function scheduleListSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      save({ strongKeywords: linesOf(ui.strong), weakKeywords: linesOf(ui.weak), blockedChannels: linesOf(ui.channels) });
    }, SAVE_DELAY_MS);
  }

  async function refreshStats() {
    try {
      const stats = await SB.settings.loadStats();
      ui.countTotal.textContent = String(stats.hiddenTotal);
    } catch (_) {
      ui.countTotal.textContent = '–';
    }
  }

  async function init() {
    const manifest = browser.runtime.getManifest();
    ui.version.textContent = manifest.version;
    if (manifest.homepage_url) ui.homepage.href = manifest.homepage_url;
    else ui.homepage.hidden = true;
    ui.welcome.hidden = location.hash !== '#welcome';

    render(await SB.settings.load());
    refreshStats();

    ui.enabled.addEventListener('change', () => save({ enabled: ui.enabled.checked }));
    ui.blur.addEventListener('change', () => save({ blurThumbnails: ui.blur.checked }));
    ui.strict.addEventListener('change', () => save({ strictMode: ui.strict.checked }));
    for (const radio of ui.pageMatch) {
      radio.addEventListener('change', () => {
        if (radio.checked) save({ pageMatch: radio.value });
      });
    }
    for (const el of [ui.strong, ui.weak, ui.channels]) el.addEventListener('input', scheduleListSave);

    for (const button of document.querySelectorAll('[data-preset]')) {
      button.addEventListener('click', async () => {
        clearTimeout(saveTimer);
        const next = await SB.settings.applyPreset(button.dataset.preset);
        ui.strong.value = next.strongKeywords.join('\n');
        ui.weak.value = next.weakKeywords.join('\n');
        showStatus(SB.settings.PRESETS[button.dataset.preset].name + ' preset loaded');
      });
    }

    ui.resetStats.addEventListener('click', async () => {
      await SB.settings.resetStats();
      refreshStats();
      showStatus('Counter reset');
    });

    SB.settings.onChange(render);
    setInterval(refreshStats, 2000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

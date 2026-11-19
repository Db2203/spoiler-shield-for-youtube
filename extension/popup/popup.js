/*
 * Popup: edits settings in browser.storage.local and shows hidden counts.
 * Changes are saved automatically a short moment after typing stops.
 */
(function () {
  'use strict';

  const SB = globalThis.SpoilerBlocker;
  const YOUTUBE_ORIGIN = '*://*.youtube.com/*';
  const SAVE_DELAY_MS = 400;

  const $ = (id) => document.getElementById(id);
  const ui = {
    enabled: $('enabled'),
    enabledLabel: $('enabled-label'),
    countPage: $('count-page'),
    countTotal: $('count-total'),
    permission: $('permission'),
    grant: $('grant'),
    strong: $('strong'),
    weak: $('weak'),
    channels: $('channels'),
    reset: $('reset'),
    status: $('status'),
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
    ui.strong.value = settings.strongKeywords.join('\n');
    ui.weak.value = settings.weakKeywords.join('\n');
    ui.channels.value = settings.blockedChannels.join('\n');
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
      ui.enabledLabel.textContent = next.enabled ? 'On' : 'Off';
      document.body.dataset.enabled = String(next.enabled);
      showStatus('Saved');
    } catch (err) {
      showStatus('Could not save');
      console.error(err);
    }
  }

  function scheduleKeywordSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      save({ strongKeywords: linesOf(ui.strong), weakKeywords: linesOf(ui.weak), blockedChannels: linesOf(ui.channels) });
    }, SAVE_DELAY_MS);
  }

  async function refreshCounts() {
    try {
      const stats = await SB.settings.loadStats();
      ui.countTotal.textContent = String(stats.hiddenTotal);
    } catch (_) {
      ui.countTotal.textContent = '–';
    }
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('no active tab');
      const state = await browser.tabs.sendMessage(tab.id, { type: 'sb:getState' });
      ui.countPage.textContent = state && typeof state.hiddenCount === 'number' ? String(state.hiddenCount) : '–';
    } catch (_) {
      // Not a YouTube tab, or the content script is not running there.
      ui.countPage.textContent = '–';
    }
  }

  async function refreshPermission() {
    try {
      const ok = await browser.permissions.contains({ origins: [YOUTUBE_ORIGIN] });
      ui.permission.hidden = ok;
    } catch (_) {
      ui.permission.hidden = true;
    }
  }

  async function init() {
    render(await SB.settings.load());
    refreshCounts();
    refreshPermission();

    ui.enabled.addEventListener('change', () => save({ enabled: ui.enabled.checked }));
    ui.strong.addEventListener('input', scheduleKeywordSave);
    ui.weak.addEventListener('input', scheduleKeywordSave);
    ui.channels.addEventListener('input', scheduleKeywordSave);

    ui.reset.addEventListener('click', async () => {
      const next = await SB.settings.save({
        strongKeywords: [...SB.settings.DEFAULTS.strongKeywords],
        weakKeywords: [...SB.settings.DEFAULTS.weakKeywords],
      });
      render(next);
      showStatus('Defaults restored');
    });

    ui.grant.addEventListener('click', async () => {
      try {
        await browser.permissions.request({ origins: [YOUTUBE_ORIGIN] });
      } catch (err) {
        console.error(err);
      }
      refreshPermission();
    });

    // Keep the live count fresh while the popup is open.
    setInterval(refreshCounts, 1000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

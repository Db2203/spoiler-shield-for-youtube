/*
 * Popup: quick switches and counts. Keyword and channel lists are edited on
 * the options page.
 */
(function () {
  'use strict';

  const SB = globalThis.SpoilerBlocker;
  const YOUTUBE_ORIGIN = '*://*.youtube.com/*';

  const $ = (id) => document.getElementById(id);
  const ui = {
    enabled: $('enabled'),
    enabledLabel: $('enabled-label'),
    countPage: $('count-page'),
    countTotal: $('count-total'),
    permission: $('permission'),
    grant: $('grant'),
    blur: $('blur'),
    strict: $('strict'),
    strongCount: $('strong-count'),
    weakCount: $('weak-count'),
    channelCount: $('channel-count'),
    manage: $('manage'),
    status: $('status'),
  };

  let statusTimer = null;

  function render(settings) {
    ui.enabled.checked = settings.enabled;
    ui.enabledLabel.textContent = settings.enabled ? 'On' : 'Off';
    document.body.dataset.enabled = String(settings.enabled);
    ui.blur.checked = settings.blurThumbnails;
    ui.strict.checked = settings.strictMode;
    ui.strongCount.textContent = String(settings.strongKeywords.length);
    ui.weakCount.textContent = String(settings.weakKeywords.length);
    ui.channelCount.textContent = String(settings.blockedChannels.length);
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
      render(await SB.settings.save(partial));
      showStatus('Saved');
    } catch (err) {
      showStatus('Could not save');
      console.error(err);
    }
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
    ui.blur.addEventListener('change', () => save({ blurThumbnails: ui.blur.checked }));
    ui.strict.addEventListener('change', () => save({ strictMode: ui.strict.checked }));

    ui.manage.addEventListener('click', async () => {
      await browser.runtime.openOptionsPage();
      window.close();
    });

    ui.grant.addEventListener('click', async () => {
      try {
        await browser.permissions.request({ origins: [YOUTUBE_ORIGIN] });
      } catch (err) {
        console.error(err);
      }
      refreshPermission();
    });

    SB.settings.onChange(render);
    setInterval(refreshCounts, 1000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

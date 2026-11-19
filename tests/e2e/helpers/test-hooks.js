/*
 * TEST BUILD ONLY. Lets the end-to-end tests talk to the content script
 * through window.postMessage: change settings, inspect state, inject
 * failures. build-extension.js copies this file into the test build; the
 * real extension never includes it.
 */
(function () {
  'use strict';

  const SB = globalThis.SpoilerBlocker;

  async function run(cmd, payload) {
    switch (cmd) {
      case 'setSettings':
        return SB.settings.save(payload);
      case 'getSettings':
        return SB.settings.load();
      case 'getState':
        return SB.scanner.getState();
      case 'getPageState':
        return SB.watchGuard.getState();
      case 'getStats':
        return SB.settings.loadStats();
      case 'injectFailure':
        SB.scanner.injectFailure(payload);
        return SB.scanner.getState();
      case 'resetStorage':
        await browser.storage.local.clear();
        return true;
      default:
        throw new Error('unknown test command: ' + cmd);
    }
  }

  window.addEventListener('message', async (event) => {
    const data = event.data;
    if (event.source !== window || !data || data.type !== 'sb-test') return;
    let result = null;
    let error = null;
    try {
      result = await run(data.cmd, data.payload);
    } catch (err) {
      error = String((err && err.message) || err);
    }
    window.postMessage({ type: 'sb-test-result', id: data.id, result, error }, '*');
  });

  document.documentElement.setAttribute('data-sb-test-hooks', 'ready');
})();

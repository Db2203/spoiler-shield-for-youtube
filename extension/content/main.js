/*
 * Bootstrap. Loads settings, starts the scanner and answers the popup's
 * state requests. If anything here fails, hide.css keeps content hidden.
 */
(function (root) {
  'use strict';

  const SB = root.SpoilerBlocker;

  async function main() {
    const settings = await SB.settings.load();
    SB.scanner.start(settings);
    SB.settings.onChange((next) => SB.scanner.applySettings(next));
    browser.runtime.onMessage.addListener((message) => {
      if (message && message.type === 'sb:getState') {
        return Promise.resolve(SB.scanner.getState());
      }
      return undefined;
    });
  }

  main().catch((err) => {
    console.error('[SpoilerBlocker] failed to start, content stays hidden', err);
  });
})(globalThis);

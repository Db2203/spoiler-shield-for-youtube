/*
 * Bootstrap. Loads settings, starts the scanner and the watch guard, and
 * answers the popup's state requests. If anything here fails, hide.css keeps
 * content hidden.
 */
(function (root) {
  'use strict';

  const SB = root.SpoilerBlocker;

  async function main() {
    const settings = await SB.settings.load();
    SB.scanner.start(settings);
    SB.watchGuard.applySettings(settings);
    SB.blur.applySettings(settings);
    SB.settings.onChange((next) => {
      SB.scanner.applySettings(next);
      SB.watchGuard.applySettings(next);
      SB.blur.applySettings(next);
    });
    browser.runtime.onMessage.addListener((message) => {
      if (message && message.type === 'sb:getState') {
        return Promise.resolve(Object.assign(SB.scanner.getState(), { page: SB.watchGuard.getState() }));
      }
      return undefined;
    });
  }

  main().catch((err) => {
    console.error('[SpoilerBlocker] failed to start, content stays hidden', err);
  });
})(globalThis);

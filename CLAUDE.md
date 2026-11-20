# Spoiler Shield for YouTube — project rules

Firefox extension (Manifest V3, plain JavaScript, no build step) that hides keyword-matching content on YouTube. Built so the user can wait for the GTA 6 PC release spoiler-free; the GTA 6 keyword list is the default preset. Renamed from "GTA 6 Spoiler Blocker" for the addons.mozilla.org listing (trademark); the gecko id must never change.

## Spoiler-safety rules (apply to every task in this project, no exceptions)

1. **Never quote, print or summarize text from real web pages or saved page HTML.** Describe page structure only: tag names, attributes, classes, ids. This includes YouTube pages, screenshots and any saved DOM dumps.
2. **Never search the web for anything GTA-related, and never mention GTA 6 story details.** Generic technical searches (Firefox APIs, Selenium, CSS) are fine.
3. **All test content must be made-up text in local mock pages.** Fixtures use a fictional game ("Zorblax Quest 9") and the harmless keyword "pizza". Only short synthetic strings in unit tests exercise the real default keyword list, and they must not contain anything beyond the keyword itself.
4. Manual checks on real YouTube are done by the user with the keyword "pizza". Do not ask the user to report what they saw on YouTube beyond "hidden / not hidden".

## Stack and conventions

- Firefox only. MV3 with `browser_specific_settings.gecko.id`. `background.scripts` event page (never `service_worker`) used only for the toolbar badge and the first-run page.
- Plain JS content scripts attach to `globalThis.SpoilerBlocker`; `extension/content/matcher.js` also exports via `module.exports` so Node unit tests can load it.
- Fail closed: candidate containers are hidden by CSS until the scanner marks them `data-sb="ok"`. Never write code that reveals content on error.
- No network requests, no analytics, no remote code. `storage.local` only.
- YouTube selectors live only in `extension/content/selectors.js`.

## Commands

- `npm test` — unit + end-to-end (headless Firefox via selenium-webdriver, local fixture server)
- `npm run test:unit` — matcher tests (`node --test`)
- `npm run test:e2e` — Firefox tests against `tests/fixtures/`
- `npm run lint` — `web-ext lint` on `extension/`
- `npm run build` — zip in `web-ext-artifacts/`
- `npm run screenshots` — options page shot plus mock-page renders into `docs/screenshots/mock/` (not committed)
- `node scripts/real-youtube-screenshots.js` — README/store screenshots taken on YouTube with the keyword "pizza", written to `docs/screenshots/`. The assistant must never open these images (rule 1); the user reviews them.

## Testing notes

- The test build (`.test-extension/`) adds a 127.0.0.1 match and `content/test-hooks.js`; the real build has neither.
- The fixture server routes YouTube-shaped paths (`/watch`, `/shorts/x`, `/@handle`) to fixture files.
- The popup is opened in a tab from Firefox's chrome context, which needs `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1` (set by the launcher) and a pinned UUID via the `extensions.webextensions.uuids` pref.
- Fixture videos play a muted canvas stream so `paused` is meaningful.

## Git

- Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`. Imperative subject under 72 chars, body says why.
- Commit straight to `main`, linear history, tag each phase (`v0.1.0`, `v0.2.0`, ...), update `CHANGELOG.md` per tag.
- Commit author: Db2203.

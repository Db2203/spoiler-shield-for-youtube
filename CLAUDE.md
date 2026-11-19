# GTA 6 Spoiler Blocker — project rules

Firefox extension (Manifest V3, plain JavaScript, no build step) that hides GTA 6 content on YouTube so the user can wait for the PC release spoiler-free.

## Spoiler-safety rules (apply to every task in this project, no exceptions)

1. **Never quote, print or summarize text from real web pages or saved page HTML.** Describe page structure only: tag names, attributes, classes, ids. This includes YouTube pages, screenshots and any saved DOM dumps.
2. **Never search the web for anything GTA-related, and never mention GTA 6 story details.** Generic technical searches (Firefox APIs, Selenium, CSS) are fine.
3. **All test content must be made-up text in local mock pages.** Fixtures use a fictional game ("Zorblax Quest 9") and the harmless keyword "pizza". Only short synthetic strings in unit tests exercise the real default keyword list, and they must not contain anything beyond the keyword itself.
4. Manual checks on real YouTube are done by the user with the keyword "pizza". Do not ask the user to report what they saw on YouTube beyond "hidden / not hidden".

## Stack and conventions

- Firefox only. MV3 with `browser_specific_settings.gecko.id`; no `background` key (if ever needed use `background.scripts`, never `service_worker`).
- Plain JS content scripts attach to `globalThis.SpoilerBlocker`; `extension/content/matcher.js` also exports via `module.exports` so Node unit tests can load it.
- Fail closed: candidate containers are hidden by CSS until the scanner marks them `data-sb="ok"`. Never write code that reveals content on error.
- No network requests, no analytics, no remote code. `storage.local` only.
- YouTube selectors live only in `extension/content/selectors.js`.

## Commands

- `npm test` — unit + end-to-end (headless Firefox via selenium-webdriver, local fixture server)
- `npm run test:unit` — matcher tests (`node --test`)
- `npm run test:e2e` — Firefox tests against `tests/fixtures/`
- `npm run lint` — `web-ext lint` on `extension/`

## Git

- Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`. Imperative subject under 72 chars, body says why.
- Commit straight to `main`, linear history, tag each phase (`v0.1.0`, `v0.2.0`, ...), update `CHANGELOG.md` per tag.
- Commit author: Db2203.

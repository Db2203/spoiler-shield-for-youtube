# GTA 6 Spoiler Blocker

A Firefox extension that keeps GTA 6 off your YouTube feed while you wait for the PC release.

It hides matching videos, Shorts, comments, community posts and search suggestions, blocks matching video pages outright, and can blur every thumbnail until you choose to look. Everything runs locally in your browser: no network requests, no accounts, no data collection.

> **Status:** v0.1.0, first working version. Video tiles are filtered on the home page, search results, subscriptions, channel pages and the watch-page sidebar. See the [roadmap](#roadmap) for what is next.

## How it works

- **Keyword matching.** Two editable lists. A *strong* keyword hides an item on its own. *Weak* keywords only count when two different ones appear together, which keeps common words like a first name from hiding unrelated videos. Matching is case-insensitive and whole-word, so `GTA` does not match the middle of another word.
- **Fails closed.** Every video tile is invisible from the moment it enters the page until the extension has checked it. The hiding is done by a stylesheet injected before the page runs, so if the checking code ever crashes, stalls or is out of date, content stays hidden rather than leaking through.
- **Keeps up with YouTube.** Infinite scroll, recycled tiles and in-page navigation are all watched with a mutation observer that decides each item before the browser paints it.
- **Offline by design.** The only permission beyond youtube.com is local storage for your settings.

Default strong keywords: `GTA`, `GTA 6`, `GTA6`, `GTA VI`, `GTAVI`, `Grand Theft Auto`, `Leonida`, `Vice City`, `Jason Duval`, `Lucia Caminos`.
Default weak keywords: `Rockstar`, `Lucia`, `Jason`.

## Install

The extension is not on addons.mozilla.org yet. To load it from source:

1. Clone this repository.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on…** and pick `extension/manifest.json`.
4. Open YouTube. The toolbar button opens the settings popup.

Temporary add-ons are removed when Firefox closes. A packaged build for permanent installation is planned for v1.0.

## Settings

Click the toolbar icon to:

- switch the blocker on or off
- edit the strong and weak keyword lists (one per line, saved as you type)
- see how many items were hidden on the current page and in total

## Development

Requirements: Node 22 and Firefox.

```
npm install
npm run test:unit     # keyword matcher, runs in Node
npm run test:e2e      # loads the extension into headless Firefox against local mock pages
npm run lint          # web-ext lint
```

The end-to-end tests never touch youtube.com. They serve mock pages from `tests/fixtures/` that copy YouTube's DOM structure with invented content, install a test build of the extension as a temporary add-on, and assert on computed styles. Selenium Manager downloads a matching geckodriver on first run; set `FIREFOX_BIN` if Firefox is installed somewhere unusual, or `SB_HEADED=1` to watch the tests run.

### Project layout

```
extension/
  manifest.json         Manifest V3, Firefox
  content/hide.css      fail-closed rules
  content/matcher.js    keyword logic (pure, unit tested)
  content/selectors.js  every YouTube selector in one place
  content/settings.js   defaults and storage
  content/scanner.js    mutation observer, marking, counting
  content/main.js       bootstrap
  popup/                settings UI
tests/
  unit/                 node:test
  e2e/                  selenium-webdriver + headless Firefox
  fixtures/             mock YouTube pages
```

## Roadmap

- [x] v0.1.0: keyword filtering of video tiles, on/off switch, editable keyword lists, hidden counter
- [ ] v0.2.0: Shorts, comments, community posts, search suggestions, end screens, channel blocklist, video page blocking with a "Go back" screen, hover previews off
- [ ] v0.3.0: thumbnail blur with click to reveal, strict mode
- [ ] v1.0.0: performance pass, packaged build, manual test guide

## Privacy

The extension makes no network requests and collects nothing. Keyword lists and counters are stored with `browser.storage.local` and never leave your machine.

## License

[MIT](LICENSE)

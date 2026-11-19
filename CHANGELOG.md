# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-11-20

### Changed

- Renamed to **Spoiler Shield for YouTube** for the addons.mozilla.org listing (the old name used a trademark). The extension id is unchanged, so existing installs update in place. GTA 6 remains the built-in default keyword preset.
- The popup is now a quick panel: on/off, counts, blur and strict toggles, list sizes, and a button to the options page. Keyword and channel lists moved to a full options page.

### Added

- Options page (`about:addons` > Preferences, or the popup button) with large editors for both keyword lists and the blocklist, a **GTA 6** preset button, behaviour options and a resettable all-time counter.
- Toolbar badge showing how many items were hidden on the current page, via a small background event page.
- First-run welcome section on the options page, opened once after install.
- Page-match option: block a video page when a keyword appears in its title, channel or description (default), or in the title or channel only.
- `npm run sign` (unlisted) and `npm run sign:listed` submit the package to Mozilla for signing. `docs/store-listing.md` holds the listing text.
- End-to-end suites for the options page and the page-match option.

### Fixed

- Shorts: a Short is now also judged by the page title and the description panel, which live outside the reel element, and the current reel is found even when YouTube omits the `is-active` attribute. Text inside neighbouring preloaded reels is ignored.

## [1.0.1] - 2026-11-19

### Fixed

- On a video page the guard could report "ok" from the document title alone, about a second before the page body and heading had rendered. An early decision can now only be "blocked"; "ok" waits until the watch container carries the URL's video id and the heading is present.

### Added

- `npm run check:real`: a structural check against the real YouTube site in headless Firefox using the keyword "pizza". It reports counts only (found, hidden, unchecked, leaked) and never prints page text. Verified on 2026-11-19: 20 checks passed with zero leaks and zero unchecked items across suggestions, search, Shorts, watch pages, sidebar, comments, in-page navigation, channel pages, the blocklist, blur, reveal, strict mode, the off switch and the counters.

## [1.0.0] - 2026-11-19

### Added

- Packaged build (`npm run build`) producing a zip that can be loaded as a temporary add-on.
- GitHub Actions workflow running lint, unit tests and the headless Firefox end-to-end suite on every push, and attaching the packaged zip.
- Manual test guide for real YouTube using the harmless keyword "pizza" (`docs/manual-testing.md`).
- Popup end-to-end tests, opened as an extension page with a pinned UUID.
- Performance guard: 500 tiles inserted at once are decided before the next task (about 50 ms in headless Firefox).
- README screenshots captured from the mock pages.

## [0.3.0] - 2026-11-19

### Added

- Optional blur of every thumbnail (video tiles, Shorts, playlists, end screens). The first click on a blurred thumbnail reveals that tile; the second opens it. A recycled tile is blurred again.
- Strict mode: blurred thumbnails cannot be revealed and blocked pages have no "Show anyway".
- Popup options for thumbnail blur and strict mode.
- End-to-end coverage for blur, reveal, strict mode and the persisted all-time counter.

## [0.2.0] - 2026-11-19

### Added

- Watch guard: a video, Short or channel page that matches is covered by a "Go back" screen and playback is stopped and kept stopped. The player stays hidden until the page's own metadata has been checked, and a stale title from the previous video is never trusted during in-page navigation.
- Shorts shelf tiles and Shorts player reels, comments and replies, community posts, notifications, end screen cards, the end video wall and search suggestions are now filtered.
- Channel blocklist: handles or display names, editable in the popup. Hides every tile from the channel and covers the channel's own page.
- Hover previews are disabled and any inline player inside a tile is paused.
- "Show anyway" on a blocked page, hidden when strict mode is on.
- End-to-end suites for the watch page, Shorts, channels and community posts; the fixture server now routes YouTube-shaped paths.

## [0.1.0] - 2026-11-19

### Added

- Firefox Manifest V3 extension that hides YouTube video tiles matching a keyword list.
- Strong and weak keyword lists with whole-word, case-insensitive matching; one strong or two distinct weak keywords hide an item.
- Fail-closed stylesheet: tiles stay invisible until checked, so a crash never reveals content.
- Mutation observer that handles infinite scroll, recycled tiles and in-page navigation before paint.
- Settings popup with on/off switch, editable keyword lists and hidden counters.
- Unit tests for the matcher and end-to-end tests that drive headless Firefox against local mock pages.

[Unreleased]: https://github.com/Db2203/spoiler-shield-for-youtube/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Db2203/spoiler-shield-for-youtube/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/Db2203/spoiler-shield-for-youtube/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Db2203/spoiler-shield-for-youtube/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/Db2203/spoiler-shield-for-youtube/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Db2203/spoiler-shield-for-youtube/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Db2203/spoiler-shield-for-youtube/releases/tag/v0.1.0

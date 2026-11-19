# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/Db2203/gta6-spoiler-blocker/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Db2203/gta6-spoiler-blocker/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/Db2203/gta6-spoiler-blocker/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Db2203/gta6-spoiler-blocker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Db2203/gta6-spoiler-blocker/releases/tag/v0.1.0

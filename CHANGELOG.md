# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/Db2203/gta6-spoiler-blocker/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Db2203/gta6-spoiler-blocker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Db2203/gta6-spoiler-blocker/releases/tag/v0.1.0

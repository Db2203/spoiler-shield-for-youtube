# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-19

### Added

- Firefox Manifest V3 extension that hides YouTube video tiles matching a keyword list.
- Strong and weak keyword lists with whole-word, case-insensitive matching; one strong or two distinct weak keywords hide an item.
- Fail-closed stylesheet: tiles stay invisible until checked, so a crash never reveals content.
- Mutation observer that handles infinite scroll, recycled tiles and in-page navigation before paint.
- Settings popup with on/off switch, editable keyword lists and hidden counters.
- Unit tests for the matcher and end-to-end tests that drive headless Firefox against local mock pages.

[Unreleased]: https://github.com/Db2203/gta6-spoiler-blocker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Db2203/gta6-spoiler-blocker/releases/tag/v0.1.0

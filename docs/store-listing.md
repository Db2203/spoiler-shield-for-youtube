# addons.mozilla.org listing

Copy-and-paste material for the listed submission. Submit from your own terminal with `npm run sign:listed`, then fill in the listing at https://addons.mozilla.org/developers/addons.

## Name

Spoiler Shield for YouTube

## Summary (max 250 characters)

Hides YouTube videos, Shorts, comments and search suggestions that match your keywords, and blocks matching video pages with a "Go back" screen. Ships with a GTA 6 preset. Fails closed, runs offline, collects nothing.

## Description

Waiting for a game, a show or a match result and want YouTube to stay quiet about it? Spoiler Shield removes anything that mentions your keywords, everywhere on YouTube:

• Video tiles on the home feed, subscriptions, search results, channel pages and the watch-page sidebar
• Shorts, in shelves and in the Shorts player
• Comments and replies, community posts and notifications
• Search suggestions as you type
• End screen cards and the end video wall

Open a matching video, Short or channel by accident and playback stops immediately: the page is covered by a "Go back" screen before anything can be seen or heard.

Two kinds of keywords keep false alarms down. Strong keywords hide on their own. Weak keywords only count when two different ones appear together, so a common first name never hides anything by itself. Matching is whole-word and case-insensitive. A channel blocklist hides everything from channels you never want to see.

Thumbnails can spoil without a single word, so every thumbnail can be blurred until you click it. Strict mode removes the reveal entirely.

Built to fail closed: every item is invisible from the moment it enters the page until it has been checked, so if YouTube changes its layout, content stays hidden rather than leaking through. Infinite scroll, recycled tiles and in-page navigation are handled before the browser paints.

The GTA 6 preset is loaded on install. Edit the lists or start from scratch on the options page.

Privacy: no network requests, no accounts, no analytics. Your keyword lists and counters are stored in Firefox only. Source code: https://github.com/Db2203/spoiler-shield-for-youtube

## Categories

Primary: Social & Communication. Secondary: Privacy & Security.

## Tags

youtube, spoilers, spoiler blocker, filter, keywords, gta 6, hide videos

## Screenshots

Use the four files in `docs/screenshots/`. Captions:

1. home-filtered.png: "Matching videos are removed; the grid closes up."
2. home-blurred.png: "Optional thumbnail blur with click to reveal."
3. watch-blocked.png: "A matching video page is blocked before it can play."
4. options.png: "Keyword lists, presets, blocklist and behaviour on the options page."

## Review notes (for the "Notes to reviewer" field)

No build step: the uploaded package is the source. All logic is in extension/content/*.js, the popup and options pages, and a small background event page used only for the toolbar badge and the first-run page. No remote code, no network requests. Tests and a fail-closed design description are in the repository README.

## Support

Issues: https://github.com/Db2203/spoiler-shield-for-youtube/issues

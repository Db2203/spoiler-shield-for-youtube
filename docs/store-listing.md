# addons.mozilla.org listing

Copy-and-paste material for the listed submission. Submit from your own terminal with `npm run sign:listed` (the license and release notes come from `amo-metadata.json`), then fill in the listing at https://addons.mozilla.org/developers/addons.

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

Privacy: no network requests, no accounts, no analytics. Your keyword lists and counters are stored in Firefox only.

## Categories

Primary: Social & Communication. Secondary: Privacy & Security.

## Tags

youtube, spoilers, spoiler blocker, filter, keywords, gta 6, hide videos

## Screenshots

Five files in `docs/screenshots/`, in this order with these captions (also set by `npm run upload:previews`, though the web form is faster because the API is heavily rate-limited):

1. search-before.png: "Same search with the shield off..."
2. search-after.png: "...and with the shield on. Matching videos and Shorts are gone and the layout closes up."
3. video-blocked.png: "Open a matching video by accident and it is stopped and covered before anything plays."
4. search-blurred.png: "Optional: blur every thumbnail. One click reveals a tile, a second opens it."
5. options.png: "Keyword lists, the GTA 6 preset, blocked channels and behaviour on the options page."

## Review notes (for the "Notes to reviewer" field)

No build step: the uploaded package is the source. All logic is in extension/content/*.js, the popup and options pages, and a small background event page used only for the toolbar badge and the first-run page. No remote code, no network requests. Tests and a fail-closed design description are in the repository README.

## Support

No links on the store page by choice. Issues are accepted on GitHub, but the listing does not advertise it.

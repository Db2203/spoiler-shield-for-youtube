/*
 * Single source of truth for the YouTube DOM selectors the extension relies on.
 * Keep the candidate list in sync with hide.css.
 *
 * Only item-level containers are candidates. Shelves and grids are
 * intentionally excluded so one matching video does not hide an entire shelf.
 */
(function (root) {
  'use strict';

  const SB = (root.SpoilerBlocker = root.SpoilerBlocker || {});

  // Containers that must stay hidden until checked.
  const candidates = [
    // Video tiles: home, subscriptions, search, channel pages, sidebar
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-renderer',
    'ytd-compact-playlist-renderer',
    'ytd-grid-playlist-renderer',
    'ytd-radio-renderer',
    'ytd-compact-radio-renderer',
    'ytd-channel-renderer',
    'ytd-playlist-video-renderer',
    'yt-lockup-view-model',
    // Shorts shelf tiles and the Shorts player reels
    'ytd-reel-item-renderer',
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',
    'ytd-reel-video-renderer',
    // Comments and replies
    'ytd-comment-thread-renderer',
    'ytd-comment-view-model',
    'ytd-comment-renderer',
    // Community posts
    'ytd-backstage-post-thread-renderer',
    'ytd-post-renderer',
    // Notifications
    'ytd-notification-renderer',
    // End screen cards and the end video wall inside the player
    '.ytp-ce-element',
    '.ytp-videowall-still',
    // Search suggestion rows (current and legacy markup)
    '.ytSuggestionComponentSuggestion',
    '.sbsb_c',
    '[role="listbox"] > [role="option"]',
    '[role="listbox"] > li',
  ];

  SB.selectors = {
    candidates,
    candidateSelector: candidates.join(','),
    // Links that identify a channel inside a tile.
    channelLink: 'a[href^="/@"], a[href*="/channel/"], a[href^="/c/"], a[href^="/user/"]',
    // Elements that carry a channel's display name inside a tile.
    channelName: 'ytd-channel-name, #channel-name, .ytd-channel-name, #author-text',
    // Attributes whose values are included in a tile's text.
    textAttributes: ['aria-label', 'title', 'alt'],

    // Hover preview players; always disabled.
    previewContainers: 'ytd-video-preview, #video-preview, #mouseover-overlay, ytd-moving-thumbnail-renderer, #inline-preview-player',

    // Watch page
    watchFlexy: 'ytd-watch-flexy',
    watchTitle: 'ytd-watch-metadata h1, h1.ytd-watch-metadata, #above-the-fold #title',
    watchMetadata: 'ytd-watch-metadata, #above-the-fold, #description, #info-contents',
    playerTitle: '.ytp-title-link, .ytp-title-text',
    watchOwnerLinks: 'ytd-watch-metadata a[href^="/@"], ytd-watch-metadata a[href*="/channel/"], ytd-video-owner-renderer a[href]',
    watchOwnerName: 'ytd-watch-metadata ytd-channel-name, ytd-video-owner-renderer #channel-name',

    // Shorts player
    activeReel: 'ytd-reel-video-renderer[is-active]',
    anyReel: 'ytd-reel-video-renderer',

    // Channel page header
    channelHeaderName:
      'yt-page-header-renderer h1, yt-page-header-view-model h1, .page-header-view-model-wiz__page-header-title, ytd-c4-tabbed-header-renderer #channel-name, #channel-header #text',
  };
})(globalThis);

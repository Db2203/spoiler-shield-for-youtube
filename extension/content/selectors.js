/*
 * Single source of truth for the YouTube DOM selectors the extension relies on.
 * Keep the candidate list in sync with hide.css.
 *
 * Only item-level containers are listed. Shelves and grids are intentionally
 * excluded so one matching video does not hide an entire shelf.
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
    // Shorts
    'ytd-reel-item-renderer',
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',
    // Comments
    'ytd-comment-thread-renderer',
    'ytd-comment-view-model',
    'ytd-comment-renderer',
    // Community posts
    'ytd-backstage-post-thread-renderer',
    'ytd-post-renderer',
    // Notifications
    'ytd-notification-renderer',
    // End screen cards and end video wall on the player
    '.ytp-ce-element',
    '.ytp-videowall-still',
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
  };
})(globalThis);

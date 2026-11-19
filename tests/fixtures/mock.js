/*
 * Mock YouTube renderer for the fixture pages. Reproduces the DOM shape of
 * YouTube's components with invented content, and exposes window.YTMock so
 * tests can simulate infinite scroll, element recycling, SPA navigation,
 * lazy comment loading, Shorts activation and search suggestions.
 *
 * All titles, channels, comments and descriptions here are fictional.
 */
(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function thumbFor(item) {
    const hue = (String(item.id).split('').reduce((h, c) => h + c.charCodeAt(0), 0) * 37) % 360;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90">` +
      `<rect width="160" height="90" fill="hsl(${hue} 60% 40%)"/>` +
      `<circle cx="80" cy="45" r="22" fill="hsl(${hue} 70% 70%)"/></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function ariaLabel(item) {
    return `${item.title} by ${item.channel} 2 days ago 10 minutes, 12,000 views`;
  }

  function channelNameBlock(item) {
    return `
      <ytd-channel-name id="channel-name">
        <div id="container"><div id="text-container">
          <yt-formatted-string id="text"><a href="/@${esc(item.handle)}">${esc(item.channel)}</a></yt-formatted-string>
        </div></div>
      </ytd-channel-name>`;
  }

  // Gives a <video> something playable so tests can check paused/playing:
  // a muted live stream from a small animated canvas.
  function attachStream(video) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const ctx = canvas.getContext('2d');
      let hue = 0;
      const draw = () => {
        hue = (hue + 3) % 360;
        ctx.fillStyle = `hsl(${hue} 60% 50%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(draw);
      };
      draw();
      video.muted = true;
      video.srcObject = canvas.captureStream(10);
    } catch (_) {
      /* no canvas capture support */
    }
  }

  /* ---- Builders ---- */

  // Home / subscriptions / channel grid tile.
  function richItem(item) {
    const el = document.createElement('ytd-rich-item-renderer');
    el.setAttribute('data-mock-id', item.id);
    el.innerHTML = `
      <div id="content">
        <ytd-rich-grid-media>
          <div id="dismissible">
            <ytd-thumbnail>
              <a id="thumbnail" href="/watch?v=${esc(item.id)}">
                <yt-image><img src="${thumbFor(item)}" alt=""></yt-image>
              </a>
            </ytd-thumbnail>
            <div id="details">
              <div id="meta">
                <h3>
                  <a id="video-title-link" href="/watch?v=${esc(item.id)}" aria-label="${esc(ariaLabel(item))}">
                    <yt-formatted-string id="video-title">${esc(item.title)}</yt-formatted-string>
                  </a>
                </h3>
                <ytd-video-meta-block>
                  <div id="metadata">
                    <div id="byline-container">${channelNameBlock(item)}</div>
                    <div id="metadata-line"><span>12K views</span> <span>2 days ago</span></div>
                  </div>
                </ytd-video-meta-block>
              </div>
            </div>
          </div>
        </ytd-rich-grid-media>
      </div>`;
    return el;
  }

  // Search result row.
  function videoRenderer(item) {
    const el = document.createElement('ytd-video-renderer');
    el.setAttribute('data-mock-id', item.id);
    el.innerHTML = `
      <div id="dismissible">
        <ytd-thumbnail>
          <a id="thumbnail" href="/watch?v=${esc(item.id)}">
            <yt-image><img src="${thumbFor(item)}" alt=""></yt-image>
          </a>
        </ytd-thumbnail>
        <div class="text-wrapper">
          <div id="meta">
            <div id="title-wrapper">
              <h3>
                <a id="video-title" href="/watch?v=${esc(item.id)}" title="${esc(item.title)}" aria-label="${esc(ariaLabel(item))}">
                  <yt-formatted-string class="title">${esc(item.title)}</yt-formatted-string>
                </a>
              </h3>
            </div>
            <ytd-video-meta-block>
              <div id="metadata">
                <div id="byline-container">${channelNameBlock(item)}</div>
                <div id="metadata-line"><span>12K views</span> <span>2 days ago</span></div>
              </div>
            </ytd-video-meta-block>
            <yt-formatted-string id="description-text">${esc(item.description || '')}</yt-formatted-string>
          </div>
        </div>
      </div>`;
    return el;
  }

  // Newer "lockup" tile used in the watch-page sidebar and some shelves.
  function lockup(item) {
    const el = document.createElement('yt-lockup-view-model');
    el.className = 'ytLockupViewModelHost';
    el.setAttribute('data-mock-id', item.id);
    el.innerHTML = `
      <div class="yt-lockup-view-model-wiz">
        <a class="yt-lockup-view-model-wiz__content-image" href="/watch?v=${esc(item.id)}">
          <yt-thumbnail-view-model><img src="${thumbFor(item)}" alt=""></yt-thumbnail-view-model>
        </a>
        <div class="yt-lockup-view-model-wiz__metadata">
          <yt-lockup-metadata-view-model>
            <h3>
              <a class="yt-lockup-metadata-view-model-wiz__title" href="/watch?v=${esc(item.id)}" aria-label="${esc(ariaLabel(item))}">
                <span>${esc(item.title)}</span>
              </a>
            </h3>
            <yt-content-metadata-view-model>
              <span class="yt-content-metadata-view-model-wiz__metadata-text">${esc(item.channel)}</span>
              <span class="yt-content-metadata-view-model-wiz__metadata-text">12K views</span>
            </yt-content-metadata-view-model>
          </yt-lockup-metadata-view-model>
        </div>
      </div>`;
    return el;
  }

  // Shorts shelf tile.
  function shortTile(item) {
    const el = document.createElement('ytm-shorts-lockup-view-model-v2');
    el.className = 'shortsLockupViewModelHost';
    el.setAttribute('data-mock-id', item.id);
    el.innerHTML = `
      <a class="shortsLockupViewModelHostEndpoint" href="/shorts/${esc(item.id)}" aria-label="${esc(item.title)}, 1 million views">
        <div class="shortsLockupViewModelHostThumbnailContainer"><img src="${thumbFor(item)}" alt=""></div>
        <div class="shortsLockupViewModelHostOutsideMetadata">
          <h3 class="shortsLockupViewModelHostMetadataTitle"><span>${esc(item.title)}</span></h3>
          <div class="shortsLockupViewModelHostMetadataSubhead"><span>1M views</span></div>
        </div>
      </a>`;
    return el;
  }

  // Shorts player reel.
  function reel(item) {
    const el = document.createElement('ytd-reel-video-renderer');
    el.setAttribute('data-mock-id', item.id);
    el.innerHTML = `
      <div id="player-container">
        <ytd-player><div class="html5-video-player"><video class="html5-main-video"></video></div></ytd-player>
      </div>
      <div id="overlay">
        <ytd-reel-player-overlay-renderer>
          <yt-reel-metapanel-view-model>
            <yt-reel-channel-bar-view-model>
              <a class="yt-core-attributed-string__link" href="/@${esc(item.handle)}">@${esc(item.handle)}</a>
            </yt-reel-channel-bar-view-model>
            <yt-shorts-video-title-view-model>
              <h2 class="ytShortsVideoTitleViewModelShortsVideoTitle"><span>${esc(item.title)}</span></h2>
            </yt-shorts-video-title-view-model>
          </yt-reel-metapanel-view-model>
        </ytd-reel-player-overlay-renderer>
      </div>`;
    attachStream(el.querySelector('video'));
    return el;
  }

  function commentBody(c) {
    return `
      <div id="body">
        <div id="author-thumbnail"></div>
        <div id="main">
          <div id="header">
            <h3><a id="author-text" href="/@${esc(c.handle)}"><span>@${esc(c.handle)}</span></a></h3>
          </div>
          <div id="comment-content">
            <ytd-expander id="expander">
              <div id="content"><yt-attributed-string id="content-text"><span>${esc(c.text)}</span></yt-attributed-string></div>
            </ytd-expander>
          </div>
        </div>
      </div>`;
  }

  // Comment thread with optional replies.
  function commentThread(item) {
    const el = document.createElement('ytd-comment-thread-renderer');
    el.setAttribute('data-mock-id', item.id);
    const replies = (item.replies || [])
      .map((r) => `<ytd-comment-view-model data-mock-id="${esc(r.id)}">${commentBody(r)}</ytd-comment-view-model>`)
      .join('');
    el.innerHTML = `
      <ytd-comment-view-model id="comment" data-mock-id="${esc(item.id)}-top">${commentBody(item)}</ytd-comment-view-model>
      <div id="replies">
        <ytd-comment-replies-renderer><div id="expander-contents">${replies}</div></ytd-comment-replies-renderer>
      </div>`;
    return el;
  }

  // Community post.
  function post(item) {
    const el = document.createElement('ytd-backstage-post-thread-renderer');
    el.setAttribute('data-mock-id', item.id);
    el.innerHTML = `
      <div id="post">
        <ytd-post-renderer>
          <div id="body">
            <div id="author">${channelNameBlock(item)}</div>
            <div id="content"><yt-formatted-string id="content-text">${esc(item.text)}</yt-formatted-string></div>
          </div>
        </ytd-post-renderer>
      </div>`;
    return el;
  }

  // End screen card shown near the end of a video.
  function endscreenCard(item) {
    const el = document.createElement('div');
    el.className = 'ytp-ce-element ytp-ce-video ytp-ce-element-show';
    el.setAttribute('data-mock-id', item.id);
    el.innerHTML = `
      <a class="ytp-ce-covering-overlay" href="/watch?v=${esc(item.id)}">
        <div class="ytp-ce-covering-image" style="background-image:url(${thumbFor(item)})"></div>
        <div class="ytp-ce-expanding-overlay">
          <div class="ytp-ce-video-title">${esc(item.title)}</div>
          <div class="ytp-ce-channel-title">${esc(item.channel)}</div>
        </div>
      </a>`;
    return el;
  }

  // End video wall tile shown after a video finishes.
  function videowallStill(item) {
    const el = document.createElement('a');
    el.className = 'ytp-videowall-still';
    el.setAttribute('href', '/watch?v=' + item.id);
    el.setAttribute('data-mock-id', item.id);
    el.innerHTML = `
      <div class="ytp-videowall-still-image" style="background-image:url(${thumbFor(item)})"></div>
      <span class="ytp-videowall-still-info">
        <span class="ytp-videowall-still-info-title">${esc(item.title)}</span>
        <span class="ytp-videowall-still-info-author">${esc(item.channel)}</span>
      </span>`;
    return el;
  }

  // Search suggestion row.
  function suggestion(item) {
    const el = document.createElement('div');
    el.className = 'ytSuggestionComponentSuggestion';
    el.setAttribute('role', 'option');
    el.setAttribute('data-mock-id', item.id);
    el.innerHTML = `<span class="ytSuggestionComponentSuggestionText">${esc(item.text)}</span>`;
    return el;
  }

  const builders = {
    rich: richItem,
    video: videoRenderer,
    lockup,
    short: shortTile,
    reel,
    comment: commentThread,
    post,
    endscreen: endscreenCard,
    videowall: videowallStill,
    suggestion,
  };

  function render(container, items, kind) {
    const build = builders[kind || container.getAttribute('data-mock-kind') || 'rich'];
    for (const item of items) container.appendChild(build(item));
  }

  // Rewrites an existing tile in place, the way YouTube reuses DOM nodes when
  // scrolling. Only text nodes and attributes change; the element stays.
  function recycle(id, next) {
    const el = document.querySelector(`[data-mock-id="${id}"]`);
    if (!el) throw new Error('no tile ' + id);
    const title = el.querySelector('#video-title, .yt-lockup-metadata-view-model-wiz__title span');
    if (title) title.firstChild ? (title.firstChild.nodeValue = next.title) : (title.textContent = next.title);
    const labelled = el.querySelector('[aria-label]');
    if (labelled) labelled.setAttribute('aria-label', ariaLabel(Object.assign({}, next, { channel: next.channel || '' })));
    const titled = el.querySelector('[title]');
    if (titled) titled.setAttribute('title', next.title);
    const channelLink = el.querySelector('ytd-channel-name a');
    if (channelLink && next.channel) {
      channelLink.textContent = next.channel;
      channelLink.setAttribute('href', '/@' + next.handle);
    }
    const channelText = el.querySelector('.yt-content-metadata-view-model-wiz__metadata-text');
    if (channelText && next.channel) channelText.textContent = next.channel;
    el.setAttribute('data-mock-id', next.id);
    return el;
  }

  function fire(name) {
    for (const target of [window, document]) target.dispatchEvent(new CustomEvent(name, { bubbles: true }));
  }

  /* ---- Watch page helpers ---- */

  function setMeta(name, attr, content) {
    let meta = document.querySelector(`meta[${attr}="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  // Fills the watch page metadata for a video, like YouTube's data binding.
  function renderWatch(item, options) {
    const opts = options || {};
    const flexy = document.querySelector('ytd-watch-flexy');
    flexy.setAttribute('video-id', item.id);
    document.title = item.title + ' - YouTube';
    document.querySelector('ytd-watch-metadata h1 yt-formatted-string').textContent = item.title;
    const owner = document.querySelector('ytd-watch-metadata #owner ytd-channel-name a');
    owner.textContent = item.channel;
    owner.setAttribute('href', '/@' + item.handle);
    document.querySelector('#description-inline-expander yt-formatted-string').textContent = item.description || '';
    if (opts.initial) {
      setMeta('title', 'name', item.title);
      setMeta('og:title', 'property', item.title);
      setMeta('description', 'name', item.description || '');
    }
  }

  function watchItems() {
    const script = document.querySelector('script[type="application/json"][data-mock-watch]');
    return script ? JSON.parse(script.textContent) : [];
  }

  function findWatchItem(id) {
    const items = watchItems();
    return items.find((i) => i.id === id) || items[0];
  }

  // SPA navigation to another video: URL changes first, data arrives later.
  function navigateWatch(id, delayMs) {
    const item = findWatchItem(id);
    history.pushState({}, '', '/watch?v=' + item.id);
    fire('yt-navigate-start');
    return new Promise((resolve) => {
      setTimeout(() => {
        renderWatch(item);
        fire('yt-navigate-finish');
        resolve(item.id);
      }, delayMs == null ? 50 : delayMs);
    });
  }

  /* ---- Shorts helpers ---- */

  function reelItems() {
    const script = document.querySelector('script[type="application/json"][data-mock-items="[data-mock-reels]"]');
    return script ? JSON.parse(script.textContent) : [];
  }

  // Page-level data for the current Short: document title and the description panel.
  function showReelData(id) {
    const item = reelItems().find((i) => i.id === id);
    if (!item) return;
    document.title = item.title + ' #shorts - YouTube';
    const panel = document.querySelector('[data-mock-shorts-description]');
    if (panel) panel.textContent = item.description || '';
  }

  function activateReel(id) {
    for (const el of document.querySelectorAll('ytd-reel-video-renderer')) el.removeAttribute('is-active');
    const target = document.querySelector(`ytd-reel-video-renderer[data-mock-id="${id}"]`);
    target.setAttribute('is-active', '');
    history.pushState({}, '', '/shorts/' + id);
    showReelData(id);
    fire('yt-navigate-finish');
  }

  /* ---- Public API ---- */

  const api = {
    render,
    recycle,
    fire,
    fireNavigation: () => fire('yt-navigate-finish'),
    addItems(items, containerSelector, kind) {
      const container = document.querySelector(containerSelector || '[data-mock-contents]');
      render(container, items, kind);
      return items.map((i) => i.id);
    },
    navigate(items, containerSelector, kind) {
      const container = document.querySelector(containerSelector || '[data-mock-contents]');
      container.replaceChildren();
      render(container, items, kind);
      fire('yt-navigate-finish');
    },
    clear(containerSelector) {
      document.querySelector(containerSelector || '[data-mock-contents]').replaceChildren();
    },
    // Comments arrive later than the rest of the watch page.
    loadComments(items) {
      const container = document.querySelector('[data-mock-comments]');
      const data = items || JSON.parse(document.querySelector('script[data-mock-comment-items]').textContent);
      render(container, data, 'comment');
    },
    showSuggestions(items) {
      const container = document.querySelector('[data-mock-suggestions]');
      container.replaceChildren();
      render(container, items, 'suggestion');
      container.hidden = false;
    },
    renderWatch,
    navigateWatch,
    activateReel,
  };

  window.YTMock = api;

  document.addEventListener('DOMContentLoaded', () => {
    // Generic item lists.
    for (const script of document.querySelectorAll('script[type="application/json"][data-mock-items]')) {
      const container = document.querySelector(script.getAttribute('data-mock-items'));
      if (container) render(container, JSON.parse(script.textContent));
    }
    // Watch page: pick the video from ?v=
    if (document.querySelector('ytd-watch-flexy')) {
      const id = new URLSearchParams(location.search).get('v');
      renderWatch(findWatchItem(id), { initial: true });
      attachStream(document.querySelector('ytd-watch-flexy video'));
    }
    // Shorts page: activate the reel named in the path.
    const reels = document.querySelectorAll('ytd-reel-video-renderer');
    if (reels.length) {
      const id = location.pathname.split('/')[2];
      const target = document.querySelector(`ytd-reel-video-renderer[data-mock-id="${id}"]`) || reels[0];
      target.setAttribute('is-active', '');
      showReelData(target.getAttribute('data-mock-id'));
    }
    // Channel page: header from the handle in the path.
    const header = document.querySelector('[data-mock-channel-header]');
    if (header) {
      const handle = location.pathname.split('/')[1].replace(/^@/, '');
      const channels = JSON.parse(document.querySelector('script[data-mock-channels]').textContent);
      const name = channels[handle] || 'Some Channel';
      header.querySelector('h1 span').textContent = name;
      header.querySelector('[data-mock-handle]').textContent = '@' + handle;
      document.title = name + ' - YouTube';
      setMeta('og:title', 'property', name);
    }
  });
})();

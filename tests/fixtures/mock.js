/*
 * Mock YouTube renderer for the fixture pages. Reproduces the DOM shape of
 * YouTube's components with invented content, and exposes window.YTMock so
 * tests can simulate infinite scroll, element recycling and SPA navigation.
 *
 * All titles, channels and descriptions here are fictional.
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
    const hue = (item.id.split('').reduce((h, c) => h + c.charCodeAt(0), 0) * 37) % 360;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90">` +
      `<rect width="160" height="90" fill="hsl(${hue} 60% 40%)"/>` +
      `<circle cx="80" cy="45" r="22" fill="hsl(${hue} 70% 70%)"/></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function ariaLabel(item) {
    return `${item.title} by ${item.channel} 2 days ago 10 minutes, 12,000 views`;
  }

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
                    <div id="byline-container">
                      <ytd-channel-name id="channel-name">
                        <div id="container"><div id="text-container">
                          <yt-formatted-string id="text"><a href="/@${esc(item.handle)}">${esc(item.channel)}</a></yt-formatted-string>
                        </div></div>
                      </ytd-channel-name>
                    </div>
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
                <div id="byline-container">
                  <ytd-channel-name id="channel-name">
                    <div id="container"><div id="text-container">
                      <yt-formatted-string id="text"><a href="/@${esc(item.handle)}">${esc(item.channel)}</a></yt-formatted-string>
                    </div></div>
                  </ytd-channel-name>
                </div>
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

  const builders = { rich: richItem, video: videoRenderer, lockup };

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

  function fireNavigation() {
    for (const target of [window, document]) {
      target.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true }));
    }
  }

  const api = {
    render,
    recycle,
    fireNavigation,
    addItems(items, containerSelector, kind) {
      const container = document.querySelector(containerSelector || '[data-mock-contents]');
      render(container, items, kind);
      return items.map((i) => i.id);
    },
    // Replaces the page content as a SPA navigation would and fires YouTube's event.
    navigate(items, containerSelector, kind) {
      const container = document.querySelector(containerSelector || '[data-mock-contents]');
      container.replaceChildren();
      render(container, items, kind);
      fireNavigation();
    },
    clear(containerSelector) {
      document.querySelector(containerSelector || '[data-mock-contents]').replaceChildren();
    },
  };

  window.YTMock = api;

  // Pages declare their initial items in a JSON script tag.
  document.addEventListener('DOMContentLoaded', () => {
    for (const script of document.querySelectorAll('script[type="application/json"][data-mock-items]')) {
      const container = document.querySelector(script.getAttribute('data-mock-items'));
      if (container) render(container, JSON.parse(script.textContent));
    }
  });
})();

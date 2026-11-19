/*
 * Event page. Two small jobs:
 *  - show the per-tab hidden count as a badge on the toolbar icon
 *  - open the welcome page once, on first install
 * No network access, no state beyond what Firefox keeps for the badge.
 */
'use strict';

const BADGE_COLOR = '#d6453d';

function isTestBuild() {
  return /\(test build\)/.test(browser.runtime.getManifest().name);
}

browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
if (browser.action.setBadgeTextColor) browser.action.setBadgeTextColor({ color: '#ffffff' });

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== 'sb:count' || !sender.tab) return undefined;
  const count = Number(message.count) || 0;
  const text = count <= 0 ? '' : count > 999 ? '999+' : String(count);
  browser.action.setBadgeText({ text, tabId: sender.tab.id }).catch(() => {});
  return undefined;
});

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install' || isTestBuild()) return;
  browser.tabs.create({ url: browser.runtime.getURL('options/options.html#welcome') }).catch(() => {});
});

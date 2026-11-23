'use strict';

/*
 * Renders extension/icons/icon.svg to PNG at the sizes Firefox and
 * addons.mozilla.org use, with headless Firefox (no extra dependencies).
 *
 * Usage: node scripts/render-icons.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { Builder } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

const ICON_DIR = path.join(__dirname, '..', 'extension', 'icons');
const SIZES = [16, 32, 48, 64, 96, 128, 256];
const WINDOWS_FIREFOX = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';

async function main() {
  const svg = fs.readFileSync(path.join(ICON_DIR, 'icon.svg'), 'utf8');
  const options = new firefox.Options().addArguments('-headless');
  if (process.env.FIREFOX_BIN) options.setBinary(process.env.FIREFOX_BIN);
  else if (process.platform === 'win32' && fs.existsSync(WINDOWS_FIREFOX)) options.setBinary(WINDOWS_FIREFOX);
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
  try {
    await driver.get('data:text/html;charset=utf-8,<!doctype html><html><body></body></html>');
    for (const size of SIZES) {
      // Draw the SVG on a canvas so the corners stay transparent.
      const dataUrl = await driver.executeAsyncScript(
        function (svg, size, done) {
          const img = new Image();
          img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            canvas.getContext('2d').drawImage(img, 0, 0, size, size);
            done(canvas.toDataURL('image/png'));
          };
          img.onerror = function () {
            done(null);
          };
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        },
        svg,
        size
      );
      if (!dataUrl) throw new Error('could not render the SVG');
      const file = path.join(ICON_DIR, `icon-${size}.png`);
      fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log('wrote', path.relative(process.cwd(), file));
    }
  } finally {
    await driver.quit();
  }
}

main().catch((err) => {
  console.error(err.message.split('\n')[0]);
  process.exit(1);
});

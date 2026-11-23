'use strict';

/*
 * Renders extension/icons/icon.svg to PNG at the sizes Firefox and
 * addons.mozilla.org use, with headless Firefox (no extra dependencies).
 *
 * Usage: node scripts/render-icons.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { Builder, By } = require('selenium-webdriver');
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
    for (const size of SIZES) {
      const html =
        '<!doctype html><html><body style="margin:0;background:transparent">' +
        `<div id="icon" style="width:${size}px;height:${size}px;display:inline-block">` +
        svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`) +
        '</div></body></html>';
      await driver.get('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      const el = await driver.findElement(By.id('icon'));
      const png = await el.takeScreenshot();
      const file = path.join(ICON_DIR, `icon-${size}.png`);
      fs.writeFileSync(file, Buffer.from(png, 'base64'));
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

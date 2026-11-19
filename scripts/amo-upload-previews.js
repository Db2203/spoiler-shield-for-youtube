'use strict';

/*
 * Uploads the store screenshots to the add-on's listing on
 * addons.mozilla.org using the official API, authenticated with the same
 * credentials web-ext sign uses:
 *
 *   WEB_EXT_API_KEY     JWT issuer, like user:12345:678
 *   WEB_EXT_API_SECRET  JWT secret
 *
 * Usage (from your own terminal, never with the secret in chat):
 *   node scripts/amo-upload-previews.js            # upload, skip if previews already exist
 *   node scripts/amo-upload-previews.js --replace  # delete existing previews first
 *
 * Nothing here prints page content; it prints file names, ids and API errors.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const API = 'https://addons.mozilla.org/api/v5';
const ROOT = path.join(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'manifest.json'), 'utf8'));
const ADDON_ID = MANIFEST.browser_specific_settings.gecko.id;

// Order on the store page and the caption shown under each image.
const PREVIEWS = [
  { file: 'docs/screenshots/real/1-search-before.png', caption: 'Same search with the shield off...' },
  { file: 'docs/screenshots/real/2-search-after.png', caption: '...and with the shield on. Matching videos and Shorts are gone and the layout closes up.' },
  { file: 'docs/screenshots/real/4-video-blocked.png', caption: 'Open a matching video by accident and it is stopped and covered before anything plays.' },
  { file: 'docs/screenshots/real/3-search-blurred.png', caption: 'Optional: blur every thumbnail. One click reveals a tile, a second opens it.' },
  { file: 'docs/screenshots/options.png', caption: 'Keyword lists, the GTA 6 preset, blocked channels and behaviour on the options page.' },
];

function jwt(key, secret) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ iss: key, jti: crypto.randomUUID(), iat: now, exp: now + 60 });
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function call(method, url, body, headers = {}) {
  const key = process.env.WEB_EXT_API_KEY;
  const secret = process.env.WEB_EXT_API_SECRET;
  const res = await fetch(url, {
    method,
    headers: Object.assign({ Authorization: 'JWT ' + jwt(key, secret) }, headers),
    body,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data)}`);
  return data;
}

async function main() {
  if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
    console.error('Set WEB_EXT_API_KEY and WEB_EXT_API_SECRET first (same values as for npm run sign).');
    process.exit(2);
  }
  for (const p of PREVIEWS) {
    if (!fs.existsSync(path.join(ROOT, p.file))) {
      console.error('missing', p.file, '(run npm run screenshots and node scripts/real-youtube-screenshots.js)');
      process.exit(2);
    }
  }

  const base = `${API}/addons/addon/${encodeURIComponent(ADDON_ID)}/previews/`;
  const existing = await call('GET', base);
  const current = existing.results || [];
  if (current.length && !process.argv.includes('--replace')) {
    console.log(`${current.length} preview(s) already on the listing. Run with --replace to replace them.`);
    return;
  }
  for (const preview of current) {
    await call('DELETE', `${base}${preview.id}/`);
    console.log('deleted preview', preview.id);
  }

  let position = 0;
  for (const p of PREVIEWS) {
    const form = new FormData();
    const bytes = fs.readFileSync(path.join(ROOT, p.file));
    form.append('image', new Blob([bytes], { type: 'image/png' }), path.basename(p.file));
    form.append('position', String(position));
    const created = await call('POST', base, form);
    await call('PATCH', `${base}${created.id}/`, JSON.stringify({ caption: { 'en-US': p.caption }, position }), {
      'Content-Type': 'application/json',
    });
    console.log(`uploaded ${path.basename(p.file)} as preview ${created.id} at position ${position}`);
    position += 1;
  }
  console.log('done. Check the Images section of the listing on addons.mozilla.org.');
}

main().catch((err) => {
  console.error('failed:', err.message);
  process.exit(1);
});

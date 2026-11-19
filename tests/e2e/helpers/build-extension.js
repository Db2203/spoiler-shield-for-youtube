'use strict';

/*
 * Produces the test build of the extension in .test-extension/ (git-ignored):
 * a copy of extension/ whose manifest also matches the local fixture server
 * and which loads the test-only hook script. The real build never contains
 * either change.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const SOURCE_DIR = path.join(ROOT, 'extension');
const OUTPUT_DIR = path.join(ROOT, '.test-extension');
const LOCAL_MATCHES = ['http://127.0.0.1/*', 'http://localhost/*'];

function buildTestExtension() {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.cpSync(SOURCE_DIR, OUTPUT_DIR, { recursive: true });

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.name += ' (test build)';
  manifest.host_permissions = [...(manifest.host_permissions || []), ...LOCAL_MATCHES];
  for (const script of manifest.content_scripts) {
    script.matches = [...script.matches, ...LOCAL_MATCHES];
    script.js = [...script.js, 'content/test-hooks.js'];
  }
  fs.copyFileSync(path.join(__dirname, 'test-hooks.js'), path.join(OUTPUT_DIR, 'content', 'test-hooks.js'));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return OUTPUT_DIR;
}

module.exports = { buildTestExtension, OUTPUT_DIR };

if (require.main === module) {
  console.log('Test extension written to ' + buildTestExtension());
}

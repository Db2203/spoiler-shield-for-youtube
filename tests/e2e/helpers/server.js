'use strict';

/*
 * Tiny static file server for the fixture pages. Binds to 127.0.0.1 on a
 * random free port so tests never touch the network.
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

function startServer(rootDir = FIXTURES_DIR) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const filePath = path.join(rootDir, relative);
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        port,
        url: (file) => `http://127.0.0.1:${port}/${file}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

module.exports = { startServer, FIXTURES_DIR };

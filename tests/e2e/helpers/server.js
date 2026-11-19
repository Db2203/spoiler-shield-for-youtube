'use strict';

/*
 * Tiny static file server for the fixture pages. Binds to 127.0.0.1 on a
 * random free port so tests never touch the network.
 *
 * YouTube-shaped paths are routed to fixture files so the extension's
 * page-type detection (which looks at location.pathname) works unchanged:
 *   /              /feed/*        -> home.html
 *   /results                      -> search.html
 *   /watch                        -> watch.html
 *   /shorts/<id>                  -> shorts.html
 *   /@handle/community, /posts    -> community.html
 *   /@handle, /channel/<id>       -> channel.html
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

const ROUTES = [
  [/^\/$/, 'home.html'],
  [/^\/feed\//, 'home.html'],
  [/^\/results$/, 'search.html'],
  [/^\/watch$/, 'watch.html'],
  [/^\/shorts\//, 'shorts.html'],
  [/^\/@[^/]+\/(community|posts)$/, 'community.html'],
  [/^\/@[^/]+/, 'channel.html'],
  [/^\/channel\//, 'channel.html'],
];

function resolveFile(urlPath) {
  if (path.extname(urlPath)) return urlPath.replace(/^\/+/, '');
  for (const [pattern, file] of ROUTES) if (pattern.test(urlPath)) return file;
  return urlPath.replace(/^\/+/, '');
}

function startServer(rootDir = FIXTURES_DIR) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const filePath = path.join(rootDir, resolveFile(urlPath));
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
        // url('home.html') serves a file directly; url('/watch?v=x') uses the routes.
        url: (target) => `http://127.0.0.1:${port}${target.startsWith('/') ? target : '/' + target}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

module.exports = { startServer, FIXTURES_DIR };

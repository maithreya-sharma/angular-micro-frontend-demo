// Minimal static server that mimics GitHub Pages: serves files, index.html for
// directories, and the site's 404.html (with a 404 status) for unknown paths,
// which is what makes SPA deep links work on Pages.
// Usage: node e2e/serve.mjs <root-dir> <site-prefix> [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [root = '_site', prefix = '/angular-micro-frontend-demo', port = '8080'] = process.argv.slice(2);
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.png': 'image/png',
};

async function resolveFile(urlPath) {
  const path = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await stat(file);
    return { file, status: 200 };
  } catch {
    return { file: join(root, prefix, '404.html'), status: 404 };
  }
}

createServer(async (req, res) => {
  const { file, status } = await resolveFile(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(file);
    res.writeHead(status, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(Number(port), () => console.log(`Serving ${root} on http://localhost:${port}${prefix}/`));

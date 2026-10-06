import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('out');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(absolute) : [absolute];
    }),
  );
  return files.flat();
}

const files = (await listFiles(outputDir))
  .filter((file) => path.basename(file) !== 'sw.js' && path.basename(file) !== '.DS_Store')
  .sort();

const assets = files.map((file) => `/${path.relative(outputDir, file).split(path.sep).join('/')}`);
if (!assets.includes('/')) assets.unshift('/');

const fingerprint = createHash('sha256')
  .update((await Promise.all(files.map((file) => readFile(file)))).map((buffer) => createHash('sha256').update(buffer).digest('hex')).join(''))
  .digest('hex')
  .slice(0, 12);

const source = `const CACHE = 'backbeat-${fingerprint}';
const PRECACHE = ${JSON.stringify(assets, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('backbeat-') && key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html') || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
    ),
  );
});
`;

await writeFile(path.join(outputDir, 'sw.js'), source);
console.log(`Generated offline cache ${fingerprint} with ${assets.length} assets.`);

import { CACHE_NAME, urlsToCache } from './build/cacheconfig.js';

const fillCache = async () => {
  const cache = await caches.open(CACHE_NAME);
  return cache.addAll(urlsToCache);
};

self.addEventListener('install', (event) => {
  event.waitUntil(fillCache());
});

const doFetch = async (request) => {
  const response = await caches.match(request);
  if (response) {
    return response;
  }
  console.warn('Missing from cache: ', request.url);
  return fetch(request);
};

self.addEventListener('fetch', (event) => {
  event.respondWith(doFetch(event.request));
});


const cleanOldCaches = async () => {
  const cacheNames = await caches.keys();
  const cachesToDelete = cacheNames.filter((cacheName) => cacheName !== CACHE_NAME);
  return Promise.all(cachesToDelete.map((cacheName) => caches.delete(cacheName)));
};

self.addEventListener('activate', (event) => {
  event.waitUntil(cleanOldCaches());
});

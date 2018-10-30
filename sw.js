'use strict';

const CACHE_NAME = 'jsdafx-dev';
const urlsToCache = [
  'common.js',
  'index.html',
  'install-sw.js',
  'ovs.html',
  'ovs.js',
  'ovsproc.js',
  'qds.html',
  'qds.js',
  'qdsproc.js',
  'audio/unfinite_function.mp3',
  'images/ant_logo.png',
  'images/ovs/ns5.png',
  'images/ovs/ns5b.png',
  'images/ovs/ns5c.png',
  'images/ovs/ns5d.png',
  'images/qds/ns5.png',
  'images/qds/ns5b.png',
  'images/qds/ns5c.png',
  'images/qds/ns5d.png',
];

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

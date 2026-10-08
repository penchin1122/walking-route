// Sampo サービスワーカー
// ・画面（HTML・アイコン・地図ライブラリ）を保存し、起動を速くする
// ・ルート計算（Worker）と地図の画像は保存しない（常に最新を取りに行く）
// ・index.html などを更新したら、下の VERSION の数字を1つ上げてアップロードする

const VERSION = 'v2';
const CACHE = `walking-route-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './terms.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

const STATIONS_URL = 'https://penchin1122.github.io/cafenavi/stations.json';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // ルート計算（POST）は素通し

  const url = new URL(req.url);

  // 地図の画像（OpenStreetMap）は保存しない
  if (url.hostname.endsWith('tile.openstreetmap.org')) return;

  // 画面のHTML：まずネットから最新を取り、つながらなければ保存分を出す
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 駅データ：保存分をすぐ出しつつ、裏で最新に更新する
  if (req.url === STATIONS_URL) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // それ以外（アイコン・地図ライブラリ・フォント）：保存分があればそれを使う
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

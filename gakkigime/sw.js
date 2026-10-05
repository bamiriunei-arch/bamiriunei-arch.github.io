// 楽器決め・編成計画：ホーム画面に追加したとき・ネットがないときにも開けるようにする仕組み
// 自分のファイルはネットを先に見て（更新がすぐ届く）、つながらないときは保存しておいたものを使う
const CACHE = 'gakkigime-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-512-maskable.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('gakkigime-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) {
    // 文字のフォントと、PDFを作る道具（cdnjs）は一度読んだら保存しておく
    if (/^(fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com)$/.test(u.hostname)) {
      e.respondWith(caches.open(CACHE).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }))));
    }
    return;
  }
  // 同じ場所にあるほかのツールのページは、そのツール自身に任せる
  const base = new URL('./', self.registration.scope).pathname;
  if (!u.pathname.startsWith(base)) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});

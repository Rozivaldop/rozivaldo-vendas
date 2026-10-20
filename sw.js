// Rozivaldo Store: serviço do aplicativo (abertura rápida e funciona se a internet cair por um instante)
const V = 'rs-v1';
const BASE = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(BASE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('rs-') && k != V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function rede(r) {
  const c = await caches.open(V);
  try {
    const res = await Promise.race([fetch(r), new Promise((_, no) => setTimeout(no, 4000))]);
    if (res && res.ok) c.put(r, res.clone());
    return res;
  } catch (e) {
    return (await c.match(r)) || (r.mode == 'navigate' ? await c.match('index.html') : Response.error());
  }
}
async function cacheFirst(r) {
  const c = await caches.open(V), hit = await c.match(r);
  if (hit) return hit;
  const res = await fetch(r);
  if (res && (res.ok || res.type == 'opaque')) c.put(r, res.clone());
  return res;
}
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method != 'GET') return;
  if (u.hostname.endsWith('supabase.co')) return;            // dados sempre ao vivo
  if (u.origin == location.origin) return e.respondWith(rede(r));  // seus arquivos: sempre a versão mais nova
  if (/cdn\.tailwindcss\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u.hostname)) e.respondWith(cacheFirst(r));
});

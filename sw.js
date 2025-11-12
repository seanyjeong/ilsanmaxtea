/* /admin/sw.js — I-MAX Instructor PWA
   - HTML: Network First (오프라인 시 캐시 폴백)
   - Assets(JS/CSS/img/font): Stale-While-Revalidate
   - supermax.kr API: 네트워크 직통
   - 즉시 활성화 + 구캐시 정리
*/

const CACHE_HTML   = 'imax-admin-html';
const CACHE_ASSETS = 'imax-admin-assets';

async function cleanOldCaches() {
  const keep = new Set([CACHE_HTML, CACHE_ASSETS]);
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k)));
}

self.addEventListener('install', (event) => {
  // 프리캐시는 필수 아님. 오프라인 첫실행까지 대비하려면 아래 주석 해제
  // event.waitUntil(caches.open(CACHE_HTML).then(c => c.addAll(['/admin/index.html','/admin/manifest.json'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await cleanOldCaches();
    await self.clients.claim();
  })());
});

// HTML: 네트워크 우선
async function networkFirstHTML(request) {
  try {
    const fresh = await fetch(request);
    const c = await caches.open(CACHE_HTML);
    c.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // SPA 라우팅 폴백 (경로에 맞게 조정)
    const fallback = await caches.match('/admin/index.html');
    if (fallback) return fallback;
    throw e;
  }
}

// 정적 리소스: SWR
async function swrAsset(request) {
  const c = await caches.open(CACHE_ASSETS);
  const cached = await c.match(request);

  const fetchPromise = fetch(request)
    .then(res => {
      if (res && res.status === 200) c.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  return cached || fetchPromise || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 0) API(supermax.kr)는 항상 네트워크
  if (url.hostname.endsWith('supermax.kr')) {
    event.respondWith(fetch(req));
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  // 1) HTML 문서
  if (isSameOrigin && isHTML) {
    event.respondWith(networkFirstHTML(req));
    return;
  }

  // 2) 정적 리소스 (같은 오리진)
  if (
    isSameOrigin &&
    (url.pathname.endsWith('.js')   ||
     url.pathname.endsWith('.css')  ||
     url.pathname.endsWith('.png')  ||
     url.pathname.endsWith('.jpg')  ||
     url.pathname.endsWith('.jpeg') ||
     url.pathname.endsWith('.webp') ||
     url.pathname.endsWith('.svg')  ||
     url.pathname.endsWith('.ico')  ||
     url.pathname.endsWith('.woff') ||
     url.pathname.endsWith('.woff2'))
  ) {
    event.respondWith(swrAsset(req));
    return;
  }

  // 3) 그 외: 네트워크 우선(+캐시 폴백)
  if (isSameOrigin) {
    event.respondWith((async () => {
      try { return await fetch(req); }
      catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // 외부 리소스는 기본 네트워크 우선 (필요시 도메인별 규칙 추가)
});

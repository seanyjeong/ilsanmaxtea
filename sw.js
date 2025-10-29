const CACHE_NAME = 'max-season-admin-v1';
// 폰에 미리 저장해둘 파일 목록
const FILES_TO_CACHE = [
  'index.html',
  'welcome.html',
  'admin_login.html',
  'admin_student_assignment.html',
  'admin_assign_workout.html',
  'admin_student_notes.html',
  'admin_student_dashboard.html',
  'admin_student_announcements.html',
  'admin_student_records_view.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' // 폰트 아이콘
];

// 1. 앱 설치 (install) 이벤트
self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Install');
  // 캐시 열고 -> 파일들 저장
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline page');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. 앱 활성화 (activate) 이벤트 - 예전 캐시 정리
self.addEventListener('activate', (evt) => {
  console.log('[ServiceWorker] Activate');
  evt.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// 3. 파일 요청 (fetch) 이벤트 - 캐시된 파일 먼저 보여주기 (Stale-While-Revalidate)
self.addEventListener('fetch', (evt) => {
  // API 요청(supermax.kr)은 캐시하지 않고 항상 네트워크로 요청
  if (evt.request.url.includes('supermax.kr')) {
    evt.respondWith(fetch(evt.request));
    return;
  }

  // 나머지 파일(HTML, CSS 등)은 캐시 우선
  evt.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(evt.request)
        .then((response) => {
          // 1. 캐시에 있으면 -> 일단 캐시 파일 보여줌
          // 2. 동시에 -> 네트워크로 새 파일 가져와서 캐시 업데이트
          const fetchPromise = fetch(evt.request).then((networkResponse) => {
            cache.put(evt.request, networkResponse.clone());
            return networkResponse;
          });
          return response || fetchPromise; // 캐시에 있으면 캐시(response) 반환, 없으면 네트워크(fetchPromise) 반환
        });
    })
  );
});
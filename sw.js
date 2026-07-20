const CACHE_NAME='rdo-v3';
const FIREBASE_URLS=[
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js'
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(c=>{
      return c.addAll([
        'index.html',
        'admin.html',
        'manifest.json',
        'icon.svg',
        'sw.js'
      ]).then(()=>{
        return Promise.allSettled(
          FIREBASE_URLS.map(url=>fetch(url).then(r=>{if(r.ok)return c.put(url,r);}))
        );
      });
    }).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET') return;

  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(
      caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
        const clone=resp.clone();
        caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));
        return resp;
      }).catch(()=>new Response('',{status:504})))
    );
    return;
  }

  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase')){
    e.respondWith(
      caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
        const clone=resp.clone();
        caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));
        return resp;
      }).catch(()=>new Response('',{status:504})))
    );
    return;
  }

  if(url.hostname==='api.imgbb.com'){
    e.respondWith(fetch(e.request));
    return;
  }

  if(url.hostname==='firestore.googleapis.com'||url.hostname.includes('firebaseio.com')){
    e.respondWith(fetch(e.request).catch(()=>new Response('{}',{status:503,headers:{'Content-Type':'application/json'}})));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached=>{
      const fetchPromise=fetch(e.request).then(resp=>{
        if(resp.ok){
          const clone=resp.clone();
          caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));
        }
        return resp;
      }).catch(()=>cached);

      return cached||fetchPromise;
    })
  );
});

self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('sync',e=>{
  if(e.tag==='sync-pending'){
    e.waitUntil(syncPendingRecords());
  }
});

async function syncPendingRecords(){
  const clients=await self.clients.matchAll();
  clients.forEach(c=>c.postMessage({type:'TRIGGER_SYNC'}));
}

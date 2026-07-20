const CACHE_NAME='rdo-v1';
const STATIC_ASSETS=[
  'index.html',
  'admin.html',
  'manifest.json',
  'icon.svg'
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS)).then(()=>self.skipWaiting())
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

  e.respondWith(
    fetch(e.request).then(resp=>{
      const clone=resp.clone();
      caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));
      return resp;
    }).catch(()=>caches.match(e.request).then(r=>{
      if(r) return r;
      if(e.request.destination==='document'){
        return caches.match('index.html');
      }
      return new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
    }))
  );
});

self.addEventListener('sync',e=>{
  if(e.tag==='sync-pending'){
    e.waitUntil(syncPendingRecords());
  }
});

async function syncPendingRecords(){
  const clients=await self.clients.matchAll();
  clients.forEach(c=>c.postMessage({type:'SYNC_START'}));
  clients.forEach(c=>c.postMessage({type:'TRIGGER_SYNC'}));
}

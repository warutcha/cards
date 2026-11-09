/* Shows the reminder when the push arrives, even if the app is closed.
   The Worker address comes in on the query string: sw.js?w=https://... */
const W=new URL(self.location.href).searchParams.get('w')||'';

async function sha(s){
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

self.addEventListener('install',()=>self.skipWaiting());

/* always open the newest version of the app; fall back to the last copy when offline */
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||r.mode!=='navigate')return;
  e.respondWith((async()=>{
    const cache=await caches.open('cards-page');
    try{
      const res=await fetch(r,{cache:'no-store'});
      if(res&&res.ok)cache.put(r,res.clone());
      return res;
    }catch(_){
      return (await cache.match(r))||(await cache.match('./'))||Response.error();
    }
  })());
});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

self.addEventListener('push',e=>{
  e.waitUntil((async()=>{
    let title='Money still to move';
    let body='Open Cards to see what\'s waiting.';
    let count=null;
    try{
      const sub=await self.registration.pushManager.getSubscription();
      if(sub&&W){
        const r=await fetch(W+'/msg?e='+await sha(sub.endpoint));
        if(r.ok){const j=await r.json();title=j.title||title;body=j.body||body;
          if(typeof j.count==='number')count=j.count;}
      }
    }catch(_){}
    // the red number on the home-screen icon — but if the app is open, it keeps the number itself
    try{
      const open=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      const seen=open.some(c=>c.visibilityState==='visible');
      if(!seen&&count!==null&&self.navigator.setAppBadge)await self.navigator.setAppBadge(count);
    }catch(_){}
    await self.registration.showNotification(title,{
      body,tag:'unmoved',icon:'icon-192.png',badge:'icon-192.png'
    });
  })());
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c)return c.focus();}
    return self.clients.openWindow('./');
  }));
});

#!/usr/bin/env node
// Loki as a resident of Home (jungle): perches measured, his way out of the nook by the mossy trunk in the wide margin beside the
// briefing card, a layer inside the scrolling content, moves made only of drawn frames (feet on their line within 2px, nothing
// turned or resized, up or down only on the trunk), one Loki, stuck to his perch when Home scrolls, still while Uri types or a sheet
// is open, the timings, LOKI.goTo/say/react, the lab.
// Run: node tests/lifetest.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
// A check that no longer applies (the rule it tested was changed) is kept and listed as "no longer applies", with the reason.
'use strict'
const http=require('http'),fs=require('fs'),path=require('path'),{execSync}=require('child_process')
function loadPlaywright(){try{return require('playwright')}catch(e){}try{return require(path.join(execSync('npm root -g',{encoding:'utf8'}).trim(),'playwright'))}catch(e){}console.error('✕ playwright not found');process.exit(2)}
const {chromium}=loadPlaywright()
const ROOT=process.env.ROOT||path.resolve(__dirname,'..')
const snap=fs.readFileSync(path.join(__dirname,'snapshots.cjs'),'utf8')
const seededState=new Function(snap.slice(snap.indexOf('function todayPlus'),snap.indexOf('// Each scene'))+'\nreturn seededState')()
let pass=0,fail=0;const gone=[];const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('  ✕',m)}}
const retired=(m,why)=>{gone.push(m);console.log('  – no longer applies: '+m+' ('+why+')')}
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(!p.startsWith('/Fieldy/')){r.writeHead(404);return r.end()}p=p.slice(8)||'index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}
  r.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json'}[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)})
srv.listen(0,async()=>{
const B='http://127.0.0.1:'+srv.address().port+'/Fieldy/',br=await chromium.launch()
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
async function boot({theme='jungle',rm=false,q='?gnomeHour=12',W=390}={}){const ctx=await br.newContext({viewport:{width:W,height:844},reducedMotion:rm?'reduce':'no-preference'});const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));pg.fetches=[];pg.on('request',x=>{if(!x.url().startsWith(B))pg.fetches.push(x.url())})
  await pg.route('**/*',r=>{const u=r.request().url();(u.startsWith(B)||/fonts\.(googleapis|gstatic)\.com/.test(u))?r.continue():r.abort()})
  await pg.goto(B);await pg.evaluate(([s,t,d])=>{localStorage.clear();localStorage.setItem('fieldy_v2',JSON.stringify(s));localStorage.setItem('fieldy_theme',t);localStorage.setItem('fieldy_gnome_wave',d)},[seededState(),theme,today()])
  await pg.goto(B+q);await pg.waitForTimeout(400);if(theme==='jungle'&&!rm)await pg.waitForFunction(()=>!!lokiSeqReady('ledge')&&!!lkr.geo,null,{timeout:20000});await pg.evaluate(()=>{lkr.lastKey=0;clearTimeout(lkr.timer)});return pg}
// a Home where the trunk joins his nook and the flow of tasks: it should be there on every load, whatever the briefing card's height
let noRoute=[]
async function bootRoute(o={}){for(let i=0;i<12;i++){const pg=await boot(o);const why=await pg.evaluate(()=>{lokiLifeSync();const g=lkr.geo;return g.vines.some(v=>v.key==='nook>flow')?'':((g.tried.find(t=>t.key==='nook>flow')||{}).why||'no nook>flow')});if(!why)return pg;noRoute.push(why);await pg.context().close()}return null}
// the trunk's and the lip's ink (alpha > 40) inside a rectangle on the screen, sampled every pixel through the drawn image
const INK_IN=`(async(rects)=>{const out=[];const ims=[...document.querySelectorAll('#lk-roam .lk-trunk,#lk-roam .lk-branch')];for(const im of ims){await im.decode().catch(()=>{});const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data;const R=im.getBoundingClientRect(),b1=im.parentElement.getBoundingClientRect(),vb=(im.closest('.lk-vinebox,.lk-lipbox')||im.parentElement).getBoundingClientRect(),box={top:Math.max(b1.top,vb.top),bottom:Math.min(b1.bottom,vb.bottom),left:Math.max(b1.left,vb.left),right:Math.min(b1.right,vb.right)},fl=/scaleX\\(-1\\)/.test(im.style.transform)
  for(const q of rects){let n=0;for(let y=Math.ceil(Math.max(q.t,R.top,box.top))+.5;y<Math.min(q.b,R.bottom,box.bottom);y++)for(let x=Math.ceil(Math.max(q.l,R.left,box.left))+.5;x<Math.min(q.r,R.right,box.right);x++){let u=Math.floor((x-R.left)/R.width*c.width);if(fl)u=c.width-1-u;const v=Math.floor((y-R.top)/R.height*c.height);if(d[(v*c.width+u)*4+3]>40)n++}if(n)out.push(im.className+' over '+q.name+' ('+n+' px)')}}return out})`
// what the page can say about him right now: how many Lokis are seen, his ink box, and anything readable or touchable under it
const LOOK=`(async()=>{
  window.__ink=window.__ink||{};const ink=async im=>{const k=im.src;if(__ink[k])return __ink[k];const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data;let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}return __ink[k]={x0,y0,x1,y1}}
  const vis=e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&c.visibility!=='hidden'&&c.display!=='none'&&+c.opacity>0}
  const card=[...document.querySelectorAll('#jg-gnome .gn-stage .gn-img')].filter(vis).length,act=[...document.querySelectorAll('.lk-actor .lk-spr:not(.lk-g)')].filter(vis).length
  const a=document.querySelector('.lk-actor'),im=a&&a.querySelector('.lk-spr');let over=[],box=null,tf=null
  if(im&&im.naturalWidth){const b=await ink(im),R=im.getBoundingClientRect(),sx=R.width/im.naturalWidth,sy=R.height/im.naturalHeight,fl=/scaleX\\(-1\\)/.test(im.style.transform)
    box={left:R.left+(fl?im.naturalWidth-b.x1:b.x0)*sx,right:R.left+(fl?im.naturalWidth-b.x0:b.x1)*sx,top:R.top+b.y0*sy,bottom:R.top+b.y1*sy}
    over=vnContent(document.getElementById('screen-home'),e=>!!e.closest(LK_SKIP)).filter(q=>q.right>box.left+1&&q.left<box.right-1&&q.bottom>box.top+1&&q.top<box.bottom-1).map(q=>Math.round(q.left)+','+Math.round(q.top)+' '+Math.round(q.width)+'x'+Math.round(q.height))
    tf={actor:getComputedStyle(a).transform,img:im.style.transform}}
  const ep=lkr.ep;return {card,act,n:card+act,state:lkr.state,kind:a&&a.dataset.kind,box,over,tf,step:ep&&(ep.steps[ep.si]||{}).t,node:ep&&ep.node,stump:!!document.querySelector('#jg-gnome .gn-stump'),note:!!document.querySelector('#jg-gnome .gn-note'),txt:(document.querySelector('#jg-gnome .gn-t')||{}).textContent}})()`
const look=pg=>pg.evaluate(LOOK)

// 1 the map: the perches marked and measured, the vines, the reasons where there is no room
let pg=await boot({q:'?gnomeHour=12'}),r
r=await pg.evaluate(()=>{const g=lkr.geo;return {perches:g.perches.map(p=>({key:p.key,ok:p.ok,why:p.why,runs:p.runs.length})),vines:g.vines.map(v=>v.key),marked:[...document.querySelectorAll('[data-loki-perch]')].map(e=>e.dataset.lokiPerch),layerIn:document.getElementById('lk-roam').parentNode.id,last:document.getElementById('screen-home').lastElementChild.id}})
ok(r.layerIn==='screen-home'&&r.last==='lk-roam','his layer is inside Home\'s scrolling content (its last child): '+r.layerIn)
ok(['focus','flow','garden','peek','nav'].every(k=>r.marked.includes(k)),'the perches are marked data-loki-perch: '+r.marked.join(','))
const P=k=>r.perches.find(p=>p.key===k)
ok(P('flow').ok,'the top of the flow of tasks has room for him')
retired('the ground of his garden has room for him','the approved map has only places 2, 3, 5 and 6; the garden is not one of them');ok(!P('garden').ok&&/approved map/.test(P('garden').why),'the garden is not a perch (not in the approved map): '+P('garden').why)
ok(!P('focus').ok&&/room above it \d+px, he needs 105/.test(P('focus').why),'the top of the briefing card: no room for him to stand (no forcing): '+P('focus').why)
ok(!P('nav').ok&&/G2/.test(P('nav').why),'the nav: no drawn way down to it yet: '+P('nav').why)
retired('a vine joins his corner and the flow of tasks','the thin vine is no longer a way: the way out of the nook is the trunk beside the briefing card (checked below)')
await pg.context().close();pg=await bootRoute()
ok(!!pg&&noRoute.length===0,'the trunk joins his nook and the flow of tasks, on the first load'+(noRoute.length?' — loads without it: '+noRoute.length+' ('+[...new Set(noRoute)].join(' / ')+')':''))
retired('where there is no way, the only reason is the missing repeating piece of the trunk','vine-tile.png is here: the way should always be there (checked above, and over 24 loads below)')
if(!pg)pg=await boot()
r=await pg.evaluate(()=>{const g=lkr.geo,v=g.vines.find(v=>v.key==='nook>flow'),c=document.getElementById('jg-gnome').getBoundingClientRect(),o=document.querySelector('[data-loki-perch="flow"]').getBoundingClientRect(),O=lkr.layer.getBoundingClientRect();return v?{margin:Math.round(c.left-o.left),gap:getComputedStyle(document.getElementById('jg-gnome')).marginLeft,core:+(v.vx-g.nodes.nook.card.l).toFixed(1),top:Math.round(v.drawTop+O.top-c.top),roots:Math.round(v.bot+O.top-o.top),sv:v.sv,core37:+(37*v.sv).toFixed(1),pole:+(36*lokiSeqReady('ledge').k).toFixed(1),lip:!!document.querySelector('#lk-roam .lk-branch'),cut:v.lip.flip?v.lip.l<=g.L+.5:v.lip.l+v.lip.w>=g.R-.5,flat:document.querySelectorAll('#lk-roam .lk-trunk').length}:null})
ok(r&&r.margin>0&&r.gap==='36px','the briefing card stands in a wider margin on the nook\'s side (36px more than the other cards): '+JSON.stringify(r&&{margin:r.margin,gap:r.gap}))
ok(r&&Math.abs(r.core)<=3,'the trunk leans on the briefing card\'s side (its core at the card\'s edge): '+(r&&r.core))
ok(r&&r.top>=-1&&r.top<=12&&r.roots===0,'it reaches from the top edge of the flow of tasks (its roots) up to the briefing card\'s top edge (cut behind the lip there): '+JSON.stringify(r&&{top:r.top,roots:r.roots}))
ok(r&&r.lip&&r.cut,'the moss lip lies over its top, its cut end at the screen\'s edge')
ok(r&&Math.abs(r.core37/r.pole-.98)<.02,'one scale: its core about as thick as the pole he climbs ('+(r&&r.core37)+'px against '+(r&&r.pole)+'px)')
// the pieces: vine-trunk from row 474 down (roots on the flow of tasks), whole tiles of vine-tile.png above it, each one's bottom on the next one's top
r=await pg.evaluate(()=>{const v=lkr.geo.vines.find(v=>v.key==='nook>flow');if(!v)return null;const P=v.pieces,b=P[P.length-1],T=LK_TRUNK,t=T.tile;return {tile:!!t.rows&&t.w===303&&t.h===342,bottom:/vine-trunk/.test(b.file)&&Math.abs(b.from-(b.top+474*v.sv))<.01&&Math.abs(b.top+b.h-v.bot)<.01,tiles:P.slice(0,-1).every(q=>/vine-tile/.test(q.file)&&Math.abs(q.from-q.top)<.01&&Math.abs(q.h-342*v.sv)<.01),joins:P.slice(0,-1).map((q,i)=>+(q.top+q.h-P[i+1].from).toFixed(3)),n:P.length,cut:v.drawTop,lip:[v.lip.t+44*v.lip.h/223,v.lip.t+112*v.lip.h/223],sv:v.sv,tsv:[b.w/303,P[0].w/303]}})
ok(r&&r.tile,'vine-tile.png is there (303x342)')
ok(r&&r.bottom,'the trunk is shown from its row 474 down, its roots on the flow of tasks (its thin curled top is not used)')
ok(r&&r.tiles&&r.n>=2,'above it whole tiles only ('+(r&&r.n-1)+'), at the trunk\'s scale: '+JSON.stringify(r&&r.tsv))
ok(r&&r.joins.every(d=>Math.abs(d)<.01),'each tile\'s bottom sits exactly on the row above the next piece (no gap, no overlap): '+JSON.stringify(r&&r.joins))
ok(r&&r.cut>=r.lip[0]&&r.cut<=r.lip[1],'the top cut is on a row behind the lip\'s solid band: '+JSON.stringify(r&&{cut:r.cut,band:r.lip}))
// the cut row, pixel by pixel: every pixel of the trunk on it is behind a solid pixel of the lip
r=await pg.evaluate(async()=>{const box=document.querySelector('#lk-roam .lk-vinebox[data-vine="nook>flow"]'),lipIm=document.querySelector('#lk-roam .lk-branch');if(!box||!lipIm)return {err:'missing'};const load=async im=>{await im.decode().catch(()=>{});const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);return {d:g.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height,R:im.getBoundingClientRect(),fl:/scaleX\(-1\)/.test(im.style.transform)}}
  const y=box.getBoundingClientRect().top+.5,L=await load(lipIm),lb=lipIm.parentElement.getBoundingClientRect();let ink=0,bare=0
  for(const im of box.querySelectorAll('img')){const p=im.parentElement.getBoundingClientRect();if(y<p.top||y>=p.bottom)continue;const I=await load(im),v=Math.floor((y-I.R.top)/I.R.height*I.h);for(let x=Math.ceil(I.R.left)+.5;x<I.R.right;x++){let u=Math.floor((x-I.R.left)/I.R.width*I.w);if(I.fl)u=I.w-1-u;if(I.d[(v*I.w+u)*4+3]<=40)continue;ink++;let a=0;if(x>=lb.left&&x<lb.right&&y>=L.R.top&&y<L.R.bottom){let lu=Math.floor((x-L.R.left)/L.R.width*L.w);if(L.fl)lu=L.w-1-lu;const lv=Math.floor((y-L.R.top)/L.R.height*L.h);a=L.d[(lv*L.w+lu)*4+3]}if(a<=200)bare++}}
  return {ink,bare}})
ok(r&&r.ink>0&&r.bare===0,'no cut edge in view: on the cut row every pixel of the trunk is behind the lip: '+JSON.stringify(r))
r=await pg.evaluate(()=>[...document.querySelectorAll('#screen-home > #lk-roam .lk-trunk')].map(im=>[im.style.width,im.style.height,im.naturalWidth,im.naturalHeight]).map(([w,h,nw,nh])=>Math.abs(parseFloat(w)/nw-parseFloat(h)/nh)))
ok(r.length>=1&&r.every(d=>d<.001),'the trunk is never stretched (the same scale across and down): '+r.map(d=>d.toFixed(4)))
// no ink of the trunk or the lip over anything readable or touchable, the middle of the mushroom's cap, the stump, the lantern or the note
r=await pg.evaluate(()=>{const k=lokiCorner(),pr=lokiNookRects(k.stage.left,k.stage.bottom),mu=pr[0],R=(name,q)=>({name,l:q.l,r:q.r,t:q.t,b:q.b});const rects=[R('the middle of the mushroom\'s cap',{l:mu.l+(mu.r-mu.l)*.25,r:mu.r-(mu.r-mu.l)*.25,t:mu.t,b:mu.t+(mu.b-mu.t)*.42}),R('the stump',pr[1]),R('the lantern',pr[2]),R('the lantern on the stump',pr[3]),R('the note',pr[4])];vnContent(document.getElementById('screen-home'),e=>!!e.closest(LK_SKIP)).forEach((q,i)=>rects.push(R('text or control '+Math.round(q.left)+','+Math.round(q.top),{l:q.left,r:q.right,t:q.top,b:q.bottom})));return rects})
r=await pg.evaluate(([src,rects])=>(0,eval)(src)(rects),[INK_IN,r]);ok(r.length===0,'the trunk and the lip, pixel by pixel, over nothing readable or touchable, not the middle of the mushroom\'s cap, the stump, the lantern or the note: '+r.slice(0,4).join(' | '))
r=await pg.evaluate(()=>{const g=lkr.geo;return {tried:g.tried.filter(t=>!t.deco).map(t=>t.key+': '+t.why),thin:g.decos.length}})
ok(r.tried.some(t=>/^flow>peek: /.test(t)),'between the flow of tasks and the peek: no way unless one passes every rule (the reason is given): '+r.tried.find(t=>/^flow>peek/.test(t)))
ok(r.tried.some(t=>/^focus>flow: focus itself is rejected/.test(t)),'the briefing card\'s top is not climbed over (no room above it to stand)')
// the way on 24 loads: three widths, four hours (the briefing card short and tall), twice each
{const miss=[],hs=new Set();for(const W of [360,390,412])for(const h of [8,12,17,20])for(let i=0;i<2;i++){const p=await boot({q:'?gnomeHour='+h,W});const x=await p.evaluate(()=>{lokiLifeSync();return {ok:lkr.geo.vines.some(v=>v.key==='nook>flow'),why:(lkr.geo.tried.find(t=>t.key==='nook>flow')||{}).why,h:document.getElementById('jg-gnome').offsetHeight}});hs.add(x.h);if(!x.ok)miss.push(W+'/'+h+': '+x.why);await p.context().close()}
 ok(miss.length===0,'the way is there on all 24 loads (briefing card heights '+[...hs].sort().join(', ')+'): '+miss.join(' | '))}
r=await pg.evaluate(()=>({can:lokiCan('edgeSit',{}),canWith:lokiCan('edgeSit',{sitedge:1}),hop:lokiCan('hopUp',{}),hopWith:lokiCan('hopUp',{hopup:1}),walk:lokiCan('walk',{walk:1})}))
ok(!r.can&&r.canWith&&!r.hop&&r.hopWith&&r.walk,'a verb is there only with its frames (sitting on an edge, a jump: only once their frames are loaded): '+JSON.stringify(r))
r=await pg.evaluate(async()=>(await (await fetch('assets/gnome/loki/manifest.json')).json()).extra);{const P5=['sitedge','seatlook','seatwave','seatread','sitflat','standpoint','thinking','laughing','prep','hopup','hopdown','landup'],k=Object.keys(r||{});ok(k.length===P5.length&&P5.every(n=>r[n]&&r[n].dir&&r[n].json&&r[n].kOf==='walk'&&r[n].kMul>0),'the manifest has the twelve sets of pack 5 (and nothing else: crouch-b and the hires frames stay out): '+k.join(','))}

// 2 the timings (claude/loki-purposeful-roam): he goes out only on an errand, never by the clock; a stay lasts what its errand is for;
// sent out by hand (the lab, these tests) he stays until his time out is up, with no moves of his own in between
const STUB=`(()=>{const rec=[];const o=window.setTimeout;window.setTimeout=(f,ms)=>{rec.push(ms);return o(()=>{},1e9)};return ()=>{window.setTimeout=o;return rec}})()`
r=await pg.evaluate(`(()=>{const out={};lkr.eq=[];let d=${STUB};lkr.walked=false;lkr.homeAt=Date.now();lokiWalkSchedule();out.first=d();d=${STUB};lkr.walked=true;lkr.backAt=Date.now();lokiWalkSchedule();out.back=d();lkr.eq=[{kind:'taskDone',d:{},at:Date.now(),exp:Date.now()+300000,card:null}];d=${STUB};lokiWalkSchedule();out.waiting=d();lkr.eq=[];clearTimeout(lkr.eqT)
  lkr.outUntil=Date.now()+300000;const m=[];for(let i=0;i<200;i++){d=${STUB};lokiMoveSchedule();m.push(d())}out.left=[Math.min(...m.map(x=>x[0])),Math.max(...m.map(x=>x[0]))];out.calls=Math.max(...m.map(x=>x.length));clearTimeout(lkr.timer);clearTimeout(lkr.moveTimer)
  out.stay=Object.fromEntries(Object.entries(LK_ERRAND).map(([k,v])=>[k,[v.seat,v.stay||0]]));return out})()`)
ok(r.first.length===0&&r.back.length===0,'no outing by the clock: Home opened, or back on his stump, with nothing waiting, no timer is set at all (opened: '+JSON.stringify(r.first)+', back: '+JSON.stringify(r.back)+')')
ok(r.waiting.length===1&&r.waiting[0]===1500,'out again only for an errand waiting: then one look at it, 1.5 s later ('+JSON.stringify(r.waiting)+')')
ok(JSON.stringify(r.stay)===JSON.stringify({guest:[1,4000],dayDone:[0,0],taskDone:[1,15000],point:[1,12000],brief:[2,30000],evening:[2,180000],quiet:[2,60000]})&&r.left[0]>=299000&&r.left[1]<=300000&&r.calls===1,'a stay lasts what its errand is for (guest 4 s after it, a task 15 s, a point 12 s, the briefing 30 s, the evening 3 min, the quiet walk 1 min, the day done: the laugh only); sent out by hand, one look when his time is up and no move before it ('+JSON.stringify(r.stay)+' / '+r.left+')')

// 3 out to the flow of tasks, on to the garden, and called home: every frame recorded
await pg.evaluate(()=>{lkr.trace=[];lokiQueue=[];lokiRender()});await pg.waitForTimeout(300)
const before=(await look(pg)).txt
const samples=[];let s
const go=await pg.evaluate(async()=>await lokiWalkNow('flow'));retired('out: over the edge and down the vine','his way out is now the trunk, by a jump from the nook\'s floor')
const turns=await pg.evaluate(()=>lkr.ep.steps.filter(s=>s.name==='turn').map(s=>s.frames.join('')))
ok(!!go&&/^(seq:standup,)?seq:turn,walk,pk:prep,grab,climb,grab:rev,walk,(pk:sitedge,arrive|seq:turn,arrive),life$/.test(go.steps.join(','))&&turns.every(t=>t==='210'||t==='123'),'out, straight: up (from the stump, if he sits on it), a quarter turn to the trunk, along the floor, the wind-up, the jump to the trunk, down it, off it, to the corner, and down on it or a quarter turn to Uri; no look about, and every turn a quarter turn ('+(go&&go.steps.join(','))+' / turns '+turns.join(' ')+')')
r=await pg.evaluate(()=>({out:lkr.outUntil-Date.now()}));ok(r.out>=299000&&r.out<=900000,'out for 5-15 minutes: '+Math.round(r.out/1000)+' s')
do{s=await look(pg);samples.push(s);await pg.waitForTimeout(120)}while(s.state!=='perched'&&samples.length<500)
ok(s.state==='perched'&&s.node==='flow','he arrived at the flow of tasks and stays there: '+s.state+' '+s.node)
r=await pg.evaluate(()=>({say:(document.querySelector('.lk-say')||{}).textContent||'',lines:[].concat(...Object.values(LOKI.trip.hour),LOKI.trip.tasks.one,LOKI.trip.tasks.many)}));ok(!r.say||r.lines.some(l=>l.replace('{n}','').split(' ').slice(0,2).join(' ')===r.say.replace(/\d+/,'').trim().split(' ').slice(0,2).join(' ')),'on arriving, a line of why he came (the hour, or the tasks waiting): '+r.say)
ok(samples.slice(2).every(t=>t.stump&&t.note&&t.txt===before),'while he is out his nook shows the empty stump and the note, with the same words as the bubble')
// on his feet out there he only stands while he does something: a wave, a point, a laugh, one after the other (up from the edge first if he sat)
await pg.evaluate(()=>{if(lkr.ep&&lkr.ep.seat)lokiLabDo('unsit')});await pg.waitForTimeout(3500)
for(const a of ['tap','point','laugh']){await pg.evaluate(a=>{lkr.ep[a]=true;cancelAnimationFrame(lkr.raf);clearTimeout(lkr.frz);lkr.raf=requestAnimationFrame(lokiTick)},a);await pg.waitForTimeout(2600)}
// a lot of the rest, on the way down to the garden and back home
await pg.evaluate(()=>{document.getElementById('screen-home').scrollTop=260});await pg.waitForTimeout(300)
const second=await pg.evaluate(()=>{const g=lkr.geo,c=g.perches.filter(p=>p.ok&&p.key!=='flow'&&lokiPath('flow',p.key));return c.length?c[0].key:null})
if(second){const went=await pg.evaluate(k=>lokiGoTo(k,{force:true}),second);ok(went,'LOKI.goTo '+second+': a drawn way leads there (a vine from the flow of tasks)')
  do{s=await look(pg);samples.push(s);await pg.waitForTimeout(120)}while(s.state!=='perched'&&samples.length<1000)
  ok(s.node===second,'… and he is there: '+s.node)}
else console.log('  (no second perch with a drawn way from the flow of tasks at this layout: nothing to try)')
await pg.evaluate(()=>lokiCall())
do{s=await look(pg);samples.push(s);await pg.waitForTimeout(120)}while(s.state!=='in'&&samples.length<1600)
ok(s.state==='in','a call brings him home');r=await pg.evaluate(()=>(document.querySelector('#jg-gnome .gn-img')||{}).dataset&&document.querySelector('#jg-gnome .gn-img').dataset.pose);ok(/^standup:0/.test(r||''),'back on his stump, sitting: '+r)
ok(samples.every(t=>t.n<=1),'one Loki at every moment: '+JSON.stringify(samples.filter(t=>t.n>1).slice(0,2).map(t=>[t.card,t.act,t.state])))
const overs=samples.filter(t=>t.over&&t.over.length);ok(overs.length===0,'never over text, icons, buttons or fields (his drawn outline, every 120 ms): '+overs.slice(0,3).map(t=>t.kind+'@'+t.state+'/'+t.node+'/'+t.step+' box '+(t.box?[t.box.left,t.box.top,t.box.right,t.box.bottom].map(Math.round):'')+': '+t.over.join(';')).join(' | '))
const tfs=samples.filter(t=>t.tf);ok(tfs.every(t=>/^matrix\(1, 0, 0, 1, /.test(t.tf.actor)&&(t.tf.img===''||t.tf.img==='scaleX(-1)')),'nothing turned or resized: the picture only moves (and faces left by a mirror): '+JSON.stringify(tfs.find(t=>!/^matrix\(1, 0, 0, 1, /.test(t.tf.actor))||''))
// the frames themselves
const T=await pg.evaluate(async()=>{const ink={};const met=async src=>{if(ink[src])return ink[src];const im=new Image();im.src=src;await im.decode();return ink[src]=lokiFeet(im)};const out=[];for(const f of lkr.trace){const m=lkr.seq[f.name]&&lkr.seq[f.name].val;if(!m)continue;const im=m.imgs[f.i]||m.final;const t=await met(im.src);const W=im.naturalWidth;out.push({name:f.name,i:f.i,step:f.step,node:f.node,y:f.y,k:f.k,footY:f.top+t.fb*f.k,footX:f.left+(f.flip?W-t.fc:t.fc)*f.k,bodyX:f.left+(f.flip?W-lokiTorso(im):lokiTorso(im))*f.k,t:f.t})}return out})
ok(!T.some(f=>f.name==='slide'),'no slide: every frame is from a walk, a turn, a look, the stump, the jump to the trunk, the climb or the arrival over an edge: '+[...new Set(T.map(f=>f.name))].join(','))
const line=f=>f.y+(f.name==='standup'?31:0)   // on the stump the frame is placed by its seat, 31px above the floor his feet are on
const ground=T.filter(f=>['walk','turn','look','idle','wave'].includes(f.name)),gd=ground.map(f=>Math.abs(f.footY-f.y)),sd=T.filter(f=>f.name==='standup'&&f.i>=3).map(f=>Math.abs(f.footY-line(f)))
ok(ground.length>200&&Math.max(...gd)<=2,'his feet on the line they stand on, every frame (walk, turn, look, breathing): max '+Math.max(...gd).toFixed(2)+'px over '+ground.length+' frames')
ok(sd.length>5&&Math.max(...sd)<=2,'… and getting down onto the stump, feet on the floor until he sits (the sitting frames are placed by the seat on the stump, as drawn): max '+Math.max(...sd).toFixed(2)+'px')
// where one sequence gives way to the next on the ground (claude/loki-purposeful-roam): the middle of his body stays where it was, not his feet
const G=new Set(['walk','turn','idle','wave','standup','prep','standpoint','laughing']);let tj=[],tw=[];for(let i=1;i<T.length;i++){const a=T[i-1],b=T[i];if(a.name!==b.name&&G.has(a.name)&&G.has(b.name)){tj.push(Math.abs(b.bodyX-a.bodyX));tw.push(a.name+'>'+b.name)}}
const tjm=Math.max(...tj),tjw=tw[tj.indexOf(tjm)]
ok(tj.length>=4&&tjm<=3,'where one sequence gives way to the next on the ground, the middle of his body stays where it was (within 3px): max '+tjm.toFixed(2)+' ('+tjw+') over '+tj.length+' seams: '+[...new Set(tw)].join(' '))
// on his feet he stands only while he does something; while he does it, his feet do not move
let steps=[];for(let i=1;i<T.length;i++){const a=T[i-1],b=T[i];if(a.name===b.name&&a.node===b.node&&['wave','standpoint','laughing','thinking'].includes(a.name))steps.push(Math.hypot(b.footX-a.footX,b.footY-a.footY))}
// (1.5px, tighter than the 2px of the old check: laugh 2 to 3 is drawn with his right foot about 1.4px further out; the point and the wave hold within 0.1px)
ok(steps.length>=10&&Math.max(...steps)<=1.5,'while he does something on his feet (a wave, a point, a laugh), his feet do not move (max '+Math.max(...steps).toFixed(2)+'px a frame over '+steps.length+' frames)')
const wsteps=await pg.evaluate(()=>{const W=lkr.seq.walk.val;return 12.3*W.k});ok(wsteps>2&&wsteps<3.2,'a stride a cycle: the walk frames follow the distance ('+wsteps.toFixed(2)+'px a frame, within 5% at the end of a walk, so it stops on his feet)')
const ys=[];for(let i=1;i<T.length;i++){const a=T[i-1],b=T[i];if(Math.abs(line(b)-line(a))>.01&&!['grab','climb','ledge'].includes(b.step)&&!['grab','climb','ledge'].includes(a.step)&&a.node===b.node)ys.push(a.name+'>'+b.name)}
ok(ys.length===0,'up or down only on the trunk (the jump to it, the climb, off it): '+ys.slice(0,4).join(','))
const ks={};T.forEach(f=>{(ks[f.name]=ks[f.name]||new Set()).add(f.k.toFixed(5))});ok(Object.values(ks).every(v=>v.size===1),'each sequence at one size all the way: '+JSON.stringify(Object.fromEntries(Object.entries(ks).map(([a,b])=>[a,b.size]))))
const wf=T.filter(f=>f.name==='walk');let bad=0;for(let i=1;i<wf.length;i++){if(wf[i].i!==wf[i-1].i&&wf[i].node===wf[i-1].node){const d=Math.abs(wf[i].footX-wf[i-1].footX)}}ok(wf.length>50,'he walks (frames: '+wf.length+')')
ok(pg.errs.length===0,'page errors '+pg.errs.join('|'));await pg.context().close()

// 4 stuck to his perch when Home scrolls; drawn again with Home; still while Uri types or a sheet is open
pg=(await bootRoute())||await boot();await pg.evaluate(async()=>await lokiWalkNow('flow'));await pg.waitForFunction(()=>lkr.state==='perched',null,{timeout:60000})
r=await pg.evaluate(async()=>{const a=()=>document.querySelector('.lk-actor').getBoundingClientRect(),f=()=>document.querySelector('[data-loki-perch="flow"]').getBoundingClientRect();const d0=a().top-f().top,x0=a().left-f().left;const sc=document.getElementById('screen-home');sc.scrollTop=220;await new Promise(r=>setTimeout(r,250));const d1=a().top-f().top,x1=a().left-f().left;sc.scrollTop=0;await new Promise(r=>setTimeout(r,250));renderHome();await new Promise(r=>setTimeout(r,400));const d2=a().top-f().top;return {d0,d1,d2,x0,x1,moved:sc.scrollTop,inLayer:!!document.querySelector('#screen-home > #lk-roam .lk-actor'),state:lkr.state}})
ok(Math.abs(r.d1-r.d0)<.6&&Math.abs(r.x1-r.x0)<.6,'when Home scrolls he scrolls with the card he stands on (he stays where he is on it): '+JSON.stringify(r))
ok(Math.abs(r.d2-r.d0)<1.5&&r.inLayer&&r.state==='perched','when Home is drawn again he is still there, on the same card: '+r.d2.toFixed(1))
// a tap on him: a wave and a line; LOKI.say / react / goTo
r=await pg.evaluate(async()=>{const a=document.querySelector('.lk-actor'),b=a.getBoundingClientRect();a.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:b.left+b.width/2,clientY:b.top+b.height/2}));const seen=new Set();for(let i=0;i<14;i++){await new Promise(r=>setTimeout(r,90));seen.add(a.dataset.kind)}return {seen:[...seen],say:(document.querySelector('.lk-say')||{}).textContent,bank:LOKI.roamTap}})
ok((r.seen.includes('wave')||r.seen.includes('seatwave'))&&r.bank.includes(r.say),'a tap on him: he waves (standing, or seated on a card corner) and says a line: '+r.seen.join(',')+' / '+r.say)
r=await pg.evaluate(()=>{lokiSayClear();const a=LOKI.react('taskDone');const t1=(document.querySelector('.lk-say')||{}).textContent;const b=LOKI.say('בדיקה');const t2=(document.querySelector('.lk-say')||{}).textContent;const c=LOKI.goTo('focus'),d=LOKI.goTo('nav'),e=LOKI.goTo('flow');return {a,t1,in:LOKI.taskDone||LOKI['taskDone'],ok1:LOKI.taskDone.includes(t1),b,t2,c,d,e}})
ok(r.a&&r.ok1,'LOKI.react: he answers out here, where he is: '+r.t1);ok(r.b&&r.t2==='בדיקה','LOKI.say: a line beside him');ok(r.c===false&&r.d===false,'LOKI.goTo a place with no room, or no drawn way: no')
ok(r.e===false,'LOKI.goTo again within 45 s of his last move: no (one move every 45 s at most)')
r=await pg.evaluate(()=>{const g=document.querySelector('.lk-say');if(!g)return null;const b=g.getBoundingClientRect();return vnContent(document.getElementById('screen-home'),e=>!!e.closest(LK_SKIP)).filter(q=>q.right>b.left+1&&q.left<b.right-1&&q.bottom>b.top+1&&q.top<b.bottom-1).length});ok(r===0,'his line covers nothing: '+r)
// the tap on the empty stump calls him; on the way he cannot be called twice
await pg.evaluate(()=>{const st=document.querySelector('#jg-gnome .gn-stage'),b=st.getBoundingClientRect();st.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:b.left+b.width/2,clientY:b.top+b.height/2}))})
r=await pg.evaluate(()=>lkr.state);ok(r==='coming','a tap on the empty stump: he sets off home at once: '+r)
// on the way home: a sheet, typing, another screen; he stops where he is and goes on after
await pg.waitForFunction(()=>lkr.ep&&lkr.ep.cur&&['walk','loop','ledge','turn'].includes(lkr.ep.cur.name),null,{timeout:20000})
const freeze=async(name,on,off)=>{await pg.evaluate(on);await pg.waitForTimeout(150);const a=await pg.evaluate(()=>document.querySelector('.lk-actor').style.transform+'|'+document.querySelector('.lk-spr').src);await pg.waitForTimeout(900);const b=await pg.evaluate(()=>document.querySelector('.lk-actor').style.transform+'|'+document.querySelector('.lk-spr').src);await pg.evaluate(off);await pg.waitForTimeout(700);const c=await pg.evaluate(()=>document.querySelector('.lk-actor').style.transform+'|'+document.querySelector('.lk-spr').src+'|'+lkr.state);ok(a===b&&c!==b,name+': he stops where he is, in the middle of the step, and goes on after ('+(a===b)+','+(c!==b)+')')}
await freeze('a sheet opens',()=>openModal('<div>x</div>'),()=>closeModal())
await freeze('Uri types',()=>{const i=document.createElement('input');i.id='tmpi';document.body.appendChild(i);i.focus()},()=>{document.getElementById('tmpi').remove();lkr.lastKey=0})
await freeze('Uri goes to another screen',()=>navigateTo('tasks'),()=>navigateTo('home'))
r=await pg.evaluate(()=>!!lkr.ep&&lkr.state==='coming');ok(r,'none of these sends him home at once (he is still on his way)')
await pg.waitForFunction(()=>lkr.state==='in',null,{timeout:90000});r=await pg.evaluate(()=>LOKI.react('taskDone'));ok(r===false,'LOKI.react while he is on his stump: the card answers, as before')
ok(pg.errs.length===0,'page errors '+pg.errs.join('|'));await pg.context().close()

// 5 night, the switch, reduced motion, the other themes, the lab
pg=await boot({q:'?gnomeHour=23'});r=await pg.evaluate(()=>lokiLeaveGuard());ok(r==='asleep','at night he does not set out: '+r);await pg.context().close()
pg=await boot();await pg.evaluate(()=>{setLokiRoam(false);navigateTo('home')});await pg.waitForTimeout(400);r=await pg.evaluate(async()=>({t:await lokiWalkNow(),layer:!!document.getElementById('lk-roam')&&!!document.getElementById('lk-roam').parentNode}));r.margin=await pg.evaluate(()=>getComputedStyle(document.getElementById('jg-gnome')).marginLeft);ok(!r.t&&!r.layer&&r.margin==='0px','"Loki roams" off: he stays on his stump, no trunk, and the briefing card in its usual margin: '+JSON.stringify(r));await pg.evaluate(()=>setLokiRoam(true));await pg.context().close()
pg=await boot({rm:true});await pg.waitForTimeout(600);r=await pg.evaluate(async()=>({t:await lokiWalkNow(),layer:!!(document.getElementById('lk-roam')&&document.getElementById('lk-roam').parentNode),timer:!!lkr.timer}));ok(!r.t&&!r.layer,'reduced motion: he does not go out, nothing of the layer: '+JSON.stringify(r));await pg.context().close()
for(const th of ['original','moss','aqua','nachal']){pg=await boot({theme:th});await pg.waitForTimeout(400);r=await pg.evaluate(async()=>({t:await lokiWalkNow(),layer:!!document.getElementById('lk-roam'),marked:document.querySelectorAll('[data-loki-perch]').length}));ok(!r.t&&!r.layer&&r.marked===0,th+': nothing of him: '+JSON.stringify(r));ok(pg.errs.length===0,th+' errors '+pg.errs.join('|'));await pg.context().close()}
pg=await boot();r=await pg.evaluate(()=>({panel:!!document.getElementById('lk-lab-panel'),lab:!!document.querySelector('.lk-lab')}));ok(!r.panel&&!r.lab,'the lab is not there in ordinary use');await pg.context().close()
pg=await boot({q:'?gnomeHour=12&loki-lab=1'});r=await pg.evaluate(()=>({panel:!!document.getElementById('lk-lab-panel'),btns:[...document.querySelectorAll('#lk-lab-panel button')].map(b=>b.textContent),perches:document.querySelectorAll('.lk-lab-p').length,vines:document.querySelectorAll('.lk-lab-v').length}))
ok(r.panel&&r.btns.includes('out')&&r.btns.includes('home')&&r.perches>=4&&r.vines>=0,'?loki-lab=1: the map (perches, room, vines) and a button for each movement and place: '+r.btns.join(' '));await pg.context().close()
// no push, no notification in his name; nothing fetched outside the app
r=fs.readFileSync(ROOT+'/index.html','utf8');const blk=r.slice(r.indexOf('// ── LOKI LIVES OUT HERE'),r.indexOf('// ── his nook in the card'));ok(blk.length>1000&&!/Notification|showNotification|pushManager|serviceWorker/.test(blk),'no push or notification anywhere in him')
console.log('life: '+pass+'/'+(pass+fail)+' passed'+(gone.length?', '+gone.length+' no longer apply':''));await br.close();srv.close();process.exit(fail?1:0)})

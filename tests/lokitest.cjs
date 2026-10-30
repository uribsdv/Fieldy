#!/usr/bin/env node
// Loki on the journey's branch, against main: his banks and his story word for word as main's, his bubble's font and slant
// (italic) as main's, no line told again within the last five of its bank, his card on the jungle Home, no page errors.
// Run: node tests/lokitest.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
// The other side is main, taken from git (git archive of BASE=<ref>, default origin/main, else main); MAIN=<dir> uses a checkout
// instead. ROOT=<dir> runs this side against another checkout (default: this repository).
'use strict'
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),{execSync}=require('child_process')
function loadPlaywright(){try{return require('playwright')}catch(e){}try{return require(path.join(execSync('npm root -g',{encoding:'utf8'}).trim(),'playwright'))}catch(e){}console.error('✕ playwright not found');process.exit(2)}
const {chromium}=loadPlaywright()
const ROOT=process.env.ROOT||path.resolve(__dirname,'..')
function mainDir(){if(process.env.MAIN)return process.env.MAIN;const d=fs.mkdtempSync(path.join(os.tmpdir(),'lokitest-'))
  for(const ref of [process.env.BASE,'origin/main','main'].filter(Boolean)){try{execSync('git archive '+ref+' | tar -x -C '+JSON.stringify(d),{cwd:ROOT,stdio:['ignore','ignore','ignore']});if(fs.existsSync(path.join(d,'index.html')))return d}catch(e){}}
  console.error('✕ main not found in git (set BASE or MAIN)');process.exit(2)}
const snap=fs.readFileSync(path.join(__dirname,'snapshots.cjs'),'utf8')
const seededState=new Function(snap.slice(snap.indexOf('function todayPlus'),snap.indexOf('// Each scene'))+'\nreturn seededState')()
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m)}else{fail++;console.log('  ✕',m)}}
function serve(ROOT){return new Promise(res=>{const s=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(!p.startsWith('/Fieldy/')){r.writeHead(404);return r.end()}p=p.slice(8)||'index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png','.webp':'image/webp'}[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});s.listen(0,()=>res(s))})}
;(async()=>{const br=await chromium.launch()
 async function boot(ROOT){const s=await serve(ROOT),B='http://127.0.0.1:'+s.address().port+'/Fieldy/';const ctx=await br.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.route('**/*',r=>r.request().url().startsWith(B)?r.continue():r.abort())
  await pg.goto(B);await pg.evaluate(st=>{localStorage.clear();localStorage.setItem('fieldy_v2',JSON.stringify(st));localStorage.setItem('fieldy_theme','jungle')},seededState());await pg.goto(B+'?gnomeHour=12');await pg.waitForTimeout(800);pg.srv=s;return pg}
 const A=await boot(mainDir()),G=await boot(ROOT)
 const dump=pg=>pg.evaluate(()=>JSON.stringify({LOKI,LOKI_STORY:typeof LOKI_STORY!=='undefined'?LOKI_STORY:null}))
 // one line of taskDone was rewritten on purpose (claude/streak-welcome-back): main's, with that line alone replaced, is the bank to match
 const TASKDONE_OLD='אתה רואה את כל מה שלא עשית. אני רואה מכאן מישהו שלא הפסיק לנסות.',TASKDONE_NEW='הנה עוד משהו שנעשה. אני רושם אותו אצלי, ליד כל השאר.'
 ok((await dump(A)).split(JSON.stringify(TASKDONE_OLD)).join(JSON.stringify(TASKDONE_NEW))===await dump(G),"Loki's banks and story are the same as main's, word for word (one taskDone line replaced)")
 const css=pg=>pg.evaluate(()=>{const e=document.querySelector('#jg-gnome');if(!e)return null;const t=[...e.querySelectorAll('*')].find(x=>x.children.length===0&&x.textContent.trim().length>8);return t?getComputedStyle(t).fontStyle+'|'+getComputedStyle(t).fontFamily:null})
 const cg=await css(G);ok(cg!==null&&cg===await css(A),"his bubble's font and slant are main's ("+cg+')')
 const banks=await G.evaluate(()=>{const out=[];const walk=(o,p)=>{if(Array.isArray(o)){if(o.length>=6&&o.every(x=>typeof x==='string'||(x&&typeof x.t==='string')))out.push(p)}else if(o&&typeof o==='object')for(const k in o)walk(o[k],p?p+'.'+k:k)};walk(LOKI,'');return out})
 const bad=await G.evaluate(banks=>banks.filter(b=>{const seq=[];for(let i=0;i<80;i++)seq.push(JSON.stringify(lokiPick(b)));return seq.some((t,i)=>seq.slice(Math.max(0,i-5),i).includes(t))}),banks)
 ok(banks.length>0&&bad.length===0,banks.length+' banks: no line repeats within the last five told'+(bad.length?' (bad: '+bad.join(',')+')':''))
 ok(await G.evaluate(()=>!!document.getElementById('jg-gnome')),'his card is on Home in the jungle')
 ok(G.errs.length===0&&A.errs.length===0,'no page errors'+(G.errs.concat(A.errs).length?': '+G.errs.concat(A.errs).join('|'):''))
 await br.close();A.srv.close();G.srv.close();console.log('\n'+pass+'/'+(pass+fail)+' checks passed');process.exit(fail?1:0)})()

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {ATLAS_DEFAULTS,atlasStateFromHash,atlasHash,selectWorldAtlas,atlasCSV} from '../src/world-atlas-model.mjs';
import {renderWorldAtlas,createWorldAtlas} from '../src/world-atlas.mjs';
import {mediaFor,validMedia} from '../src/visual-model.mjs';
import {STUDIO_PAGES,renderNavigation} from '../src/navigation.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../src/data/'+name+'.json',import.meta.url),'utf8'));
const [d,expansion,remote,review]=await Promise.all(['world-atlas','apk-media-expansion','remote-character-study','apk-media-review'].map(read));
const context={worldAtlas:d,media:{entries:[...expansion.mediaEntries,...remote.mediaEntries,...review.mediaEntries]}};
const state=x=>({...ATLAS_DEFAULTS,...x});

test('atlas inventories exact model/prefab populations and preserves no-static-image records',()=>{
 assert.equal(d.originalRuntimeObserved,false);assert.equal(d.mapEntries.length,9094);assert.equal(new Set(d.mapEntries.map(x=>x.id)).size,9094);
 assert.equal(d.mapEntries.filter(x=>x.format==='model').length,944);assert.equal(d.mapEntries.filter(x=>x.format==='prefab').length,8150);
 assert.equal(d.mapEntries.filter(x=>x.mediaKey).length,9030);assert.equal(d.mapEntries.filter(x=>!x.mediaKey).length,64);
 assert.ok(d.mapEntries.filter(x=>x.format==='model').every(x=>x.mediaKey));
 assert.equal(d.roles.length,50);assert.equal(d.motions.length,903);assert.equal(d.motions.filter(x=>x.staticOnly).length,2);
 assert.equal(d.roles.filter(x=>x.kind==='customer').length,6);assert.equal(d.motions.filter(x=>x.roleId.startsWith('customer:')).length,15);
 assert.ok(d.areas.some(x=>x.id==='area48'));assert.ok(d.areas.some(x=>x.id==='area1'));
 for(const entry of d.mapEntries){assert.ok(entry.areaIds.every(id=>d.areas.some(a=>a.id===id)));assert.match(entry.path,/^Assets\/Map\//);assert.match(entry.bundleSHA256,/^[a-f0-9]{64}$/);}
});

test('every map item and motion is reachable once through bounded pages with no duplicate or lost identities',()=>{
 for(const tab of ['map','motion']){
  const options=state({tab,scope:'all'}),total=selectWorldAtlas(d,options),seen=new Set();
  for(let page=1;page<=total.pages;page++){const p=selectWorldAtlas(d,{...options,page});assert.ok(p.rows.length<=p.size);for(const row of p.rows){assert.equal(seen.has(row.id),false);seen.add(row.id);}}
  assert.equal(seen.size,tab==='map'?9094:903);
 }
 assert.equal(selectWorldAtlas(d,state({tab:'npc'})).rows.length,50);
 assert.equal(selectWorldAtlas(d,state({scope:'model'})).total,944);
 assert.ok(selectWorldAtlas(d,state({area:'area1'})).rows.every(x=>x.areaIds.includes('area1')));
 assert.ok(selectWorldAtlas(d,state({tab:'npc',kind:'variant'})).allRows.every(x=>x.variant));
 assert.ok(selectWorldAtlas(d,state({tab:'npc',kind:'customer'})).total===6);
 assert.equal(selectWorldAtlas(d,state({tab:'motion',phase:'static'})).total,2);
 assert.equal(selectWorldAtlas(d,state({query:'__no_such_resource__'})).total,0);
 const matching=selectWorldAtlas(d,state({tab:'npc',kind:'variant',query:'해리슨'}));assert.ok(matching.rows.some(x=>x.sourceId==='Harrisonbuild'));
});

test('hash state, invalid parameters, filtering and CSV preserve namespaces, proposal-independent counts and safe fields',()=>{
 const s=state({tab:'motion',role:'body:Quinn',query:'angry',page:2,materialExamples:false}),restored=atlasStateFromHash(atlasHash(s),d);assert.deepEqual(restored,s);
 const invalid=atlasStateFromHash('#world-atlas?tab=bad&scope=unknown&area=nope&role=x&page=NaN',d);assert.equal(invalid.tab,'map');assert.equal(invalid.area,'all');assert.equal(selectWorldAtlas(d,invalid).page,1);
 const filtered=selectWorldAtlas(d,state({tab:'motion',role:'body:Quinn',query:'angry'}));assert.equal(filtered.total,3);assert.ok(filtered.rows.every(m=>m.animation.startsWith('Quinn_angry')));
 assert.equal(selectWorldAtlas(d,state({tab:'motion',role:'customer:Norman'})).total,2);
 assert.match(atlasCSV(d,state({tab:'motion',role:'body:Quinn',query:'angry'})),/Quinn_angry/);
 const csv=atlasCSV(d,state({scope:'model',query:'mainhousetower'}));assert.match(csv,/mainhousetower/);assert.equal(csv.split('\r\n').length,2);
});

test('all previews, long-motion segments and material examples resolve exact known media and source identities',()=>{
 const entries=new Map(d.mapEntries.map(r=>[r.id,r]));
 for(const r of d.mapEntries){if(r.mediaKey)assert.ok(validMedia(mediaFor(context,r.mediaKey)),r.id);if(r.materialExample){const example=entries.get(r.materialExample.entryId);assert.ok(example&&example.format==='prefab');assert.equal(example.mediaKey,r.materialExample.mediaKey);assert.ok(r.materialExample.sharedMeshHashes.length);for(const sha of r.materialExample.sharedMeshHashes)assert.match(sha,/^[a-f0-9]{64}$/);}}
 for(const role of d.roles){assert.ok(mediaFor(context,role.posterKey),role.id);assert.ok(d.motions.some(m=>m.id===role.defaultMotionId));assert.equal(d.motions.filter(m=>m.roleId===role.id).length,role.motionCount);}
 for(const m of d.motions){assert.ok(mediaFor(context,m.posterKey),m.id);if(m.previewKey)assert.equal(mediaFor(context,m.previewKey).kind,'gif');for(const seg of m.segments){assert.ok(seg.range[0]>=0&&seg.range[1]>=seg.range[0]&&seg.range[1]<=m.duration+1e-6);assert.ok(mediaFor(context,seg.posterKey));if(seg.key)assert.ok(mediaFor(context,seg.key));}}
 assert.ok(d.motions.some(m=>m.segments.length>1));
 const lucy=d.roles.find(r=>r.id==='customer:Lucy');assert.equal(lucy.componentPair,true);assert.match(lucy.posterKey,/declared-pair/);
});

test('curated map and customer preview files match hashes; raw geometry and binaries are not published',async()=>{
 const files=new Map(d.mediaEntries.map(m=>[m.src,m]));
 await Promise.all(Array.from({length:8},async(_,worker)=>{const rows=[...files.values()];for(let i=worker;i<rows.length;i+=8){const m=rows[i];assert.ok(validMedia(m),m.key);const bytes=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256,m.key);assert.equal(bytes.length,m.bytes,m.key);}}));
 assert.doesNotMatch(JSON.stringify(d),/[CD]:[\\/]|\.obj"|\.skel"|geometryFile|Bearer /);
 for(const s of d.sources){assert.ok(s.path.startsWith('analysis/'));assert.match(s.sha256,/^[a-f0-9]{64}$/);}
});

test('map cards, all fifty role images, static poses and long split clips render usable controls and honest limits',()=>{
 const dom=new JSDOM(renderWorldAtlas(context,state())),doc=dom.window.document;
 assert.equal(doc.querySelectorAll('[data-atlas-card]').length,36);assert.equal(doc.querySelectorAll('[data-atlas-filter]').length,3);
 doc.body.innerHTML=renderWorldAtlas(context,state({tab:'npc'}));assert.equal(doc.querySelectorAll('[data-atlas-card]').length,50);assert.ok(doc.querySelectorAll('[data-loop-src]').length>40);
 doc.body.innerHTML=renderWorldAtlas(context,state({tab:'motion',phase:'static'}));assert.equal(doc.querySelectorAll('[data-atlas-card]').length,2);assert.equal(doc.querySelectorAll('[data-loop-src]').length,0);assert.ok(doc.querySelector('[data-loop-all]').disabled);
 const long=d.motions.find(m=>m.segments.length>1);doc.body.innerHTML=renderWorldAtlas(context,state({tab:'motion',role:long.roleId,query:long.animation}));assert.ok(doc.querySelector('.atlas-segments'));
 assert.match(STUDIO_PAGES['world-atlas'],/도감/);assert.match(renderNavigation(),/data-route="world-atlas"/);dom.window.close();
});

test('controller filters, query reset, namespace links and current-filter exports work without stale global listeners',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test/#world-atlas?tab=map'}),saved={window:globalThis.window,document:globalThis.document,location:globalThis.location,history:globalThis.history};Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history});
 try{const root=document.querySelector('#root'),downloads=[];let c;const render=()=>{c.beforeLeave();root.innerHTML=c.renderPage();c.afterMount(root);};c=createWorldAtlas({getData:()=>context,render,download:(...args)=>downloads.push(args)});render();
  const select=(key,value)=>{const n=root.querySelector(`[data-atlas-filter="${key}"]`);n.value=value;n.dispatchEvent(new window.Event('change',{bubbles:true}));};select('scope','model');assert.match(root.querySelector('[data-atlas-results]').textContent,/944/);assert.equal(document.activeElement.dataset.atlasFilter,'scope');
  const q=root.querySelector('[data-atlas-query]');q.value='mainhousetower';q.dispatchEvent(new window.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,160));assert.equal(root.querySelectorAll('[data-atlas-card]').length,1);assert.match(location.hash,/q=mainhousetower/);
  root.querySelector('[data-atlas-csv]').click();assert.equal(downloads.length,1);assert.match(downloads[0][1],/mainhousetower/);root.querySelector('[data-atlas-reset]').click();assert.equal(root.querySelector('[data-atlas-query]').value,'');
  c.beforeLeave();history.replaceState(null,'','#world-atlas?tab=npc&kind=customer');render();assert.equal(root.querySelectorAll('[data-atlas-card]').length,6);const img=root.querySelector('[data-loop-src]');root.querySelector('[data-loop-all]').click();assert.equal(img.getAttribute('src'),img.dataset.loopPoster);c.beforeLeave();
 }finally{Object.assign(globalThis,saved);dom.window.close();}
});

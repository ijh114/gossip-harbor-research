import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {selectSpineMotions,spineMotionCSV,renderSpineMotionStudy,createSpineMotionStudy} from '../src/spine-motion-study.mjs';
const study=JSON.parse(await readFile(new URL('../src/data/spine-motion-study.json',import.meta.url),'utf8'));
const hex=/^[a-f0-9]{64}$/;
test('all654 source skeletons and694 declared animations remain represented includingunsupported rows',()=>{
 assert.equal(study.summary.sourceSkeletons,654);assert.equal(study.summary.fullByteParses,654);assert.equal(study.summary.prefixOnlyParses,0);assert.equal(study.summary.parseErrors,0);
 assert.equal(study.clips.length,694);assert.equal(new Set(study.clips.map(c=>c.id)).size,694);assert.equal(new Set(study.clips.map(c=>c.atlasId)).size,654);
 assert.equal(study.clips.filter(c=>c.status.startsWith('projected-')).length,study.summary.projectedAnimations);
 assert.equal(study.clips.filter(c=>c.status==='omitted-unsupported-features').length,32);assert.equal(study.summary.projectedAnimations,662);
 assert.equal(study.summary.sourceDimensionMismatches,528);assert.equal(study.summary.originalRuntimeObserved,false);
 const clone={...study};delete clone.revision;assert.equal(createHash('sha256').update(JSON.stringify(clone)).digest('hex'),study.revision);
});
test('source range is not cut: every sample list contains declared start/end and everyvideo PTS agrees',()=>{
 for(const c of study.clips){
  assert.equal(c.sampleFPS,8);assert.equal(c.sourceSampleTimes.length,c.sampleCount);assert.equal(c.sourceSampleTimes[0],0);assert.equal(c.sourceSampleTimes.at(-1),c.sourceDuration);
  assert.equal(c.includesDeclaredStart,true);assert.equal(c.includesDeclaredEnd,true);
  if(c.media?.video){assert.equal(c.encoded.frameCount,c.sampleCount);assert.equal(c.encoded.framePTS.length,c.sampleCount);assert.equal(c.encoded.audioTracks,0);
   for(let i=0;i<c.sampleCount;i++)assert.ok(Math.abs(c.encoded.framePTS[i]-c.sourceSampleTimes[i])<=.00001,c.id+' source PTS mismatch');
   assert.ok(c.encoded.finalPoseHoldSeconds>=0&&c.encoded.finalPoseHoldSeconds<=.251);assert.ok(c.encoded.durationSeconds>=c.sourceDuration-.00001);
  }
 }
});
test('unsupported visiblefeatures never get a completed projection or a substituted image',()=>{
 for(const c of study.clips){
  if(c.status.startsWith('projected-')){assert.equal(c.unsupportedAttachments.length,0);assert.equal(c.unsupportedBlends.length,0);assert.ok(c.media?.poster);}
  else{assert.equal(c.status,'omitted-unsupported-features');assert.ok(c.unsupportedAttachments.length||c.unsupportedBlends.length);assert.equal(c.media,undefined);}
  assert.equal(c.originalRuntimeObserved,false);assert.equal(c.originalAnimationPlaybackVerified,false);
 }
});
test('published metadata preserves exact source identities but excludes original geometry and payloads',()=>{
 const banned=new Set(['vertices','uv','triangles','geometryPath','privateGeometryPath','rawBytes','skeletonBinary']);
 function walk(v){if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){assert.equal(banned.has(k),false,'Raw field published: '+k);walk(x);}}
 walk(study);
 for(const c of study.clips){for(const s of Object.values(c.source)){assert.equal(typeof s.pathId,'string');assert.match(s.pathId,/^-?\d+$/);assert.match(s.sourceSHA256,hex);}assert.ok(Array.isArray(c.timelineTypes));assert.ok(Array.isArray(c.eventNames));}
 for(const source of study.sources)assert.match(source.sha256,hex);
});
test('published reduced files physically match recorded hashes and stay inside the declared budget',async()=>{
 let total=0;
 for(let start=0;start<study.mediaEntries.length;start+=12){await Promise.all(study.mediaEntries.slice(start,start+12).map(async m=>{
  assert.ok(m.src.startsWith('./assets/media/spine-motion-study/'));assert.ok(!m.src.includes('..'));assert.equal(m.width,240);assert.equal(m.height,240);
  const bytes=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(bytes.byteLength,m.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);total+=bytes.length;
  if(m.kind==='video'){assert.equal(m.mimeType,'video/mp4');assert.equal(m.audioTracks,0);assert.ok(m.poster);}
 }));}
 assert.equal(total,study.summary.publicMediaBytes);assert.ok(total<=180*1024*1024);assert.equal(study.mediaEntries.length,study.summary.publicMediaFiles);
});
test('filtering, paging andCSV coverevery matching row instead of exporting only thevisiblepage',()=>{
 assert.equal(selectSpineMotions(study,{status:'omitted-unsupported-features'}).total,32);
 assert.equal(selectSpineMotions(study,{query:'공작'}).total,2);assert.equal(selectSpineMotions(study,{query:'definitely-no-source-like-this'}).total,0);
 const page=selectSpineMotions(study,{page:999999});assert.equal(page.page,page.pages);assert.ok(page.rows.length<=12);
 const csv=spineMotionCSV(study,{status:'omitted-unsupported-features'});assert.ok(csv.startsWith('\ufeff'));assert.equal(csv.split('\r\n').length,33);
 const probe={clips:[{id:'a',atlasId:'b',sourceName:'=HYPERLINK("bad")',animation:'x',status:'projection-error',source:{}}]};assert.ok(spineMotionCSV(probe).includes("'=HYPERLINK"));
});
test('HTML uses real native media controls, visible evidence limits and source-text escaping',()=>{
 const html=renderSpineMotionStudy(study);assert.match(html,/<video[^>]+controls muted playsinline preload="none"/);assert.doesNotMatch(html,/<video[^>]+autoplay/);
 assert.match(html,/원작 게임 실행 촬영 아님/);assert.match(html,/끝 pose/);assert.match(html,/PathAttachment/);assert.match(html,/source/);
 const dangerous={...study,clips:[{...study.clips[0],displayName:'<img src=x onerror="attack()">',animation:'</code><script>attack()</script>'}]};
 const escaped=renderSpineMotionStudy(dangerous);assert.ok(escaped.includes('&lt;script&gt;'));assert.ok(!escaped.includes('<script>attack'));
 const omitted=renderSpineMotionStudy(study,{status:'omitted-unsupported-features'});assert.match(omitted,/표현 미지원/);assert.doesNotMatch(omitted,/<video/);
 const empty=renderSpineMotionStudy(study,{query:'definitely-no-source-like-this'});assert.match(empty,/검색 조건 초기화/);
});
test('controller preservesquery focus, page actions, source seek endpoints andpause onexit',t=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.test/#spine-motions'});const prior={document:globalThis.document,location:globalThis.location};globalThis.document=dom.window.document;globalThis.location=dom.window.location;
 t.after(()=>{globalThis.document=prior.document;globalThis.location=prior.location;dom.window.close();});let pauses=0;dom.window.HTMLMediaElement.prototype.pause=function(){pauses++;};
 let download=null,controller;const mount=()=>{document.querySelector('main').innerHTML=controller.renderPage();controller.afterMount();};controller=createSpineMotionStudy({getData:()=>({spineMotionStudy:study}),render:mount,download:(...args)=>{download=args;}});mount();
 const query=document.querySelector('[data-spm-query]');query.value='공작';query.focus();query.setSelectionRange(2,2);assert.equal(controller.handleInput({target:query}),true);assert.equal(document.activeElement,document.querySelector('[data-spm-query]'));assert.match(document.querySelector('.spm-result').textContent,/2개/);
 const card=document.querySelector('[data-spm-clip]'),row=study.clips.find(c=>c.id===card.dataset.spmClip),video=card.querySelector('video');assert.ok(video);
 Object.defineProperty(video,'readyState',{get:()=>1});Object.defineProperty(video,'duration',{get:()=>row.encoded.durationSeconds});
 controller.handleClick({target:card.querySelector('[data-spm-seek="end"]')});assert.ok(Math.abs(video.currentTime-row.sourceDuration)<=.00001);assert.match(card.querySelector('[data-spm-time]').textContent,/source/);
 controller.handleClick({target:document.querySelector('[data-spm-export]')});assert.ok(download[1].startsWith('\ufeff'));assert.equal(download[2],'text/csv');
 controller.beforeLeave();assert.ok(pauses>0);
});

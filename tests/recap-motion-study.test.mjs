import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {recapMotionForEvent,recapPageMotionPhase,recapBookCellPose,recapBookOpenPhase,renderRecapMotionSlot,renderRecapMotionStudy,createRecapMotionStudy} from '../src/recap-motion-study.mjs';
const d=JSON.parse(await readFile(new URL('../src/data/recap-motion-study.json',import.meta.url),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('3 exact prefabs and3 PPtr bindings preserve two fully parsed skeletons and all17 declarations',()=>{
 assert.equal(d.prefabs.length,3);assert.equal(d.bindings.length,3);assert.equal(d.skeletons.length,2);assert.equal(d.summary.fullInputBytes,88381);assert.equal(d.skeletons.reduce((n,s)=>n+s.animations.length,0),17);
 assert.deepEqual(new Set(d.bindings.map(b=>b.field)),new Set(['m_rollPageSpine','m_avatarHandSpine','m_avatarBodySpine']));
 const body=d.bindings.find(b=>b.field==='m_avatarBodySpine'),hand=d.bindings.find(b=>b.field==='m_avatarHandSpine');assert.equal(body.skeletonSource.id,hand.skeletonSource.id);assert.match(body.skeletonSource.bundleFile,/areares\/orderexpression\/area1\/lily/);assert.doesNotMatch(body.skeletonSource.bundleFile,/customers/);assert.equal(body.componentSettings.initialFlipX,1);
 for(const s of d.skeletons){assert.equal(s.parser.fullBytesConsumed,true);assert.equal(s.parser.binaryBytes,s.parser.bytesConsumed);assert.equal(s.version,'3.8.99');}
 const clone={...d};delete clone.revision;assert.equal(hash(JSON.stringify(clone)),d.revision);
});

test('all6 source-declared motions include their full30Hz range and match decoded silent-video PTS',()=>{
 assert.equal(d.motions.length,6);let frames=0;
 for(const m of d.motions){const binding=d.bindings.find(b=>b.id===m.bindingId),skeleton=d.skeletons.find(s=>s.source.id===binding.skeletonSource.id),animation=skeleton.animations.find(a=>a.name===m.animation);assert.ok(animation);assert.equal(animation.duration,m.duration);assert.equal(m.fullSourceRange,true);assert.equal(m.sampleFPS,30);assert.equal(m.sourceSampleTimes[0],0);assert.equal(m.sourceSampleTimes.at(-1),m.duration);assert.equal(m.encoded.frameCount,m.sourceSampleTimes.length);assert.equal(m.encoded.audioTracks,0);assert.equal(m.unsupported.length,0);frames+=m.sourceSampleTimes.length;
  for(let i=0;i<m.sourceSampleTimes.length;i++)assert.ok(Math.abs(m.sourceSampleTimes[i]-m.encoded.framePTS[i])<.00001);
  assert.equal(m.componentInitialFlipApplied.x,binding.componentSettings.initialFlipX===1);assert.ok(m.encoded.finalPoseHoldSeconds>=0&&m.encoded.finalPoseHoldSeconds<.251);}
 assert.equal(frames,246);assert.ok(Math.abs(recapMotionForEvent(d,'next').duration-.5333333611488342)<1e-12);assert.equal(recapMotionForEvent(d,'fabricated-open'),null);
});

test('page input locks and actual source animation endings remain separate',()=>{
 assert.equal(recapPageMotionPhase(d,{direction:'next',elapsed:.099}).animationVisible,false);const n=recapPageMotionPhase(d,{direction:'next',elapsed:.25});assert.equal(n.inputLocked,false);assert.equal(n.sourceAnimationEnded,false);assert.ok(Math.abs(n.sourceTime-.15)<1e-12);assert.equal(n.contentUpdated,true);
 const p=recapPageMotionPhase(d,{direction:'previous',elapsed:.3});assert.equal(p.layerOrderSwapped,true);assert.equal(p.contentUpdated,true);assert.equal(p.inputLocked,true);
 assert.equal(recapPageMotionPhase(d,{direction:'lastPage',elapsed:.5}).inputLocked,false);assert.equal(recapPageMotionPhase(d,{direction:'lastPage',elapsed:.5}).sourceAnimationEnded,false);assert.equal(recapPageMotionPhase(d,{direction:'nextPage',elapsed:.64}).sourceAnimationEnded,true);assert.equal(recapPageMotionPhase(d,{direction:'unknown'}).valid,false);
});

test('native yoyo trigger maps through controller state to actual hide-clip cubic scale on content/bookFace',()=>{
 const n=d.nativeBookCell,t=n.transitions.find(t=>t.conditions.some(c=>c.name==='yoyo'));assert.equal(n.poolCells.length,3);assert.equal(t.destinationStateIndex,1);assert.equal(t.clipIndex,0);assert.equal(t.clipName,'StoryRecapBookCell_hide');assert.equal(t.transitionDuration,0);assert.equal(n.yoyoClip.channels.length,3);
 for(const c of n.yoyoClip.channels){assert.equal(c.nodePath,'content/bookFace');assert.equal(c.nodePathCRC32,3139738895);assert.equal(c.typeID,4);assert.equal(c.attribute,3);}
 const pending=recapBookCellPose(d,.159);assert.equal(pending.triggerPending,true);assert.deepEqual(pending.normalizedScale,[1,1,1]);const dip=recapBookCellPose(d,.36);assert.ok(dip.normalizedScale.every(v=>Math.abs(v-.8)<.0001));const end=recapBookCellPose(d,1);assert.equal(end.completed,true);assert.deepEqual(end.normalizedScale,[1,1,1]);
 const open=recapBookOpenPhase(d,.275);assert.equal(open.SpineAnimation,null);assert.ok(Math.abs(open.moveProgress-.25)<1e-12);assert.equal(open.ease,'InQuad');assert.equal(recapBookOpenPhase(d,.5).complete,true);assert.equal(n.openingAutomaticallyMappedToShowClip,false);
});

test('physical reduced-media hashes and reference identities are preserved without raw prefab/geometry publication',async()=>{
 let bytes=0;for(const m of d.mediaEntries){assert.ok(m.src.startsWith('./assets/media/recap-motion-study/'));assert.ok(!m.src.includes('..'));const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(hash(b),m.sha256);assert.equal(b.length,m.bytes);bytes+=b.length;assert.equal(m.width,320);assert.equal(m.height,320);assert.equal(m.originalRuntimeObserved,false);}
 assert.equal(bytes,188930);assert.equal(d.mediaEntries.length,12);
 const banned=new Set(['vertices','uv','triangles','geometryPath','rawBytes','componentPayload','controllerPayload','skeletonBinary']);function walk(x){if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){assert.equal(banned.has(k),false,k);if(['pathId','path_id'].includes(k))assert.equal(typeof v,'string');walk(v);}}walk(d);
 assert.equal(d.summary.originalGameExecuted,false);assert.equal(d.summary.originalShaderCanvasMaskingAudioVerified,false);
});

test('visible player copy preserves native timing limits and never invents a book-open Spine',()=>{
 const html=renderRecapMotionStudy(d);assert.match(html,/입력 잠금은 0.25초 \/ 0.5초/);assert.match(html,/원본 cubic scale XYZ/);assert.match(html,/book-open Spine/);assert.doesNotMatch(html,/<video[^>]+autoplay/);assert.equal((html.match(/<video/g)||[]).length,6);assert.doesNotMatch(html,/原작/);
 assert.match(renderRecapMotionSlot(d,{action:'next'}),/data-recap-motion="nextPage"/);assert.match(renderRecapMotionSlot(d,{action:'unproven'}),/명시적인 원본 모션 연결이 없습니다/);
});

test('controller uses recorded source PTS, respects delayed next-page starts and pauses on cleanup',t=>{
 const dom=new JSDOM('<main></main>'),before=globalThis.document;globalThis.document=dom.window.document;t.after(()=>{globalThis.document=before;dom.window.close();});let pauses=0;dom.window.HTMLMediaElement.prototype.pause=function(){pauses++;};dom.window.HTMLMediaElement.prototype.play=function(){return Promise.resolve();};dom.window.HTMLMediaElement.prototype.load=function(){};
 const main=document.querySelector('main');main.innerHTML=renderRecapMotionSlot(d,{action:'nextPage'});const video=main.querySelector('video'),m=recapMotionForEvent(d,'nextPage');Object.defineProperty(video,'readyState',{get:()=>1});Object.defineProperty(video,'duration',{get:()=>m.encoded.durationSeconds});const control=createRecapMotionStudy({getData:()=>({recapMotionStudy:d})});control.mount(main);
 control.sync({action:'nextPage',elapsed:.05,playing:true});assert.equal(video.style.visibility,'hidden');control.sync({action:'nextPage',elapsed:.3,playing:false});assert.equal(video.style.visibility,'visible');assert.ok(Math.abs(video.currentTime-.2)<.00001);
 control.sync({action:'nextPage',sourceTime:m.duration});assert.ok(Math.abs(video.currentTime-m.duration)<.00001);control.cleanup();assert.ok(pauses>0);
});

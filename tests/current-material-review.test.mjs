import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {currentMaterialFrame,nearestCurrentMaterialFrame,currentMaterialCSV,renderCurrentMaterialReview,createCurrentMaterialReview} from '../src/current-material-review.mjs';
const study=JSON.parse(await readFile(new URL('../src/data/current-material-review.json',import.meta.url),'utf8'));
const spine=JSON.parse(await readFile(new URL('../src/data/spine-motion-study.json',import.meta.url),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('new native PTS detail keeps3020 indexed frames separate from108 inspected stills and four old recording identities',()=>{
 assert.equal(study.summary.newClips,4);assert.equal(study.clips.reduce((n,c)=>n+c.frameCount,0),3020);assert.equal(study.clips.reduce((n,c)=>n+c.selectedFrames.length,0),108);
 assert.equal(study.summary.allNativeFramesVisuallyInspected,false);assert.equal(study.summary.sourceGameExecuted,false);
 for(const c of study.clips){
  assert.equal(c.sourceManifestVersion,null);assert.equal(c.buildMatches4105Verified,false);assert.equal(c.rawInputAvailable,false);assert.equal(c.originalWholeRecordingPublished,false);assert.equal(c.playbackRate,1);assert.equal(c.audioTracks,0);assert.equal(c.sourceFramePTS.length,c.frameCount);assert.equal(c.clipFramePTS.length,c.frameCount);
  assert.ok(c.sourceFramePTS[0]>=c.requestedRange[0]);assert.ok(c.sourceFramePTS.at(-1)<c.requestedRange[1]);
  for(let i=0;i<c.frameCount;i++){assert.ok(Math.abs(c.sourceFramePTS[i]-c.sourceFramePTS[0]-c.clipFramePTS[i])<.00001);if(i)assert.ok(c.sourceFramePTS[i]>c.sourceFramePTS[i-1]);}
  for(const f of c.selectedFrames){assert.equal(c.sourceFramePTS[f.frameIndex],f.sourcePTS);assert.equal(c.clipFramePTS[f.frameIndex],f.clipPTS);}
 }
});
test('native-frame selection clamps endpoints and maps source offsets instead of treating source seconds as clip seconds',()=>{
 const c=study.clips[1];assert.equal(currentMaterialFrame(c,-99).index,0);assert.equal(currentMaterialFrame(c,999999).index,c.frameCount-1);assert.equal(currentMaterialFrame(null),null);
 const i=120;assert.equal(nearestCurrentMaterialFrame(c,c.sourceFramePTS[i]).index,i);assert.ok(nearestCurrentMaterialFrame(c,43).clipPTS<5);assert.equal(nearestCurrentMaterialFrame(c,-100).index,0);assert.equal(nearestCurrentMaterialFrame(c,9999).index,c.frameCount-1);
});
test('all additional published files match their bytes and SHA while retaining silent bounded provenance',async()=>{
 let total=0;for(let i=0;i<study.mediaEntries.length;i+=12)await Promise.all(study.mediaEntries.slice(i,i+12).map(async m=>{assert.match(m.src,/^\.\/assets\/media\/current-material-review\//);assert.equal(m.src.includes('..'),false);const bytes=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(bytes.length,m.bytes);assert.equal(sha(bytes),m.sha256);total+=bytes.length;if(m.kind==='video')assert.equal(m.audioTracks,0);}));
 assert.equal(total,study.summary.publicMediaBytes);assert.equal(study.mediaEntries.length,112);
 const patch=await readFile(new URL('../src/data/native-map-study.json',import.meta.url));assert.equal(sha(patch),study.mapExtension.sha256);
});
test('property consumer trace preserves the bounded unresolved key and does not invent bubble or reward aliases',()=>{
 const p=study.propertyBubble;assert.equal(p.modelDeclarationCount,4);assert.equal(p.priorParsedChunks,3400);assert.equal(p.repeatedGlobalScan,false);assert.equal(p.staticEPropertyTypeMembership,false);assert.equal(p.staticItemTypeMembership,false);assert.equal(p.purposeConfirmed,false);assert.equal(p.registeredImage,false);assert.equal(p.directBubbleComponent,false);assert.equal(p.normalBubbleType,'3401');assert.equal(p.findings.length,4);
 assert.ok(p.findings.every(f=>f.sourceRefs.every(id=>study.sources.some(s=>s.id===id))));assert.equal(p.runtimeObserved,false);
});
test('all9 signal hypotheses keep zero listening and unconfirmed sound identity despite visual followup',()=>{
 assert.equal(study.audio.directInputAvailable,false);assert.equal(study.audio.directListeningSeconds,0);assert.equal(study.audio.recordedAudioPublished,0);assert.equal(study.audio.hypotheses.length,9);
 for(const h of study.audio.hypotheses){assert.equal(h.confirmedSoundIdentity,false);assert.equal(h.listened,false);assert.ok(Number.isFinite(h.ncc));assert.ok(h.adoptionBoundary);}
 assert.equal(study.summary.confirmedRecordedSoundIdentities,0);
});
test('32 added blend projections preserve atlas metadata and explicitly identify the independent compositor',()=>{
 const added=spine.clips.filter(c=>c.researchCompositor);assert.equal(added.length,32);assert.equal(spine.summary.projectedAnimations,694);assert.equal(spine.summary.omittedUnsupported,0);assert.equal(spine.summary.originalUnityBlendShaderCompared,false);assert.equal(spine.summary.sourceDimensionMismatches,528);
 for(const c of added){assert.ok(c.media.video&&c.media.poster);assert.ok(c.previouslyUnsupportedBlends.length);assert.equal(c.unsupportedBlends.length,0);assert.equal(c.unsupportedAttachments.length,0);assert.equal(c.originalAnimationPlaybackVerified,false);assert.match(c.researchCompositor,/not compared/);}
 assert.equal(spine.summary.independentBlendPixelCases,12);assert.equal(spine.summary.independentBlendPixelMaximumError,0);
});
test('HTML offers native playback, independent frame controls, safe evidence labels and escaped source text',()=>{
 const html=renderCurrentMaterialReview(study);assert.equal((html.match(/<video /g)||[]).length,4);assert.match(html,/controls muted playsinline preload="none"/);assert.doesNotMatch(html,/<video[^>]+autoplay/);assert.match(html,/직접 청취 0초/);assert.match(html,/3020/);assert.match(html,/원시 입력/);assert.match(html,/0\.25초/);assert.match(html,/property_bubble_1/);
 const dangerous={...study,clips:[{...study.clips[0],title:'<script>attack()</script>',video:{...study.clips[0].video,src:'javascript:attack()'}}]};const safe=renderCurrentMaterialReview(dangerous);assert.ok(!safe.includes('<script>attack'));assert.ok(!safe.includes('javascript:attack'));
 assert.equal(currentMaterialCSV(study).split('\r\n').length,5);assert.ok(currentMaterialCSV(study).startsWith('\ufeff'));
});
test('controller can step exact native indices, seek selected stills, export and pause on leave',t=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.test/#current-material-review'});const previous={document:globalThis.document,location:globalThis.location};globalThis.document=dom.window.document;globalThis.location=dom.window.location;t.after(()=>{Object.assign(globalThis,previous);dom.window.close();});let pauses=0,loads=0,plays=0,download;
 const proto=dom.window.HTMLMediaElement.prototype;proto.pause=function(){pauses++;};proto.load=function(){loads++;};proto.play=function(){plays++;return Promise.resolve();};
 const controller=createCurrentMaterialReview({getData:()=>({currentMaterialReview:study}),render(){},download:(...args)=>{download=args;}});document.querySelector('main').innerHTML=controller.renderPage();controller.afterMount();
 const card=document.querySelector('[data-cmr-clip]'),clip=study.clips[0],video=card.querySelector('video');Object.defineProperty(video,'readyState',{get:()=>1});
 controller.handleClick({target:card.querySelector('[data-cmr-step="1"]')});assert.equal(Number(card.querySelector('[data-cmr-frame]').value),1);assert.equal(video.currentTime,clip.clipFramePTS[1]);
 const still=card.querySelectorAll('[data-cmr-seek]')[5];controller.handleClick({target:still});assert.equal(video.currentTime,nearestCurrentMaterialFrame(clip,Number(still.dataset.cmrSeek)).clipPTS);assert.match(card.querySelector('[data-cmr-pts]').textContent,/source/);
 const range=card.querySelector('[data-cmr-frame]');range.value=String(clip.frameCount-1);controller.handleInput({target:range});assert.equal(video.currentTime,clip.clipFramePTS.at(-1));
 controller.handleClick({target:card.querySelector('[data-cmr-play]')});assert.equal(plays,1);assert.equal(video.playbackRate,1);
 controller.handleClick({target:document.querySelector('[data-cmr-export]')});assert.ok(download[1].startsWith('\ufeff'));assert.equal(download[2],'text/csv');controller.beforeLeave();assert.ok(pauses>=4);assert.equal(loads,0);
});

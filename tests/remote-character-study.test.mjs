import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validMedia} from '../src/visual-model.mjs';
const d=JSON.parse(await readFile(new URL('../src/data/remote-character-study.json',import.meta.url),'utf8'));
const baseline=JSON.parse(await readFile(new URL('../src/data/apk-media-assets.json',import.meta.url),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('all formerly remote-only RoleConfig variants have exact physical evidence and remain separate from the 15 embedded roles',()=>{
 assert.equal(d.checklistId,'4.10');assert.equal(d.targetVersion,'4.10.5');assert.equal(d.characters.length,29);assert.equal(new Set(d.characters.map(r=>r.name)).size,29);assert.equal(d.summary.registeredRoleVariants,44);assert.equal(d.summary.previousEmbeddedRoleVariants,15);assert.equal(d.summary.newExactRemoteRoleVariants,29);assert.equal(d.summary.registeredOnlyRemaining,0);assert.equal(d.summary.sourceAnimationCount,478);
 const registry=baseline.characterAssets.registry.filter(r=>!r.localPrefab);assert.equal(registry.length,29);
 for(const r of d.characters){const ref=registry.find(x=>x.name===r.name);assert.ok(ref,r.name);assert.equal(r.prefab,ref.prefab);assert.equal(r.assetGuid,ref.assetGuid);assert.equal(r.originalRuntimeObserved,false);assert.equal(r.originalPlaybackVerified,false);assert.equal(r.status,'exact-remote-prefab-spine-static-preview');assert.equal(r.physicalIdentities.length,4);for(const i of r.physicalIdentities){assert.equal(typeof i.path_id,'string');assert.match(i.object_source_sha256,/^[a-f0-9]{64}$/);assert.match(i.bundle_sha256,/^[a-f0-9]{64}$/);}}
});

test('custom split animation footers are exact source mappings with completely consumed payloads',()=>{
 const split=d.characters.filter(r=>r.skeleton.splitRecovery.customFooterRecovered);assert.deepEqual(split.map(r=>r.name),['Colton2','Dominic','Ziva2']);assert.equal(d.summary.separateAnimationPayloadsRetrieved,111);
 for(const r of split){const s=r.skeleton.splitRecovery;assert.equal(s.customMarker.marker,'0x99');assert.equal(s.customMarker.folderMatchesRegisteredPrefab,true);assert.equal(s.fullBytesConsumed,true);assert.equal(s.declaredNames.length,r.animationSummary.count);assert.equal(s.splitPayloadIdentities.length,s.declaredNames.length);assert.equal(s.customMarker.declaredAnimationCount,s.declaredNames.length);for(const n of s.declaredNames){const item=s.splitPayloadIdentities.find(p=>p.name===n+'.ani');assert.ok(item,n);assert.equal(typeof item.identity.path_id,'string');assert.match(item.sha256,/^[a-f0-9]{64}$/);}}
});

test('source atlas coordinates and actual stored textures stay distinct from 240px preview dimensions',()=>{
 assert.equal(d.summary.exactTexturePages,29);assert.ok(d.characters.some(r=>r.atlasPages.some(p=>p.declaredPixels.some((v,i)=>v!==p.actualTexturePixels[i]))));
 for(const r of d.characters){assert.equal(r.skeleton.version,'3.8.99');assert.ok(r.skeleton.bones>0&&r.skeleton.slots>0);assert.equal(r.atlasAssets.length,1);assert.equal(r.atlasAssets[0].texturePages.length,1);for(const t of r.atlasAssets[0].texturePages){assert.ok(t.width>0&&t.height>0);assert.equal(typeof t.identity.path_id,'string');}const a=r.animationSummary;assert.equal(a.animations.length,a.count);assert.ok(a.animations.every(x=>Number.isFinite(x.duration)&&x.duration>=0));assert.ok(a.animations.some(x=>x.name===a.selectedPreviewAnimation));assert.equal(a.sampledRange.start,0);assert.ok(a.sampledRange.end<=1.5);assert.ok(a.sampledRange.end<=a.declaredPreviewDuration);assert.equal(a.sourceSampleTimes.length,a.sampleFrames);assert.ok(a.sourceSampleTimes.every((t,i)=>i===0||t>a.sourceSampleTimes[i-1]));assert.equal(a.sourceSampleTimes.at(-1),a.sampledRange.end);assert.deepEqual(a.unsupportedAttachmentTypes,[]);assert.deepEqual(a.unsupportedBlendModes,[]);}
});

test('all 29 selected short pose sequences contain actual animated GIF frames and each public derivative matches its hash',async()=>{
 assert.equal(d.mediaEntries.length,d.summary.totalMediaEntries);assert.equal(d.summary.staticPNGs,29);assert.equal(d.summary.animatedGIFs,29);assert.equal(new Set(d.mediaEntries.map(m=>m.key)).size,d.mediaEntries.length);
 for(const r of d.characters){assert.equal(r.mediaKeys.length,2);assert.ok(r.animationSummary.encodedGifUniqueFrames>1);assert.ok(r.animationSummary.encodedGifFrames>1);assert.equal(r.animationSummary.staticPreviewOnly,false);}
 for(const m of d.mediaEntries){assert.ok(validMedia(m),m.key);assert.equal(m.origin,'apk-catalog-remote-spine-reconstruction');assert.equal(m.originalRuntimeObserved,false);assert.equal(m.originalPlaybackVerified,false);assert.equal(m.originalTargetExecuted,false);assert.equal(m.width,240);assert.equal(m.height,240);const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(hash(b),m.sha256,m.key);assert.equal(b.length,m.bytes);if(m.kind==='image'){assert.equal(b.readUInt32BE(16),240);assert.equal(b.readUInt32BE(20),240);}else{assert.match(b.subarray(0,6).toString(),/^GIF8[79]a$/);assert.equal(b.readUInt16LE(6),240);assert.equal(b.readUInt16LE(8),240);assert.ok(m.encodedDurationMs>0&&m.encodedDurationMs<=2020);assert.ok(m.poster.endsWith('.png'));}assert.match(m.sourceURL,/^https:\/\/diary\.cdn\.mergesigma\.com\/hotfix\/4\.10\.5\/android\//);}
});

test('all 478 remote source motions cover zero to their declared endpoints with contiguous short segments',()=>{
 assert.equal(d.motionStudies.length,478);assert.equal(new Set(d.motionStudies.map(s=>s.id)).size,478);assert.equal(d.summary.newlyPreviewedAnimations,449);assert.equal(d.summary.unpreviewedDeclaredMotions,0);assert.equal(d.summary.sourceTimelineRangesCovered,478);assert.equal(d.summary.sourceMotionSegments,561);assert.equal(d.summary.newMotionSegments,532);
 const media=new Map(d.mediaEntries.map(m=>[m.key,m]));let segments=0;
 for(const c of d.characters){const rows=d.motionStudies.filter(s=>s.role===c.name);assert.equal(rows.length,c.animationSummary.count);assert.equal(c.allDeclaredMotionsHaveSourceRangePreview,true);assert.equal(c.animationSummary.unpreviewedDeclaredMotions,0);assert.deepEqual(new Set(rows.map(s=>s.declaredAnimation)),new Set(c.animationSummary.animations.map(a=>a.name)));}
 for(const s of d.motionStudies){assert.equal(s.sourceTimelineRangeCovered,true);assert.equal(s.originalRuntimeObserved,false);assert.equal(s.originalPlaybackVerified,false);assert.ok(s.segments.length);let end=0;for(const [i,seg]of s.segments.entries()){assert.equal(seg.index,i+1);assert.ok(Math.abs(seg.sourceRange.start-end)<1e-6,s.id);assert.ok(seg.sourceRange.end>=seg.sourceRange.start);assert.ok(seg.sourceRange.end-seg.sourceRange.start<=2+1e-6);assert.equal(seg.sourceSampleRate,8);assert.equal(seg.sourceSampleTimes[0],seg.sourceRange.start);assert.equal(seg.sourceSampleTimes.at(-1),seg.sourceRange.end);assert.equal(media.get(seg.posterMediaKey)?.kind,'image');if(seg.previewMediaKey){assert.equal(media.get(seg.previewMediaKey)?.kind,'gif');assert.ok(seg.encodedGifFrames>1);assert.ok(seg.encodedGifUniqueFrames>1);assert.equal(seg.staticPreview,false);}else{assert.equal(seg.staticPreview,true);assert.equal(seg.encodedGifFrames,0);}end=seg.sourceRange.end;segments++;}assert.ok(Math.abs(end-s.declaredDuration)<1e-6,s.id);}
 assert.equal(segments,561);
});

test('the original 58 representative files retain their original byte hashes during the 449-motion expansion',()=>{
 const keys=new Set(d.characters.flatMap(r=>r.mediaKeys));const rows=d.mediaEntries.filter(m=>keys.has(m.key)).map(m=>[m.key,m.sha256]);assert.equal(rows.length,58);assert.equal(hash(JSON.stringify(rows)),'88dda9788ba1ea7755fe5e06ad5a7cbab1839b8c903bec89e216487a9c53a418');assert.equal(d.summary.representativeFilesBytePreserved,58);
});

test('public study preserves bounded provenance without publishing raw game assets or unsafe pointer numbers',()=>{
 const sources=new Set(d.sources.map(s=>s.id));for(const s of d.sources){assert.ok(s.path.startsWith('analysis/'));assert.match(s.sha256,/^[a-f0-9]{64}$/);}for(const r of d.characters)for(const id of r.sourceRefs)assert.ok(sources.has(id),id);for(const m of d.mediaEntries)for(const id of m.sourceRefs)assert.ok(sources.has(id),id);
 const unsafe=[];function walk(v,p=''){if(typeof v==='number'&&Number.isInteger(v)&&!Number.isSafeInteger(v))unsafe.push(p);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))walk(x,p+'.'+k);}walk(d);assert.deepEqual(unsafe,[]);assert.doesNotMatch(JSON.stringify(d),/[CD]:[\\/]|@gmail\.com|binaryPrivateFile|"vertices"|"atlasText"|base64Payload|originalPath/);const {revision,...body}=d;assert.equal(hash(JSON.stringify(body)),revision);
});

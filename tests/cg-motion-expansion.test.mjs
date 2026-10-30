import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const d=JSON.parse(await readFile(new URL('../src/data/cg-motion-expansion.json',import.meta.url),'utf8'));
const prior=JSON.parse(await readFile(new URL('../src/data/apk-media-assets.json',import.meta.url),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const byMedia=new Map(d.mediaEntries.map(m=>[m.key,m]));

test('all41 shipped CG source animations cover nineteen exact skeletons and retain runtime boundaries',()=>{
 assert.equal(d.targetVersion,'4.10.5');assert.equal(d.originalRuntimeObserved,false);assert.equal(d.studies.length,41);assert.equal(d.animationIndex.length,41);assert.equal(new Set(d.studies.map(s=>s.skeletonName)).size,19);assert.equal(new Set(d.studies.map(s=>s.id)).size,41);assert.equal(d.summary.sourceTimelineRangesCovered,41);assert.equal(d.sourceInputAudit.skeletonsVerified,19);assert.equal(d.sourceInputAudit.splitAnimationPayloadsVerified,3);assert.equal(d.sourceInputAudit.errors,0);assert.equal(d.summary.originalRuntimeValidated,0);assert.equal(d.summary.originalFinalRenderingValidated,0);
 assert.deepEqual(d.studies.map(s=>s.skeletonName+'\0'+s.declaredAnimation).sort(),prior.motionStudies.map(s=>s.skeletonResourceKey+'\0'+s.declaredAnimation).sort());
 for(const s of d.studies){const o=prior.motionStudies.find(x=>x.skeletonResourceKey===s.skeletonName&&x.declaredAnimation===s.declaredAnimation);assert.equal(s.declaredDuration,o.declaredDuration);assert.equal(s.originalRuntimeObserved,false);assert.equal(s.originalPlaybackVerified,false);assert.equal(s.sourceDeclaredLoop,null);assert.ok(s.sourceRefs.every(ref=>d.sources.some(x=>x.id===ref)));if(s.skeletonName==='scene3_Quinn'){assert.equal(s.splitAnimationEvidence.fullBytesConsumed,true);assert.ok(s.sourceRefs.some(ref=>ref==='cg-expansion:split:'+s.declaredAnimation+'.ani.bytes'));}}
});

test('fifty-three short8Hz source windows cover every source timeline from zero through exact declared endpoint without gaps',()=>{
 let count=0,total=0;for(const s of d.studies){let end=0;for(const seg of s.segments){count++;assert.ok(Math.abs(seg.sourceRange.start-end)<1e-7);assert.ok(seg.sourceRange.end>=seg.sourceRange.start);assert.ok(seg.sourceRange.end-seg.sourceRange.start<=2.000001);assert.equal(seg.sourceSampleRate,8);assert.equal(seg.sourceSampleTimes[0],seg.sourceRange.start);assert.ok(Math.abs(seg.sourceSampleTimes.at(-1)-seg.sourceRange.end)<1e-7);for(let i=1;i<seg.sourceSampleTimes.length;i++)assert.ok(seg.sourceSampleTimes[i]>seg.sourceSampleTimes[i-1]&&seg.sourceSampleTimes[i]-seg.sourceSampleTimes[i-1]<=.125001);assert.ok(byMedia.has(seg.posterMediaKey));assert.equal(byMedia.get(seg.previewMediaKey).kind,'gif');assert.equal(seg.staticPreview,false);end=seg.sourceRange.end;}assert.ok(Math.abs(end-s.declaredDuration)<1e-7);assert.equal(s.sourceTimelineRangeCovered,true);total+=end;const row=d.animationIndex.find(x=>x.studyId===s.id);assert.ok(row);assert.equal(row.segmentCount,s.segments.length);assert.ok(row.segmentMediaKeys.every(k=>byMedia.has(k)));}
 assert.equal(count,53);assert.equal(d.summary.newlyRenderedSegments,53);assert.ok(Math.abs(total-d.summary.declaredSourceSeconds)<1e-7);assert.ok(total>69.7);
});

function gifInfo(b){let at=13+((b[10]&128)?3*2**((b[10]&7)+1):0),frames=0,ms=0,delay=0;const blocks=()=>{while(true){assert.ok(at<b.length);const n=b[at++];if(!n)break;at+=n;assert.ok(at<=b.length);}};while(at<b.length){const marker=b[at++];if(marker===0x3b)break;if(marker===0x21){const label=b[at++];if(label===0xf9){assert.equal(b[at++],4);delay=b.readUInt16LE(at+1)*10;at+=4;assert.equal(b[at++],0);}else blocks();}else if(marker===0x2c){const packed=b[at+8];at+=9;if(packed&128)at+=3*2**((packed&7)+1);at++;blocks();frames++;ms+=delay;delay=0;}else assert.fail('Unexpected GIF marker '+marker);}return{frames,ms};}

test('all106 selected derivatives retain exact PNG/GIF hashes,240px dimensions and source-time GIF duration',async()=>{
 assert.equal(d.mediaEntries.length,106);let gifs=0,posters=0,bytes=0;for(const m of d.mediaEntries){assert.match(m.src,/^\.\/assets\/media\/cg-expansion\/[A-Za-z0-9_-]+\.(png|gif)$/);const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(sha(b),m.sha256);assert.equal(b.length,m.bytes);bytes+=b.length;assert.equal(m.originalRuntimeObserved,false);assert.equal(m.originalPlaybackVerified,false);assert.match(m.identity.path_id,/^-?\d+$/);assert.ok(m.sourceRefs.every(ref=>d.sources.some(s=>s.id===ref)));if(m.kind==='image'){posters++;assert.equal(b.readUInt32BE(16),240);assert.equal(b.readUInt32BE(20),240);}else{gifs++;assert.match(b.subarray(0,6).toString(),/^GIF8[79]a$/);assert.equal(b.readUInt16LE(6),240);assert.equal(b.readUInt16LE(8),240);assert.ok(b.includes(Buffer.from('NETSCAPE2.0')));const g=gifInfo(b);assert.ok(g.frames>1);assert.equal(g.ms,m.encodedDurationMs);assert.ok(Math.abs(g.ms-(m.sourceSampledRange.end-m.sourceSampledRange.start)*1000-10)<=5.001);assert.ok(g.ms<=2015);}}
 assert.equal(gifs,53);assert.equal(posters,53);assert.equal(bytes,d.summary.newMediaBytes);
});

test('all82 previous curated CG PNG/GIF bytes remain intact',async()=>{
 const keys=prior.motionStudies.flatMap(s=>[s.previewMediaKey,s.posterMediaKey]);assert.equal(keys.length,82);for(const key of keys){const m=prior.mediaEntries.find(m=>m.key===key);assert.ok(m);const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(sha(b),m.sha256);}assert.equal(d.summary.previousMediaFilesPreserved,82);
});

test('CG evidence preserves safe source identity strings and publishes no raw binary, atlas, geometry or machine paths',()=>{
 const bad=[];function visit(v,p){if(typeof v==='number'&&Number.isInteger(v)&&!Number.isSafeInteger(v))bad.push(p);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))visit(x,p+'.'+k);}visit(d,'root');assert.deepEqual(bad,[]);assert.doesNotMatch(JSON.stringify(d),/[CD]:[\\/]|"vertices"\s*:|"triangles"\s*:|"binaryPrivateFile"\s*:|@gmail\.com/);const c=structuredClone(d);delete c.revision;assert.equal(sha(JSON.stringify(c)),d.revision);assert.match(d.studies.find(s=>s.skeletonName==='scene1_firefly').visibilityNote,/작고 옅은/);
});

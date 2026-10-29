import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validMedia} from '../src/visual-model.mjs';
const data=JSON.parse(await readFile(new URL('../src/data/media-completion.json',import.meta.url),'utf8'));
const old=JSON.parse(await readFile(new URL('../src/data/media-refinement.json',import.meta.url),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('new capture evidence resolves the ordinary swap gap while retaining the earlier bounded negative observation',()=>{
 assert.equal(data.studies.length,2);assert.equal(data.mediaEntries.length,12);assert.equal(new Set(data.mediaEntries.map(m=>m.key)).size,12);
 const swap=data.coverage.find(r=>r.action==='교환');assert.deepEqual(swap.beforeCompletion,old.coverage.find(r=>r.action==='교환'));
 assert.deepEqual(swap.studyIds,['motion-swap-observed']);assert.match(swap.observation,/미확인/);
 assert.ok(data.remaining.filter(r=>r.status==='unconfirmed').length>=5);assert.equal(data.summary.directListeningSeconds,0);
 assert.equal(data.inventoryReview.addedFiles,0);assert.match(data.inventoryReview.comparisonMethod,/전체453개 바이트 해시/);
 for(const source of data.inventoryReview.sourceHashRechecks){assert.equal(source.matchesCatalog,true);assert.match(source.sha256,/^[a-f0-9]{64}$/);}
});

test('published completion derivatives retain source hashes, bounded PTS ranges, correct formats and no mixed capture audio',async()=>{
 for(const m of data.mediaEntries){
  assert.equal(validMedia(m),true,m.key);assert.equal(m.origin,'observed-user-capture-completion');assert.equal(m.version,null);assert.equal(m.capturedAt,null);
  assert.match(m.originalSha256,/^[a-f0-9]{64}$/);assert.ok(m.sourceRange.endSeconds>=m.sourceRange.startSeconds);
  const p=new URL('../src/'+m.src.slice(2),import.meta.url);assert.equal(hash(await readFile(p)),m.sha256,m.key);
  if(m.poster)assert.equal(hash(await readFile(new URL('../src/'+m.poster.slice(2),import.meta.url))),m.posterSha256);
  if(m.kind==='video'){assert.equal(m.encodedVerification.hasAudio,false);assert.equal(m.transform.fps,24);assert.equal(m.transform.speed,1);}
  if(m.kind==='gif'){assert.equal(m.transform.fps,12);assert.equal(m.transform.timingIsMeasurementSource,false);assert.equal(m.transform.nominalHoldStartFrames,4);assert.equal(m.transform.nominalHoldEndFrames,8);}
 }
 for(const s of data.studies){
  assert.equal(s.evidenceType,'actual-play');assert.equal(s.publicReady,true);assert.equal(s.review.inputLogAvailable,false);assert.equal(s.review.nativeRealtimePlayback,false);
  for(const f of s.frames){assert.ok(f.timeSeconds>=s.sourceRange.startSeconds&&f.timeSeconds<s.sourceRange.endSeconds);assert.ok(data.mediaEntries.some(m=>m.key===f.key&&m.sha256===f.sha256));
   for(const a of f.annotations||[]){for(const k of ['x','y','width','height'])assert.ok(Number.isFinite(a[k])&&a[k]>=0&&a[k]<=1);assert.ok(a.x+a.width<=1&&a.y+a.height<=1);assert.ok(a.note);}}
  for(const r of s.measurements){assert.ok(r.fromSeconds>=s.sourceRange.startSeconds&&r.toSeconds<s.sourceRange.endSeconds);assert.ok(r.toSeconds>=r.fromSeconds);assert.equal(r.sampleCount,1);assert.ok(r.note);}
 }
 assert.doesNotMatch(JSON.stringify(data),/[CD]:\\|[CD]:\//);
});

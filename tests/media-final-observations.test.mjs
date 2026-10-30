import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validMedia} from '../src/visual-model.mjs';

const data=JSON.parse(await readFile(new URL('../src/data/media-final-observations.json',import.meta.url),'utf8'));
const media=new Map(data.mediaEntries.map(m=>[m.key,m]));
const hash=b=>createHash('sha256').update(b).digest('hex');
const study=id=>data.studies.find(s=>s.id===id);
const file=src=>new URL('../src/'+src.slice(2),import.meta.url);

test('final historical observations preserve curated file provenance and original source distinctions',async()=>{
 assert.equal(data.targetAPKVersion,'4.10.5');
 assert.equal(data.originalRuntimeObserved,false);
 assert.equal(media.size,data.mediaEntries.length);
 assert.equal(data.studies.length,5);
 assert.equal(data.sources.length,5);
 for(const m of data.mediaEntries){
  assert.ok(validMedia(m),m.key);
  assert.match(m.src,/^\.\/assets\/media\/final-observations\/[a-z0-9.-]+$/);
  assert.equal(m.version,null);assert.equal(m.capturedAt,null);
  assert.equal(m.sourceManifestVersionVerified,false);assert.equal(m.originalRuntimeObserved,false);
  assert.equal(data.sources.find(s=>s.id===m.sourceId)?.sha256,m.originalSha256);
  const b=await readFile(file(m.src));assert.equal(hash(b),m.sha256,m.key);assert.equal(b.length,m.bytes);
  if(m.poster)assert.equal(hash(await readFile(file(m.poster))),m.posterSha256);
 }
 for(const s of data.studies){
  assert.equal(media.get(s.imageKey)?.kind,'image');
  assert.equal(s.review.inputLogAvailable,false);assert.equal(s.review.currentAPKRuntimeObserved,false);
  for(const k of s.mediaKeys)assert.ok(media.has(k),s.id+' '+k);
  assert.equal(media.get(s.sourceDisplayedBuildMediaKey)?.sourceId,s.sourceId);
  for(const f of s.frames){
   const m=media.get(f.key);assert.equal(m?.sourcePTS,f.timeSeconds);
   const range=s.observationRange??s.sourceRange;
   assert.ok(f.timeSeconds>=range.startSeconds&&f.timeSeconds<=range.endSeconds);
  }
 }
 assert.doesNotMatch(JSON.stringify(data),/[CD]:[\\/]|@gmail\.com|originalPath|privateReviewPath/);
});

test('native speed clips remain silent and GIFs cannot become the timing measurement authority',async()=>{
 const videos=data.mediaEntries.filter(m=>m.kind==='video');assert.equal(videos.length,4);
 assert.equal(data.browserPlaybackReview.checks.length,4);assert.equal(data.browserPlaybackReview.everyPlaybackFrameVisuallyReviewed,false);
 for(const m of videos){
  assert.equal(m.transform.speed,1);assert.equal(m.transform.audioRemoved,true);
  assert.equal(m.encodedVerification.hasAudio,false);assert.equal(m.transform.fps,24);
  assert.ok(m.transform.firstIncludedSourcePTS>=m.sourceRange.startSeconds);
  assert.ok(m.transform.lastIncludedSourcePTS<=m.sourceRange.endSeconds);
  assert.ok(Math.abs(m.encodedVerification.durationSeconds-(m.sourceRange.endSeconds-m.sourceRange.startSeconds))<.05);
  assert.equal(m.browserReview.browserOneSpeedPlaybackChecked,true);assert.equal(m.browserReview.browserStartEndFramesChecked,true);
  assert.equal(m.browserReview.everyPlaybackFrameVisuallyReviewed,false);assert.equal(m.browserReview.ended,true);assert.equal(m.browserReview.playbackRate,1);
  assert.equal(m.browserReview.finalCurrentTimeSeconds,m.browserReview.durationSeconds);
  const b=await readFile(file(m.src));assert.equal(b.subarray(4,8).toString(),'ftyp');
 }
 for(const m of data.mediaEntries.filter(m=>m.kind==='gif')){
  assert.equal(m.transform.speed,1);assert.equal(m.transform.fps,12);
  assert.equal(m.transform.timingIsMeasurementSource,false);
  assert.equal(m.transform.nominalHoldStartFrames,0);assert.equal(m.transform.nominalHoldEndFrames,0);
  const b=await readFile(file(m.src));assert.match(b.subarray(0,6).toString(),/^GIF8[79]a$/);
  assert.equal(b.readUInt16LE(6),m.width);assert.equal(b.readUInt16LE(8),m.height);
 }
});

test('observed storage, confirmation and boost states cannot silently become actual tool-use proof',()=>{
 const clock=study('observed-clock-storage');assert.equal(clock.actualTimeSkipUseVerified,false);
 assert.equal(clock.actualStorageTransitionObserved,true);assert.equal(clock.candidateAPKType,'time_skip_3');
 assert.match(clock.evidenceType,/not-time-skip-use/);
 const bubble=study('observed-bubble-replacement');
 assert.deepEqual(bubble.counters,{beforeHUDGold:187,afterHUDGold:187,resultItemCount:1,displayedCollectGold:2});
 const boost=study('observed-booster-cycle');assert.deepEqual(boost.observedBoostStates,[4,1,2,4]);
 assert.deepEqual(boost.counters,{energy:230,coins:28,gems:1378,unchangedAtSelectedEndpoints:true});
 const rainbow=study('observed-rainbow-confirm');assert.equal(rainbow.sourceDisplayedBuildPrefix,'3.83.0');
 assert.equal(rainbow.sourceRange,null);assert.equal(rainbow.actualConsumptionObserved,false);
 assert.match(rainbow.evidenceType,/still-not-consumption/);
 for(const id of ['4.06','4.07','4.08']){
  const row=data.coverage.find(r=>r.checklistId===id);assert.ok(row.remaining.length>0);
  assert.notEqual(row.status,'complete');
 }
});

test('the exhaustive exploratory search count is bounded and not described as proof of footage absence',()=>{
 const s=data.searchAudit;assert.equal(s.originalFolderFiles,453);assert.equal(s.catalogFiles,453);assert.equal(s.newOriginalFiles,0);
 assert.equal(s.templateSearch.videos,110);assert.equal(s.templateSearch.sampleFrames,11167);
 assert.equal(s.templateSearch.sourceTemplates,6);assert.deepEqual(s.templateSearch.scales,[18,23]);
 assert.match(s.templateSearch.confidenceBoundary,/not proof of absence/);
 assert.ok(s.templateSearch.falsePositiveExamples.length>=3);
});

test('the ten-gem consumable result cannot be mistaken for proof of an album-collection card flow',()=>{
 const s=study('observed-board-gem-use');assert.equal(s.sourceDisplayedBuildPrefix,'3.96.1');
 assert.equal(s.topic,'board-reward-consumable');assert.equal(s.albumCollectionRelationshipVerified,false);
 assert.equal(s.actualRewardCardUseResultObserved,true);assert.equal(s.acquisitionPathObserved,false);assert.equal(s.internalItemTypeId,null);
 assert.equal(s.displayedCardName,'소량의 젬');assert.equal(s.displayedCardLevel,3);assert.equal(s.displayedUseRewardGems,10);
 assert.deepEqual(s.counters,{beforeGems:3842,afterGems:3852,gemDelta:10,beforeEnergy:3214,afterEnergy:3214,beforeCoins:653,afterCoins:653});
 assert.match(s.boundaries.join(' '),/카드앨범/);assert.equal(s.review.inputLogAvailable,false);
});

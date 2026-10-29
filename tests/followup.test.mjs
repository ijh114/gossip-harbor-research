import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mergeResearch,DOMAIN_IDS,selectDomainFacts} from '../src/domain-model.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../src/data/'+name,import.meta.url),'utf8'));
const [base,extension,followup,media]=await Promise.all(['research.json','domains.json','followup.json','media.json'].map(read));
test('follow-up facts remain indexed in all related chapters without replacing the original evidence',()=>{
 const data=mergeResearch(base,extension,followup);assert.equal(data.facts.length,229);
 for(const id of DOMAIN_IDS){const actual=data.domainAnalysis.pages[id].sections.flatMap(s=>s.factIds).sort();assert.deepEqual(actual,selectDomainFacts(data.facts,id).map(f=>f.id).sort(),id);}
 for(const f of followup.findings){assert.ok(f.sources.length);for(const s of f.sources){assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.ok(s.method);assert.ok(s.path.startsWith('analysis/')||f.kind==='capture');}}
 assert.equal(followup.work.find(w=>w.step==='플레이 영상·스크린샷').state,'partial');
 assert.equal(followup.work.find(w=>w.step==='실기 실행·광고·결제').state,'held');
});
test('published APK images preserve decoded PNG hashes and a clear static-image origin',async()=>{
 const originals=media.entries.filter(x=>x.key.startsWith('asset:'));assert.equal(originals.length,24);
 assert.equal(media.entries.filter(x=>/^item:ItemModelConfig:[^:]+$/.test(x.key)).length,544);
 assert.equal(media.entries.filter(x=>x.key.startsWith('item:ItemModelConfig:3201:')).length,6);
 for(const x of originals){const bytes=await readFile(new URL('../src/'+x.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),x.sha256);assert.equal(x.origin,'packaged-sprite');assert.match(x.source,/Sprite path_id/);}
 const target=media.entries.find(x=>x.key==='item:ItemModelConfig:106');assert.match(target.src,/GroceryBag06/);
 for(const x of media.entries.filter(x=>x.origin==='packaged-sprite')){const bytes=await readFile(new URL('../src/'+x.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),x.sha256);if(x.identity)assert.equal(typeof x.identity.path_id,'string');}
 assert.equal(media.entries.filter(x=>x.kind==='video').length,11);
 assert.equal(followup.assets.clips.length,26);assert.deepEqual(followup.assets.summary.canvasReference,[1080,1920]);
});
test('historical evidence preserves unknown build identity, extraction ranges and published derivative hashes',async()=>{
 const captures=media.entries.filter(x=>x.origin==='observed-user-capture');assert.equal(captures.length,42);
 assert.equal(followup.findings.filter(x=>x.kind==='capture').length,9);
 for(const entry of captures){
  assert.equal(entry.version,null);assert.equal(entry.capturedAt,null);assert.match(entry.originalSha256,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(entry).match(/[CD]:\\/));
  const bytes=await readFile(new URL('../src/'+entry.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  if(entry.poster){const poster=await readFile(new URL('../src/'+entry.poster.slice(2),import.meta.url));assert.equal(createHash('sha256').update(poster).digest('hex'),entry.posterSha256);}
  if(entry.kind==='video'){assert.ok(entry.sourceRange.endSeconds>entry.sourceRange.startSeconds);assert.equal(entry.transform.speed,1);assert.equal(entry.transform.audioRemoved,true);}
 }
 assert.equal(captures.find(x=>x.sourceId==='GH-V0030').key,'capture:energy-chain');
 assert.equal(captures.find(x=>x.sourceId==='GH-V0114').key,'capture:reward-queue');
 for(const fact of followup.findings.filter(x=>x.kind==='capture')){assert.equal(fact.version,null);assert.ok(fact.sourceIds.length);assert.ok(fact.sources.every(s=>s.evidence_id===null));assert.ok(captures.some(c=>fact.sourceIds.includes(c.sourceId)),fact.id+' needs a matching curated source');}
});

test('published work status matches current configuration, replay scope and media origins without stale implementation gaps',async()=>{
 const [config,progress,audit,extended]=await Promise.all(['play-config.json','play-progress.json','media-audit.json','progression-validation.json'].map(read));
 const work=new Map(followup.work.map(row=>[row.step,row]));
 assert.equal(work.size,followup.work.length);
 for(const row of followup.work){assert.ok(['partial','held','waiting','working','done'].includes(row.state),row.step+' has a rendered status');assert.ok(row.done);assert.ok(row.remaining);}
 assert.equal(work.get('문서·공개 상태표').state,'done');
 assert.deepEqual(work.get('웹 보드·고정 주문').metrics,{
  baseTypes:config.items.length,generators:Object.keys(config.spreadRules.byType).length,fixedOrders:config.orders.length,
  randomOrderKinds:config.orderRules.supportedTypes.length,guideNodes:progress.tutorials.summary.webLogicHooks,
  sourceLogicGuides:progress.tutorials.summary.classificationCounts['web-runtime'],
  openingLogic:progress.tutorials.summary.classificationCounts['original-presentation-required'],
  dependentGuides:progress.tutorials.summary.classificationCounts['server-or-presentation-required']
 });
 const growth=work.get('맵·성장 연결');
 assert.deepEqual(growth.metrics,{quests:config.quests.length,levelRows:config.levels.length,naturalOrders:progress.natural.final.orders,
  naturalQuests:progress.natural.final.quests,naturalLevel:progress.natural.final.level,fixedDone:progress.fixed16.final.fixedDone,extendedNaturalLevel:extended.continuation.final.level,extendedNaturalQuests:extended.continuation.final.quests,extendedNaturalOrders:extended.continuation.final.orders,comparedSeeds:extended.seedComparison.seeds.map(r=>r.seed)});
 assert.match(growth.remaining,/Lv26 이후/);
 const images=work.get('APK 이미지·UI 자산').metrics;
 assert.deepEqual(images,{baseTypes:config.items.length,available:config.imageCoverage.available,variants:config.imageCoverage.variants,unavailable:config.items.length-config.imageCoverage.available});
 const observed=media.entries.filter(row=>row.origin==='observed-user-capture'),replays=media.entries.filter(row=>row.origin==='apk-rule-replay');
 const clips=work.get('플레이 영상·스크린샷').metrics;
 assert.equal(clips.observedReferences,observed.length);assert.equal(clips.replayGifs,replays.length);
 for(const [kind,key]of [['image','images'],['video','videos'],['gif','gifs']])assert.equal(clips[key],observed.filter(row=>row.kind===kind).length);
 assert.equal(clips.interactionCards,replays.length+observed.filter(row=>row.kind==='gif').length);
 assert.equal(clips.sourceVideos,audit.summary.totalVideos);assert.equal(clips.visualTimelineReviewedVideos,audit.summary.visualTimelineReviewedVideos);assert.equal(clips.sampleFrames,audit.summary.inScopeSampleFrames);assert.equal(clips.reviewSheets,audit.summary.inScopeOrderedSheets);assert.equal(clips.audioListenedVideos,0);assert.match(work.get('신규 게임 제작 리소스').remaining,/확정/);
 assert.match(work.get('실기 실행·광고·결제').remaining,/웹 모델/);
 assert.match(work.get('Unity 규칙 이식').remaining,/최신 웹/);
});

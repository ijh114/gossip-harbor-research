import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mergeResearch,DOMAIN_IDS,selectDomainFacts} from '../src/domain-model.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../src/data/'+name,import.meta.url),'utf8'));
const [base,extension,followup,media]=await Promise.all(['research.json','domains.json','followup.json','media.json'].map(read));
test('follow-up facts remain indexed in all related chapters without replacing the original evidence',()=>{
 const data=mergeResearch(base,extension,followup);assert.equal(data.facts.length,205);
 for(const id of DOMAIN_IDS){const actual=data.domainAnalysis.pages[id].sections.flatMap(s=>s.factIds).sort();assert.deepEqual(actual,selectDomainFacts(data.facts,id).map(f=>f.id).sort(),id);}
 for(const f of followup.findings){assert.ok(f.sources.length);for(const s of f.sources){assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.ok(s.method);assert.ok(s.path.startsWith('analysis/')||f.kind==='capture');}}
 assert.equal(followup.work.find(w=>w.step==='플레이 영상·스크린샷').state,'partial');
 assert.equal(followup.work.find(w=>w.step==='실기 실행·광고·결제').state,'held');
});
test('published APK images preserve decoded PNG hashes and a clear static-image origin',async()=>{
 const originals=media.entries.filter(x=>x.key.startsWith('asset:'));assert.equal(originals.length,24);assert.equal(media.entries.filter(x=>x.key.startsWith('item:')).length,20);
 for(const x of originals){const bytes=await readFile(new URL('../src/'+x.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),x.sha256);assert.equal(x.origin,'packaged-sprite');assert.match(x.source,/Sprite path_id/);}
 const target=media.entries.find(x=>x.key==='item:ItemModelConfig:106');assert.match(target.src,/GroceryBag06/);
 assert.equal(media.entries.filter(x=>x.kind==='video').length,3);
 assert.equal(followup.assets.clips.length,26);assert.deepEqual(followup.assets.summary.canvasReference,[1080,1920]);
});
test('historical evidence preserves unknown build identity, extraction ranges and published derivative hashes',async()=>{
 const captures=media.entries.filter(x=>x.origin==='observed-user-capture');assert.equal(captures.length,20);
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

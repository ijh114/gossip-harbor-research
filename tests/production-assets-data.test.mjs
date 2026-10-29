import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mergeResearch} from '../src/domain-model.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../src/data/'+name,import.meta.url),'utf8'));
const [d,media,c,base,domains,followup]=await Promise.all(['production-assets.json','media.json','play-config.json','research.json','domains.json','followup.json'].map(read));
test('production request inventory separates original measurements from editable new-project quantities',()=>{
 assert.equal(d.rows.length,43);assert.equal(new Set(d.rows.map(r=>r.id)).size,43);
 assert.equal(d.meta.defaultPreset,'launch');assert.deepEqual(d.presets.map(p=>p.id),['core','launch','expansion']);
 assert.deepEqual(d.presets[1].phases,['core','launch']);
 assert.equal(d.rows.filter(r=>r.phase==='core').length,27);assert.equal(d.rows.filter(r=>r.phase==='launch').length,13);assert.equal(d.rows.filter(r=>r.phase==='expansion').length,3);
 assert.equal(d.meta.counts.baseTypes,c.items.length);assert.equal(d.meta.counts.baseGenerators,Object.keys(c.spreadRules.byType).length);
 assert.equal(d.meta.counts.baseTypesWithImage,c.imageCoverage.available);assert.equal(d.meta.counts.baseUniquePngs,522);
 assert.match(d.meta.quantityPolicy,/계획/);assert.match(d.meta.countPolicy,/합산하지/);
 const ids=new Set(d.rows.map(r=>r.id)),keys=new Set(media.entries.map(m=>m.key)),facts=new Set(mergeResearch(base,domains,followup).facts.map(f=>f.id));
 for(const row of d.rows){
  assert.ok(d.categories.some(c=>c.id===row.category));assert.ok(['core','launch','expansion'].includes(row.phase));
  assert.ok(Number.isInteger(row.defaultQuantity)&&row.defaultQuantity>0);assert.ok(row.unit&&row.quantityBasis);
  for(const k of ['requiredStates','deliverables','referenceKeys','facts','sources','unknowns'])assert.ok(Array.isArray(row[k])&&row[k].length,row.id+' '+k);
  assert.ok(row.observed.summary);assert.match(row.proposal.status,/초안/);assert.ok(row.proposal.dimensions&&row.proposal.format&&row.proposal.notes);
  for(const id of row.dependencies)assert.ok(ids.has(id),id);for(const k of row.referenceKeys)assert.ok(keys.has(k),k);for(const f of row.facts)assert.ok(facts.has(f),f);
  for(const s of row.sources){assert.ok(s.path.startsWith('analysis/'));assert.match(s.sha256,/^[a-f0-9]{64}$/);}
 }
 assert.doesNotMatch(JSON.stringify(d),/[CD]:[\\/]|@gmail\.com|privateSources|sessionExport/);
});
test('measured example pixels and selected static clip ranges retain public file hashes and interpretation limits',async()=>{
 assert.equal(d.observedExamples.length,9);assert.equal(d.staticClipExamples.length,5);
 for(const e of d.observedExamples){const m=media.entries.find(m=>m.key===e.mediaKey);assert.ok(m);const bytes=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),e.sha256,e.id);assert.equal(bytes.toString('ascii',1,4),'PNG');assert.equal(bytes.readUInt32BE(16),e.pngPixels[0]);assert.equal(bytes.readUInt32BE(20),e.pngPixels[1]);assert.ok(e.pivot&&e.border&&e.note);}
 for(const clip of d.staticClipExamples){assert.ok(clip.end>clip.start);assert.ok(clip.sampleRate>0);assert.match(clip.note,/실기/);}
});

test('production observations link only reviewed video ranges with the same original source digest',async()=>{
 const audit=await read('media-audit.json');assert.equal(d.rows.filter(r=>r.videoObservations.length).length,20);
 for(const row of d.rows)for(const note of row.videoObservations){assert.ok(note.briefImplication&&note.limit);for(const ref of note.references){const source=audit.videos.find(v=>v.id===ref.sourceId);assert.ok(source&&!source.excluded);assert.equal(source.timeline.visualReviewStatus,'reviewed');assert.equal(ref.videoSha256,source.sha256);assert.ok(ref.toSeconds>ref.fromSeconds&&ref.fromSeconds>=0&&ref.toSeconds<=source.duration+.001,row.id+' '+ref.sourceId);assert.deepEqual(Object.keys(ref).sort(),['fromSeconds','sourceId','toSeconds','videoSha256']);}}
});

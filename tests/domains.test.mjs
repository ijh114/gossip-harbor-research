import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMAIN_DEFS,DOMAIN_IDS,mergeResearch,selectDomainFacts,baseMergeUnits} from '../src/domain-model.mjs';
import {renderDomainPage,describeInitialCell,renderStoryDay,renderMergeOutput} from '../src/domain-pages.mjs';
const base=JSON.parse(await readFile(new URL('../src/data/research.json',import.meta.url),'utf8'));
const extension=JSON.parse(await readFile(new URL('../src/data/domains.json',import.meta.url),'utf8'));
const data=mergeResearch(base,extension);
test('all10chapters have research, visuals and a complete nonduplicated finding index',()=>{
 for(const id of DOMAIN_IDS){
  const page=extension.pages[id],facts=selectDomainFacts(data.facts,id);
  assert.ok(facts.length>0,id);assert.equal(page.answers.length,3,id);assert.ok(page.visuals.length>0,id);
  const indexed=page.sections.flatMap(s=>s.factIds);
  assert.equal(new Set(indexed).size,indexed.length,id+' duplicate index');
  assert.deepEqual([...indexed].sort(),facts.map(f=>f.id).sort(),id+' lost finding');
  for(const v of page.visuals) for(const ref of v.sourceIds||[])assert.ok(data.facts.some(f=>f.id===ref),ref);
  const html=renderDomainPage(id,data,{kind:'all'});
  assert.ok(html.includes('<h1>'));assert.equal((html.match(/class="domain-finding"/g)||[]).length,facts.length,id);
 }
});
test('63-cell source board preserves distinct wrappers and source coordinates',()=>{
 const b=extension.models.initialBoard;
 assert.equal(b.width*b.height,63);assert.equal(b.cells.length,63);
 assert.equal(new Set(b.cells.map(c=>`${c.x},${c.y}`)).size,63);
 assert.equal(b.cells.filter(c=>c.outerState==='paperbox').length,60);
 assert.equal(b.cells.filter(c=>!c.locked).length,2);
 assert.match(describeInitialCell(0,data),/pb#c#1002/);
});
test('day and area aggregates agree without implying elapsed play days',()=>{
 const m=extension.models.mapProgression;
 assert.equal(m.days.length,292);assert.equal(m.areas.length,48);
 assert.equal(m.days.reduce((a,d)=>a+d.task_count,0),4277);
 assert.equal(m.areas.reduce((a,d)=>a+d.task_count,0),4277);
 assert.match(renderStoryDay(1,data),/185/);assert.match(renderStoryDay(292,data),/실제 플레이 일수/);
});
test('search stays in the selected domain and preserves evidence kind',()=>{
 assert.ok(selectDomainFacts(data.facts,'map',{query:'골드'}).length>0);
 assert.equal(selectDomainFacts(data.facts,'map',{query:'getgem_6'}).length,0);
 assert.ok(selectDomainFacts(data.facts,'ui',{kind:'code'}).every(f=>f.kind==='code'));
 assert.equal(selectDomainFacts(data.facts,'ui',{query:'no-such-fact-zz'}).length,0);
});
test('rendered target material is escaped and model/version boundaries remain explicit',()=>{
 const poisoned=structuredClone(data),f=poisoned.facts.find(x=>x.domain==='mechanics');
 f.title='<img src=x onerror=alert(1)>';f.details=['<script>bad()</script>'];
 const html=renderDomainPage('mechanics',poisoned,{kind:'all'});
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>bad'));
 assert.throws(()=>mergeResearch(base,{...extension,targetVersion:'0.0.0'}));
 assert.throws(()=>mergeResearch(base,{...extension,findings:[base.facts[0]]}));
 assert.equal(baseMergeUnits(8),128);assert.equal(baseMergeUnits(13),4096);assert.match(renderMergeOutput(8),/128/);
 assert.throws(()=>baseMergeUnits(0));
});

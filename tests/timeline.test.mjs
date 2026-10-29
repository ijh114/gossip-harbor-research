import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {renderBMTimeline} from '../src/bm-timeline.mjs';
import {renderActionGallery} from '../src/action-gallery.mjs';
import {validMedia} from '../src/visual-model.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../src/data/'+name,import.meta.url),'utf8'));
const [bmTimeline,media,followup]=await Promise.all(['bm-timeline.json','media.json','followup.json'].map(read));
const data={bmTimeline,media};

test('all9 BM studies preserve42 source-identified points and link to published derivatives and existing findings',()=>{
 assert.equal(bmTimeline.entries.length,9);assert.equal(bmTimeline.entries.flatMap(x=>x.milestones).length,42);
 const ids=new Set();
 for(const entry of bmTimeline.entries){
  assert.ok(followup.findings.some(f=>f.id===entry.factId));
  if(entry.codeComparison.sources.length)assert.equal(entry.codeComparison.status,'source-linked');
  else {assert.equal(entry.codeComparison.status,'not-identified');assert.ok(entry.codeComparison.unverified.length);assert.match(entry.codeComparison.condition,/확정|식별/);}
  for(const p of entry.milestones){
   assert.ok(!ids.has(p.id));ids.add(p.id);assert.equal(p.version,null);assert.equal(p.capturedAt,null);
   assert.match(p.evidence.originalSha256,/^[a-f0-9]{64}$/);assert.equal(p.sourceId,p.evidence.sourceId);
   for(const key of p.mediaKeys){const m=media.entries.find(x=>x.key===key);assert.ok(validMedia(m));assert.equal(m.origin,'observed-user-capture');}
   for(const d of p.evidence.derivatives){assert.equal(d.sha256,media.entries.find(m=>m.key===d.key).sha256);}
  }
 }
 assert.equal(bmTimeline.coverage.fullVideoAuditComplete,false);
});

test('every topic and point renders its own state without turning unknown price or wallet values into zero',()=>{
 for(const entry of bmTimeline.entries)for(const point of entry.milestones){
  const dom=new JSDOM(renderBMTimeline(data,{entryId:entry.id,milestoneId:point.id})),d=dom.window.document;
  assert.equal(d.querySelectorAll('[data-timeline-entry]').length,9);
  assert.equal(d.querySelector('[data-timeline-point][aria-pressed=true]').dataset.timelinePoint,point.id);
  assert.equal(d.querySelector('.timeline-point-info h3').textContent,point.label);
  const values=[...d.querySelectorAll('.timeline-values dd')].map(x=>x.textContent);
  for(const [i,key]of ['level','energy','gems','coins'].entries())if(point.state[key]===null)assert.equal(values[i],'미확인');
  dom.window.close();
 }
 const poisoned=structuredClone(data);poisoned.bmTimeline.entries[0].milestones[0].label='<img src=x onerror=alert(1)>';
 const dom=new JSDOM(renderBMTimeline(poisoned));assert.equal(dom.window.document.querySelector('img[onerror]'),null);dom.window.close();
});

test('action grids retain help-demo boundaries, video media hooks and distinct source-static web demonstrations',()=>{
 for(const scope of ['puzzle','ui']){
  const dom=new JSDOM(renderActionGallery(data,{scope})),d=dom.window.document;
  assert.ok(d.querySelectorAll('.action-evidence-card').length>0);
  for(const button of d.querySelectorAll('[data-media-key]'))assert.ok(validMedia(media.entries.find(m=>m.key===button.dataset.mediaKey)));
  assert.match(d.body.textContent,/원속도·무음/);assert.match(d.body.textContent,/도움말 데모/);
  assert.equal(d.querySelectorAll('[data-demo]').length,scope==='puzzle'?5:0);
  dom.window.close();
 }
});

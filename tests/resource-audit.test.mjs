import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {selectResourceRows,resourceRowsCSV,renderResourceAudit} from '../src/resource-audit.mjs';
const study=JSON.parse(await readFile(new URL('../src/data/resource-resolution.json',import.meta.url),'utf8'));
test('original three cohorts remain exhaustive and partial/native and unavailable/GUID stay distinct',()=>{
 assert.equal(study.records.length,1020);assert.equal(new Set(study.records.map(r=>r.id)).size,1020);
 for(const [kind,expected]of [['spine',654],['native',342],['guid',24]]){const c=study.cohorts.find(c=>c.id===kind),rows=study.records.filter(r=>r.kind===kind);assert.equal(c.baseline,expected);assert.equal(c.reviewed,expected);assert.equal(rows.length,expected);assert.equal(Object.values(c.counts).reduce((a,b)=>a+b,0),expected);for(const[status,count]of Object.entries(c.counts))assert.equal(rows.filter(r=>r.status===status).length,count);}
 assert.equal(study.cohorts.find(c=>c.id==='native').counts.partial,3);assert.equal(study.cohorts.find(c=>c.id==='guid').counts.unavailable,19);
 for(const r of study.records){if(r.source?.pathId)assert.equal(typeof r.source.pathId,'string');if(r.kind==='native'&&r.status==='partial'){assert.ok(Number(r.facts.find(f=>f.label==='미해석 원본 tail').value.replace('바이트',''))>0);assert.equal(r.facts.find(f=>f.label==='전체 byte roundtrip').value,'공통 prefix만 확인');}}
 assert.equal(study.originalRuntimeObserved,false);assert.equal(study.originalPlaybackVerified,false);
});
test('search/status/paging use real source records and the filtered CSV retains the same physical evidence',()=>{
 const one=selectResourceRows(study,{kind:'spine',query:'Peacock'});assert.equal(one.total,1);assert.match(one.rows[0].name,/Peacock/);
 const partial=selectResourceRows(study,{kind:'native',status:'partial'});assert.equal(partial.total,3);
 assert.equal(selectResourceRows(study,{kind:'guid',status:'unavailable'}).total,19);
 assert.equal(selectResourceRows(study,{kind:'all',query:'not-a-real-resource-28374982'}).total,0);
 const last=selectResourceRows(study,{kind:'spine',page:99999});assert.equal(last.page,last.pages);assert.ok(last.rows.length>0);
 const csv=resourceRowsCSV(study,{kind:'native',status:'partial'});assert.ok(csv.startsWith('\ufeff'));assert.equal(csv.split('\r\n').length,4);assert.match(csv,/AppLovinSettings/);
 const protectedCSV=resourceRowsCSV({records:[{id:'csv',kind:'spine',name:'=SUM(1,2)',status:'partial'}]},{kind:'all'});assert.ok(protectedCSV.includes('"\'=SUM(1,2)"'));
});
test('public source setup images are exactly selected derivatives and their paths and hashes are valid',async()=>{
 assert.equal(study.mediaEntries.length,5);
 for(const m of study.mediaEntries){assert.match(m.src,/^\.\/assets\/media\/resource-resolution\/[a-z0-9-]+\.png$/);assert.equal(m.originalRuntimeObserved,false);assert.equal(m.originalPlaybackVerified,false);assert.equal(m.privateGeometryPublished,false);assert.equal(m.width,320);assert.equal(m.height,320);const bytes=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);assert.equal(bytes.readUInt32BE(16),320);assert.equal(bytes.readUInt32BE(20),320);}
 const dom=new JSDOM(renderResourceAudit({resourceResolution:study},{kind:'guid',status:'unavailable'}));try{const doc=dom.window.document;assert.equal(doc.querySelectorAll('[data-resource-kind]').length,4);assert.equal(doc.querySelectorAll('.resource-card').length,18);assert.equal(doc.querySelectorAll('[data-media-key]').length,0);assert.match(doc.body.textContent,/19건/);assert.match(doc.body.textContent,/동적/);}finally{dom.window.close();}
});
test('untrusted resource names are text and unresolved GUID records are not rendered as physical objects',()=>{
 const fixture=structuredClone(study);fixture.records=[{id:'unsafe',kind:'guid',name:'<img src=x onerror=alert(1)>',status:'unavailable',summary:'<script>bad()</script>',guid:'old',facts:[],notes:[],sourceRefs:[]}];
 const dom=new JSDOM(renderResourceAudit({resourceResolution:fixture},{kind:'guid'}));try{const doc=dom.window.document;assert.equal(doc.querySelectorAll('script,[onerror]').length,0);assert.match(doc.querySelector('.resource-card h3').textContent,/<img/);assert.equal(doc.querySelector('.resource-identity').textContent.trim(),'');assert.match(doc.body.textContent,/원래 등록 GUID/);}finally{dom.window.close();}
});

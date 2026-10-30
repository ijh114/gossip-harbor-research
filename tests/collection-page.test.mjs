import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {selectCollectionAssets,collectionResourceCSV,renderCollectionStudy,createCollectionStudy} from '../src/collection-page.mjs';
const collectionStudy=JSON.parse(await readFile(new URL('../src/data/collection-study.json',import.meta.url),'utf8'));
test('collection distinguishes album, item book and recap and exposes rules, flow, sources and exact resource status',()=>{
 const dom=new JSDOM(renderCollectionStudy({collectionStudy})),doc=dom.window.document;
 assert.equal(doc.querySelector('h1').textContent,'컬렉션');assert.equal(doc.querySelectorAll('[data-collection-system]').length,2);
 assert.ok(doc.querySelectorAll('[data-collection-step]').length>=10);assert.equal(doc.querySelectorAll('.collection-resource-table tbody tr').length,24);
 assert.ok(doc.body.textContent.includes('원격 Sprite 확보'));assert.ok(doc.body.textContent.includes('2026-08-28~2026-10-06'));
 for(const a of doc.querySelectorAll('.collection-source-links a'))assert.ok(collectionStudy.sources.some(s=>a.hash.endsWith(encodeURIComponent(s.id))));dom.window.close();
});
test('resource selection handles localization search, system boundaries, empty results and pagination',()=>{
 const all=selectCollectionAssets(collectionStudy),next=selectCollectionAssets(collectionStudy,{page:2});
 assert.equal(all.rows.length,24);assert.ok(!next.rows.some(r=>all.rows.some(a=>a.id===r.id)));
 const row=collectionStudy.resourceAssets.find(a=>a.displayName);assert.ok(selectCollectionAssets(collectionStudy,{query:row.displayName}).rows.some(a=>a.id===row.id));
 assert.equal(selectCollectionAssets(collectionStudy,{query:'__no_such_resource__'}).total,0);
 assert.ok(selectCollectionAssets(collectionStudy,{system:'activity-book'}).rows.every(r=>r.scope!=='album'));
});
test('CSV exports the full inventory with quoted newlines, formula escaping and source references',()=>{
 const csv=collectionResourceCSV({...collectionStudy,resourceAssets:[{groupId:'test',name:'=SUM(A1)',role:'a,"b"\nc',sourceRefs:['proof']}]});
 assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"\'=SUM(A1)"'));assert.ok(csv.includes('"a,""b""\nc"'));assert.ok(csv.includes('proof'));
});
test('collection flow and filter events update displayed state, keep search focus and export a reviewable CSV',()=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.test/#collection'}),old={document:globalThis.document,location:globalThis.location};Object.assign(globalThis,{document:dom.window.document,location:dom.window.location});let exported;
 try{let c;const render=()=>dom.window.document.querySelector('main').innerHTML=c.renderPage();c=createCollectionStudy({getData:()=>({collectionStudy}),render,download:(...args)=>{exported=args;}});render();const doc=dom.window.document;
  const button=doc.querySelectorAll('[data-collection-step]')[1];c.handleClick({target:button});assert.equal(doc.querySelector(`[data-collection-step="${button.dataset.collectionStep}"]`).getAttribute('aria-pressed'),'true');
  const input=doc.querySelector('[data-collection-query]');input.value='joker';input.setSelectionRange(5,5);c.handleInput({target:input});assert.equal(doc.activeElement.value,'joker');assert.equal(doc.activeElement.selectionStart,5);
  c.handleClick({target:doc.querySelector('[data-collection-export]')});assert.equal(exported[0],'gossip-harbor-collection-resources.csv');assert.ok(exported[1].includes('GUID'));
 }finally{Object.assign(globalThis,old);dom.window.close();}
});

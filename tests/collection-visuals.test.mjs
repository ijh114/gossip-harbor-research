import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {collectionViewFromHash,renderCollectionStudy,createCollectionStudy} from '../src/collection-page.mjs';
import {collectionOutlineEntries} from '../src/collection-outline.mjs';
import {FLOW_PATHS,LOOP_NODES,BM_CASES,collectionResourceParts,normalizeCollectionVisualState} from '../src/collection-visuals.mjs';

const collectionStudy=JSON.parse(await readFile(new URL('../src/data/collection-study.json',import.meta.url),'utf8'));
const data={collectionStudy};

test('analysis starts with operations and a separate catalog deep link keeps every gallery control',()=>{
 const analysis=new JSDOM(renderCollectionStudy(data)),catalog=new JSDOM(renderCollectionStudy(data,{system:'cards'}));
 try{
  assert.equal(analysis.window.document.querySelector('.collection-card-catalog'),null);
  assert.equal(analysis.window.document.querySelector('#collection-panel>section').id,'collection-operation');
  assert.deepEqual(collectionOutlineEntries(analysis.window.document).map(e=>e.id),['collection-operation','collection-content-flow','collection-play-loop','collection-resource-summary','collection-bm','collection-all-assets']);
  assert.equal(catalog.window.document.querySelector('[data-collection-system="cards"]').getAttribute('aria-pressed'),'true');
  assert.equal(catalog.window.document.querySelectorAll('.collection-card-figure').length,9);
  assert.equal(catalog.window.document.querySelector('#collection-operation'),null);
  assert.equal(collectionViewFromHash('#collection?view=cards'),'cards');
  assert.equal(collectionViewFromHash('#collection?view=activity-book'),'activity-book');
  assert.equal(collectionViewFromHash('#collection?section=collection-card-gallery'),'cards');
  assert.equal(collectionViewFromHash('#collection?view=<script>'),'album');
 }finally{analysis.window.close();catalog.window.close();}
});

test('diagram sources exist and quantitative resource segments sum to the exact image inventory',()=>{
 const ids=new Set(collectionStudy.sources.map(s=>s.id));
 for(const row of [...Object.values(FLOW_PATHS),...LOOP_NODES,...Object.values(BM_CASES)])for(const id of row.sourceRefs)assert.ok(ids.has(id),id);
 const parts=collectionResourceParts(collectionStudy);assert.deepEqual(parts.map(p=>p.quantity),[324,36,30,36,57]);assert.equal(parts.reduce((n,p)=>n+p.quantity,0),483);
 const state=normalizeCollectionVisualState({phase:999,flowPath:'unknown',loopNode:'unknown',bmCase:'unknown',payment:'unknown'});
 assert.equal(state.phase,5);assert.equal(state.flowPath,'new');assert.equal(state.loopNode,'energy');assert.equal(state.bmCase,'missing');assert.equal(state.payment,'before');
});

test('selectors change phase, acquisition branches, a complete loop, BM eligibility and resource explanations without mutating research data',()=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.test/#collection'}),previous={document:globalThis.document,location:globalThis.location};
 Object.assign(globalThis,{document:dom.window.document,location:dom.window.location});const before=JSON.stringify(collectionStudy);
 try{
  let controller;const render=()=>{dom.window.document.querySelector('main').innerHTML=controller.renderPage();controller.afterMount();};
  controller=createCollectionStudy({getData:()=>data,render,download:()=>{}});render();const doc=dom.window.document;
  const click=(key,value)=>controller.handleClick({target:doc.querySelector(`[data-collection-viz="${key}"][data-value="${value}"]`)});
  click('phase','4');assert.match(doc.querySelector('.collection-operation-explorer .collection-viz-output h3').textContent,/전체 완성 후/);
  click('flowPath','duplicate');assert.match(doc.querySelector('#collection-content-flow .collection-viz-output').textContent,/중복은 고유 진행도를 늘리지/);
  click('flowPath','joker');assert.match(doc.querySelector('#collection-content-flow .collection-viz-output').textContent,/공통 카드 획득/);
  for(let i=0;i<6;i++)controller.handleClick({target:doc.querySelector('.collection-loop-explorer .collection-viz-output [data-collection-viz]')});
  assert.equal(doc.querySelector('.collection-loop-diagram [aria-pressed=true]').dataset.value,'energy');assert.equal(doc.activeElement.dataset.vizLabel,'다음 연결 보기');
  click('bmCase','progress');click('payment','after');assert.match(doc.querySelector('.collection-payment-compare p').textContent,/완료 과제의 보상을 수령/);
  click('payment','before');assert.match(doc.querySelector('.collection-payment-compare p').textContent,/수령 자격은 열리지/);
  click('resourcePart','shared');assert.match(doc.querySelector('.collection-resource-chart .collection-viz-output h3').textContent,/57개/);
  assert.equal(JSON.stringify(collectionStudy),before);
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});

test('tab keyboard navigation, URL restoration and search state work across the new catalog view',()=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.test/#collection'}),previous={document:globalThis.document,location:globalThis.location};
 Object.assign(globalThis,{document:dom.window.document,location:dom.window.location});
 try{
  let controller;const render=()=>{dom.window.document.querySelector('main').innerHTML=controller.renderPage();controller.afterMount();};
  controller=createCollectionStudy({getData:()=>data,render,download:()=>{}});render();const doc=dom.window.document;
  const album=doc.querySelector('[data-collection-system="album"]');album.focus();album.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(dom.window.location.hash,'#collection?view=cards');assert.equal(doc.activeElement.dataset.collectionSystem,'cards');assert.equal(doc.querySelectorAll('.collection-card-figure').length,9);
  const query=doc.querySelector('[data-collection-card-query]');query.value='set1_1';query.setSelectionRange(6,6);controller.handleInput({target:query});assert.equal(doc.querySelectorAll('.collection-card-figure').length,1);
  controller.handleClick({target:doc.querySelector('[data-collection-system="album"]')});assert.equal(doc.querySelector('.collection-card-catalog'),null);
  controller.handleClick({target:doc.querySelector('[data-collection-system="cards"]')});assert.equal(doc.querySelector('[data-collection-card-query]').value,'set1_1');
  dom.window.history.replaceState(null,'','#collection');render();assert.ok(doc.querySelector('#collection-operation'));assert.equal(doc.querySelector('.collection-card-catalog'),null);
  const last=doc.querySelector('[data-collection-system="activity-book"]');last.focus();last.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(doc.activeElement.dataset.collectionSystem,'album');
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});

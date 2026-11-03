import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {selectCollectionCards,collectionResourceSummary} from '../src/collection-overview.mjs';
import {renderCollectionStudy,createCollectionStudy} from '../src/collection-page.mjs';

const collectionStudy=JSON.parse(await readFile(new URL('../src/data/collection-study.json',import.meta.url),'utf8'));
const data={collectionStudy};

test('every theme and set can be reached exactly once without missing or duplicate card identities',()=>{
 const all=new Set();
 for(const theme of collectionStudy.themes){
  const sets=selectCollectionCards(collectionStudy,{cardTheme:theme.id}).sets;
  assert.equal(sets.length,18);
  for(const set of sets){
   const selection=selectCollectionCards(collectionStudy,{cardTheme:theme.id,cardSet:set.id});
   assert.equal(selection.total,9);assert.equal(selection.rows.length,9);
   for(const row of selection.rows){assert.ok(row.mediaKey);assert.equal(all.has(row.id),false);all.add(row.id);}
  }
 }
 assert.equal(all.size,324);
});

test('whole-theme pagination, invalid inputs and localized queries keep a bounded stable card range',()=>{
 const first=selectCollectionCards(collectionStudy,{cardSet:'all'}),next=selectCollectionCards(collectionStudy,{cardSet:'all',cardPage:2});
 assert.equal(first.total,162);assert.equal(first.rows.length,27);assert.equal(first.pages,6);
 assert.ok(next.rows.every(r=>!first.rows.some(a=>a.id===r.id)));
 assert.equal(selectCollectionCards(collectionStudy,{cardTheme:'invalid',cardSet:'invalid',cardPage:Infinity,size:0}).rows.length,9);
 assert.equal(selectCollectionCards(collectionStudy,{cardSet:'all',cardPage:1e10}).page,6);
 const name=first.rows[0].displayName;
 assert.ok(selectCollectionCards(collectionStudy,{cardSet:'all',cardQuery:name}).rows.some(r=>r.displayName===name));
 assert.equal(selectCollectionCards(collectionStudy,{cardQuery:'__missing_card__'}).total,0);
});

test('resource summary distinguishes per-theme art from shared assets and preserves evidence boundaries',()=>{
 const rows=collectionResourceSummary(collectionStudy);
 assert.deepEqual(rows.map(r=>r.perTheme),[[162,162],[18,18],[15,15],[18,18]]);
 assert.deepEqual(rows.map(r=>r.total),[324,36,30,36]);
 const a=collectionStudy.operationalAnalysis;
 assert.equal(a.originalRuntimeObserved,false);assert.equal(a.activeServerValuesVerified,false);
 assert.match(a.resourceBoundary,/135/);assert.match(a.resourceBoundary,/162/);
 const sourceIds=new Set(collectionStudy.sources.map(s=>s.id));
 for(const ref of a.sourceRefs)assert.ok(sourceIds.has(ref),ref);
});

test('gallery uses actual media keys, relative lazy images, labels and escaped card search',()=>{
 const dom=new JSDOM(renderCollectionStudy(data,{cardQuery:'"><script>alert(1)</script>'}));
 assert.equal(dom.window.document.querySelector('script'),null);
 assert.match(dom.window.document.querySelector('.collection-card-catalog').textContent,/일치하는 카드가 없습니다/);
 dom.window.close();
 const real=new JSDOM(renderCollectionStudy(data));
 assert.equal(real.window.document.querySelectorAll('.collection-card-figure').length,9);
 for(const image of real.window.document.querySelectorAll('.collection-card-grid img')){assert.ok(image.src.startsWith('./assets/media/'));assert.equal(image.getAttribute('loading'),'lazy');assert.ok(image.alt);}
 for(const button of real.window.document.querySelectorAll('.collection-card-grid [data-media-key]'))assert.ok(collectionStudy.mediaEntries.some(m=>m.key===button.dataset.mediaKey));
 real.window.close();
});

test('card controls switch season, search with focus preserved, paginate and keep item book separate',()=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.test/#collection'});
 const previous={document:globalThis.document,location:globalThis.location};Object.assign(globalThis,{document:dom.window.document,location:dom.window.location});
 try{
  let controller;const render=()=>{dom.window.document.querySelector('main').innerHTML=controller.renderPage();};
  controller=createCollectionStudy({getData:()=>data,render,download:()=>{}});render();const doc=dom.window.document;
  const theme=doc.querySelector('[data-collection-card-filter="cardTheme"]');theme.value='halloween';assert.equal(controller.handleChange({target:theme}),true);
  assert.match(doc.querySelector('.collection-card-grid [data-media-key]').dataset.mediaKey,/Ahalloween_/);
  const set=doc.querySelector('[data-collection-card-filter="cardSet"]');set.value='all';controller.handleChange({target:set});
  assert.equal(doc.querySelectorAll('.collection-card-figure').length,27);
  controller.handleClick({target:doc.querySelector('[data-collection-card-page="2"]')});assert.match(doc.querySelector('.collection-gallery-status').textContent,/2\/6/);
  const input=doc.querySelector('[data-collection-card-query]');input.value='set18_';input.setSelectionRange(6,6);controller.handleInput({target:input});
  assert.equal(doc.querySelectorAll('.collection-card-figure').length,9);assert.equal(doc.activeElement.value,'set18_');assert.equal(doc.activeElement.selectionStart,6);
  controller.handleClick({target:doc.querySelector('[data-collection-system="activity-book"]')});assert.equal(doc.querySelector('.collection-card-catalog'),null);
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});

test('asset disclosure stays usable while filtering and paginating',()=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.test/#collection'});
 const previous={document:globalThis.document,location:globalThis.location};Object.assign(globalThis,{document:dom.window.document,location:dom.window.location});
 try{
  let controller;const render=()=>{dom.window.document.querySelector('main').innerHTML=controller.renderPage();};
  controller=createCollectionStudy({getData:()=>data,render,download:()=>{}});render();const doc=dom.window.document;
  doc.getElementById('collection-all-assets').open=true;
  controller.handleClick({target:doc.querySelector('[data-collection-page="2"]')});assert.equal(doc.getElementById('collection-all-assets').open,true);
  const field=doc.querySelector('[data-collection-filter="group"]');field.value='pack-icons';controller.handleChange({target:field});assert.equal(doc.getElementById('collection-all-assets').open,true);assert.equal(doc.querySelectorAll('.collection-resource-table tbody tr').length,24);
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});

test('BM copy exposes missing-card targeting, pre-payment tasks and limits without asserting live prices',()=>{
 const dom=new JSDOM(renderCollectionStudy(data)),text=dom.window.document.getElementById('collection-bm').textContent;
 assert.match(text,/한 장으로 세트를 완성/);assert.match(text,/미결제/);assert.match(text,/일일/);assert.match(text,/미확보/);
 assert.ok(collectionStudy.sources.find(s=>s.id==='custom-card-purchase'));
 assert.ok(collectionStudy.sources.find(s=>s.id==='card-progress-recovery'));
 dom.window.close();
});

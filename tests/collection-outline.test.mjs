import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {COLLECTION_OUTLINE,collectionOutlineEntries,activeCollectionSection,mountCollectionScrollSpy} from '../src/collection-outline.mjs';
import {createReader} from '../src/reader.mjs';
import {renderCollectionStudy} from '../src/collection-page.mjs';

function fixture(){
 const sections=COLLECTION_OUTLINE.map(([id,title],index)=>index===5?`<details id="${id}"><summary>${title}</summary><h2>내부 제목</h2></details>`:`<section id="${id}"><h2>${title}</h2><h2>목차에 넣지 않는 세부 제목</h2></section>`).join('');
 const dom=new JSDOM(`<body data-surface="visual"><header class="topbar"></header><input id="global-search"><div id="search-results" hidden></div><button data-action="text-size"></button><button data-action="toggle-details"></button><span id="reading-status"></span><main id="main"><div class="reader-layout"><details id="page-outline"><summary>이 페이지 목차</summary><nav id="outline-links"></nav></details><div id="app-view">${sections}</div></div></main></body>`,{url:'https://example.test/#collection'});
 const win=dom.window,root=win.document.getElementById('app-view'),outline=win.document.getElementById('page-outline');
 Object.defineProperty(win,'innerWidth',{value:1440,writable:true});
 let offset=0;const bases=[200,2000,3000,4000,5000,6000],frames=new Map();let frameId=0;
 win.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};win.cancelAnimationFrame=id=>frames.delete(id);
 win.document.querySelector('.topbar').getBoundingClientRect=()=>({bottom:80});
 COLLECTION_OUTLINE.forEach(([id],i)=>{const node=win.document.getElementById(id);node.getBoundingClientRect=()=>({top:bases[i]-offset});node.scrollIntoView=()=>{offset=bases[i]-112;win.dispatchEvent(new win.Event('scroll'));};});
 const flush=()=>{const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback();};
 return {dom,win,root,outline,frames,flush,setOffset(value){offset=value;}};
}

test('the collection header has only the two system choices and no recap shortcut or duplicated inline outline',async()=>{
 const collectionStudy=JSON.parse(await readFile(new URL('../src/data/collection-study.json',import.meta.url),'utf8'));
 const dom=new JSDOM(renderCollectionStudy({collectionStudy}));
 assert.equal(dom.window.document.querySelectorAll('.collection-system-nav button').length,2);
 assert.equal(dom.window.document.querySelector('.collection-system-nav a'),null);
 assert.equal(dom.window.document.querySelector('.collection-section-nav'),null);
 assert.equal(collectionOutlineEntries(dom.window.document).length,6);dom.window.close();
});

test('scroll tracking keeps a long section current and follows reverse scrolling and section boundaries',()=>{
 const f=fixture(),entries=collectionOutlineEntries(f.root);
 try{
  assert.equal(activeCollectionSection(entries).id,'collection-card-gallery');
  f.setOffset(1500);assert.equal(activeCollectionSection(entries).id,'collection-card-gallery');
  f.setOffset(1888);assert.equal(activeCollectionSection(entries).id,'collection-operation');
  f.setOffset(1950);assert.equal(activeCollectionSection(entries).id,'collection-operation');
  f.setOffset(4100);assert.equal(activeCollectionSection(entries).id,'collection-play-loop');
  f.setOffset(500);assert.equal(activeCollectionSection(entries).id,'collection-card-gallery');
  assert.equal(activeCollectionSection([]),null);
 }finally{f.dom.window.close();}
});

test('scroll, image loading and disclosures update exactly one active target; cleanup cancels stale work',()=>{
 const f=fixture(),entries=collectionOutlineEntries(f.root);
 f.outline.querySelector('nav').innerHTML=entries.map(e=>`<a data-outline-target="${e.id}">${e.title}</a>`).join('')+'<small data-collection-current></small>';
 const dispose=mountCollectionScrollSpy({root:f.root,outline:f.outline,entries,win:f.win});
 const current=()=>[...f.outline.querySelectorAll('[aria-current]')].map(a=>a.dataset.outlineTarget);
 try{
  assert.deepEqual(current(),['collection-card-gallery']);
  f.setOffset(3200);for(let i=0;i<10;i++)f.win.dispatchEvent(new f.win.Event('scroll'));assert.equal(f.frames.size,1);f.flush();assert.deepEqual(current(),['collection-resource-summary']);
  f.setOffset(5100);f.root.dispatchEvent(new f.win.Event('load'));f.flush();assert.deepEqual(current(),['collection-bm']);
  f.setOffset(6100);f.root.dispatchEvent(new f.win.Event('toggle'));f.flush();assert.deepEqual(current(),['collection-all-assets']);
  f.win.dispatchEvent(new f.win.Event('scroll'));assert.equal(f.frames.size,1);dispose();assert.equal(f.frames.size,0);
  f.win.dispatchEvent(new f.win.Event('scroll'));assert.equal(f.frames.size,0);
 }finally{dispose();f.dom.window.close();}
});

test('the shared reader exposes the album outline, opens closed targets, adapts width and cleans up on route changes',()=>{
 const f=fixture(),previous={document:globalThis.document,window:globalThis.window,location:globalThis.location,history:globalThis.history};
 Object.assign(globalThis,{document:f.win.document,window:f.win,location:f.win.location,history:f.win.history});let route='collection';
 try{
  const reader=createReader({getData:()=>({facts:[],products:[]}),getRoute:()=>route,clearQuery:()=>{},render:()=>{},toast:()=>{}});
  reader.afterRender();assert.equal(f.outline.hidden,false);assert.equal(f.outline.open,true);assert.ok(f.root.parentElement.classList.contains('collection-reading'));
  assert.equal(f.outline.querySelectorAll('[data-outline-target]').length,6);
  const target=f.win.document.getElementById('collection-all-assets');assert.equal(target.open,false);
  f.outline.querySelector('[data-outline-target="collection-all-assets"]').click();f.flush();assert.equal(target.open,true);assert.equal(f.win.location.hash,'#collection?section=collection-all-assets');
  assert.equal(f.outline.querySelector('[aria-current="location"]').dataset.outlineTarget,'collection-all-assets');
  f.win.innerWidth=390;f.win.dispatchEvent(new f.win.Event('resize'));f.flush();assert.equal(f.outline.open,false);assert.match(f.outline.querySelector('[data-collection-current]').textContent,/전체 자산/);
  f.win.innerWidth=1200;f.win.dispatchEvent(new f.win.Event('resize'));f.flush();assert.equal(f.outline.open,true);
  route='puzzle';f.root.innerHTML='<h2>다른 페이지</h2>';reader.afterRender();assert.equal(f.outline.hidden,true);assert.equal(f.root.parentElement.classList.contains('collection-reading'),false);
  f.win.dispatchEvent(new f.win.Event('scroll'));assert.equal(f.frames.size,0);
 }finally{Object.assign(globalThis,previous);f.dom.window.close();}
});

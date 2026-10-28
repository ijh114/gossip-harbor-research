import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {DOMAIN_DEFS} from '../src/domain-model.mjs';
// A DOM-level application test; no browser, game runtime or server is launched.
test('chapter navigation, evidence, source-board selection, day exploration and legacy simulator remain connected',async()=>{
 const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://ijh114.github.io/gossip-harbor-research/#overview',pretendToBeVisual:true});
 const w=dom.window;
 const errors=[];w.addEventListener('error',event=>{errors.push(event.error?.message||event.message);event.preventDefault();});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 const media={matches:false,listener:null,addEventListener(_name,listener){this.listener=listener;},removeEventListener(){}};
 w.matchMedia=()=>media;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const previous={};for(const key of ['window','document','location','history','matchMedia','fetch'])previous[key]=globalThis[key];
 Object.assign(globalThis,{window:w,document:w.document,location:w.location,history:w.history,matchMedia:w.matchMedia,
  fetch:async relative=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../src/'+relative.replace(/^\.\//,''),import.meta.url),'utf8'))})});
 const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
 const until=async predicate=>{for(let i=0;i<50;i++){if(predicate())return;await tick();}throw new Error('Application state did not settle');};
 const click=selector=>{const node=w.document.querySelector(selector);assert.ok(node,selector);node.click();};
 const go=async id=>{click(`[data-route="${id}"]`);await until(()=>w.document.querySelector('#page-label')?.textContent===(DOMAIN_DEFS.find(d=>d.id===id)?.title||({catalog:'상품 카탈로그',simulator:'시뮬레이션'})[id]));};
 try{
  await import('../src/app.js');
  await until(()=>w.document.querySelector('#app-view').getAttribute('aria-busy')==='false');
  assert.equal(w.document.querySelectorAll('.domain-index-card').length,10);
  for(const def of DOMAIN_DEFS){await go(def.id);assert.equal(w.document.querySelector('#app-view h1').textContent,def.title);assert.ok(w.document.querySelector('.domain-finding'));}
  await go('difficulty');
  const range=w.document.querySelector('[data-merge-level]');range.value='10';range.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.match(w.document.querySelector('#merge-output').textContent,/512/);
  await go('mechanics');assert.equal(w.document.querySelectorAll('[data-initial-cell]').length,63);
  click('[data-initial-cell="0"]');assert.match(w.document.querySelector('#initial-cell-detail').textContent,/pb#c#1002/);
  click('.domain-finding [data-evidence]');assert.ok(w.document.querySelector('#evidence-dialog').hasAttribute('open'));
  assert.match(w.document.querySelector('#evidence-content').textContent,/SHA-256/);click('#close-evidence');
  await go('map');const select=w.document.querySelector('[data-story-day]');select.value='292';select.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.match(w.document.querySelector('#story-day-output').textContent,/292/);
  const jump=w.document.querySelector('[data-domain-jump]');jump.click();assert.ok(w.location.hash.includes('?section='));
  await go('catalog');const search=w.document.querySelector('#global-search');search.value='getgem_1';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.querySelectorAll('tbody tr').length,1);
  search.value='';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  await go('simulator');await until(()=>w.document.querySelector('#sim-generate-many'));
  click('#sim-generate-many');assert.equal(w.document.querySelectorAll('.board-cell:not(.empty)').length,10);
  click('#sim-buy-energy');assert.match(w.document.querySelector('.sim-info').textContent,/20 젬/);
  media.matches=true;media.listener();
  assert.equal(w.document.querySelector('#sidebar').inert,true);
  click('#menu-toggle');assert.equal(w.document.querySelector('#menu-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(w.document.querySelector('.app-shell').inert,true);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(w.document.querySelector('#menu-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(w.document.querySelector('.app-shell').inert,false);
  assert.deepEqual(errors,[],'No uncaught UI event errors');
 }finally{for(const [key,value]of Object.entries(previous))globalThis[key]=value;dom.window.close();}
});

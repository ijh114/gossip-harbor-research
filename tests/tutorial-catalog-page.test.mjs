import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createTutorialCatalogWorkbench,TUTORIAL_CATALOG_STORAGE_KEY as KEY} from '../src/tutorial-catalog-page.mjs';
import {SAVE_KEY} from '../src/session-store.mjs';
const catalog=JSON.parse(await readFile(new URL('../src/data/tutorial-catalog.json',import.meta.url),'utf8'));
const FLOAT='tutorial_floatrace_start',OTHER='tutorial_bakeout_1';
const ctx={mode:'research',openViews:['FloatRaceMainWindow'],activities:{FloatRace:{state:'Started',id:'research-float-1'}}};
async function harness(run,{raw,storageWrapper,getData}={}){
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test/research/#tutorial-analysis'}),w=dom.window,prior=globalThis.document;
 globalThis.document=w.document;const downloads=[],storage=storageWrapper?storageWrapper(w.localStorage):w.localStorage;
 const main=JSON.stringify({state:{wallet:{gems:123,coins:77},questsDone:3}});w.localStorage.setItem(SAVE_KEY,main);if(raw!==undefined)w.localStorage.setItem(KEY,raw);
 let workbench;const render=()=>{w.document.body.innerHTML=workbench.renderPage();};
 workbench=createTutorialCatalogWorkbench({getData:getData||(()=>({tutorialCatalogConfig:catalog})),render,download:(name,content)=>downloads.push({name,content:structuredClone(content)}),storage});render();
 const h={w,downloads,storage,main,workbench,render,handle:(a,v)=>workbench.handle(a,v),find:s=>w.document.querySelector(s),stored:()=>JSON.parse(w.localStorage.getItem(KEY)),set:(s,v)=>{const n=w.document.querySelector(s);assert.ok(n,s);n.value=v;}};
 try{await run(h);}finally{globalThis.document=prior;w.close();}
}
function setupFloat(h){h.handle('select',FLOAT);h.set('[data-catalog-context]',JSON.stringify(ctx));h.set('[data-catalog-payload]',JSON.stringify({name:'FloatRaceMainWindow'}));h.handle('start');h.set('[data-catalog-event]','OpenView');h.handle('event-select','OpenView');}

test('87 guide choices are grouped in Korean, begin with mode only and never dump all source IR',async()=>{
 await harness(h=>{
  assert.equal(h.find('[data-catalog-select]').options.length,87);assert.ok(h.find('optgroup[label="라이브 활동·이벤트"]'));
  assert.deepEqual(JSON.parse(h.find('[data-catalog-context]').value),{mode:'research'});assert.deepEqual(JSON.parse(h.find('[data-catalog-payload]').value),{});
  assert.match(h.w.document.body.textContent,/87개 안내의 전체 구현·실행 완료가 아닙니다/);assert.equal(h.w.document.querySelectorAll('pre').length,0);assert.ok(h.w.document.body.innerHTML.length<150000);
  assert.equal(h.find('[data-catalog-action="mask-click"]').disabled,true);assert.equal(h.find('[data-catalog-action="source-event"]').disabled,true);assert.equal(h.w.localStorage.getItem(SAVE_KEY),h.main);
 });
});
test('actual FloatRace source event and two live callbacks register then complete without touching main save',async()=>{
 await harness(h=>{
  setupFloat(h);h.handle('source-event');let state=h.stored().entries[FLOAT].state;
  assert.deepEqual(state.registeredFinished,[FLOAT]);assert.deepEqual(state.completed,[]);assert.equal(state.strong,true);assert.equal(h.find('[data-catalog-action="mask-click"]').disabled,false);
  h.handle('mask-click');state=h.stored().entries[FLOAT].state;assert.deepEqual(state.completed,[]);h.handle('mask-click');state=h.stored().entries[FLOAT].state;assert.deepEqual(state.completed,[FLOAT]);
  assert.equal(h.find('[data-catalog-action="mask-click"]').disabled,true);assert.equal(h.w.document.activeElement.hasAttribute('data-catalog-status'),true);
  assert.equal(h.w.localStorage.getItem(SAVE_KEY),h.main);h.handle('export');assert.equal(h.downloads[0].content.originalRuntimeObserved,false);assert.equal(h.downloads[0].content.registry.entries[FLOAT].state.completed.length,1);
 });
});
test('per-guide context, payload, subscriptions and progress survive selection and reload',async()=>{
 let raw;
 await harness(h=>{
  setupFloat(h);h.handle('source-event');const before=h.stored().entries[FLOAT];h.handle('select',OTHER);assert.deepEqual(JSON.parse(h.find('[data-catalog-context]').value),{mode:'research'});h.set('[data-catalog-context]','{"mode":"research","otherStrong":false}');h.set('[data-catalog-payload]','{"sample":9}');h.handle('save-draft');
  h.handle('select',FLOAT);const after=h.stored().entries[FLOAT];assert.deepEqual(after,before);assert.equal(h.find('[data-catalog-payload]').value,JSON.stringify({name:'FloatRaceMainWindow'}));assert.equal(h.find('[data-catalog-action="mask-click"]').disabled,false);
  raw=h.w.localStorage.getItem(KEY);
 });
 await harness(h=>{assert.equal(h.find('[data-catalog-select]').value,FLOAT);assert.equal(h.find('[data-catalog-action="mask-click"]').disabled,false);h.handle('resume');const s=h.stored().entries[FLOAT].state;assert.deepEqual(s.registeredFinished,[FLOAT]);assert.deepEqual(s.completed,[]);assert.equal(s.mask,null);h.handle('select',OTHER);assert.equal(h.find('[data-catalog-context]').value,'{"mode":"research","otherStrong":false}');assert.equal(h.find('[data-catalog-payload]').value,'{"sample":9}');},{raw});
});
test('missing context remains unknown and malformed context/payload preserve semantic progress and drafts',async()=>{
 await harness(h=>{
  h.handle('select',FLOAT);h.handle('start');h.set('[data-catalog-event]','OpenView');h.set('[data-catalog-payload]','{"name":"FloatRaceMainWindow"}');h.handle('source-event');let row=h.stored().entries[FLOAT];assert.equal(row.state.status,'unknown');assert.equal(row.state.registeredFinished.length,0);
  const semantic=JSON.stringify(row.state);h.set('[data-catalog-context]','{oops');h.handle('start');row=h.stored().entries[FLOAT];assert.equal(row.contextJSON,'{oops');assert.equal(JSON.stringify(row.state),semantic);assert.match(h.find('[data-catalog-status]').textContent,/조건 JSON/);
  h.set('[data-catalog-context]',JSON.stringify(ctx));h.set('[data-catalog-payload]','[');h.handle('source-event');assert.equal(h.stored().entries[FLOAT].payloadJSON,'[');assert.equal(JSON.stringify(h.stored().entries[FLOAT].state),semantic);assert.match(h.find('[data-catalog-status]').textContent,/payload JSON/);
  h.set('[data-catalog-context]','{"mode":"research","facts":{"__proto__":{"evil":true}}}');h.handle('start');assert.match(h.find('[data-catalog-status]').textContent,/조건 JSON/);assert.equal(JSON.stringify(h.stored().entries[FLOAT].state),semantic);
 });
});
test('defined corrupt raw is untouched, exportable exactly, and reset requires a successful raw backup',async()=>{
 const raw='{"schema":1,"revision":"stale","entries":';
 await harness(h=>{
  assert.match(h.w.document.body.textContent,/원본 독립 저장을 자동 교체하지 않습니다/);h.handle('start');assert.equal(h.w.localStorage.getItem(KEY),raw);h.handle('export');assert.equal(h.downloads[0].content,raw);
  h.handle('reset-all');assert.equal(h.w.localStorage.getItem(KEY+'-previous'),raw);assert.equal(h.stored().revision,catalog.revision);assert.equal(h.w.localStorage.getItem(SAVE_KEY),h.main);assert.equal(h.find('[data-catalog-select]').disabled,false);
 },{raw});
 await harness(h=>{h.handle('reset-all');assert.equal(h.w.localStorage.getItem(KEY),raw);assert.match(h.find('[data-catalog-status]').textContent,/백업하지 못해 초기화를 중단/);},{raw,storageWrapper:store=>({getItem:k=>store.getItem(k),setItem(){throw Error('quota');}})});
});
test('a registry containing a defined corrupt guide field is preserved rather than silently resetting that guide',async()=>{
 let raw;await harness(h=>{h.handle('select',FLOAT);raw=h.w.localStorage.getItem(KEY);});const registry=JSON.parse(raw);registry.entries[FLOAT].state.pending=[{id:'bad',handler:'not-real',dueAt:0,locals:{},repeatSeconds:null}];raw=JSON.stringify(registry);
 await harness(h=>{assert.equal(h.find('[data-catalog-select]').disabled,true);h.handle('select',OTHER);assert.equal(h.w.localStorage.getItem(KEY),raw);h.handle('export');assert.equal(h.downloads[0].content,raw);},{raw});
});
test('oversized drafts are not truncated or applied and feedback preserves the textarea for correction',async()=>{
 await harness(h=>{
  h.handle('select',FLOAT);const before=h.w.localStorage.getItem(KEY);const oversized='x'.repeat(32769);h.set('[data-catalog-context]',oversized);h.handle('start');assert.equal(h.w.localStorage.getItem(KEY),before);assert.equal(h.find('[data-catalog-context]').value,oversized);assert.match(h.find('[data-catalog-status]').textContent,/32KiB/);assert.equal(h.w.document.activeElement.hasAttribute('data-catalog-status'),true);
 });
});
test('constructor tolerates unavailable localStorage getter and missing data without throwing',()=>{
 const prior=globalThis.window;try{
  globalThis.window={get localStorage(){throw Error('SecurityError');}};
  let data=null;const w=createTutorialCatalogWorkbench({getData:()=>data,render(){},download(){}});assert.match(w.renderPage(),/불러오고/);data={tutorialCatalogConfig:catalog};assert.doesNotThrow(()=>w.renderPage());assert.match(w.renderPage(),/저장소에 접근할 수 없어/);
 }finally{globalThis.window=prior;}
});

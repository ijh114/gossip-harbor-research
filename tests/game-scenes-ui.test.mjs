import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {SAVE_KEY} from '../src/session-store.mjs';

test('application buttons connect game scenes, dialog focus, spatial preview, tap-merge and backed-up restart',async()=>{
 const dom=new JSDOM(await readFile(new URL('../src/index.html',import.meta.url),'utf8'),{url:'https://example.test/project/#experience',pretendToBeVisual:true}),w=dom.window,errors=[];
 w.addEventListener('error',ev=>{errors.push(ev.error?.message||ev.message);ev.preventDefault();});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.matchMedia=query=>({matches:query.includes('prefers-reduced-motion'),addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.Audio=class{play(){return Promise.resolve();}pause(){}};
 const prior={};for(const key of ['window','document','location','history','matchMedia','fetch'])prior[key]=globalThis[key];
 Object.assign(globalThis,{window:w,document:w.document,location:w.location,history:w.history,matchMedia:w.matchMedia,fetch:async relative=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../src/'+relative.replace(/^\.\//,''),import.meta.url),'utf8'))})});
 const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
 const until=async fn=>{const deadline=Date.now()+10000;while(Date.now()<deadline){if(fn())return;await tick();}throw new Error('Scene did not settle: '+errors.join(' / '));};
 const click=selector=>{const node=w.document.querySelector(selector);assert.ok(node,selector);assert.equal(node.disabled,false,selector);node.click();};
 const screen=()=>w.document.querySelector('[data-game-screen]')?.dataset.gameScreen;
 const saved=()=>JSON.parse(w.localStorage.getItem(SAVE_KEY)).state;
 try{
  await import('../src/app.js');await until(()=>screen()==='title');
  click('.game-entry [data-play=new-game]');assert.equal(screen(),'opening');
  click('[data-play=game-opening-next]');click('[data-play=game-opening-next]');assert.equal(screen(),'map');
  click('[data-play=game-task-list]');assert.ok(w.document.querySelector('#game-task-list').open);
  w.document.querySelector('#game-task-list').dispatchEvent(new w.Event('cancel',{cancelable:true}));
  assert.equal(w.document.activeElement.dataset.play,'game-task-list');
  click('[data-play=game-space-open]');click('[data-play=game-space-select][data-value=furniture]');
  assert.equal(w.document.activeElement.dataset.value,'furniture');click('[data-play=game-space-build]');
  await until(()=>screen()==='space-choice'&&saved().screenFlow.spaceAfter);click('[data-play=game-space-close]');assert.equal(screen(),'map');
  click('.game-map-nav [data-play=main]');assert.equal(screen(),'board');
  click('[data-play=game-cell][data-value="22"]');click('[data-play=game-cell][data-value="29"]');assert.equal(saved().tutorialStep,1);
  click('[data-play=game-title]');assert.equal(screen(),'title');click('[data-play=game-new-prompt]');assert.ok(w.document.querySelector('#game-new-dialog').open);
  click('[data-play=game-new-cancel]');assert.equal(w.document.activeElement.dataset.play,'game-new-prompt');assert.equal(saved().tutorialStep,1);
  click('[data-play=game-new-prompt]');click('#game-new-dialog [data-play=new-game]');assert.equal(screen(),'opening');
  assert.equal(JSON.parse(w.localStorage.getItem(SAVE_KEY+'-previous')).state.tutorialStep,1);assert.equal(saved().tutorialStep,0);
  click('[data-play-mode=activities]');click('[data-activity=start]');
  for(let i=0;i<3;i++)click('[data-activity=research-progress]');
  click('[data-activity=claim-pass][data-value="1:free"]');assert.equal(saved().activityPlay.ledger.energy,5);
  assert.equal(w.document.querySelector('[data-activity=claim-pass][data-value="1:free"]').disabled,true);
  click('[data-activity=tab][data-value=album]');
  for(let i=1;i<=3;i++){w.document.querySelector('[data-activity-card]').value='research-card-'+i;click('[data-activity=open-pack]');}
  assert.equal(saved().activityPlay.album.albumClaimed,true);assert.equal(saved().wallet.coins,0);
  click('[data-activity=tab][data-value=event]');assert.equal(w.document.querySelectorAll('.activity-cell').length,72);
  click('[data-activity=event-pop]');click('[data-activity=event-pop]');
  for(const [from,to]of [[67,66],[66,60],[60,23],[23,8],[68,62],[62,56]]){
   const selected=w.document.querySelector('.activity-cell[aria-pressed=true]');if(selected&&Number(selected.dataset.value)!==from)selected.click();
   if(!w.document.querySelector(`.activity-cell[aria-pressed=true][data-value="${from}"]`))click(`[data-activity=event-cell][data-value="${from}"]`);
   click(`[data-activity=event-cell][data-value="${to}"]`);
  }
  click('[data-activity=event-claim]');assert.equal(saved().activityPlay.event.goalClaimed,true);assert.equal(saved().wallet.coins,0);
  w.location.hash='#scene-analysis?task=1_4';await until(()=>w.document.querySelector('[data-scene-select]'));
  assert.equal(w.document.querySelectorAll('.scene-variant-grid img').length,3);
  w.document.querySelector('[data-scene-select]').value='intro_timeline';w.document.querySelector('[data-scene-select]').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.match(w.document.querySelector('#app-view').textContent,/CG의 정적 레이어/);
  const mainSave=w.localStorage.getItem(SAVE_KEY);w.location.hash='#tutorial-analysis';await until(()=>w.document.querySelector('[data-tutorial-context]'));
  click('[data-tutorial-action=preset]');click('[data-tutorial-action=event][data-value="0"]');click('[data-tutorial-action=event][data-value="1"]');click('[data-tutorial-action=event][data-value="2"]');click('[data-tutorial-action=event][data-value="2"]');
  assert.match(w.document.querySelector('.tutorial-state').textContent,/안내 흐름 완료완료/);assert.equal(w.localStorage.getItem(SAVE_KEY),mainSave);assert.equal(w.document.querySelector('.research-tree').classList.contains('active-tree'),true);
  assert.deepEqual(errors,[]);
 }finally{w.dispatchEvent(new w.Event('pagehide'));dom.window.close();Object.assign(globalThis,prior);}
});

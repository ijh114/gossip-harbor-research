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
  assert.deepEqual(errors,[]);
 }finally{w.dispatchEvent(new w.Event('pagehide'));dom.window.close();Object.assign(globalThis,prior);}
});

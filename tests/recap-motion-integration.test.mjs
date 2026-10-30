import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createStoryRecap,storyRecapAction} from '../src/story-recap.mjs';
import {renderStoryRecap} from '../src/story-recap-page.mjs';
import {createPlay,validPlay} from '../src/play-model.mjs';
import {createPlayController} from '../src/play-controller.mjs';
import {beginTaskScene} from '../src/screen-flow.mjs';
import {playSceneCastOptions} from '../src/game-scenes.mjs';
import {sceneSteps} from '../src/scene-script.mjs';
import {encodeSave,SAVE_KEY} from '../src/session-store.mjs';
const load=async name=>JSON.parse(await readFile(new URL('../src/data/'+name+'.json',import.meta.url),'utf8'));
const [recap,motions,scenes,play]=await Promise.all(['story-recap','recap-motion-study','scene-config','play-config'].map(load));
const context={serverEnabled:true,currentTask:null};
function opened(){const s=createStoryRecap(recap);for(const action of [{type:'configure',inputs:{schema:1,serverEnabled:true,taskMode:'research',taskOverride:null}},{type:'open-shelf'},{type:'open-book',book:1}])assert.equal(storyRecapAction(s,action,context,recap).ok,true);return s;}
function markup(state,visual=null){return new JSDOM(renderStoryRecap({storyRecap:state,board:[]},{storyRecapConfig:recap,sceneConfig:scenes,recapMotionStudy:motions,recapVisual:visual},{mainTask:null,serverEnabled:true}));}

test('newly opened books show the manual source gallery without inventing an automatic nextPage motion',()=>{
 const s=opened(),before=JSON.stringify(s),dom=markup(s);try{assert.equal(dom.window.document.querySelector('.recap-motion-slot'),null);assert.equal(dom.window.document.querySelectorAll('.recap-source-motion-gallery video').length,6);assert.equal(JSON.stringify(s),before);}finally{dom.window.close();}
});

test('a restored previous transition keeps its logical direction and lock without a fabricated automatic next-page visual',()=>{
 const s=opened();storyRecapAction(s,{type:'next'},context,recap);storyRecapAction(s,{type:'advance',seconds:.25},context,recap);storyRecapAction(s,{type:'previous'},context,recap);storyRecapAction(s,{type:'advance',seconds:.1},context,recap);
 const restored=JSON.parse(JSON.stringify(s)),before=JSON.stringify(restored),dom=markup(restored);try{assert.equal(restored.transition.direction,'previous');assert.equal(dom.window.document.querySelector('.recap-motion-slot'),null);assert.equal(dom.window.document.querySelector('[data-play="recap:close-book"]').disabled,true);assert.match(dom.window.document.body.textContent,/저장된 잔여시간/);assert.equal(JSON.stringify(restored),before);}finally{dom.window.close();}
 const active=markup(restored,{action:'lastPage',startedAt:Date.now()});try{assert.equal(active.window.document.querySelector('.recap-motion-slot video').dataset.recapMotion,'lastPage');}finally{active.window.close();}
});

test('pending task casts use the real selected source cursor and do not pass a global clock as a clip clock',()=>{
 const q=play.quests[0],scene=scenes.tasks.find(s=>s.id===q.id),s=createPlay(play);s.stage='home';s.pendingQuest={id:q.id};s.questsDone=0;assert.equal(beginTaskScene(s,play),true);
 const index=sceneSteps(scene).findIndex(s=>s.kind==='dialogue');assert.ok(index>=0);s.screenFlow.task.script={sceneId:scene.id,index,choices:{}};
 const options=playSceneCastOptions(s,play,{sceneConfig:scenes}),step=sceneSteps(scene)[index];assert.equal(options.scene,scene.id);assert.equal(options.order,step.order);assert.equal(options.speaker,step.line.speaker);for(const key of ['clock','time','playing'])assert.equal(Object.hasOwn(options,key),false);
 s.screenFlow.phase='task-building';assert.equal(playSceneCastOptions(s,play,{sceneConfig:scenes}),null);s.pendingQuest=null;assert.equal(playSceneCastOptions(s,play,{sceneConfig:scenes}),null);
});

test('hiding or leaving the active reader cancels only automatic media while the quarter-second logical turn resumes',t=>{
 const dom=new JSDOM('<div id="app-view"></div>',{url:'https://example.test/#experience?mode=game'}),w=dom.window,prior={window:globalThis.window,document:globalThis.document,location:globalThis.location},originalNow=Date.now;
 Object.assign(globalThis,{window:w,document:w.document,location:w.location});let now=1000000,nextId=0,hidden=false,pauses=0;Date.now=()=>now;Object.defineProperty(w.document,'hidden',{get:()=>hidden,configurable:true});
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLMediaElement.prototype.pause=function(){pauses++;};w.HTMLMediaElement.prototype.play=function(){return Promise.resolve();};w.HTMLMediaElement.prototype.load=function(){};
 const timers=new Map();w.setTimeout=(fn,delay=0)=>{const id=++nextId;timers.set(id,{fn,at:now+Math.max(1,delay),once:true});return id;};w.setInterval=(fn,delay=0)=>{const id=++nextId;timers.set(id,{fn,at:now+Math.max(1,delay),delay:Math.max(1,delay)});return id;};w.clearTimeout=w.clearInterval=id=>timers.delete(id);
 const advance=ms=>{const end=now+ms;for(let guard=0;guard<10000;guard++){const due=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;const[id,timer]=due;now=timer.at;if(timer.once)timers.delete(id);else timer.at+=timer.delay;timer.fn();}now=end;};
 let controller;const root=w.document.getElementById('app-view'),data={playConfig:play,storyRecapConfig:recap,recapMotionStudy:motions,sceneConfig:scenes};
 const mount=()=>{controller.beforeRender();root.innerHTML=controller.render('game');controller.afterMount();};
 t.after(()=>{controller?.beforeRender();timers.clear();Date.now=originalNow;dom.window.close();Object.assign(globalThis,prior);});
 const s=createPlay(play);s.stage='home';s.storyRecap=opened();s.screenFlow={schema:1,phase:'recap'};assert.equal(validPlay(s,play),true);
 const encoded=encodeSave(s,{revision:play.revision,now,validate:v=>validPlay(v,play)});assert.equal(encoded.ok,true);w.localStorage.setItem(SAVE_KEY,encoded.raw);
 controller=createPlayController({getData:()=>data,render:mount,download(){}});mount();advance(350);controller.handle('game-continue');assert.ok(root.querySelector('[data-game-screen="recap"]'));
 controller.handle('recap:next');assert.equal(root.querySelector('.recap-motion-slot video').dataset.recapMotion,'nextPage');advance(50);hidden=true;w.document.dispatchEvent(new w.Event('visibilitychange'));assert.ok(pauses>0);advance(10000);
 hidden=false;w.document.dispatchEvent(new w.Event('visibilitychange'));advance(75);assert.equal(root.querySelector('.recap-motion-slot'),null);assert.equal(root.querySelector('[data-play="recap:close-book"]').disabled,true);advance(150);assert.equal(root.querySelector('[data-play="recap:close-book"]').disabled,false);
 const saved=JSON.parse(w.localStorage.getItem(SAVE_KEY)).state;assert.ok(saved.storyRecap.clock<1);assert.equal(Object.hasOwn(saved,'recapVisual'),false);
 controller.handle('recap:previous');assert.equal(root.querySelector('.recap-motion-slot video').dataset.recapMotion,'lastPage');w.location.hash='#collection';controller.beforeRender();advance(1000);w.location.hash='#experience?mode=game';mount();assert.equal(root.querySelector('.recap-motion-slot'),null);assert.equal(root.querySelector('[data-play="recap:close-book"]').disabled,true);
});

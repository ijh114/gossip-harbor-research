import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createPlay,playAction,validPlay} from '../src/play-model.mjs';
import {createPlayController} from '../src/play-controller.mjs';
import {writeSession,SAVE_KEY} from '../src/session-store.mjs';
import {screenFlow,soundForAction} from '../src/screen-flow.mjs';
const config=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
const refinement=JSON.parse(await readFile(new URL('../src/data/media-refinement.json',import.meta.url),'utf8'));
const media=JSON.parse(await readFile(new URL('../src/data/media.json',import.meta.url),'utf8'));
const sceneConfig=JSON.parse(await readFile(new URL('../src/data/scene-config.json',import.meta.url),'utf8'));
const activityConfig=JSON.parse(await readFile(new URL('../src/data/activity-play.json',import.meta.url),'utf8'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function harness(run,{saved=null,raw=null,reduced=true,scenes=false,activities=false}={}){
 const dom=new JSDOM('<main></main>',{url:'https://example.test/project/#experience',pretendToBeVisual:true}),w=dom.window,prior={window:globalThis.window,document:globalThis.document};
 Object.assign(globalThis,{window:w,document:w.document});
 w.matchMedia=()=>({matches:reduced});w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const played=[];w.Audio=class{constructor(src){this.src=src;}play(){played.push(this.src);return Promise.resolve();}pause(){}};
 if(saved)writeSession(w.localStorage,saved,{revision:config.revision,now:Date.now(),validate:x=>validPlay(x,config)});
 if(raw)w.localStorage.setItem(SAVE_KEY,raw);
 let controller,skin='game';
 function render(){controller.beforeRender();w.document.querySelector('main').innerHTML=controller.render(skin);controller.afterMount();}
 const create=()=>{controller=createPlayController({getData:()=>({playConfig:config,media,refinement,...(scenes?{sceneConfig}:{}),...(activities?{activityConfig}:{})}),render,download(){}});return controller;};
 create();render();
 const read=()=>JSON.parse(w.localStorage.getItem(SAVE_KEY)).state;
 const act=(action,value)=>controller.handle(action,value);
 const screen=()=>w.document.querySelector('[data-game-screen]')?.dataset.gameScreen;
 try{await run({w,act,read,screen,played,render,showMode(mode){skin=mode;render();},recreate(){controller.beforeRender();create();render();}});}
 finally{controller.beforeRender();w.close();Object.assign(globalThis,prior);}
}

test('new player follows loading → title → two opening pages → map → actual tutorial board and first order without aids',async()=>harness(async({w,act,read,screen,played})=>{
 assert.ok(w.document.querySelector('.game-loading'));await pause(380);assert.equal(screen(),'title');
 act('new-game');assert.equal(screen(),'opening');assert.equal(read().wallet.coins,0);
 act('generate');assert.equal(read().wallet.energy,100);assert.equal(screen(),'opening');
 act('game-opening-next');assert.match(w.document.querySelector('.game-dialogue').textContent,/合|합성/);
 act('game-opening-next');assert.equal(screen(),'map');assert.equal(read().stage,'home');
 assert.equal(w.document.querySelector('[data-play="quest-start"]').disabled,true);
 act('main');assert.equal(screen(),'board');assert.equal(w.document.querySelectorAll('.game-cell').length,63);
 for(const [index,step]of config.tutorialSteps.entries()){if(step.kind==='generate')act('game-cell',step.index);else act('move',`${step.from},${step.to}`);assert.equal(read().tutorialStep,index+1,JSON.stringify({step,message:read().message,selected:read().selected}));}
 act('deliver');assert.equal(read().wallet.coins,2,JSON.stringify({message:read().message,step:read().tutorialStep,onboarding:read().onboarding}));assert.equal(read().wallet.orders,1);assert.equal(read().wallet.energy,97);
 act('home');assert.equal(screen(),'board');assert.match(read().message,/튜토리얼/);assert.equal(read().pendingQuest,null);
 assert.equal(played.length,0);assert.equal(validPlay(read(),config),true);
}));

test('quest scene can be held and resumed, commits only once, restores reward after reload and returns to map/board',async()=>{
 const saved=createPlay(config);saved.stage='home';saved.wallet.coins=config.quests[0].cost;
 await harness(async({w,act,read,screen,recreate})=>{
  await pause(380);act('game-continue');assert.equal(screen(),'map');
  act('quest-start');assert.equal(screen(),'task-story');assert.equal(w.document.querySelector('.game-hud'),null);assert.equal(read().wallet.coins,26);
  act('main');assert.equal(screen(),'task-story');assert.equal(read().stage,'home');
  act('game-task-hold');assert.equal(screen(),'map');assert.equal(read().pendingQuest.id,'1_1');
  act('game-task-resume');act('game-task-build');await pause(25);assert.equal(screen(),'task-reward');
  assert.equal(read().questsDone,1);assert.equal(read().wallet.coins,0);assert.equal(read().xp,15);
  act('game-task-finish');assert.equal(read().questsDone,1);assert.equal(read().xp,15);
  recreate();await pause(380);assert.equal(screen(),'title');act('game-continue');assert.equal(screen(),'task-reward');
  act('game-task-close');assert.equal(screen(),'map');assert.ok(w.document.querySelector('.game-hud'));
  act('main');assert.equal(screen(),'board');assert.equal(validPlay(read(),config),true);
 },{saved});
});

test('leaving an in-flight task for title cancels its timer; continuing safely finishes it without lost or duplicate rewards',async()=>{
 const saved=createPlay(config);saved.stage='home';saved.wallet.coins=26;
 await harness(async({act,read,screen})=>{
  await pause(380);act('game-continue');act('quest-start');act('game-task-build');act('game-title');
  await pause(880);assert.equal(screen(),'title');assert.equal(read().questsDone,0);assert.equal(read().wallet.coins,26);
  act('game-continue');await pause(880);assert.equal(screen(),'task-reward');assert.equal(read().questsDone,1);assert.equal(read().wallet.coins,0);
 },{saved,reduced:false});
});

test('three reference spaces preview and persist changes independently of quest progression, gold, XP and board',async()=>{
 const saved=createPlay(config);saved.stage='home';
 await harness(async({w,act,read,screen})=>{
  await pause(380);act('game-continue');const before=read();act('game-space-open');assert.equal(screen(),'space-choice');
  act('game-space-select','flowers');assert.equal(w.document.querySelectorAll('.game-space-options button').length,3);
  act('game-space-build');await pause(25);assert.equal(read().screenFlow.spaceAfter,true);assert.equal(screen(),'space-choice');
  act('game-space-close');assert.equal(screen(),'map');const after=read();assert.deepEqual(after.board,before.board);assert.equal(after.wallet.coins,before.wallet.coins);assert.equal(after.xp,before.xp);assert.equal(after.questsDone,before.questsDone);
  assert.match(w.document.querySelector('.game-scene-source').textContent,/과제 대응 미확인/);
  act('game-task-list');assert.ok(w.document.querySelector('#game-task-list').open);act('game-task-list-close');
 },{saved});
});

test('sound is opt-in, preserved across new game, and does not turn on or play during restoration',async()=>harness(async({act,played,read,recreate,screen})=>{
 await pause(380);assert.equal(played.length,0);act('game-sound');assert.equal(played.length,1);
 act('new-game');assert.equal(read().screenFlow.sound,true);act('game-opening-next');assert.equal(played.length,2);
 recreate();await pause(380);assert.equal(screen(),'title');assert.equal(played.length,2);act('game-sound');assert.equal(read().screenFlow.sound,false);
}));

test('old or malformed optional presentation state cannot alter domain state or manufacture a committed reward',()=>{
 const s=createPlay(config);s.stage='home';s.screenFlow={schema:1,phase:'task-reward',task:{index:0,id:'1_1'},space:'../../other',sound:'true'};
 const board=structuredClone(s.board);const f=screenFlow(s,config);assert.equal(f.phase,'map');assert.equal(f.sound,false);assert.equal(f.space,'garden');assert.equal(s.questsDone,0);assert.deepEqual(s.board,board);assert.equal(validPlay(s,config),true);
});

test('merging other levels never borrows the verified level4 sound and failed actions emit no success sound',()=>{
 const after=createPlay(config),before={coins:0,uids:new Set(after.board.filter(Boolean).map(x=>x.uid))};
 assert.equal(soundForAction('deliver',before,after,{ok:false},config),null);
 assert.equal(soundForAction('aid-coins',before,after,{ok:true},config),null);
 after.board[0]={uid:99999,type:'202',cover:null};assert.equal(soundForAction('move',before,after,{ok:true},config),null);
 after.board[0].type='204';assert.equal(soundForAction('move',before,after,{ok:true},config),'merge-level-4');
});

test('source-backed scene requires its real choice, resumes the selected step and commits the chosen physical slot once',async()=>{
 const saved=createPlay(config);saved.stage='home';saved.wallet.coins=26;
 await harness(async({w,act,read,screen})=>{
  await pause(380);act('game-continue');act('quest-start');act('game-task-build');assert.equal(screen(),'task-story');assert.equal(read().wallet.coins,26);
  for(let i=0;i<30&&!w.document.querySelector('[data-play=game-scene-choice]');i++)act('game-scene-next');
  assert.ok(w.document.querySelector('[data-play=game-scene-choice]'));act('game-scene-choice','2');
  const script=structuredClone(read().screenFlow.task.script);act('game-task-hold');act('game-task-resume');assert.deepEqual(read().screenFlow.task.script,script);
  for(let i=0;i<30&&!w.document.querySelector('[data-play=game-task-build]');i++)act('game-scene-next');
  act('game-task-build');await pause(25);assert.equal(screen(),'task-reward');assert.equal(read().wallet.coins,0);assert.equal(read().screenFlow.decor['1_1'],'2');
  act('game-task-close');act('game-decor-open');assert.equal(screen(),'decor');assert.ok(w.document.querySelector('img[alt*="技术"],img[alt*="기술"]'));assert.equal(read().questsDone,1);
 },{saved,scenes:true});
});

test('real successful main-board orders advance the opt-in research pass while separate activity clocks keep updating',async()=>{
 const saved=createPlay(config,{scenario:'initial',guide:true});playAction(saved,'start',null,config);
 await harness(async({w,act,read,showMode})=>{
  await pause(380);showMode('activities');act('activity:start');const first=w.document.querySelector('[data-activity-clock]').textContent;
  await pause(1100);assert.notEqual(w.document.querySelector('[data-activity-clock]').textContent,first);
  showMode('game');act('game-continue');for(const step of config.tutorialSteps){if(step.kind==='generate')act('game-cell',step.index);else act('move',`${step.from},${step.to}`);}act('deliver');
  assert.equal(read().wallet.orders,1);assert.equal(read().activityPlay.pass.taskProgress,1);assert.deepEqual(read().activityPlay.ledger,{energy:0,gold:0,gem:0});
 },{saved,activities:true});
});

test('defined invalid optional activity saves are preserved until a backed-up activity-only reset',async()=>{
 const saved=createPlay(config);saved.stage='play';saved.activityPlay=null;saved.wallet.coins=27;
 await harness(async({w,act,read,showMode})=>{
  showMode('activities');assert.match(w.document.body.textContent,/활동 저장을 보존/);act('save');assert.equal(read().activityPlay,null);
  act('activity:reset-invalid');assert.equal(read().activityPlay.schema,1);assert.equal(read().wallet.coins,27);assert.equal(JSON.parse(w.localStorage.getItem(SAVE_KEY+'-previous')).state.activityPlay,null);
 },{saved,activities:true});
});

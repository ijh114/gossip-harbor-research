import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createPlay,playAction,validPlay} from '../src/play-model.mjs';
import {createPlayController} from '../src/play-controller.mjs';
import {createActivitySeason,activitySeasonAction} from '../src/activity-season.mjs';
import {createActivityLinkInputs} from '../src/activity-transaction.mjs';
import {createStoryRecap} from '../src/story-recap.mjs';
import {configureFactoryTransaction} from '../src/factory-transaction.mjs';
import {writeSession,SAVE_KEY} from '../src/session-store.mjs';
import {screenFlow,soundForAction} from '../src/screen-flow.mjs';
const config=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
const refinement=JSON.parse(await readFile(new URL('../src/data/media-refinement.json',import.meta.url),'utf8'));
const media=JSON.parse(await readFile(new URL('../src/data/media.json',import.meta.url),'utf8'));
const sceneConfig=JSON.parse(await readFile(new URL('../src/data/scene-config.json',import.meta.url),'utf8'));
const activityConfig=JSON.parse(await readFile(new URL('../src/data/activity-play.json',import.meta.url),'utf8'));
const tutorialConfig=JSON.parse(await readFile(new URL('../src/data/tutorial-extension.json',import.meta.url),'utf8'));
const skinConfig=JSON.parse(await readFile(new URL('../src/data/skin-lab.json',import.meta.url),'utf8'));
const tutorialMoreConfig=JSON.parse(await readFile(new URL('../src/data/tutorial-more.json',import.meta.url),'utf8'));
const factoryConfig=JSON.parse(await readFile(new URL('../src/data/factory-play.json',import.meta.url),'utf8'));
const tutorialCatalogConfig=JSON.parse(await readFile(new URL('../src/data/tutorial-catalog.json',import.meta.url),'utf8'));
const storyRecapConfig=JSON.parse(await readFile(new URL('../src/data/story-recap.json',import.meta.url),'utf8'));
const seasonConfig=JSON.parse(await readFile(new URL('../src/data/activity-season.json',import.meta.url),'utf8'));
const presentationAssets=JSON.parse(await readFile(new URL('../src/data/presentation-assets.json',import.meta.url),'utf8'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForState(predicate,label){const deadline=Date.now()+6000;while(!predicate()&&Date.now()<deadline)await pause(25);assert.ok(predicate(),label);}
async function harness(run,{saved=null,raw=null,reduced=true,scenes=false,activities=false,tutorials=false,skins=false,more=false,factory=false,recap=false,runtime=false,season=false,presentation=false}={}){
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
 const create=()=>{controller=createPlayController({getData:()=>({playConfig:config,media,refinement,...(scenes?{sceneConfig}:{}),...((activities||season)?{activityConfig}:{}),...(season?{activitySeasonConfig:seasonConfig}:{}),...(presentation?{presentationAssets}:{}),...(tutorials?{tutorialConfig}:{}),...(skins?{skinConfig}:{}),...(more?{tutorialMoreConfig}:{}),...(factory?{factoryConfig}:{}),...(recap?{storyRecapConfig}:{}),...(runtime?{tutorialCatalogConfig}:{})}),render,download(){}});return controller;};
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
 await harness(async({w,act,read,screen,recreate})=>{
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
 await harness(async({w,act,read,screen,recreate})=>{
  await pause(380);act('game-continue');act('quest-start');act('game-task-build');assert.equal(screen(),'task-story');assert.equal(read().wallet.coins,26);
  for(let i=0;i<30&&!w.document.querySelector('[data-play=game-scene-choice]');i++)act('game-scene-next');
  assert.ok(w.document.querySelector('[data-play=game-scene-choice]'));act('game-scene-choice','2');
  const script=structuredClone(read().screenFlow.task.script);act('game-task-hold');act('game-task-resume');assert.deepEqual(read().screenFlow.task.script,script);
  for(let i=0;i<30&&!w.document.querySelector('[data-play=game-task-build]');i++)act('game-scene-next');
  act('game-task-build');await pause(25);assert.equal(screen(),'task-reward');assert.equal(read().wallet.coins,0);assert.equal(read().screenFlow.decor['1_1'],'2');
  act('game-task-close');act('game-decor-open');assert.equal(screen(),'decor');assert.ok(w.document.querySelector('img[alt*="技术"],img[alt*="기술"]'));assert.equal(read().questsDone,1);
  act('game-decor-edit','1_1');assert.equal(screen(),'decor-edit');act('game-decor-preview','3');assert.equal(read().screenFlow.decor['1_1'],'2');
  recreate();await pause(380);act('game-continue');assert.equal(screen(),'decor-edit');assert.equal(read().screenFlow.decorEdit.selected,'3');
  act('game-decor-cancel');assert.equal(read().screenFlow.decor['1_1'],'2');act('game-decor-edit','1_1');act('game-decor-preview','1');act('game-decor-confirm');assert.equal(read().screenFlow.decor['1_1'],'1');assert.equal(read().wallet.coins,0);assert.equal(read().questsDone,1);
  act('game-decor-close');const plane=w.document.querySelector('.game-map-scene');plane.focus();plane.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(read().screenFlow.view.x,5);assert.equal(w.document.activeElement.className,'game-scene game-map-scene');w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(read().screenFlow.view.x,10);
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

test('linked boost guide consumes successful web boost changes and preserves wallet',async()=>{
 const saved=createPlay(config,{scenario:'open'});saved.stage='play';
 await harness(async({w,act,read})=>{await pause(380);act('game-continue');w.document.querySelector('[data-guide-select]').value='tutorial_event_energyboost_simple';act('guide:configure');assert.equal(read().tutorialBridge.engine.active?.phase,'entry-delay');act('guide:clock');assert.equal(read().tutorialBridge.engine.active?.phase,'click-1');const coins=read().wallet.coins,energy=read().wallet.energy;act('set-boost',1);assert.equal(read().tutorialBridge.engine.active?.phase,'click-2');act('set-boost',2);assert.equal(read().tutorialBridge.engine.completed.length,1);assert.equal(read().wallet.coins,coins);assert.equal(read().wallet.energy,energy);},{saved,tutorials:true});
});
test('linked pass and recap guides follow actual activity entry and native web dialog callbacks',async()=>{
 const saved=createPlay(config);saved.stage='home';
 await harness(async({w,act,read,showMode})=>{await pause(380);act('game-continue');act('guide:configure');showMode('activities');act('activity:start');assert.equal(read().tutorialBridge.engine.active?.phase,'tip-delay');act('guide:clock');act('guide:event','2');act('guide:event','2');assert.equal(read().tutorialBridge.engine.completed.length,1);act('guide:reset');showMode('game');w.document.querySelector('[data-guide-select]').value='tutorial_story_recap';act('guide:configure');act('game-task-list');assert.ok(w.document.querySelector('#game-task-list [data-play="guide:clock"]'));act('guide:clock');act('guide:event','2');assert.equal(read().tutorialBridge.engine.active?.phase,'recap-highlight');act('game-task-list-close');assert.equal(read().tutorialBridge.engine.completed.includes('tutorial_story_recap'),true);assert.equal(read().wallet.coins,0);},{saved,tutorials:true,activities:true});
});
test('Skin research grants drive decoration guide while linked-slot edits restore, cancel and apply without main rewards',async()=>{
 const saved=createPlay(config);saved.stage='home';
 await harness(async({w,act,read,recreate,screen})=>{await pause(380);act('game-continue');w.document.querySelector('[data-guide-select]').value='tutorial_change_decoration';act('guide:configure');act('game-decor-open');act('game-skins-open');assert.equal(screen(),'skins');act('skin:acquire-set');act('skin:select','14');act('skin:acquire-set');assert.equal(read().tutorialBridge.engine.active?.phase,'dialogue-delay');act('guide:clock');act('guide:event','2');act('guide:clock');act('guide:event','3');assert.equal(read().tutorialBridge.engine.completed.includes('tutorial_change_decoration'),true);act('skin:preview-set');recreate();await pause(380);act('game-continue');assert.equal(screen(),'skins');assert.equal(Object.keys(read().skinLab.edit.preview).length,13);act('skin:cancel');assert.deepEqual(read().skinLab.slots,{});act('skin:preview-set');act('skin:confirm');assert.equal(Object.keys(read().skinLab.slots).length,13);assert.equal(read().wallet.coins,0);assert.equal(read().questsDone,0);},{saved,tutorials:true,skins:true});
});

test('synthetic touch drag interruption removes the ghost and cannot move or merge a piece',async()=>{
 const saved=createPlay(config);saved.stage='play';
 await harness(async({w,act,read})=>{await pause(380);act('game-continue');const before=JSON.stringify(read().board),index=read().board.findIndex(x=>x&&!x.cover),node=w.document.querySelector(`.game-cell[data-value="${index}"]`);w.document.elementFromPoint=()=>node;const pointer=(type,x)=>{const ev=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(ev,{pointerId:3,pointerType:'touch',button:0,clientX:x,clientY:100});node.dispatchEvent(ev);};pointer('pointerdown',10);pointer('pointermove',50);assert.ok(w.document.querySelector('.game-drag-ghost'));pointer('lostpointercapture',50);assert.equal(w.document.querySelector('.game-drag-ghost'),null);pointer('pointerup',50);assert.equal(JSON.stringify(read().board),before);},{saved});
});
test('defined corrupt linked-guide and Skin saves stay intact until an explicit backed-up reset',async()=>{
 const saved=createPlay(config);saved.stage='home';saved.tutorialBridge=null;saved.skinLab=null;saved.wallet.coins=37;
 await harness(async({w,act,read,screen})=>{await pause(380);act('game-continue');assert.match(w.document.body.textContent,/연결 안내 저장을 보존/);act('guide:configure');assert.equal(read().tutorialBridge,null);act('game-decor-open');act('game-skins-open');assert.equal(screen(),'skins');assert.match(w.document.body.textContent,/장식 연구 저장을 보존/);act('game-skins-close');assert.equal(screen(),'map');act('guide:reset-invalid');assert.equal(JSON.parse(w.localStorage.getItem(SAVE_KEY+'-previous')).state.tutorialBridge,null);act('skin:reset-invalid');assert.equal(JSON.parse(w.localStorage.getItem(SAVE_KEY+'-previous')).state.skinLab,null);assert.equal(read().wallet.coins,37);},{saved,tutorials:true,skins:true});
});
test('newer play-linked guide uses actual successful boost actions, blocks unrelated input and follows source restore completion',async()=>{
 const saved=createPlay(config);saved.stage='play';
 await harness(async({w,act,read,recreate})=>{await pause(380);act('game-continue');assert.equal(w.document.querySelector('[data-guide-select]').options.length,10);w.document.querySelector('[data-guide-select]').value='tutorial_energyBoosteight_start';act('guide:configure');act('guide:event','0');assert.equal(read().tutorialBridge.engine.active.phase,'boost-highlight');const generated=read().wallet.generated;act('generate');assert.equal(read().wallet.generated,generated);assert.match(w.document.querySelector('.game-feedback').textContent,/대상 조작/);act('set-boost',1);assert.equal(read().tutorialBridge.engine.completed.includes('tutorial_energyBoosteight_start'),true);act('guide:reset');act('guide:event','0');recreate();await pause(380);assert.equal(read().tutorialBridge.engine.active,null);assert.equal(read().tutorialBridge.engine.completed.includes('tutorial_energyBoosteight_start'),true);},{saved,tutorials:true,more:true});
});
test('factory screen transfers real pieces, converts points, grants one queued generator, restores and returns to the board',async()=>{
 const saved=createPlay(config);saved.stage='play';const indexes=[];for(let i=0;i<2;i++){const index=saved.board.findIndex(x=>x===null);saved.board[index]={uid:saved.nextUid++,type:'103',cover:null};indexes.push(index);}
 await harness(async({w,act,read,recreate,screen})=>{await pause(380);act('game-continue');act('game-factory-open');assert.equal(screen(),'factory');w.document.querySelector('[data-factory-flag]').value='true';w.document.querySelector('[data-factory-assume]').checked=true;act('factory:configure');assert.equal(read().factoryPlay.unlockedLatched,true);const wallet=structuredClone(read().wallet);for(const index of indexes){const uid=read().board[index].uid;act('factory:store',`board:${index}:${uid}`);assert.equal(read().board[index],null);act('factory:add-score','104:103');}assert.equal(w.document.querySelector('[data-factory-lock]').dataset.factoryLock,'true');act('factory:reward','104');assert.equal(read().queue.some(q=>q.type==='104'),false);await waitForState(()=>read().queue.some(q=>q.type==='104'),'factory timer should automatically grant its queued reward');assert.equal(read().queue.find(q=>q.type==='104').count,1);const {time:beforeTime,log:beforeLog,...beforeEconomy}=wallet,{time:afterTime,log:afterLog,...afterEconomy}=read().wallet;assert.deepEqual(afterEconomy,beforeEconomy);assert.ok(afterTime>=beforeTime);recreate();await pause(380);act('game-continue');assert.equal(screen(),'factory');assert.equal(read().factoryPlay.genData['104'].score,0);act('game-factory-close');assert.equal(screen(),'board');},{saved,factory:true});
});

test('recap uses actual task gates, explicit isolated snapshot, source timed page turns and saved rereading',async()=>{
 const saved=createPlay(config);saved.stage='home';const original={wallet:structuredClone(saved.wallet),quests:saved.questsDone,board:structuredClone(saved.board)};
 await harness(async({w,act,read,screen,recreate})=>{await pause(380);act('game-continue');act('recap:inspect');assert.equal(screen(),'recap');assert.match(w.document.querySelector('.story-recap-page').textContent,/미확인/);w.document.querySelector('[data-recap-flag]').value='true';w.document.querySelector('[data-recap-task-mode]').value='research';w.document.querySelector('[data-recap-task]').value='20_11';act('recap:configure');act('recap:open-shelf');assert.equal(w.document.querySelectorAll('[data-play="recap:open-book"]').length,0);w.document.querySelector('[data-recap-task]').value='20_12';act('recap:configure');act('recap:open-shelf');assert.equal(w.document.querySelectorAll('[data-play="recap:open-book"]').length,1);act('recap:open-book','1');assert.deepEqual(read().storyRecap.seen,[1]);act('recap:next');assert.equal(read().storyRecap.page,2);assert.equal(read().storyRecap.displayPage,1);assert.equal(w.document.querySelector('[data-play="recap:next"]').disabled,true);act('aid-coins');assert.equal(read().wallet.coins,original.wallet.coins);await waitForState(()=>read().storyRecap.transition===null,'recap timer should finish its source-declared page turn');assert.equal(read().storyRecap.displayPage,2);assert.equal(read().storyRecap.transition,null);recreate();await pause(380);act('game-continue');assert.equal(screen(),'recap');assert.equal(read().storyRecap.displayPage,2);act('recap:close-book');act('recap:open-book','1');assert.equal(read().storyRecap.page,1);assert.deepEqual(read().storyRecap.seen,[1]);act('recap:close-book');act('recap:close-shelf');assert.equal(screen(),'map');assert.equal(w.document.querySelector('#game-task-list').open,true);assert.equal(read().questsDone,original.quests);assert.deepEqual(read().board,original.board);for(const key of ['energy','gems','coins','level','energyBuys','freeUsed','price','generated','orders'])assert.equal(read().wallet[key],original.wallet[key],key);
 },{saved,recap:true,scenes:true});
});

test('automatic recap responds to the actual task dialog, advances source callback inside modal and opens the real book entry',async()=>{
 const saved=createPlay(config);saved.stage='home';saved.storyRecap=createStoryRecap(storyRecapConfig);saved.storyRecap.inputs={schema:1,serverEnabled:true,taskMode:'research',taskOverride:{day:20,id:12}};
 await harness(async({w,act,read,screen})=>{await pause(380);act('game-continue');assert.ok(w.document.querySelector('.tutorial-runtime'));act('game-task-list');const deadline=Date.now()+6000;while(read().tutorialRuntime.entries.tutorial_story_recap.state.active?.phase!=='dialogue'&&Date.now()<deadline)await pause(100);assert.equal(read().tutorialRuntime.entries.tutorial_story_recap.state.active.phase,'dialogue',JSON.stringify({time:read().tutorialRuntime.time,phase:read().tutorialRuntime.entries.tutorial_story_recap.state.active,diagnostic:read().tutorialRuntime.diagnostics.tutorial_story_recap,core:read().onboarding?.phases,feedback:w.document.querySelector('.game-feedback')?.textContent}));const callback=w.document.querySelector('#game-task-list [data-play="runtime:mask"]');assert.ok(callback,'the real modal must contain an accessible source mask callback');act('runtime:mask',callback.dataset.value);assert.equal(read().tutorialRuntime.entries.tutorial_story_recap.state.active.phase,'recap-highlight');const entry=w.document.querySelector('#game-task-list [data-play="recap:open-shelf"]');assert.ok(entry);assert.equal(entry.disabled,false);act('recap:open-shelf');assert.equal(screen(),'recap');assert.ok(read().tutorialRuntime.completed.includes('tutorial_story_recap'));assert.equal(read().wallet.coins,0);assert.equal(read().questsDone,0);act('runtime:disable');assert.equal(read().tutorialRuntime.enabled,false);
 },{saved,recap:true,runtime:true,tutorials:true,more:true});
});

test('the highlighted factory part taps into storage and the masked inventory tap only finishes its source guide',async()=>{
 let saved=createPlay(config);saved.stage='play';saved.wallet.level=2;const index=saved.board.findIndex(x=>x===null);saved.board[index]={uid:saved.nextUid++,type:'103',cover:null};const configured=configureFactoryTransaction(saved,{schema:1,mode:'research',serverEnabled:true,unlockMode:'assumed'},factoryConfig,{playConfig:config});assert.equal(configured.ok,true);saved=configured.state;
 await harness(async({w,act,read,screen})=>{await pause(380);act('game-continue');w.document.querySelector('[data-guide-select]').value='tutorial_generator_factory_Acquire';act('guide:configure');act('guide:factory-poll');act('guide:clock');const target=read().tutorialBridge.engine.active.target,selected=read().board.findIndex(c=>String(c?.uid)===target.uid);assert.ok(selected>=0);assert.ok(w.document.querySelector('.game-cell[data-value="'+selected+'"]').classList.contains('tutorial-linked-target'));const uid=read().board[selected].uid;act('game-cell',String(selected));assert.equal(read().board.some(c=>c?.uid===uid),false);assert.equal(read().tutorialBridge.engine.active.phase,'inventory-highlight');act('inventory');assert.ok(read().tutorialBridge.engine.completed.includes('tutorial_generator_factory_Acquire'));assert.equal(read().modal,null,'clipRectClickable=false consumes this click for mask completion');act('inventory');assert.equal(read().modal,'inventory');assert.equal(screen(),'board');
 },{saved,factory:true,tutorials:true});
});

test('source intro survives title and reload, resumes the same command and skips without changing the domain',async()=>{
 await harness(async({w,act,read,recreate,screen})=>{await pause(380);act('new-game');assert.equal(screen(),'opening');assert.equal(read().sourceOpening.index,0);act('game-intro-next');assert.equal(read().sourceOpening.index,1);act('game-title');assert.equal(read().sourceOpening.phase,'paused');recreate();await pause(380);act('game-continue');assert.equal(read().sourceOpening.phase,'playing');assert.equal(read().sourceOpening.index,1);act('game-intro-skip');assert.equal(screen(),'map');assert.equal(read().sourceOpening.phase,'skipped');assert.equal(read().wallet.coins,0);assert.equal(read().questsDone,0);assert.equal(read().tutorialStep,0);
 },{scenes:true});
});

test('configured season opts into real main success records, settles album once and uses visible event window',async()=>{
 const saved=createPlay(config,{scenario:'initial',guide:true});playAction(saved,'start',null,config);
 await harness(async({w,act,read,showMode,recreate})=>{await pause(380);showMode('activities');act('season:configure','true');assert.equal(read().activityLink,undefined);w.document.querySelector('[data-season-accept]').checked=true;act('season:configure','true');act('season:start');assert.equal(read().activityLink.enabled,true);assert.equal(w.document.querySelectorAll('[data-season-cell]').length,48);
 showMode('game');act('game-continue');for(const step of config.tutorialSteps){if(step.kind==='generate')act('game-cell',step.index);else act('move',step.from+','+step.to);}act('deliver');assert.equal(read().wallet.orders,1);assert.equal(read().activitySeason.pass.progress.orders,1);assert.ok(read().activityOutbox.applied.length>0);assert.equal(read().activityOutbox.queue.length,0);
 showMode('activities');w.document.querySelector('[data-season-pack]').value='mock-fixed';act('season:grant-pack');const coins=read().wallet.coins;act('season:open-pack');assert.equal(read().activitySeason.album.complete,true,JSON.stringify({season:read().activitySeason.album,feedback:w.document.querySelector('.game-feedback')?.textContent,pack:w.document.querySelector('[data-season-pack]')?.value}));assert.equal(read().wallet.coins,coins+20);const receipts=read().activitySeason.receipts.length;act('season:open-pack');assert.equal(read().activitySeason.receipts.length,receipts);assert.equal(read().wallet.coins,coins+20);recreate();await pause(380);showMode('activities');assert.equal(read().activitySeason.receipts.length,receipts);assert.equal(read().wallet.coins,coins+20);
 },{saved,season:true});
});

test('a full retained activity outbox rolls back the main merge and its random/UID/economy effects',async()=>{
 const saved=createPlay(config,{scenario:'open'});saved.stage='play';saved.activityLink={...createActivityLinkInputs(),enabled:true,acceptedConfigRevision:seasonConfig.revision};saved.activitySeason=createActivitySeason(seasonConfig);activitySeasonAction(saved.activitySeason,'start',undefined,seasonConfig,{now:0});saved.activitySeason.pass.tokens=16;activitySeasonAction(saved.activitySeason,'claim-pass',{tier:3,track:'free'},seasonConfig,{now:0});saved.queue=Array.from({length:1000},()=>({type:'201',count:1,cacheType:2}));saved.activityOutbox={schema:1,queue:Array.from({length:256},(_,i)=>({eventId:'retained-'+i,kind:'customer',count:1,at:0})),applied:[]};const spots=[];for(let i=0;i<2;i++){const at=saved.board.findIndex(x=>x===null);saved.board[at]={uid:saved.nextUid++,type:'201',cover:null};spots.push(at);}
 await harness(async({act,read})=>{await pause(380);act('game-continue');const before=read();act('move',spots.join(','));const after=read();assert.deepEqual(after.board,before.board);assert.equal(after.nextUid,before.nextUid);assert.deepEqual(after.bubbles,before.bubbles);assert.equal(after.wallet.seed,before.wallet.seed);assert.equal(after.activityOutbox.queue.length,256);assert.equal(after.queue.length,1000);assert.equal(after.activitySeason.receipts.length,0);
 },{saved,season:true});
});

test('CG layer inspection returns to title or opening and preserves main progression',async()=>{
 await harness(async({act,read,screen})=>{await pause(380);act('game-cg-open');assert.equal(screen(),'cg');act('cg:select','cg-scene2');assert.equal(read().cgPresentation.sceneId,'cg-scene2');act('game-cg-close');assert.equal(screen(),'title');act('new-game');act('game-intro-next');const index=read().sourceOpening.index;act('game-cg-open');assert.equal(screen(),'cg');act('game-cg-close');assert.equal(screen(),'opening');assert.equal(read().sourceOpening.index,index);assert.equal(read().sourceOpening.phase,'playing');assert.equal(read().questsDone,0);assert.equal(read().wallet.coins,0);
 },{scenes:true,presentation:true});
});

test('a corrupt linked season preserves its raw field and queues successful main facts without paying rewards',async()=>{
 const saved=createPlay(config,{scenario:'open'});saved.stage='play';saved.activityLink={...createActivityLinkInputs(),enabled:true,acceptedConfigRevision:seasonConfig.revision};saved.activitySeason=null;const indices=[];for(let i=0;i<2;i++){const at=saved.board.findIndex(x=>x===null);saved.board[at]={uid:saved.nextUid++,type:'201',cover:null};indices.push(at);}
 await harness(async({act,read})=>{await pause(380);act('game-continue');act('move',indices.join(','));assert.equal(read().activitySeason,null);assert.equal(read().board[indices[1]].type,'202');assert.ok(read().activityOutbox.queue.some(r=>r.kind==='merge'));assert.ok(read().activityOutbox.queue.some(r=>r.kind==='202'));assert.equal(read().wallet.coins,0);
 },{saved,season:true});
});

test('actual factory catalog guide locks and re-enables Inventory, consumes real tab entry and preserves post-Finish prompt work',async()=>{
 let saved=createPlay(config,{scenario:'open'});saved.stage='play';saved.wallet.level=2;const r=configureFactoryTransaction(saved,{schema:1,mode:'research',serverEnabled:true,unlockMode:'assumed'},factoryConfig,{playConfig:config});assert.equal(r.ok,true);saved=r.state;
 await harness(async({w,act,read,screen})=>{await pause(380);act('game-continue');await waitForState(()=>read().tutorialRuntime?.entries.tutorial_generator_factory?.state.phase==='1'&&read().tutorialAdapter.anonymousLocks===0&&read().tutorialAdapter.targets['hud.inventory']?.enabled===true,'factory source should highlight the actual Inventory HUD');assert.equal(w.document.querySelector('.game-bottom [data-play=inventory]').disabled,false,JSON.stringify({button:w.document.querySelector('.game-bottom [data-play=inventory]').outerHTML,runtime:read().tutorialRuntime.constraints,adapter:read().tutorialAdapter,active:Object.fromEntries(Object.entries(read().tutorialRuntime.entries).filter(([k,v])=>v.state.active))}));act('inventory');assert.equal(read().modal,'inventory');await waitForState(()=>read().tutorialRuntime?.entries.tutorial_generator_factory?.state.phase==='2','source should wait for the real inventory open');assert.equal(read().tutorialAdapter.targets['inventory.window'].promptStopped,true);act('game-factory-open');assert.equal(screen(),'factory');assert.equal(read().tutorialRuntime.entries.tutorial_generator_factory.state.phase,'3');const cb=w.document.querySelector('[data-play="runtime:mask"]');assert.ok(cb);act('runtime:mask',cb.dataset.value);assert.ok(read().tutorialRuntime.completed.includes('tutorial_generator_factory'));assert.equal(read().tutorialAdapter.targets['inventory.window'].promptStopped,false);assert.equal(read().tutorialAdapter.targets['inventory.window'].promptGeneration,1);assert.equal(read().wallet.coins,0);
 },{saved,factory:true,runtime:true,tutorials:true,more:true});
});

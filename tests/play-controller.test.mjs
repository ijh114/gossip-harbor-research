import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createPlay,validPlay} from '../src/play-model.mjs';
import {writeSession,SAVE_KEY} from '../src/session-store.mjs';
import {createPlayController} from '../src/play-controller.mjs';
const config=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
function harness(run){
 const dom=new JSDOM('<main></main>',{url:'https://research.example/#experience'}),before={window:globalThis.window,document:globalThis.document};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document});
 const create=()=>createPlayController({getData:()=>({playConfig:config,media:{entries:[]}}),render(){},download(){}});
 try{return run(dom.window,create);}finally{Object.assign(globalThis,before);dom.window.close();}
}
test('offline recovery is immediately checkpointed so a second restoration cannot award the same elapsed time again',()=>harness((w,create)=>{
 const s=createPlay(config);s.stage='play';s.wallet.energy=10;
 writeSession(w.localStorage,s,{revision:config.revision,now:Date.now()-120000,validate:s=>validPlay(s,config)});
 create().render();const once=JSON.parse(w.localStorage.getItem(SAVE_KEY));assert.equal(once.state.wallet.energy,11);assert.match(once.state.message,/이전 실험 복원/);
 create().render();const twice=JSON.parse(w.localStorage.getItem(SAVE_KEY));assert.equal(twice.state.wallet.energy,11);assert.equal(twice.state.wallet.time,once.state.wallet.time);
}));
test('corrupt saved data remains untouched until an explicit new experiment safely backs it up',()=>harness((w,create)=>{
 const raw='{incomplete';w.localStorage.setItem(SAVE_KEY,raw);const controller=create();
 assert.match(controller.render(),/기존 자료는 유지/);controller.handle('save');assert.equal(w.localStorage.getItem(SAVE_KEY),raw);
 controller.handle('reset');assert.equal(w.localStorage.getItem(SAVE_KEY+'-previous'),raw);
 assert.equal(validPlay(JSON.parse(w.localStorage.getItem(SAVE_KEY)).state,config),true);
}));

test('reviewed previous projection migrates without losing board, wallet, progress or the raw backup',()=>harness((w,create)=>{
 const s=createPlay(config);s.stage='play';s.wallet.coins=84;s.questsDone=4;s.xp=15;
 delete s.bubbles;delete s.toolPending;
 writeSession(w.localStorage,s,{revision:config.compatibleRevisions[0],now:Date.now(),validate:x=>validPlay(x,config)});
 const original=w.localStorage.getItem(SAVE_KEY);create().render('game');
 const saved=JSON.parse(w.localStorage.getItem(SAVE_KEY));
 assert.equal(saved.revision,config.revision);assert.equal(saved.state.wallet.coins,84);assert.equal(saved.state.questsDone,4);
 assert.deepEqual(saved.state.board,s.board);assert.equal(w.localStorage.getItem(SAVE_KEY+'-previous'),original);
}));

test('unknown projection is never overwritten by visiting or saving the game view',()=>harness((w,create)=>{
 const s=createPlay(config);writeSession(w.localStorage,s,{revision:'unknown-projection',now:Date.now()});
 const original=w.localStorage.getItem(SAVE_KEY),controller=create();controller.render('game');controller.handle('save');
 assert.equal(w.localStorage.getItem(SAVE_KEY),original);assert.equal(w.localStorage.getItem(SAVE_KEY+'-previous'),null);
}));

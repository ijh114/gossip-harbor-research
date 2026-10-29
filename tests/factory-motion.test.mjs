import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createFactoryMotion,startFactoryMotion,advanceFactoryMotion,cancelFactoryMotion,factoryMotionView,validFactoryMotion} from '../src/factory-motion.mjs';
import {createPlay} from '../src/play-model.mjs';
import {createFactoryInputs,configureFactoryTransaction,commitFactoryTransaction} from '../src/factory-transaction.mjs';
import {renderFactoryPage} from '../src/factory-page.mjs';
import {JSDOM} from 'jsdom';
const c=JSON.parse(await readFile(new URL('../src/data/factory-play.json',import.meta.url),'utf8'));
const start=(s,sequence,now=0,fromScore=4)=>startFactoryMotion(s,{now,sequence,targetType:'104',itemType:'103',fromScore,toScore:fromScore+4},c);
test('threshold clock exposes source0.4 arrival,0.5 unlock,0.95 reward view and non-cumulative boolean locks',()=>{
 const raw=createFactoryMotion(),started=start(raw,1);assert.equal(started.ok,true);assert.equal(raw.motions.length,0);let s=started.state;assert.equal(s.locked,true);
 let out=advanceFactoryMotion(s,0.399,c);assert.equal(out.events.length,0);assert.equal(factoryMotionView(out.state,0.2,c).flights[0].progress,0.5);
 out=advanceFactoryMotion(out.state,0.4,c);assert.equal(out.events.find(e=>e.type==='slider-update').requestReward,true);assert.equal(out.state.locked,true);
 out=advanceFactoryMotion(out.state,0.5,c);assert.equal(out.state.locked,false,'original click callback unlocks the shared boolean before slider callback');
 out=advanceFactoryMotion(out.state,0.95,c);assert.equal(out.events.filter(e=>e.type==='reward-view').length,1);assert.equal(factoryMotionView(out.state,1,c).groups[0].displayScore,0);
 out=advanceFactoryMotion(out.state,2,c);assert.equal(out.state.motions.length,0);assert.equal(out.state.locked,false);assert.equal(validFactoryMotion(out.state,c),true);
});
test('non-threshold flights can overlap, callbacks are delivered once and backwards clocks/duplicate sequence cannot restart rewards',()=>{
 let s=start(createFactoryMotion(),1,0,0).state;assert.equal(s.locked,false);const second=start(s,2,0.1,4);assert.equal(second.ok,true);assert.equal(second.state.motions.length,2);s=second.state;
 const out=advanceFactoryMotion(s,2,c);assert.equal(out.events.filter(e=>e.type==='slider-update'&&e.requestReward).length,1);assert.equal(out.events.filter(e=>e.type==='reward-view').length,1);
 assert.equal(advanceFactoryMotion(out.state,2,c).events.length,0);assert.equal(advanceFactoryMotion(out.state,1,c).ok,false);assert.equal(start(out.state,2,3).ok,false);
});
test('leaving before arrival requests one source OnDisable settlement; after arrival it never requests that reward twice',()=>{
 const started=start(createFactoryMotion(),1),early=cancelFactoryMotion(started.state,0.1,c);assert.deepEqual(early.pendingRewards,['104']);assert.equal(early.state.locked,false);assert.equal(early.state.motions.length,0);
 const late=cancelFactoryMotion(started.state,0.45,c);assert.deepEqual(late.pendingRewards,[]);assert.equal(late.events.filter(e=>e.type==='slider-update'&&e.requestReward).length,1);
 assert.equal(advanceFactoryMotion(early.state,2,c).events.length,0);
});
test('corrupt presentation state is rejected and no clock function has access to main wallet or storage',()=>{
 const s=start(createFactoryMotion(),1).state,before=structuredClone(s);s.motions[0].toScore=999;assert.equal(validFactoryMotion(s,c),false);assert.equal(advanceFactoryMotion(s,1,c).ok,false);
 assert.deepEqual(Object.keys(before).sort(),['clock','lastSequence','locked','motions','schema']);assert.equal(before.wallet,undefined);
});
test('factory screen renders committed score separately from flight progress and disables actions during the source lock',async()=>{
 const playConfig=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));let s=createPlay(playConfig);s.stage='play';s.board=Array(63).fill(null);s.generatorState={};for(let i=0;i<2;i++)s.board[i]={uid:s.nextUid++,type:'103',cover:null};
 s=configureFactoryTransaction(s,{...createFactoryInputs(),serverEnabled:true,unlockMode:'assumed'},c,{playConfig}).state;
 for(let index=0;index<2;index++)s=commitFactoryTransaction(s,{type:'store',source:'board',index,uid:s.board[index].uid},c,{playConfig}).state;
 for(let i=0;i<2;i++)s=commitFactoryTransaction(s,{type:'add-score',targetType:'104',itemType:'103'},c,{playConfig}).state;
 const m=startFactoryMotion(createFactoryMotion(),{now:0,sequence:s.factoryPlay.sequence,targetType:'104',itemType:'103',fromScore:4,toScore:8},c).state;
 const before=structuredClone(s),dom=new JSDOM(renderFactoryPage(s,c,{playConfig,media:{entries:[]}},factoryMotionView(m,0.2,c)));
 try{const d=dom.window.document;assert.equal(d.querySelector('[data-play="factory:reward"]').disabled,true);assert.equal(d.querySelector('[data-factory-progress="104"]').value,4);assert.equal(d.querySelector('[data-factory-flight]').style.getPropertyValue('--flight-progress'),'0.5');assert.equal(d.querySelector('[data-factory-lock]').dataset.factoryLock,'true');assert.deepEqual(s,before);}finally{dom.window.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPlay,playAction,generateFrom,moveOrMerge,advancePlay,validPlay,itemFor} from '../src/play-model.mjs';

const packaged=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
// Small verified-rule fixture keeps engine regressions independent of UI data publication.
function rules(){
 const c=structuredClone(packaged);
 c.tutorialSteps=[{kind:'merge',from:30,to:31},{kind:'generate',index:31}];
 c.specialRules={
  collectibles:[['2401','gold',2],['2402','gold',6],['2501','gem',1],['2605','energy',100]].map(([type,currency,amount])=>({type,reward:{type:currency,amount}})),
  timeSkip:{items:[{type:'time_skip_1',seconds:600}]},
  specialTools:{rainbow:{type:'level_up_piece_1'},scissors:{type:'level_down_piece_1',defaultUses:1},targetProjection:{levelUpTypes:['204','207'],levelDownTypes:['204','208']}},
  mergeBonus:{type:'2401',amountItems:1,minimumResultChainLevel:8},
  bubble:{defaultDurationSeconds:60,basePriceProjection:[{type:'205',baseGemCost:4}]},
 };
 for(const item of c.items)if(/^20\d$/.test(item.type))item.chainLevel=Number(item.type)-200;
 return c;
}
function blank(c=rules()){
 const s=createPlay(c);s.stage='play';s.board.fill(null);s.generatorState={};s.selected=null;
 return s;
}
function place(s,c,index,type,{cover=null,uses}={}){
 const cell={uid:s.nextUid++,type,cover};if(uses!==undefined)cell.uses=uses;s.board[index]=cell;
 const g=itemFor(c,type)?.generator;if(g)s.generatorState[cell.uid]={charges:g.batch,storage:g.storage,timerStart:null,readyAt:0};
 return cell;
}
const resources=s=>structuredClone({board:s.board,wallet:s.wallet,generatorState:s.generatorState,pools:s.pools,rng:s.rng,nextUid:s.nextUid,queue:s.queue,bubbles:s.bubbles});

test('collecting currency consumes exactly once, while merging leaves the higher collectible unclaimed',()=>{
 const c=rules(),s=blank(c);place(s,c,30,'2401');place(s,c,31,'2401');
 assert.equal(moveOrMerge(s,30,31,c).ok,true);assert.equal(s.wallet.coins,0);assert.equal(s.board[31].type,'2402');
 assert.equal(playAction(s,'collect','31',c).ok,true);assert.equal(s.wallet.coins,6);assert.equal(s.board[31],null);
 const after=resources(s);assert.equal(playAction(s,'collect','31',c).ok,false);assert.deepEqual(resources(s),after);
 place(s,c,25,'2605');s.selected=25;
 assert.equal(playAction(s,'cell','25',c).ok,true);assert.equal(s.wallet.energy,200,'collectible grant is not clamped to natural-recovery capacity');
 assert.equal(validPlay(s,c),true);
});

test('covered or non-collectible items cannot be collected or consumed',()=>{
 const c=rules(),s=blank(c);place(s,c,10,'2401',{cover:'web'});place(s,c,11,'201');
 for(const index of [10,11]){const before=resources(s);assert.equal(playAction(s,'collect',String(index),c).ok,false);assert.deepEqual(resources(s),before);}
});

test('generated pieces and the level8 coin use the recovered spread ring order, not first board index',()=>{
 const c=rules(),s=blank(c);place(s,c,31,'104');
 assert.equal(generateFrom(s,31,c).ok,true);assert.ok(s.board[24]);assert.equal(s.board[0],null);
 const m=blank(c);place(m,c,30,'207');place(m,c,31,'207');
 assert.equal(playAction(m,'move','30,31',c).ok,true);assert.equal(m.board[31].type,'208');assert.equal(m.board[24].type,'2401');
 assert.equal(m.wallet.coins,0);assert.equal(m.xp,0);assert.equal(validPlay(m,c),true);
 const low=blank(c);place(low,c,30,'206');place(low,c,31,'206');moveOrMerge(low,30,31,c);
 assert.equal(low.board.filter(Boolean).length,1,'level7 result does not spawn the level8 bonus');
});

test('hourglasses advance only active generator timers and retain a valid partly skipped timer',()=>{
 const c=rules(),g=itemFor(c,'106').generator;g.cooldownSeconds=1200;
 const s=blank(c),active=place(s,c,31,'106'),idle=place(s,c,0,'106');
 generateFrom(s,31,c);const idleBefore=structuredClone(s.generatorState[idle.uid]);place(s,c,40,'time_skip_1');
 assert.equal(playAction(s,'collect','40',c).ok,true);assert.equal(s.wallet.time,0);assert.equal(s.board[40],null);
 assert.equal(s.generatorState[active.uid].readyAt,600);assert.equal(s.generatorState[active.uid].charges,g.batch-1);
 assert.deepEqual(s.generatorState[idle.uid],idleBefore);assert.equal(validPlay(s,c),true);
 advancePlay(s,600,c);assert.equal(s.generatorState[active.uid].charges,g.batch);assert.equal(s.generatorState[active.uid].storage,g.storage-1);
});

test('a long hourglass does not refill and spend every elapsed generator cycle',()=>{
 const c=rules(),s=blank(c),cell=place(s,c,31,'104'),g=itemFor(c,'104').generator;
 generateFrom(s,31,c);place(s,c,40,'time_skip_1');playAction(s,'collect','40',c);
 assert.equal(s.generatorState[cell.uid].charges,g.batch);assert.equal(s.generatorState[cell.uid].storage,g.storage-1);assert.equal(s.generatorState[cell.uid].timerStart,null);
});

test('rainbow confirmation consumes one tool, upgrades once and avoids ordinary merge bonuses',()=>{
 const c=rules(),s=blank(c);place(s,c,40,'level_up_piece_1');place(s,c,31,'207');
 const before=resources(s);assert.equal(moveOrMerge(s,40,31,c).ok,true);assert.equal(s.toolPending.kind,'rainbow');assert.deepEqual(resources(s),before);
 assert.equal(playAction(s,'cancel-tool',null,c).ok,true);assert.equal(s.toolPending,null);assert.deepEqual(resources(s),before);
 moveOrMerge(s,40,31,c);assert.equal(playAction(s,'confirm-tool',null,c).ok,true);
 assert.equal(s.board[40],null);assert.equal(s.board[31].type,'208');assert.equal(s.board.filter(Boolean).length,1,'rainbow is not a normal two-item merge');
 assert.equal(s.toolPending,null);assert.equal(validPlay(s,c),true);
});

test('scissors decrement persistent charges and place two previous-level pieces using the spread ring',()=>{
 const c=rules(),s=blank(c);place(s,c,40,'level_down_piece_1',{uses:2});place(s,c,31,'204');
 assert.equal(moveOrMerge(s,40,31,c).ok,true);assert.equal(playAction(s,'confirm-tool',null,c).ok,true);
 assert.equal(s.board[40].uses,1);assert.equal(s.board[31].type,'203');assert.equal(s.board[24].type,'203');assert.equal(validPlay(s,c),true);
});

test('tool confirmation rechecks the board and never partially consumes a rejected split',()=>{
 const c=rules(),s=blank(c);place(s,c,40,'level_down_piece_1');place(s,c,31,'204');moveOrMerge(s,40,31,c);
 for(let i=0;i<63;i++)if(!s.board[i])place(s,c,i,'201');
 const before=resources(s);assert.equal(playAction(s,'confirm-tool',null,c).ok,false);assert.deepEqual(resources(s),before);assert.equal(s.toolPending,null);
});

test('scissors combine uses on a full board without consuming a charge or opening confirmation',()=>{
 const c=rules(),s=blank(c);for(let i=0;i<63;i++)place(s,c,i,'201');
 place(s,c,40,'level_down_piece_1',{uses:2});place(s,c,31,'level_down_piece_1',{uses:3});
 assert.equal(moveOrMerge(s,40,31,c).ok,true);assert.equal(s.board[40],null);assert.equal(s.board[31].uses,5);assert.equal(s.toolPending,null);assert.equal(validPlay(s,c),true);
});

test('ineligible special-item drops may exchange positions but never consume a tool or grant its effect',()=>{
 const c=rules(),s=blank(c),tool=place(s,c,40,'level_up_piece_1'),target=place(s,c,31,'2501');
 assert.equal(moveOrMerge(s,40,31,c).ok,true);assert.equal(s.board[31].uid,tool.uid);assert.equal(s.board[40].uid,target.uid);assert.equal(s.wallet.gems,200);assert.equal(s.toolPending,null);
});

test('research aid places only declared special types in the queue and preserves opaque packs',()=>{
 const c=rules(),s=blank(c);s.queue.push({type:'not-a-supported-pack',count:1});
 assert.equal(playAction(s,'aid-special','2401',c).ok,true);assert.deepEqual(s.queue,[{type:'not-a-supported-pack',count:1},{type:'2401',count:1}]);
 const before=resources(s);assert.equal(playAction(s,'aid-special','not-a-supported-pack',c).ok,false);assert.deepEqual(resources(s),before);
 assert.equal(playAction(s,'queue',null,c).ok,true);assert.ok(s.board.some(x=>x?.type==='2401'));assert.deepEqual(s.queue,[{type:'not-a-supported-pack',count:1}]);
});

test('research bubbles cannot be moved, collected, sold or submitted as ordinary items before purchase',()=>{
 const c=rules();c.orders=[{id:'bubble-order',level:1,requirements:[{type:'205',count:1}],coins:99}];
 const s=blank(c);assert.equal(playAction(s,'aid-bubble','205',c).ok,true);
 const index=s.board.findIndex(x=>x&&s.bubbles[x.uid]);s.selected=index;
 const before=resources(s);assert.equal(moveOrMerge(s,index,31,c).ok,false);assert.deepEqual(resources(s),before);
 assert.equal(playAction(s,'collect',String(index),c).ok,false);assert.equal(playAction(s,'sell',null,c).ok,false);assert.equal(playAction(s,'deliver',null,c).ok,false);assert.deepEqual(resources(s),before);
 s.wallet.gems=3;const poor=resources(s);assert.equal(playAction(s,'buy-bubble',String(index),c).ok,false);assert.deepEqual(resources(s),poor);
 s.wallet.gems=4;assert.equal(playAction(s,'buy-bubble',String(index),c).ok,true);assert.equal(s.wallet.gems,0);assert.equal(s.board[index].type,'205');assert.deepEqual(s.bubbles,{});assert.equal(validPlay(s,c),true);
});

test('bubble timeout replaces it with an unclaimed coin and survives an ordinary save boundary',()=>{
 const c=rules(),s=blank(c);playAction(s,'aid-bubble','205',c);const index=s.board.findIndex(x=>x&&s.bubbles[x.uid]);
 advancePlay(s,59,c);assert.ok(s.bubbles[s.board[index].uid]);assert.equal(validPlay(JSON.parse(JSON.stringify(s)),c),true);
 advancePlay(s,1,c);assert.equal(s.board[index].type,'2401');assert.deepEqual(s.bubbles,{});assert.equal(s.wallet.coins,0);
 playAction(s,'collect',String(index),c);assert.equal(s.wallet.coins,2);assert.equal(validPlay(s,c),true);
});

test('optional tutorial gates only exact successful source actions and can be explicitly skipped',()=>{
 const c=rules(),s=blank(c);s.tutorialStep=0;place(s,c,30,'103');place(s,c,31,'103');place(s,c,32,'103');
 assert.equal(playAction(s,'cell','30',c).ok,true);const before=resources(s);
 assert.equal(playAction(s,'move','30,32',c).ok,false);assert.deepEqual(resources(s),before);assert.equal(s.tutorialStep,0);
 assert.equal(playAction(s,'move','30,31',c).ok,true);assert.equal(s.tutorialStep,1);
 const ready=resources(s);assert.equal(generateFrom(s,0,c).ok,false);assert.deepEqual(resources(s),ready);assert.equal(s.tutorialStep,1);
 assert.equal(generateFrom(s,31,c).ok,true);assert.equal(s.tutorialStep,2);assert.equal(validPlay(s,c),true);
 s.tutorialStep=0;assert.equal(playAction(s,'skip-tutorial',null,c).ok,true);assert.equal(s.tutorialStep,c.tutorialSteps.length);
});

test('new optional state is validated strictly while old save shapes remain accepted',()=>{
 const c=rules(),s=blank(c);place(s,c,40,'level_down_piece_1',{uses:2});place(s,c,31,'204');moveOrMerge(s,40,31,c);
 assert.equal(validPlay(s,c),true);
 for(const mutate of [x=>x.board[40].uses=0,x=>x.board[31].uses=1,x=>x.toolPending.targetUid=99999,x=>x.toolPending.kind='unknown',x=>x.tutorialStep=99,x=>x.bubbles=[]]){
  const bad=structuredClone(s);mutate(bad);assert.equal(validPlay(bad,c),false);
 }
 const old=blank(c);delete old.bubbles;delete old.toolPending;delete old.tutorialStep;assert.equal(validPlay(old,c),true);
 const b=blank(c);playAction(b,'aid-bubble','205',c);const uid=Object.keys(b.bubbles)[0];
 for(const mutate of [x=>x.bubbles[uid].price=-1,x=>x.bubbles[uid].innerType='204',x=>x.bubbles[uid].expiresAt='60',x=>x.bubbles['999999']={expiresAt:60,price:4,innerType:'205'}]){
  const bad=structuredClone(b);mutate(bad);assert.equal(validPlay(bad,c),false);
 }
});

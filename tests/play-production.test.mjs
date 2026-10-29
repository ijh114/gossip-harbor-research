import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPlay,playAction,validPlay} from '../src/play-model.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
function play(){const s=createPlay(c);playAction(s,'start',undefined,c);s.selected=0;return s;}
const resources=s=>structuredClone({wallet:s.wallet,rng:s.rng,pools:s.pools,poolSignatures:s.poolSignatures,generatorState:s.generatorState,productionModifiers:s.productionModifiers,board:s.board});

test('research modifier presets connect source hooks and a full board cannot consume extra-production counters or RNG',()=>{
 const s=play();assert.equal(playAction(s,'modifier-preset','extra',c).ok,true);
 for(let i=2;i<63;i++)s.board[i]={uid:s.nextUid++,type:'201',cover:null};
 const before=resources(s);assert.equal(playAction(s,'generate',undefined,c).ok,false);assert.deepEqual(resources(s),before);assert.equal(validPlay(s,c),true);
 s.board[62]=null;assert.equal(playAction(s,'generate',undefined,c).ok,true);assert.equal(validPlay(s,c),true);
 assert.ok(s.productionModifiers.generatorBoost.extraBucket.totalLeft>=0);
});

test('NoCD activation clears an eligible empty board generator and partly charged stored timer without a gem cost',()=>{
 const s=play(),uid=s.board[0].uid,r=s.generatorState[uid];r.charges=0;r.timerStart=0;r.readyAt=r.ruleSnapshot.cooldownSeconds;
 const gems=s.wallet.gems;assert.equal(playAction(s,'modifier-preset','nocd',c).ok,true);assert.equal(r.charges,r.ruleSnapshot.batch);assert.equal(s.wallet.gems,gems);assert.equal(validPlay(s,c),true);
 const stored=play();stored.wallet.level=2;assert.equal(playAction(stored,'generate',undefined,c).ok,true);const cell=stored.board[0],state=stored.generatorState[cell.uid],storage=state.storage;
 assert.equal(playAction(stored,'inventory-store',0,c).ok,true);assert.equal(playAction(stored,'modifier-preset','nocd',c).ok,true);
 assert.equal(state.charges,state.ruleSnapshot.batch);assert.equal(state.storage,storage-1);assert.equal(stored.wallet.gems,200);assert.equal(validPlay(stored,c),true);
});

test('malformed source order snapshots are rejected before storing settings or allocating large requirement arrays',()=>{
 const s=play(),before=resources(s);
 assert.equal(playAction(s,'set-modifiers',{smartProduce:{active:true},orders:[{slot:1,requirements:[{type:'not-a-type',count:1000000000}]}]},c).ok,false);
 assert.equal(s.modifierInputs,undefined);assert.deepEqual(resources(s),before);
 const forged=structuredClone(s);forged.modifierInputs={smartProduce:{active:true},orders:[{slot:1,requirements:[{type:'201',count:1000000000}]}]};assert.equal(validPlay(forged,c),false);
});

test('infinite-energy generation records source pass origin amount while spending no wallet energy',()=>{
 const s=play();s.wallet.level=3;playAction(s,'shop',undefined,c);playAction(s,'commerce-event','example-pass',c);playAction(s,'close-shop',undefined,c);
 assert.equal(playAction(s,'set-modifiers',{energyInfinite:true},c).ok,true);const before=s.wallet.energy;
 assert.equal(playAction(s,'generate',undefined,c).ok,true);assert.equal(s.wallet.energy,before);assert.equal(s.commerce.activity.metrics.energy,1);assert.equal(validPlay(s,c),true);
});

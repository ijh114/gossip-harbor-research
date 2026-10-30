import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPlay,playAction,moveOrMerge,currentBubbleQuote,validPlay} from '../src/play-model.mjs';
import {getSpeedUpCost} from '../src/spread-model.mjs';
import {normalizeTutorialEconomy,withTutorialEconomy,tutorialEconomyFor} from '../src/tutorial-economy.mjs';
import {tutorialRuntimeActionCallback,tutorialRuntimePermissionFromView} from '../src/tutorial-runtime.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
function main(){const s=createPlay(c,{scenario:'initial'});playAction(s,'start',null,c);for(const r of c.initialReplay)assert.equal(moveOrMerge(s,r.from,r.to,c).ok,true);return s;}
const economy=s=>structuredClone({board:s.board,wallet:s.wallet,rng:s.rng,pools:s.pools,generatorState:s.generatorState});
test('source forced generation uses a known type without drawing the random deck and scope never leaks',()=>{
 const s=main(),index=s.board.findIndex(x=>x?.type==='104');s.selected=index;const rng=s.rng,pools=structuredClone(s.pools),energy=s.wallet.energy;
 const out=withTutorialEconomy(s,{forceSpreadCode:'301'},()=>playAction(s,'generate',null,c));assert.equal(out.ok,true);assert.ok(s.board.some(x=>x?.type==='301'));assert.equal(s.rng,rng);assert.deepEqual(s.pools,pools);assert.equal(s.wallet.energy,energy-1);assert.deepEqual(tutorialEconomyFor(s),{});assert.equal(validPlay(s,c),true);
 const bad=main();bad.selected=bad.board.findIndex(x=>x?.type==='104');const before=economy(bad);assert.equal(withTutorialEconomy(bad,{forceSpreadCode:'not-an-item'},()=>playAction(bad,'generate',null,c)).ok,false);assert.deepEqual(economy(bad),before);
});
test('zero source bubble price reaches both the quote and actual debit, then restores its ordinary price',()=>{
 const s=main();assert.equal(playAction(s,'aid-bubble','203',c).ok,true);const index=s.board.findIndex(x=>x&&s.bubbles?.[x.uid]);s.selected=index;s.wallet.gems=0;const b=s.bubbles[s.board[index].uid],ordinary=currentBubbleQuote(s,c,b);assert.ok(ordinary.price>0);
 const out=withTutorialEconomy(s,{forceBubbleCost:0},()=>{assert.equal(currentBubbleQuote(s,c,b).price,0);return playAction(s,'buy-bubble',index,c);});assert.equal(out.ok,true);assert.equal(s.wallet.gems,0);assert.equal(s.bubbles[s.board[index].uid],undefined);assert.deepEqual(tutorialEconomyFor(s),{});
});
test('zero speedup cost applies to the real spread quote and transaction; malformed directives preserve state',()=>{
 const s=main();assert.equal(playAction(s,'aid-type','3501',c).ok,true);assert.equal(playAction(s,'queue',null,c).ok,true);const index=s.board.findIndex(x=>x?.type==='3501');s.selected=index;assert.equal(playAction(s,'open-item',index,c).ok,true);assert.ok(getSpeedUpCost(s,index,c).cost>0);s.wallet.gems=0;
 const out=withTutorialEconomy(s,{forceSkipCost:0},()=>{assert.equal(getSpeedUpCost(s,index,c).cost,0);return playAction(s,'speedup-item',index,c);});assert.equal(out.ok,true);assert.equal(s.wallet.gems,0);assert.equal(s.generatorState[s.board[index].uid].phase,'opened');
 const before=economy(s);assert.equal(normalizeTutorialEconomy({forceSkipCost:-1}).ok,false);assert.equal(normalizeTutorialEconomy({forceSkipCost:.5}).ok,false);assert.throws(()=>withTutorialEconomy(s,{forceBubbleCost:NaN},()=>playAction(s,'generate',null,c)),/directives/);assert.deepEqual(economy(s),before);
});
test('nested source scopes restore on success or exceptions and never attach temporary values to save JSON',()=>{
 const s=main(),before=JSON.stringify(s);withTutorialEconomy(s,{forceSkipCost:3},()=>{assert.equal(tutorialEconomyFor(s).forcedSkipCost,3);assert.throws(()=>withTutorialEconomy(s,{forceSkipCost:0},()=>{throw Error('interrupted');}),/interrupted/);assert.equal(tutorialEconomyFor(s).forcedSkipCost,3);});assert.deepEqual(tutorialEconomyFor(s),{});assert.equal(JSON.stringify(s),before);
});
test('a verified target click invokes only its unique source callback and never bypasses locks or a missing economic consumer',()=>{
 const active={id:'guide',strong:true,inputLocked:false,binding:{kind:'cell',origin:'verified-web-adapter',actions:['game-cell'],index:4,uid:7},allowedActions:[{type:'mask-click',callbackId:'source-callback'}]},view={valid:true,enabled:true,active:[active],constraints:{forceSource:null,forceTarget:null,forceEffect:null,forceSpreadCode:null,forceSkipCost:null,forceBubbleCost:null,dragLocks:[]},inputSnapshot:{board:[],selectedIndex:null},adapterControls:{},adapterTargets:[]};
 assert.deepEqual(tutorialRuntimeActionCallback(view,'game-cell','4'),{type:'mask-click',guideId:'guide',callbackId:'source-callback',webAction:'game-cell'});assert.equal(tutorialRuntimeActionCallback(view,'game-cell','5'),null);assert.equal(tutorialRuntimeActionCallback({...view,adapterInputLocked:true},'game-cell','4'),null);assert.equal(tutorialRuntimeActionCallback({...view,active:[active,{...active,id:'other'}]},'game-cell','4'),null);
 const economic={...view,active:[],constraints:{...view.constraints,forceSkipCost:0}};assert.equal(tutorialRuntimePermissionFromView(economic,'speedup-item').allowed,false);assert.equal(tutorialRuntimePermissionFromView({...economic,inputSnapshot:{...view.inputSnapshot,tutorialEconomySupported:true}},'speedup-item').allowed,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEnergyGift,evaluateEnergyGift,energyCostExcludeFree} from '../src/bm-rules.mjs';
import {traceOffers} from '../src/engine.mjs';
const raw={groupDuration:60,groupCD:240,giftDuration:30,triggerEnergyPrice:20,dailyTriggerUpper:2,poptype:1};
test('EnergyGift wire durations are minutes; limits and poptype are not renamed into fabricated server fields',()=>{
 assert.deepEqual(normalizeEnergyGift(raw),{groupSeconds:3600,cooldownSeconds:14400,giftSeconds:1800,triggerPrice:20,triggerLimit:2,popType:1});
 assert.equal(normalizeEnergyGift(null),null);assert.throws(()=>normalizeEnergyGift({}));
});
test('bundle creation gates stop at the first failure; boost cost and an existing bundle are separate from entry routing',()=>{
 assert.equal(evaluateEnergyGift(raw).canCreate,true);
 assert.equal(evaluateEnergyGift(raw,{energy:1,generationCost:1}).firstFailure,'energy');
 assert.equal(evaluateEnergyGift(raw,{energy:1,generationCost:2}).canCreate,true);
 for(const [state,key]of [[{lateInited:false},'lateInit'],[{triggerCount:2},'daily'],[{coolingDown:true},'cooldown'],[{freeAvailable:true},'free'],[{gemPrice:10},'price'],[{existingValidBundle:true},'existing'],[{chainEnergyOpen:true},'chain']])assert.equal(evaluateEnergyGift(raw,state).firstFailure,key);
 const result=evaluateEnergyGift(null);assert.equal(result.firstFailure,'config');assert.equal(result.gates[2].evaluated,false);
});
test('a new server day resets trigger count without bypassing group cooldown',()=>{
 const result=evaluateEnergyGift(raw,{triggerCount:99,serverTime:172800,refreshTime:172799});assert.equal(result.effectiveTriggerCount,0);assert.equal(result.canCreate,true);
 assert.equal(evaluateEnergyGift(raw,{triggerCount:99,serverTime:172800,refreshTime:172799,coolingDown:true}).firstFailure,'cooldown');
});
test('follow-up price gate uses the first positive chain step from current position, not the maximum of all future steps',()=>{
 assert.equal(energyCostExcludeFree(20,[0,40,160],0),40);assert.equal(energyCostExcludeFree(80,[0,40,160],0),80);assert.equal(energyCostExcludeFree(20,[0,40,160],2),160);
 assert.equal(energyCostExcludeFree(20,[0,0],0),20);
 assert.equal(traceOffers({energy:1,generationCost:2,bundle:true}).chosen,'에너지 번들');
});

import {writeFile} from 'node:fs/promises';
import * as engine from '../../src/engine.mjs';
import {evaluateEnergyGift,normalizeEnergyGift,energyCostExcludeFree} from '../../src/bm-rules.mjs';
const snap=s=>({energy:s.energy,gems:s.gems,coins:s.coins,time:s.time,recoveryRemainder:s.recoveryRemainder,freeUsed:s.freeUsed,freeTotal:s.freeTotal,price:s.price,energyBuys:s.energyBuys,generated:s.generated,orders:s.orders,seed:s.seed,board:s.board});
const cases=[];
function add(id,initial,actions){const input=structuredClone(initial),state=engine.createState({board:Array(63).fill(null),...structuredClone(initial)}),out=[];for(const a of actions){const fn={advance:()=>engine.advanceTime(state,a.value),buy:()=>engine.buyEnergy(state),generate:()=>engine.generateItem(state),merge:()=>engine.mergeItems(state,a.from,a.to),deliver:()=>engine.deliverOrder(state)}[a.kind];const result=fn();out.push({ok:result.ok,state:structuredClone(snap(state))});}cases.push({id,initial:input,actions,expected:out});}
add('recovery-free-price-day',{energy:0},[{kind:'advance',value:119},{kind:'advance',value:1},{kind:'buy'},{kind:'buy'},{kind:'advance',value:86400},{kind:'buy'}]);
add('capped-recovery-no-bank',{energy:99},[{kind:'advance',value:1000},{kind:'generate'},{kind:'advance',value:119},{kind:'advance',value:1}]);
add('failed-paid-buy',{energy:0,gems:0,freeUsed:1,price:20},[{kind:'buy'},{kind:'advance',value:240}]);
add('xorshift32-and-board',{energy:100},Array.from({length:12},()=>({kind:'generate'})));
const board=Array(63).fill(null);board[0]={family:'bread',level:3};board[1]={family:'bread',level:3};board[2]={family:'tea',level:1};
add('merge-move-order',{board},[{kind:'merge',from:0,to:2},{kind:'merge',from:2,to:4},{kind:'merge',from:0,to:1},{kind:'deliver'},{kind:'deliver'}]);
const raw={groupDuration:60,groupCD:240,giftDuration:30,triggerEnergyPrice:20,dailyTriggerUpper:2,poptype:1};
const predicates=[{}, {energy:1}, {energy:1,generationCost:2},{triggerCount:2},{triggerCount:20,serverTime:172800,refreshTime:172799},{freeAvailable:true},{existingValidBundle:true},{chainEnergyOpen:true},{coolingDown:true}].map(state=>({raw,state,expected:evaluateEnergyGift(raw,state)}));
const prices=[[20,[0,40,160],0],[80,[0,40,160],0],[20,[0,40,160],2],[20,[0,0],0]].map(([normal,chain,index])=>({normal,chain,index,expected:energyCostExcludeFree(normal,chain,index)}));
await writeFile(new URL('./fixtures.json',import.meta.url),JSON.stringify({schemaVersion:1,scope:'Same analyst experiment inputs in JavaScript and C#; not game runtime equivalence.',cases,predicates,normalization:{raw,expected:normalizeEnergyGift(raw)},prices},null,2)+'\n');
console.log(`Exported ${cases.length} state sequences, ${predicates.length} BM predicates, ${prices.length} price cases.`);

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceBoardCue} from '../src/source-audio-routing.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
const before={mergePair:true,uids:new Set([1,2]),sourceType:'101'},after={board:[{uid:3,type:'102'}],bubbles:{},wallet:{coins:0}},ok={ok:true};
test('source merge priorities are CardItem max before Temp before dog before exact chain level',()=>{
 const d={...c,items:[...c.items,{type:'1602',chainLevel:2}]},a={...after,board:[{uid:3,type:'1602'}]},b={...before,sourceType:null,audioComponents:{newCardMax:true,sourceTemp:true}};assert.equal(sourceBoardCue('move',b,a,ok,d),'card-item-merge');b.audioComponents={sourceTemp:true};assert.equal(sourceBoardCue('move',b,a,ok,d),'temp-item-merge');b.audioComponents={};assert.equal(sourceBoardCue('move',b,a,ok,d),'dog-merge-1');assert.equal(sourceBoardCue('move',before,after,ok,c),'merge-level-2');
});
test('the real merged cell is selected over an extra same-type bubble or merge coin',()=>{
 const a={...after,board:[{uid:3,type:'102'},{uid:4,type:'102'},{uid:5,type:'2401'}],bubbles:{4:{innerType:'102'}}};assert.equal(sourceBoardCue('move',before,a,ok,c),'merge-level-2');assert.equal(sourceBoardCue('move',before,{...a,bubbles:{}},ok,c),null);
});
test('committed spread priority honors CardItem, bubble, Temp, DogHouse, exact Lucky variants and actual boost ratio',()=>{
 const b={...before,sourceType:'1501'},r={ok:true,generatedType:'102',boostRatio:2};assert.equal(sourceBoardCue('generate',b,after,{...r,boardSpreadType:'CardItem'},c),'card-item-generate');assert.equal(sourceBoardCue('generate',b,{...after,bubbles:{3:{}}},r,c),'bubble-spawn');assert.equal(sourceBoardCue('generate',{...b,audioComponents:{newTemp:true}},after,r,c),'temp-item-appear');assert.equal(sourceBoardCue('generate',b,after,r,c),'dog-merge-1');for(const [kind,id]of [['Lucky',1],['FreeLucky',1],['SuperLucky',2],['FreeSuperLucky',2],['DoubleLucky',3],['TripleLucky1',3],['TripleLucky2',4]])assert.equal(sourceBoardCue('generate',before,after,{...r,boardSpreadType:kind},c),'lucky-generate-'+id);assert.equal(sourceBoardCue('generate',before,after,r,c),'boost-generate');assert.equal(sourceBoardCue('generate',before,after,{...r,branch:'lucky-external'},c),null);
});
test('normal70/30 selection uses one supplied random draw; blocked/no-cell/ambiguous outcomes are silent',()=>{
 let draws=0;const rand=value=>()=>{draws++;return value;};assert.equal(sourceBoardCue('generate',before,after,ok,c,{random:rand(.699)}),'manual-generate');assert.equal(sourceBoardCue('generate',before,after,ok,c,{random:rand(.7)}),'manual-generate-alternate');assert.equal(draws,2);for(const [action,a,r]of [['time',after,ok],['generate',{...after,board:[]},ok],['generate',after,{ok:false}],['aid-add',after,ok]])assert.equal(sourceBoardCue(action,before,a,r,c,{random:()=>{throw Error('must not draw');}}),null);
});
test('having no exact component fact does not infer CardItem or Temp from a name/number prefix',()=>{
 const d={...c,items:[{type:'101',name:'CardTempFake',next:'102',chainLevel:1},{type:'102',name:'CardTempMax',chainLevel:2}]};assert.equal(sourceBoardCue('move',before,after,ok,d),'merge-level-2');assert.equal(sourceBoardCue('move',{...before,audioComponents:{sourceTemp:false,newCardMax:false}},after,ok,d),'merge-level-2');
});
test('successful order button input uses Serve and not the separate CanDeliver readiness cue',()=>{
 assert.equal(sourceBoardCue('deliver',before,after,ok,c),'order-serve');assert.equal(sourceBoardCue('deliver',before,after,{ok:false},c),null);
});

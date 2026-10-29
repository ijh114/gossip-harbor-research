import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {renderProgressionStudy} from '../src/progression-study.mjs';
const load=async name=>JSON.parse(await readFile(new URL('../src/data/'+name+'.json',import.meta.url),'utf8'));
const data=await load('progression-validation'),prior=await load('progress-extended'),config=await load('play-config');
test('continuation preserves the published Lv21 checkpoint and extends it to 210 tasks without assistance',()=>{
 const r=data.continuation;
 assert.equal(data.configRevision,config.revision);assert.equal(r.configRevision,config.revision);
 assert.equal(r.continuationFrom.boardHash,prior.late.final.boardHash);
 assert.equal(r.continuationFrom.quests,150);assert.equal(r.continuationFrom.orders,479);
 assert.equal(r.points.length,210);assert.deepEqual(r.points.slice(0,150),prior.late.points);
 assert.deepEqual(r.points.map(p=>p.quest),Array.from({length:210},(_,i)=>i+1));
 assert.equal(r.final.level,26);assert.equal(r.final.quests,210);assert.equal(r.final.orders,714);
 assert.equal(r.originalRuntimeObserved,false);
 for(const key of ['aidActions','directResourceStateEdits','tutorialSkips','inventoryInjections','paidEnergyPurchases'])assert.equal(r.assistance[key],0,key);
});
test('all three runs reconcile income and retain the same verified source revision',async()=>{
 const rows=data.seedComparison.seeds;assert.deepEqual(rows.map(r=>r.seed),[42,7,83]);
 for(const r of [data.continuation,...rows]){
  assert.equal(r.success,true);assert.equal(r.configRevision,config.revision);
  const i=r.income;assert.equal(r.initial.gold+i.fixedOrders+i.randomOrders+i.collectibles+i.sales-i.questCosts,r.final.gold);
  assert.equal(r.assistance.paidEnergyPurchases,0);assert.equal(r.assistance.aidActions,0);
  assert.deepEqual(r.sourceHashes,data.continuation.sourceHashes);
  if(r!==data.continuation){assert.equal(r.final.level,21);assert.equal(r.final.quests,150);assert.equal(r.final.fixedDone,16);assert.equal(r.metrics.actionSamples,r.actions);}
 }
 for(const [path,sha]of Object.entries(data.continuation.sourceHashes)){
  const source=(await readFile(new URL('../src/'+path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(source).digest('hex'),sha,path);
 }
});
test('growth UI exposes comparative meters and continuation checkpoint without raw action traces',()=>{
 const dom=new JSDOM(renderProgressionStudy({progressionValidation:data},{metric:'free',seed:83}));
 try{
  const d=dom.window.document;assert.equal(d.querySelectorAll('meter').length,3);
  assert.equal(d.querySelector('[data-growth-seed="83"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('[data-growth-point]').max,'209');
  assert.match(d.querySelector('#seed-detail-heading').textContent,/83/);
  assert.match(d.body.textContent,/행동 후 표본/);assert.match(d.body.textContent,/원작 계정 실행/);
  assert.equal(Object.hasOwn(data.continuation,'trace'),false);
 }finally{dom.window.close();}
});

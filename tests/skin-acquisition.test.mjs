import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createSkinAcquisitionState,validSkinAcquisitionState,normalizeSkinAcquisitionStore,importSkinAcquisitionStore,purchaseSkinAcquisition,summarizeSkinAcquisition,getVerifiedSkinAcquisitions,exportSkinAcquisition,restoreSkinAcquisition,renderSkinAcquisition,mountSkinAcquisition} from '../src/skin-acquisition.mjs';
const config=JSON.parse(readFileSync(new URL('../src/data/skin-acquisition-study.json',import.meta.url),'utf8'));
const old=(ids=['1'],extra={})=>({origin:'explicit-research-input',id:'research-old',mode:'event_reward',activityState:'Started',tokenType:'eventtok',initialTokens:100,event_reward:ids.map(id=>({id:'skin-'+id,type:'decoration',score:5,rewards:[id]})),...extra});
const piece=(stage,index,id,price=5)=>({stage,index,price,reward:[{Currency:'skin_rwd_'+id,Amount:1}]});
const staged=()=>({origin:'explicit-research-input',id:'research-new',mode:'mdNew_store',activityState:'Started',tokenType:'eventtok',initialTokens:50,mdNew_store:[piece(1,1,'1'),piece(1,2,'2'),{stage:1,index:0,reward:[{Currency:'gold',Amount:3}]},piece(2,1,'3'),{stage:2,index:0,reward:[{Currency:'eventtok',Amount:2}]},{stage:0,index:0,reward:[{Currency:'gem',Amount:1}]}]});
const request=(id='r1',offerId='skin-1',storeId='research-old')=>({requestId:id,storeId,offerId});

test('registered26 and exact reward/source keys are preserved; no actual price or grant on initial state',()=>{
  assert.equal(config.skins.length,26);assert.deepEqual(config.sets.map(set=>set.skinIds.length),[13,13]);assert.equal(config.allShippedSkinRegistrations,907);assert.equal(config.rewardTypeKey,'Currency');assert.equal(config.rewardCountKey,'Amount');
  assert.equal(config.actualPriceBindings,0);const state=createSkinAcquisitionState(config);assert.deepEqual(getVerifiedSkinAcquisitions(state,config).skinIds,[]);assert.match(renderSkinAcquisition(state,config),/실제 상품 가격은 미확보/);
});
test('explicit research input is required; missing prices, invalid IDs, counts and duplicate rows reject',()=>{
  for(const input of [old(['1'],{origin:'actual-server'}),old(['1'],{initialTokens:null}),old(['unknown']),old(['1','1']),old(['1'],{initialTokens:-1}),old(['1'],{initialTokens:1.2})])assert.throws(()=>normalizeSkinAcquisitionStore(input,config));
  const missing=old();missing.event_reward[0].score=null;assert.throws(()=>normalizeSkinAcquisitionStore(missing,config),/score/);
  const modern=staged();modern.mdNew_store[0].reward[0].Amount=2;assert.throws(()=>normalizeSkinAcquisitionStore(modern,config),/수량은1/);
  modern.mdNew_store[0].reward=[{Currency:'ar_person',Amount:1}];assert.throws(()=>normalizeSkinAcquisitionStore(modern,config),/카테고리/);
  modern.mdNew_store[0].reward=[{Currency:'skin_rwd_1',Amount:1}];modern.mdNew_store[2].reward=[{Currency:'skin_rwd_2',Amount:1}];assert.throws(()=>normalizeSkinAcquisitionStore(modern,config),/단계 Skin/);
});
test('successful purchase persists before ownership callback, derives wallet and emits exact skin reward route',async()=>{
  const state=createSkinAcquisitionState(config);assert.equal((await importSkinAcquisitionStore(state,old(),config)).ok,true);const order=[];
  const result=await purchaseSkinAcquisition(state,request(),config,{persist:async draft=>{order.push('save');assert.equal(draft.receipts.length,1);assert.equal(state.receipts.length,0);return true;},onAcquire:({skinIds,receipt})=>{order.push('acquire');assert.deepEqual(skinIds,['1']);assert.equal(state.receipts.length,1);assert.equal(receipt.cost.Amount,5);}});
  assert.equal(result.ok,true);assert.deepEqual(order,['save','acquire']);assert.equal(summarizeSkinAcquisition(state,config).stores[0].balance,95);assert.deepEqual(getVerifiedSkinAcquisitions(state,config).skinIds,['1']);assert.deepEqual(result.receipt.rewards,[{Currency:'skin_rwd_1',Amount:1}]);assert.deepEqual(result.receipt.rewardPath,['skin_rwd_ID','RewardApi','SkinRewardCategoryHandler','MapDataModel.AcquireSkin']);
});
test('duplicate request replays once, conflicting request and already-owned skin never charge twice',async()=>{
  const state=createSkinAcquisitionState(config);await importSkinAcquisitionStore(state,old(['1','2']),config);let calls=0;const options={onAcquire:()=>calls++};
  assert.equal((await purchaseSkinAcquisition(state,request(),config,options)).ok,true);const replay=await purchaseSkinAcquisition(state,request(),config,options);assert.equal(replay.replayed,true);assert.equal(calls,1);
  assert.equal((await purchaseSkinAcquisition(state,request('r1','skin-2'),config)).code,'request-id-conflict');assert.equal((await purchaseSkinAcquisition(state,request('r2'),config)).code,'already-owned');assert.equal(summarizeSkinAcquisition(state,config).stores[0].balance,95);
});
test('insufficient balance, closed old activity, stale request and save failure preserve entire state',async()=>{
  for(const extra of [{initialTokens:2},{activityState:'Ended'}]){const state=createSkinAcquisitionState(config);await importSkinAcquisitionStore(state,old(['1'],extra),config);const before=JSON.stringify(state);assert.equal((await purchaseSkinAcquisition(state,request(),config)).ok,false);assert.equal(JSON.stringify(state),before);}
  const state=createSkinAcquisitionState(config);await importSkinAcquisitionStore(state,old(),config);const before=JSON.stringify(state);let acquired=0;
  assert.equal((await purchaseSkinAcquisition(state,{...request(),expectedReceiptCount:4},config)).code,'stale-request');assert.equal(JSON.stringify(state),before);
  const saved=await purchaseSkinAcquisition(state,request(),config,{persist:()=>false,onAcquire:()=>acquired++});assert.equal(saved.code,'save-failed');assert.equal(JSON.stringify(state),before);assert.equal(acquired,0);
  assert.equal((await purchaseSkinAcquisition(state,request(),config,{persist:()=>{throw Error('quota');}})).ok,false);assert.equal(JSON.stringify(state),before);
});
test('one asynchronous save excludes concurrent purchase and import without exposing half-applied ownership',async()=>{
  const state=createSkinAcquisitionState(config);await importSkinAcquisitionStore(state,old(['1','2']),config);let release,entered;const gate=new Promise(resolve=>entered=resolve);const held=new Promise(resolve=>release=resolve);
  const first=purchaseSkinAcquisition(state,request(),config,{persist:async()=>{entered();await held;return true;}});await gate;
  assert.equal(state.receipts.length,0);assert.equal((await purchaseSkinAcquisition(state,request('r2','skin-2'),config)).code,'busy');assert.equal((await importSkinAcquisitionStore(state,old(['3'],{id:'another'}),config)).code,'busy');release();assert.equal((await first).ok,true);assert.equal(state.receipts.length,1);
});
test('stage gating, automatic exact property rewards and final reward are derived without main-wallet mutation',async()=>{
  const state=createSkinAcquisitionState(config);await importSkinAcquisitionStore(state,staged(),config);
  assert.equal((await purchaseSkinAcquisition(state,request('s3','2:1','research-new'),config)).code,'stage-locked');
  await purchaseSkinAcquisition(state,request('s1','1:1','research-new'),config);let summary=summarizeSkinAcquisition(state,config);assert.deepEqual(summary.stores[0].stageClaims,[]);
  const second=await purchaseSkinAcquisition(state,request('s2','1:2','research-new'),config);assert.deepEqual(second.receipt.stageClaims,[1]);assert.deepEqual(second.receipt.stageRewardGrants,[{stage:1,rewards:[{Currency:'gold',Amount:3}]}]);
  const third=await purchaseSkinAcquisition(state,request('s3','2:1','research-new'),config);assert.equal(third.ok,true);summary=summarizeSkinAcquisition(state,config);assert.equal(summary.stores[0].balance,37);assert.deepEqual(summary.stores[0].propertyRewards,{gold:3,gem:1});assert.deepEqual(summary.stores[0].stageClaims,[1,2,0]);
});
test('whole-set completion requires all13 earned IDs and survives export/reconnect; forged ownership or receipt changes reject',async()=>{
  const state=createSkinAcquisitionState(config);const ids=config.sets[0].skinIds;await importSkinAcquisitionStore(state,old(ids),config);
  for(let n=0;n<ids.length;n++){const result=await purchaseSkinAcquisition(state,request('set-'+n,'skin-'+ids[n]),config);assert.equal(result.ok,true);assert.equal(result.receipt.completedSetIds.length,n===12?1:0);}
  const restored=restoreSkinAcquisition(exportSkinAcquisition(state,config),config);assert.deepEqual(getVerifiedSkinAcquisitions(restored,config).completedSetIds,[config.sets[0].id]);assert.equal(getVerifiedSkinAcquisitions(restored,config).skinIds.length,13);
  const fake=structuredClone(restored);fake.ownedSkinIds=['26'];assert.equal(validSkinAcquisitionState(fake,config),false);delete fake.ownedSkinIds;fake.receipts[0].cost.Amount=0;assert.equal(validSkinAcquisitionState(fake,config),false);assert.throws(()=>restoreSkinAcquisition(fake,config));
});
test('snapshot ID cannot refill balance or replace a price, and callback failure retains a committed receipt for recovery',async()=>{
  const state=createSkinAcquisitionState(config);await importSkinAcquisitionStore(state,old(),config);assert.equal((await importSkinAcquisitionStore(state,old(),config)).replayed,true);assert.equal((await importSkinAcquisitionStore(state,old(['1'],{initialTokens:999}),config)).code,'store-id-conflict');
  const result=await purchaseSkinAcquisition(state,request(),config,{persist:()=>true,onAcquire:()=>{throw Error('map link');}});assert.equal(result.ok,true);assert.equal(result.callbackError,'map link');assert.deepEqual(getVerifiedSkinAcquisitions(state,config).skinIds,['1']);
});
test('snapshot SHA-256 and receipt hash references reject edited reconnect data',async()=>{
  const state=createSkinAcquisitionState(config);await importSkinAcquisitionStore(state,old(),config);await purchaseSkinAcquisition(state,request(),config);
  const changed=structuredClone(state);changed.stores[0].snapshot.initialTokens=1000;assert.equal(validSkinAcquisitionState(changed,config),false);assert.throws(()=>restoreSkinAcquisition(changed,config));
  const hash=structuredClone(state);hash.stores[0].snapshotHash='a'.repeat(64);assert.equal(validSkinAcquisitionState(hash,config),false);
  const reference=structuredClone(state);reference.receipts[0].snapshotHash='b'.repeat(64);assert.equal(validSkinAcquisitionState(reference,config),false);
});
test('missing stage reward keeps next stage locked, while owned-skin recovery does not mint a duplicate stage reward',async()=>{
  const state=createSkinAcquisitionState(config);const snapshot=staged();snapshot.mdNew_store=snapshot.mdNew_store.filter(row=>!(row.stage===1&&row.index===0));await importSkinAcquisitionStore(state,snapshot,config);
  await purchaseSkinAcquisition(state,request('n1','1:1','research-new'),config);await purchaseSkinAcquisition(state,request('n2','1:2','research-new'),config);assert.equal((await purchaseSkinAcquisition(state,request('n3','2:1','research-new'),config)).code,'stage-locked');
  const recovered=createSkinAcquisitionState(config);await importSkinAcquisitionStore(recovered,old(['1','2']),config);await purchaseSkinAcquisition(recovered,request('old1'),config);await purchaseSkinAcquisition(recovered,request('old2','skin-2'),config);await importSkinAcquisitionStore(recovered,staged(),config);
  const next=await purchaseSkinAcquisition(recovered,request('new3','2:1','research-new'),config);assert.equal(next.ok,true);assert.deepEqual(next.receipt.recoveredClaims,['1:1','1:2']);const rewards=summarizeSkinAcquisition(recovered,config).stores.find(store=>store.id==='research-new').propertyRewards;assert.equal(rewards.gold,undefined);assert.equal(rewards.gem,1);
});
test('overflowing configured stage reward and failed store import roll back before persistence',async()=>{
  const state=createSkinAcquisitionState(config),before=JSON.stringify(state);assert.equal((await importSkinAcquisitionStore(state,old(),config,{persist:()=>false})).ok,false);assert.equal(JSON.stringify(state),before);
  const snapshot=staged();snapshot.initialTokens=config.limits.maxAmount;snapshot.mdNew_store[0].price=0;snapshot.mdNew_store[1].price=0;snapshot.mdNew_store[2].reward=[{Currency:'eventtok',Amount:1}];await importSkinAcquisitionStore(state,snapshot,config);await purchaseSkinAcquisition(state,request('a','1:1','research-new'),config);const saved=JSON.stringify(state);assert.equal((await purchaseSkinAcquisition(state,request('b','1:2','research-new'),config)).code,'overflow');assert.equal(JSON.stringify(state),saved);
});
test('UI imports explicit numbers, performs purchase and exports state through callbacks',async()=>{
  const state=createSkinAcquisitionState(config),dom=new JSDOM(`<main>${renderSkinAcquisition(state,config)}</main>`);let acquired=0,downloaded='';const cleanup=mountSkinAcquisition(dom.window.document.querySelector('main'),state,config,{persist:()=>true,onAcquire:()=>acquired++,onExport:text=>downloaded=text});const document=dom.window.document;
  const form=document.querySelector('[data-skin-acq-simple]');form.elements.initialTokens.value='9';form.elements.score.value='4';form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  for(let n=0;n<30&&!state.stores.length;n++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(state.stores.length,1);
  document.querySelector('[data-skin-acq-buy]').click();for(let n=0;n<30&&!state.receipts.length;n++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(state.receipts.length,1);assert.equal(acquired,1);assert.equal(summarizeSkinAcquisition(state,config).stores[0].balance,5);
  document.querySelector('[data-skin-acq-action="export"]').click();assert.match(downloaded,/isolated-skin-acquisition-research/);cleanup();
});
test('invalid advanced input stays available for correction and default prices are never silently filled',async()=>{
  const state=createSkinAcquisitionState(config),dom=new JSDOM(`<main>${renderSkinAcquisition(state,config)}</main>`);const cleanup=mountSkinAcquisition(dom.window.document.querySelector('main'),state,config);const document=dom.window.document,textarea=document.querySelector('[data-skin-acq-json]');textarea.value='{invalid';document.querySelector('[data-skin-acq-action="import"]').click();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(document.querySelector('[data-skin-acq-json]').value,'{invalid');assert.equal(state.stores.length,0);assert.equal(document.querySelector('[name="score"]').value,'');cleanup();
});

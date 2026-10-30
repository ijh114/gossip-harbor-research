import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {validRandomRewardStudy,sourceFallbackConfig,conditionalFallbackDistribution,factoryRandomRewardTarget,createFactoryFallbackResearchInput,renderRandomRewardStudy} from '../src/random-reward-study.mjs';
import {resolveFactoryRandomReward} from '../src/factory-random-reward.mjs';
import {validFactoryInputs} from '../src/factory-transaction.mjs';
const study=JSON.parse(await readFile(new URL('../src/data/random-reward-study.json',import.meta.url),'utf8'));
const board=()=>{const b=Array(63).fill(null);b[59]={uid:875,type:'101',cover:'box'};return b;};
test('the recovered fallback remains separate from the missing named server row',()=>{
 assert.equal(validRandomRewardStudy(study),true);assert.equal(study.namedServerTableRecovered,false);assert.equal(study.staticOriginalUid,null);
 const source=sourceFallbackConfig(study);assert.equal(source.origin,'source-provided');assert.equal(source.rows[0].name,'rdm_rwd_chest_default');
 assert.equal(resolveFactoryRandomReward(source,'rdm_rwd_mainboard_1',{energy:{choice:0,amount:0}}).ok,false);
 const dist=conditionalFallbackDistribution(study);assert.equal(dist.rows[0].probability,.9);assert.equal(dist.rows[1].probability,.1);assert.ok(Math.abs(dist.expectedEnergy-49.05)<1e-10);assert.equal(dist.liveServerOddsObserved,false);
});
test('target is the actual matching current-cell UID, never a statically invented ID',()=>{
 assert.equal(factoryRandomRewardTarget(study,board()).uid,875);
 for(const modification of[b=>{b[59].cover='web';},b=>{b[59].type='104';},b=>{b[59]=null;}]){const b=board();modification(b);assert.equal(factoryRandomRewardTarget(study,b).ok,false);}
 const duplicate=board();duplicate[0]={uid:875,type:'102',cover:null};assert.equal(factoryRandomRewardTarget(study,duplicate).ok,false);
 assert.equal(factoryRandomRewardTarget(study,[]).ok,false);
});
test('missing branch, UID and both normalized draws must be explicit; there is no RNG or award',()=>{
 const b=board(),before=JSON.stringify(b);const options={board:b,uid:875,choice:0,amount:0};
 assert.equal(createFactoryFallbackResearchInput(study,options).ok,false);
 assert.equal(createFactoryFallbackResearchInput(study,{...options,acknowledgeMissingServerRow:true,uid:876}).ok,false);
 for(const choice of[-.1,1,NaN,Infinity,'0',undefined])assert.equal(createFactoryFallbackResearchInput(study,{...options,choice,acknowledgeMissingServerRow:true}).ok,false);
 const original=Math.random;Math.random=()=>{throw Error('RNG must not be called');};let result;try{result=createFactoryFallbackResearchInput(study,{...options,acknowledgeMissingServerRow:true});}finally{Math.random=original;}
 assert.equal(result.ok,true);assert.equal(result.status,'research-input-plan');assert.equal(result.origin,'research-example');assert.equal(result.nativeRngObserved,false);assert.equal(result.randomRewardConfig.origin,'research-example');assert.deepEqual(result.randomRewardDraws,{'875':{energy:{choice:0,amount:0}}});assert.deepEqual(result.preview.rewards,[{type:'energy',count:20}]);assert.equal(JSON.stringify(b),before);
 assert.equal(validFactoryInputs({schema:1,mode:'research',serverEnabled:true,unlockMode:'assumed',randomRewardConfig:result.randomRewardConfig,randomRewardDraws:result.randomRewardDraws}),true);
});
test('inclusive intervals and exact 90% normalized boundary reproduce the supplied expression model',()=>{
 const options={board:board(),uid:875,acknowledgeMissingServerRow:true};
 for(const [choice,amount,count]of[[0,0,20],[.899999,.999999,70],[.9,0,71],[.999999,.999999,100]]){const out=createFactoryFallbackResearchInput(study,{...options,choice,amount});assert.equal(out.preview.rewards[0].count,count);}
});
test('study UI states source/server distinction, has no preset random values and gates missing targets',()=>{
 const doc=new JSDOM(renderRandomRewardStudy(study,{board:board()})).window.document;
 assert.match(doc.body.textContent,/미관측 연구 가정/);assert.match(doc.body.textContent,/현재 운영 상자의 확률·기대값/);
 assert.equal(doc.querySelector('[data-random-study-choice]').value,'');assert.equal(doc.querySelector('[data-random-study-amount]').value,'');assert.equal(doc.querySelector('[data-random-study-ack]').checked,false);
 assert.equal(doc.querySelector('[data-random-study-apply]').disabled,false);assert.equal(doc.querySelector('[data-random-study-apply]').dataset.randomStudyUid,'875');
 const missing=new JSDOM(renderRandomRewardStudy(study)).window.document;assert.equal(missing.querySelector('[data-random-study-apply]').disabled,true);
 const bad=structuredClone(study);bad.factoryResearchConfig.origin='source-provided';assert.equal(validRandomRewardStudy(bad),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {sceneSteps,sceneCursor,chooseSceneVariant,advanceScene,canCommitScene,commitSceneChoices} from '../src/scene-script.mjs';
import {createPlay,playAction,validPlay} from '../src/play-model.mjs';
import {screenFlow,beginTaskScene,leaveScene} from '../src/screen-flow.mjs';
import {renderSceneAnalysis,renderExtendedGrowth} from '../src/research-completion.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../src/data/'+p,import.meta.url),'utf8'));
const [data,c,growth]=await Promise.all(['scene-config.json','play-config.json','progress-extended.json'].map(read));

test('all 106 selected tasks retain source metadata, required choices and physically decoded previews with exact hashes',async()=>{
 assert.equal(data.tasks.length,106);assert.equal(data.summary.taskCommands,1357);assert.equal(data.mediaEntries.length,116);
 for(const t of data.tasks){assert.equal(t.cost,c.quests.find(q=>q.id===t.id).cost);assert.equal(sceneSteps(t).at(-1).kind,'end');}
 assert.equal(data.tasks.reduce((sum,t)=>sum+t.decorSlots.length,0),41);
 for(const t of data.tasks)for(const slot of t.decorSlots){assert.deepEqual(slot.variants.map(v=>v.id),['1','2','3']);for(const v of slot.variants){if(v.previewKey)assert.ok(data.mediaEntries.some(m=>m.key===v.previewKey));else {assert.equal(v.artStatus,'registered-not-physically-included');assert.ok(v.previewUnavailableReason);}}}
 for(const m of data.mediaEntries){const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),m.sha256,m.key);}
 assert.ok(data.corrections.length);assert.doesNotMatch(JSON.stringify(data),/[CD]:\\/);
});

test('source choice cannot be skipped and task hold/restart preserves the exact cursor and selected draft',()=>{
 const s=createPlay(c);s.stage='home';s.wallet.coins=26;playAction(s,'quest-start',null,c);beginTaskScene(s,c);const f=screenFlow(s,c),scene=data.tasks[0];
 while(sceneCursor(f.task,scene).step.kind!=='choice')assert.equal(advanceScene(f.task,scene),true);
 assert.equal(advanceScene(f.task,scene),false);assert.equal(chooseSceneVariant(f.task,scene,'100'),false);assert.equal(chooseSceneVariant(f.task,scene,'2'),true);
 const old=structuredClone(f.task);leaveScene(s,c);beginTaskScene(s,c);assert.deepEqual(screenFlow(s,c).task,old);
 const restored=JSON.parse(JSON.stringify(s));assert.deepEqual(sceneCursor(restored.screenFlow.task,scene).choices,old.script.choices);
});

test('corrupt late cursor with missing required choices rewinds to an actionable choice instead of trapping the player at the end',()=>{
 const scene=data.tasks[0],task={id:scene.id,script:{sceneId:scene.id,index:999,choices:{[scene.decorSlots[0].id]:'invalid'}}};
 const cursor=sceneCursor(task,scene);assert.equal(cursor.step.kind,'choice');assert.equal(canCommitScene(task,scene),false);assert.equal(chooseSceneVariant(task,scene,'1'),true);assert.equal(advanceScene(task,scene),true);
});

test('all source sequences commit normal domain costs/rewards once and retain all 41 registered choice slots',()=>{
 const s=createPlay(c);s.stage='home';s.wallet.coins=data.tasks.reduce((sum,t)=>sum+t.cost,0);const initial=s.wallet.coins;
 for(const scene of data.tasks){assert.equal(playAction(s,'quest-start',null,c).ok,true);beginTaskScene(s,c);const f=screenFlow(s,c);
  for(let steps=0;steps<100&&!canCommitScene(f.task,scene);steps++){const current=sceneCursor(f.task,scene).step;if(current.kind==='choice')assert.equal(chooseSceneVariant(f.task,scene,'3'),true);assert.equal(advanceScene(f.task,scene),true);}
  assert.equal(canCommitScene(f.task,scene),true);assert.equal(playAction(s,'quest-finish',null,c).ok,true);assert.equal(commitSceneChoices(f,f.task,scene),true);leaveScene(s,c);
  assert.equal(playAction(s,'quest-finish',null,c).ok,false);assert.equal(validPlay(s,c),true);
 }
 assert.equal(s.questsDone,106);assert.equal(s.wallet.coins,0);assert.ok(initial>0);assert.equal(Object.keys(s.screenFlow.decor).length,41);
});

test('story images preserve their actual source position and are not treated as missing dialogue text',()=>{
 const scene=data.tasks.find(x=>x.id==='1_2'),steps=sceneSteps(scene);const image=steps.find(x=>x.kind==='illustration');assert.ok(image.image.mediaKey);assert.equal(image.image.step,3);
 assert.equal(steps.filter(x=>x.storyId==='1_2_begin'&&x.kind==='omitted-dialogue').reduce((sum,x)=>sum+x.remaining,0),3);
});

test('scene research and extended-growth surfaces expose corrected facts and source boundaries without scripts or private sessions',()=>{
 const dom=new JSDOM(renderSceneAnalysis({sceneConfig:data},'1_4')+renderExtendedGrowth({progressExtended:growth}));
 assert.equal(dom.window.document.querySelectorAll('.scene-variant-grid img').length,3);assert.match(dom.window.document.body.textContent,/정정/);assert.match(dom.window.document.body.textContent,/Lv21/);assert.ok(dom.window.document.querySelector('[data-growth-point]'));dom.window.close();
 assert.equal(growth.final.quests,60);assert.equal(growth.final.orders,169);assert.equal(growth.assistance.aidActions,0);assert.equal(growth.assistance.paidEnergyPurchases,0);
 assert.doesNotMatch(JSON.stringify(growth),/sessionExport|"trace"\s*:|[CD]:\\/);
});

test('late growth retains a legal no-aid 150-quest trace summary and exact executable source hashes',async()=>{
 const r=growth.late;assert.equal(r.success,true);assert.equal(r.final.level,21);assert.equal(r.final.orders,479);assert.equal(r.final.quests,150);assert.equal(r.points.length,150);
 for(const field of ['aidActions','directResourceStateEdits','tutorialSkips','paidEnergyPurchases'])assert.equal(r.assistance[field],0);
 for(const [name,hash]of Object.entries(r.sourceHashes))assert.equal(createHash('sha256').update(await readFile(new URL('../src/'+name,import.meta.url))).digest('hex'),hash,name);
 assert.equal(r.income.fixedOrders+r.income.randomOrders+r.income.collectibles+r.income.sales-r.income.questCosts,r.final.gold-r.initial.gold);
});

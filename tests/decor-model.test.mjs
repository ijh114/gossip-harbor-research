import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPlay,validPlay} from '../src/play-model.mjs';
import {screenFlow} from '../src/screen-flow.mjs';
import {completedDecorSlots,beginDecorEdit,decorEditView,previewDecor,confirmDecorEdit,cancelDecorEdit} from '../src/decor-model.mjs';
const [c,scenes]=await Promise.all(['play-config.json','scene-config.json'].map(async p=>JSON.parse(await readFile(new URL('../src/data/'+p,import.meta.url),'utf8'))));
function setup(){const s=createPlay(c);s.stage='home';s.questsDone=1;screenFlow(s,c).decor['1_1']='1';return s;}
const domain=s=>{const x=structuredClone(s);delete x.screenFlow;return x;};
test('decor preview persists separately, cancel restores committed design and confirm never regrants rewards',()=>{
 const s=setup(),before=domain(s);assert.equal(beginDecorEdit(s,c,scenes,'1_1').ok,true);
 assert.equal(previewDecor(s,c,scenes,'2').ok,true);assert.equal(s.screenFlow.decor['1_1'],'1');
 const restored=JSON.parse(JSON.stringify(s));screenFlow(restored,c);assert.equal(decorEditView(restored,c,scenes).selected,'2');assert.equal(validPlay(restored,c),true);
 assert.equal(cancelDecorEdit(restored).ok,true);assert.equal(restored.screenFlow.decor['1_1'],'1');assert.deepEqual(domain(restored),before);
 beginDecorEdit(s,c,scenes,'1_1');previewDecor(s,c,scenes,'3');assert.equal(confirmDecorEdit(s,c,scenes).ok,true);assert.equal(s.screenFlow.decor['1_1'],'3');assert.deepEqual(domain(s),before);assert.equal(confirmDecorEdit(s,c,scenes).ok,false);
});
test('editor rejects future, pending, locked, invalid or stale choices',()=>{
 const s=setup();assert.equal(beginDecorEdit(s,c,scenes,'12_11').ok,false);assert.equal(beginDecorEdit(s,c,scenes,'1_1',{inputLocked:true}).ok,false);
 s.pendingQuest={id:c.quests[1].id};assert.equal(beginDecorEdit(s,c,scenes,'1_1').ok,false);s.pendingQuest=null;
 beginDecorEdit(s,c,scenes,'1_1');assert.equal(previewDecor(s,c,scenes,'unknown').ok,false);previewDecor(s,c,scenes,'2');s.screenFlow.decor['1_1']='3';assert.equal(decorEditView(s,c,scenes).conflict,true);assert.equal(confirmDecorEdit(s,c,scenes).ok,false);cancelDecorEdit(s);assert.equal(s.screenFlow.decor['1_1'],'3');
});
test('legacy completed tasks without design records require an explicit new web choice',()=>{
 const s=setup();delete s.screenFlow.decor['1_1'];assert.equal(completedDecorSlots(s,c,scenes)[0].historicalUnknown,true);
 beginDecorEdit(s,c,scenes,'1_1');assert.equal(decorEditView(s,c,scenes).canConfirm,false);assert.equal(confirmDecorEdit(s,c,scenes).ok,false);
 previewDecor(s,c,scenes,'2');confirmDecorEdit(s,c,scenes);assert.equal(s.screenFlow.decor['1_1'],'2');assert.equal(s.questsDone,1);
});

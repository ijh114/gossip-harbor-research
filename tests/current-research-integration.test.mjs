import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {integrateCompletionData} from '../src/completion-data.mjs';
import {itemRepresentation} from '../src/item-representation.mjs';
const load=n=>JSON.parse(readFileSync(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
test('only complete new bytecode proof enables the instant Bubble source fallback; fixture IDs never alias registered art',()=>{
 const data={itemRepresentation:load('item-representation'),itemRepresentationRemote:load('item-representation-remote'),itemResolutionFollowup:load('item-resolution-followup'),media:load('media')};
 const old=integrateCompletionData({...data,itemResolutionFollowup:null});assert.equal(itemRepresentation('ib#101',{media:data.media},old.itemRepresentation).status,'partial-component');
 const current=integrateCompletionData(data);const bubble=itemRepresentation('ib#101',{media:data.media},current.itemRepresentation);assert.equal(bubble.status,'source-composite');assert.equal(bubble.layers.find(l=>l.role==='outer').sha256,data.itemResolutionFollowup.bubble.outerSHA256);assert.equal(bubble.nativeFrameMatched,false);
 for(const row of current.itemRepresentation.entries.filter(r=>r.group==='representative-event'))assert.equal(itemRepresentation(row.type,{media:data.media},current.itemRepresentation).status,'unresolved');
 const forged=structuredClone(data);forged.itemResolutionFollowup.bubble.bytecode.instructions[5].word=0;assert.equal(itemRepresentation('ib#101',{media:data.media},integrateCompletionData(forged).itemRepresentation).status,'partial-component');
});
test('resource graph keeps all1020 source IDs and replaces prefix-only scope with full motion scope',()=>{
 const original=load('resource-resolution'),motion=load('spine-motion-study');const current=integrateCompletionData({resourceResolution:original,spineMotionStudy:motion}).resourceResolution;
 assert.deepEqual(current.records.map(r=>r.id),original.records.map(r=>r.id));assert.equal(current.records.filter(r=>r.kind==='spine'&&r.motionStudy).length,654);assert.ok(!current.boundaries.some(x=>x.includes('대표6종만')));assert.equal(original.records.some(r=>r.motionStudy),false);
});

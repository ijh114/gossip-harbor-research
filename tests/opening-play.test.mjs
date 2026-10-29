import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createOpeningPlay,validOpeningPlay,openingPlayAction,openingPlayView} from '../src/opening-play.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/scene-config.json',import.meta.url),'utf8'));
test('source intro follows ordered masks, cameras and curated dialogue without manufacturing omitted bodies',()=>{
 const s=createOpeningPlay(c),seen=[];for(let i=0;i<30;i++){const v=openingPlayView(s,c);seen.push(v.step.kind);const out=openingPlayAction(s,{type:'next'},c);assert.ok(out.ok);if(out.finished)break;}
 assert.equal(s.phase,'done');assert.deepEqual(seen,['mask','camera','camera','dialogue','dialogue','omitted-dialogue','end']);assert.equal(validOpeningPlay(JSON.parse(JSON.stringify(s)),c),true);
});
test('declared time has strict boundaries, dialogue requires input and pause/reload preserves the remaining delay',()=>{
 const s=createOpeningPlay(c);openingPlayAction(s,{type:'autoplay',value:true},c);assert.equal(openingPlayAction(s,{type:'next'},c).status,'input-locked');openingPlayAction(s,{type:'advance',seconds:2.799},c);assert.equal(s.index,0);openingPlayAction(s,{type:'pause'},c);const paused=structuredClone(s);assert.equal(openingPlayAction(s,{type:'advance',seconds:1},c).ok,false);assert.deepEqual(s,paused);openingPlayAction(s,{type:'resume'},c);openingPlayAction(s,{type:'advance',seconds:.0011},c);assert.equal(s.index,1);openingPlayAction(s,{type:'advance',seconds:2.5},c);openingPlayAction(s,{type:'advance',seconds:2.5},c);assert.equal(openingPlayView(s,c).step.kind,'dialogue');assert.equal(openingPlayAction(s,{type:'advance',seconds:60},c).ok,false);assert.equal(s.index,3);
});
test('defined corrupt opening state stays intact; skip is explicit and leaves the domain outside the model',()=>{
 assert.equal(validOpeningPlay(undefined,c),true);assert.equal(validOpeningPlay(null,c),false);const s={...createOpeningPlay(c),index:999},before=structuredClone(s);assert.equal(openingPlayAction(s,{type:'next'},c).ok,false);assert.deepEqual(s,before);const good=createOpeningPlay(c);assert.equal(openingPlayAction(good,{type:'skip'},c).finished,true);assert.equal(good.phase,'skipped');assert.equal(Object.hasOwn(good,'wallet'),false);
});

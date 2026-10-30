import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {JSDOM} from 'jsdom';
import {sourceFrameAt,sourceRolePoint,sourceUILayout,sourceMapActors,sourceCGActors,sourceAudioCue,renderSourceSceneStage,createSourceSceneStage} from '../src/source-scene-stage.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/source-scene-stage.json',import.meta.url),'utf8'));
test('complete selected source-frame collection has full endpoints and exact shipped derivatives',()=>{
  assert.equal(data.motions.length,285);assert.equal(data.scenes.length,117);assert.equal(data.summary.sourceFrames,4201);
  for(const m of data.motions){
    assert.equal(m.times[0],0);assert.ok(Math.abs(m.times.at(-1)-m.duration)<1e-6);
    assert.equal(sourceFrameAt(m,m.duration).frame,m.frameCount-1);
    assert.equal(sourceFrameAt(m,m.duration+100).frame,m.frameCount-1);
    if(m.duration>0)assert.equal(sourceFrameAt(m,m.duration,true).frame,0);
    for(const f of [...m.sheets,m.poster]){const bytes=fs.readFileSync(new URL('../src/'+f.src.replace(/^\.\//,''),import.meta.url));assert.equal(bytes.length,f.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256);}
  }
  assert.equal(data.originalGameExecuted,false);
  assert.ok(!fs.readFileSync(new URL('../src/data/source-scene-stage.json',import.meta.url),'utf8').includes('geometryPath'));
});
test('all selected UI and audio files match their recorded source derivation hashes and preserve 64-bit identifiers',()=>{
  assert.equal(data.mediaEntries.length,657);assert.equal(data.audio.clips.length,16);
  for(const f of data.mediaEntries){const bytes=fs.readFileSync(new URL('../src/'+f.src.replace(/^\.\//,''),import.meta.url));assert.equal(bytes.length,f.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256);}
  function visit(x){if(Array.isArray(x))x.forEach(visit);else if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if(['pathId','path_id','m_PathID'].includes(k))assert.equal(typeof v,'string');visit(v);}}
  visit(data);
  const bytes=fs.readFileSync(new URL('../src/data/source-scene-stage.json',import.meta.url));assert.equal(bytes.includes(13),false,'physical JSON uses LF');
});
test('source role preserves native hierarchy, raw Spine scale and Y-axis flip',()=>{
  const r=data.roles.find(x=>x.id==='Quinn'),pos=[-16,0,-112.6];
  const zero=sourceRolePoint(data,'Quinn',{position:pos,scale:1,flip:false},[0,0,0]);
  assert.ok(Math.abs(zero[0]-pos[0])<1e-6);assert.ok(Math.abs(zero[1]-r.sourceChain[1].trs.position[1])<1e-6);
  const right=sourceRolePoint(data,'Quinn',{position:pos,scale:1,flip:false},[100,0,0]);
  const left=sourceRolePoint(data,'Quinn',{position:pos,scale:1,flip:true},[100,0,0]);
  assert.ok(Math.abs(right[0]+left[0]-2*pos[0])<1e-6);
  assert.ok(Math.abs(right[0]-pos[0]-r.skeletonScale*100*r.sourceChain[1].trs.scale[0])<1e-6);
  assert.equal(sourceRolePoint(data,'not-a-source-role',{},[0,0,0]),null);
});
test('all source cues resolve endpoint frames, source wait delays and research random choices explicitly',()=>{
  let delayed=0,queues=0;
  for(const s of data.scenes)for(const c of s.cues){
    const actors=sourceMapActors(data,{scene:s.id,order:c.order,time:10});assert.ok(actors.every(a=>a.frame),'all selected native source directives have derived media: '+c.id);
    if(c.delay>0){const a=sourceMapActors(data,{scene:s.id,order:c.order,time:0}).find(a=>a.cue.id===c.id);if(a){assert.equal(a.waiting,true);delayed++;}}
    if(c.type==='roleActionlist'){const a=actors.find(a=>a.cue.id===c.id);if(a){assert.equal(a.compatible,true);assert.match(a.motionKey,/^queue:/);queues++;}}
  }
  assert.ok(delayed>0);assert.equal(queues,4);
  const first=sourceMapActors(data,{scene:'intro_timeline',order:2,time:0}).find(a=>a.cue.role==='Quinn');assert.equal(first.frame.motion.animation,'Quinn_idle');assert.equal(first.waiting,true);
});
test('native RectTransform anchors, pivots and nesting retain actual canvas origin',()=>{
  for(const p of [...data.recap.prefabs,...data.CG.prefabs]){
    const layout=sourceUILayout(p),root=layout.get(p.nodes[0].path);assert.deepEqual(root.size,p.id==='StoryRecapEntry'?[0,0]:[1080,1920]);assert.deepEqual(root.matrix,[1,0,0,1,540,960]);
    assert.equal(layout.size,p.nodes.length);assert.ok([...layout.values()].every(l=>l.matrix.every(Number.isFinite)));
  }
});
test('CG never invents idle for empty native fields; only exact commands invoke selected animations',()=>{
  let blanks=0;
  for(const p of data.CG.prefabs){for(const a of sourceCGActors(data,{scene:p.sceneId,time:2})){if(a.blankStartingAnimation){assert.equal(a.frame,null);blanks++;}}}
  assert.ok(blanks>0);
  const enter=sourceCGActors(data,{scene:'cg-scene1',phase:'enter',time:0}).find(a=>a.role==='scene1_Quinn');assert.equal(enter.frame.motion.animation,'scene1_Quinn_enter');
  const loop=sourceCGActors(data,{scene:'cg-scene1',phase:'enter',time:100}).find(a=>a.role==='scene1_Quinn');assert.equal(loop.frame.motion.animation,'scene1_Quinn_loop');assert.equal(loop.sourcePhase,1286);
  assert.equal(data.CG.nativeSpineMethods.find(m=>m.method==='SetAnimation(string)').pointer,'0x1401634');
  const p=data.CG.prefabs.find(p=>p.sceneId==='cg-scene1'),phase=data.CG.phases.find(p=>p.scene==='cg-scene1'&&p.id==='enter');
  const l=sourceUILayout(p,[1080,1920],Object.fromEntries(phase.visibility.map(x=>[x.path,{active:x.active}])));
  assert.ok(phase.visibility.every(x=>l.get(x.path).active===false));
});
test('source audio handles explicit flags and does not loop a 15-second BGM excerpt',()=>{
  assert.equal(sourceAudioCue(data,'mode-main'),null);assert.equal(sourceAudioCue(data,'mode-map',{mapExploreOverride:true}),null);
  assert.equal(sourceAudioCue(data,'dialogue-cell-ready',{ignoreAudioEffect:true}),null);
  const bgm=sourceAudioCue(data,'mode-main',{bgmSwitchOpen:true});assert.equal(bgm.name,'bgmScene2');assert.equal(bgm.isMusicExcerpt,true);assert.equal(bgm.loop,false);
  assert.equal(sourceAudioCue(data,'recap-page-change').name,'sfxStoryIn');
  assert.equal(sourceAudioCue(data,'arbitrary-unknown-effect'),null);
});
function harness(){
  const dom=new JSDOM('<main>'+renderSourceSceneStage(data,{mode:'map',scene:'intro_timeline',order:2,playing:false})+'</main>',{pretendToBeVisual:true});
  const context=new Proxy({},{get:(_,k)=>k==='canvas'?null:()=>{}});dom.window.HTMLCanvasElement.prototype.getContext=()=>context;
  class Img{set src(v){this.width=this.height=240;queueMicrotask(()=>this.onload?.());}}
  let ms=0,rafId=0;const callbacks=new Map(),audio=[];
  const c=createSourceSceneStage(data,{Image:Img,now:()=>ms,requestAnimationFrame:cb=>{callbacks.set(++rafId,cb);return rafId;},cancelAnimationFrame:id=>callbacks.delete(id),onAudio:c=>audio.push(c)});
  return {dom,c,callbacks,audio,tick(dt){ms+=dt;const current=[...callbacks.values()];callbacks.clear();for(const f of current)f(ms);}};
}
test('controller keeps directive-local clocks through same-mode rerender and fully removes callbacks on cleanup',async()=>{
  const h=harness();h.c.mount(h.dom.window.document.querySelector('main'),{mode:'map',scene:'intro_timeline',order:2,playing:true,time:0,muted:false});
  h.tick(250);await new Promise(r=>setImmediate(r));assert.equal(h.c.getState().elapsed,.25);
  h.c.update({playing:false});assert.equal(h.c.getState().elapsed,.25);h.tick(250);assert.equal(h.c.getState().elapsed,.25);
  h.c.update({playing:true});h.tick(250);assert.equal(h.c.getState().elapsed,.5);
  h.c.cue('map-timeline-start',{id:'timeline:1'});h.c.cue('map-timeline-start',{id:'timeline:1'});assert.equal(h.audio.length,1);
  h.c.update({order:1});assert.equal(h.c.getState().actors.length,0,'backwards order drops future directives');
  h.c.cleanup();assert.equal(h.callbacks.size,0);assert.equal(h.c.getState().cachedImages,0);
});
test('fresh recap and opaque original UI remain separate from page-turn events',()=>{
  const html=renderSourceSceneStage(data,{mode:'recap',recapView:'book'});assert.ok(!html.includes('lastPage'));assert.ok(html.includes('data-source-stage-content'));assert.ok(html.includes('aria-label'));
});
test('ephemeral remount retains same-scene actor ages and starts only the next source order',async()=>{
  const h=harness(),root=h.dom.window.document.querySelector('main');
  h.c.mount(root,{mode:'map',scene:'1_4',order:5,playing:true,time:0});for(let i=0;i<8;i++)h.tick(250);
  const before=h.c.getState(),snapshot=h.c.getClockSnapshot();assert.equal(before.elapsed,2);assert.ok(snapshot.directives.length>0);
  h.c.cleanup();h.c.mount(root,{mode:'map',scene:'1_4',order:5,playing:true,clockSnapshot:snapshot});
  assert.equal(h.c.getState().elapsed,2);assert.deepEqual(h.c.getState().actors,before.actors);
  const snapshot2=h.c.getClockSnapshot();h.c.cleanup();h.c.mount(root,{mode:'map',scene:'1_4',order:6,playing:true,clockSnapshot:snapshot2});
  const after=h.c.getClockSnapshot(),newIds=new Set(data.scenes.find(s=>s.id==='1_4').cues.filter(c=>c.order===6).map(c=>c.id));
  assert.ok(after.directives.filter(a=>newIds.has(a.cueId)).every(a=>a.start===2));assert.ok(after.directives.filter(a=>!newIds.has(a.cueId)).every(a=>a.start===0));
  h.c.cleanup();h.c.mount(root,{mode:'map',scene:'intro_timeline',order:2,playing:false,clockSnapshot:snapshot});assert.equal(h.c.getState().elapsed,0,'different scene rejects ephemeral snapshot');
  h.c.cleanup();await new Promise(r=>setImmediate(r));
});

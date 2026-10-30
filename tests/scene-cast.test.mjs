import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {sceneCastView,renderSceneCast,createSceneCast} from '../src/scene-cast.mjs';
const study=JSON.parse(await readFile(new URL('../src/data/scene-cast-study.json',import.meta.url),'utf8'));
const byMotion=new Map(study.motions.map(m=>[m.id,m]));
const sha=b=>createHash('sha256').update(b).digest('hex');

test('117 selected scenes preserve all1332 exact directives and separate85 portrait speakers from44 body roles',()=>{
 assert.equal(study.scenes.length,117);assert.equal(study.scenes.filter(s=>s.kind==='task').length,116);assert.equal(study.roles.length,44);assert.equal(study.speakers.length,85);
 assert.equal(study.motions.filter(m=>m.kind==='map').length,888);assert.equal(study.motions.filter(m=>m.kind==='cg').length,41);
 const refs=study.scenes.flatMap(s=>s.cues.flatMap(c=>c.actions));assert.equal(refs.length,1332);assert.equal(refs.filter(a=>a.motionId).length,1332);
 for(const s of study.scenes)for(const c of s.cues){assert.ok(c.sourceRow>0);assert.equal(typeof c.flip,'boolean');assert.ok(Number.isFinite(c.scale));assert.ok(Number.isFinite(c.delay));
  for(const a of c.actions){const m=byMotion.get(a.motionId);assert.ok(m);assert.equal(m.role,c.role);assert.equal(m.animation,a.name);assert.ok(m.projection);assert.equal(a.match,'exact-role-and-declared-animation');}}
 assert.equal(study.summary.automaticPortraitEmotionToBodyMappings,0);assert.ok(study.speakers.every(s=>s.mapBodyExpressionRule===null));
 const clone={...study};delete clone.revision;assert.equal(sha(JSON.stringify(clone)),study.revision);
});

test('source transforms and code-derived begin-loop links survive without guessing portrait-to-body or random choices',()=>{
 const s=study.scenes.find(s=>s.id==='1_1'),q=s.cues.find(c=>c.type==='roleAction'&&c.role==='Quinn');assert.deepEqual(q.positions,[[46.85,0,-82.67]]);assert.equal(q.flip,true);assert.equal(q.delay,.75);assert.equal(q.scale,1);
 assert.equal(q.actions[0].name,'Quinn_angry_begin');assert.equal(q.actions[0].codeDerivedNext.name,'Quinn_angry_loop');assert.equal(q.actions[0].codeDerivedNext.originalBlendTransitionVerified,false);
 const view=sceneCastView(study,{scene:'1_1',order:2,speaker:'Quinn'});assert.ok(view.actors.some(a=>a.role==='Quinn'&&a.relation==='previous-source-directive'));assert.equal(view.speaker.id,'Quinn');
 const random=study.scenes.flatMap(s=>s.cues.map(c=>({s,c}))).find(({c})=>c.randomActionSelection);assert.ok(random);
 const randomView=sceneCastView(study,{scene:random.s.id,order:random.c.order}),actor=randomView.actors.find(a=>a.key===random.c.id);assert.ok(actor);assert.equal(actor.motion,undefined);assert.equal(actor.selectedKey,'');
 const explicit=sceneCastView(study,{scene:random.s.id,order:random.c.order,selections:{[random.c.id]:'0'}}).actors.find(a=>a.key===random.c.id);assert.ok(explicit.motion);
});

test('CG uses actual SkeletonData identity for21 nodes and leaves empty or cleared starts unselected',()=>{
 assert.equal(study.CGScenes.length,3);assert.equal(study.CGScenes.reduce((n,s)=>n+s.nodes.length,0),21);
 for(const s of study.CGScenes){assert.equal(s.timelineIntroAutomaticallyLinked,false);assert.equal(s.originalCGSequenceVerified,false);
  for(const n of s.nodes){for(const id of n.motionIds){const m=byMotion.get(id);assert.equal(m.kind,'cg');assert.equal(m.skeletonDataSource.serialized_file,n.source.serialized_file);assert.equal(m.skeletonDataSource.path_id,n.source.path_id);}}}
 const s=study.CGScenes[0],view=sceneCastView(study,{scene:s.id}),blank=view.actors.find(a=>!a.CGNode.startingAnimation),active=view.actors.find(a=>a.motion);assert.ok(blank);assert.equal(blank.motion,undefined);assert.ok(active);
 assert.equal(sceneCastView(study,{scene:s.id,selections:{[active.key]:''}}).actors.find(a=>a.key===active.key).motion,undefined);
});

test('221 technical projections cover complete source intervals with8Hz and actual no-audio frame PTS',()=>{
 const rows=study.motions.filter(m=>m.projection);assert.equal(rows.length,221);let samples=0;
 for(const m of rows){const p=m.projection;assert.equal(p.fullSourceRange,true);assert.equal(p.fixedWholeClipBounds,true);assert.equal(p.sourceSampleRate,8);assert.equal(p.sourceSampleTimes[0],0);assert.ok(Math.abs(p.sourceSampleTimes.at(-1)-m.duration)<1e-7);assert.equal(p.encoded.audioTracks,0);assert.equal(p.encoded.frameCount,p.sourceSampleTimes.length);samples+=p.sourceSampleTimes.length;
  for(let i=0;i<p.sourceSampleTimes.length;i++)assert.ok(Math.abs(p.sourceSampleTimes[i]-p.encoded.framePTS[i])<.00001);
  assert.ok(p.encoded.finalPoseHoldSeconds>=0&&p.encoded.finalPoseHoldSeconds<=.251);assert.equal(p.originalRuntimeObserved,false);assert.equal(p.originalRenderingVerified,false);}
 assert.equal(samples,3412);
});

test('new media files and reused reduced assets match physical hashes without publishing raw payloads',async()=>{
 const media=[...study.mediaEntries,...study.motions.flatMap(m=>m.segments.flatMap(s=>[s.poster,s.gif].filter(Boolean)))],unique=new Map(media.map(m=>[m.src,m]));let bytes=0;
 for(let i=0,rows=[...unique.values()];i<rows.length;i+=16)await Promise.all(rows.slice(i,i+16).map(async m=>{assert.ok(m.src.startsWith('./assets/media/'));assert.ok(!m.src.includes('..'));const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(b.length,m.bytes);assert.equal(sha(b),m.sha256);}));
 for(const m of study.mediaEntries){bytes+=m.bytes;assert.equal(m.width,240);assert.equal(m.height,240);assert.equal(m.originalRuntimeObserved,false);}
 assert.equal(bytes,6247171);assert.ok(bytes<80*1024*1024);
 const banned=new Set(['vertices','uv','triangles','geometryPath','rawBytes','skeletonBinary','playerData']);
 function walk(x){if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){assert.equal(banned.has(k),false,'Published raw field '+k);if(['path_id','pathId','m_PathID'].includes(k))assert.equal(typeof v,'string');walk(v);}}
 walk(study);
 for(const r of study.roles)for(const source of Object.values(r.source)){assert.match(source.path_id,/^-?\d+$/);assert.match(source.object_source_sha256,/^[a-f0-9]{64}$/);}
});

test('render distinguishes previous source directives, source-only planes and unsupported scene contexts',()=>{
 const html=renderSceneCast(study,{scene:'1_1',order:2,speaker:'Quinn'});assert.match(html,/현재 활성/);assert.match(html,/대사 감정을 전신 포즈로 자동 변환하지/);assert.match(html,/<video[^>]*controls muted playsinline preload="none"/);assert.doesNotMatch(html,/<video[^>]+autoplay/);assert.match(html,/46.85/);
 const plotOrder=sceneCastView(study,{scene:'1_1',order:2});assert.ok(plotOrder.orders.includes(2));
 assert.equal(sceneCastView(study,{scene:'unknown-task'}).valid,false);assert.match(renderSceneCast(study,{scene:'unknown-task'}),/아직 확보/);
 const poison=structuredClone(study);poison.roles.find(r=>r.id==='Quinn').title='<script>bad()</script>';assert.ok(!renderSceneCast(poison,{scene:'1_1',order:1}).includes('<script>bad'));
 const before=sceneCastView(study,{scene:'intro_timeline',order:1});assert.equal(before.actors.length,0);assert.match(renderSceneCast(study,{scene:'intro_timeline',order:1}),/임의의 캐릭터/);
});

test('controller seeks by recorded source PTS, supports pause/cleanup and never treats global scene time as clip time',t=>{
 const dom=new JSDOM('<main></main>');const previous=globalThis.document;globalThis.document=dom.window.document;t.after(()=>{globalThis.document=previous;dom.window.close();});let pauses=0,plays=0;
 dom.window.HTMLMediaElement.prototype.pause=function(){pauses++;};dom.window.HTMLMediaElement.prototype.play=function(){plays++;return Promise.resolve();};dom.window.HTMLMediaElement.prototype.load=function(){};
 let control;const render=()=>{document.querySelector('main').innerHTML=control.renderPage();control.mount(document.querySelector('main'));};control=createSceneCast({getData:()=>({sceneCastStudy:study}),getOptions:()=>({scene:'1_1',order:1}),render});render();
 const card=document.querySelector('[data-cast-actor]'),video=card.querySelector('video'),m=byMotion.get(video.dataset.castMotion);assert.ok(video);Object.defineProperty(video,'readyState',{get:()=>1});Object.defineProperty(video,'duration',{get:()=>m.projection.encoded.durationSeconds});
 control.handleClick({target:card.querySelector('[data-cast-seek="end"]')});assert.ok(Math.abs(video.currentTime-m.duration)<.00001);
 video.currentTime=0;control.update({time:.5,playing:true});assert.equal(video.currentTime,0);assert.equal(plays,0);
 control.update({clock:'source-clip',time:m.duration,playing:true});assert.ok(Math.abs(video.currentTime-m.duration)<.00001);assert.ok(plays>0);
 control.cleanup();assert.ok(pauses>0);
});

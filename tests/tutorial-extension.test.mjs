import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createTutorialExtension,tutorialExtensionEvent,extensionView,validTutorialExtension} from '../src/tutorial-extension.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/tutorial-extension.json',import.meta.url),'utf8'));
const guides=Object.fromEntries(c.guides.map(g=>[g.executer,g]));
const example=key=>structuredClone(guides[key].researchExample);
const act=(s,key,event,ctx=example(key))=>tutorialExtensionEvent(s,{guideId:guides[key].id,...event},ctx,c);
test('five guide projections preserve exact source identities, reproducible config and separate unsupported album requirements',()=>{
 const d=structuredClone(c);delete d.revision;assert.equal(createHash('sha256').update(JSON.stringify(d)).digest('hex'),c.revision);assert.equal(c.guides.length,5);
 assert.equal(new Set(c.guides.map(x=>x.id)).size,5);for(const g of c.guides){assert.equal(g.researchExample.mode,'research');assert.ok(g.eventCatalog.length);for(const s of g.sources){assert.match(s.path,/^analysis\//);assert.match(s.sha256,/^[a-f0-9]{64}$/);}}
 assert.equal(c.unsupported[0].id,'tutorial_album_moon_start');assert.ok(c.passDefinitions.some(x=>x.activityType==='RoadtripPass'));
});
test('missing or nonresearch server/activity snapshots are unknown and atomic for every added executer',()=>{
 for(const g of c.guides){const s=createTutorialExtension(c),before=structuredClone(s),event={guideId:g.id,...g.eventCatalog[0].event};
  assert.equal(tutorialExtensionEvent(s,event,{},c).status,'unknown');assert.deepEqual(s,before);
  assert.equal(tutorialExtensionEvent(s,event,{mode:'research'},c).status,'unknown');assert.deepEqual(s,before);
 }
});
test('simple boost waits0.5s, registers before visual completion, and requires two mode changes',()=>{
 const s=createTutorialExtension(c),ctx=example('EnergyBoostSimpleSetting'),ctxBefore=structuredClone(ctx);
 assert.equal(act(s,'EnergyBoostSimpleSetting',{type:'game-mode-change-finished',now:10},ctx).ok,true);assert.equal(s.active.dueAt,10.5);assert.equal(s.registeredFinished.length,0);assert.equal(s.active.strong,false);
 assert.equal(act(s,'EnergyBoostSimpleSetting',{type:'clock',now:10.49},ctx).status,'waiting');assert.equal(s.active.phase,'entry-delay');
 assert.equal(act(s,'EnergyBoostSimpleSetting',{type:'clock',now:10.5},ctx).ok,true);assert.equal(s.active.phase,'click-1');assert.deepEqual(s.registeredFinished,[guides.EnergyBoostSimpleSetting.id]);assert.deepEqual(s.completed,[]);
 act(s,'EnergyBoostSimpleSetting',{type:'energy-mode-changed',now:10.6},ctx);assert.equal(s.active.phase,'click-2');
 assert.equal(act(s,'EnergyBoostSimpleSetting',{type:'mask-click',now:10.7},ctx).status,'ignored');assert.equal(s.active.phase,'click-2');
 assert.equal(act(s,'EnergyBoostSimpleSetting',{type:'energy-mode-changed',now:10.8},ctx).status,'completed');assert.equal(s.active,null);assert.equal(s.completed.length,1);assert.deepEqual(ctx,ctxBefore);assert.equal(validTutorialExtension(s,c),true);
});
test('simple boost rechecks scene/strong gates after delay and handles the source nil-HUD finish branch',()=>{
 let s=createTutorialExtension(c),ctx=example('EnergyBoostSimpleSetting');act(s,'EnergyBoostSimpleSetting',{type:'game-mode-change-finished'},ctx);ctx.otherStrong=true;
 assert.equal(act(s,'EnergyBoostSimpleSetting',{type:'clock',now:.5},ctx).status,'cancelled');assert.deepEqual(s.registeredFinished,[]);
 s=createTutorialExtension(c);ctx=example('EnergyBoostSimpleSetting');ctx.energyBoostHudAvailable=false;act(s,'EnergyBoostSimpleSetting',{type:'game-mode-change-finished'},ctx);assert.equal(act(s,'EnergyBoostSimpleSetting',{type:'clock',now:.5},ctx).status,'completed');assert.equal(s.completed.length,1);
});
test('pass registers immediately then delays its tip, highlights ticket, and completes through the mask without payment',()=>{
 const s=createTutorialExtension(c),ctx=example('PassActivity');act(s,'PassActivity',{type:'view-opened',name:ctx.passDefinition.mainWindow},ctx);
 assert.equal(s.active.phase,'tip-delay');assert.equal(s.registeredFinished.length,1);assert.equal(s.completed.length,0);
 const missing=structuredClone(ctx);delete missing.openViews;const before=structuredClone(s);assert.equal(act(s,'PassActivity',{type:'clock',now:1},missing).status,'unknown');assert.deepEqual(s,before);
 act(s,'PassActivity',{type:'clock',now:1},ctx);assert.equal(s.active.phase,'main-tip');act(s,'PassActivity',{type:'mask-click'},ctx);assert.equal(s.active.phase,'ticket-highlight');assert.equal(act(s,'PassActivity',{type:'mask-click'},ctx).status,'completed');
 const completed=structuredClone(s);assert.equal(act(s,'PassActivity',{type:'view-opened',name:ctx.passDefinition.mainWindow},ctx).status,'blocked');assert.deepEqual(s,completed);
});
test('pass source ticket-open-before-main and changed/ended activity exit paths are preserved',()=>{
 let s=createTutorialExtension(c);assert.equal(act(s,'PassActivity',{type:'view-opened',name:'PassActivityTicketWindow'},{mode:'research'}).status,'completed');assert.equal(s.completed.length,1);
 for(const event of [{type:'pass-state-changed',activityId:'different',state:'Started'},{type:'pass-state-changed',activityId:'research-pass-1',state:'Ended'},{type:'view-opened',name:'RoadtripPassNewTimelimitTaskWindowNew'}]){
  s=createTutorialExtension(c);const ctx=example('PassActivity');act(s,'PassActivity',{type:'view-opened',name:ctx.passDefinition.mainWindow},ctx);assert.equal(act(s,'PassActivity',event,ctx).status,'completed');
 }
 s=createTutorialExtension(c);const ctx=example('PassActivity');act(s,'PassActivity',{type:'view-opened',name:ctx.passDefinition.mainWindow},ctx);ctx.openViews.push(ctx.passDefinition.finishTaskWindow);assert.equal(act(s,'PassActivity',{type:'clock',now:1},ctx).status,'completed');
});
test('recap delays registration, requires unlocked books, and only ends on close after its highlight step',()=>{
 const s=createTutorialExtension(c),ctx=example('StoryRecap');const empty={...ctx,storyUnlockedBooks:[]};assert.equal(act(s,'StoryRecap',{type:'view-opened',name:'TaskWindow'},empty).status,'blocked');
 act(s,'StoryRecap',{type:'view-opened',name:'TaskWindow'},ctx);assert.equal(s.registeredFinished.length,0);act(s,'StoryRecap',{type:'clock',now:1},ctx);assert.equal(s.registeredFinished.length,1);assert.equal(s.active.phase,'dialogue');
 assert.equal(act(s,'StoryRecap',{type:'view-closed',name:'TaskWindow'},ctx).status,'ignored');assert.equal(s.completed.length,0);act(s,'StoryRecap',{type:'mask-click'},ctx);assert.equal(s.active.phase,'recap-highlight');assert.equal(act(s,'StoryRecap',{type:'view-closed',name:'TaskWindow'},ctx).status,'completed');
});
test('recap cancels a vanished task window before registration and finishes a vanished window after dialogue',()=>{
 let s=createTutorialExtension(c),ctx=example('StoryRecap');act(s,'StoryRecap',{type:'view-opened',name:'TaskWindow'},ctx);ctx.openViews=[];assert.equal(act(s,'StoryRecap',{type:'clock',now:1},ctx).status,'cancelled');assert.equal(s.registeredFinished.length,0);
 s=createTutorialExtension(c);ctx=example('StoryRecap');act(s,'StoryRecap',{type:'view-opened',name:'TaskWindow'},ctx);act(s,'StoryRecap',{type:'clock',now:1},ctx);ctx.openViews=[];assert.equal(act(s,'StoryRecap',{type:'mask-click'},ctx).status,'completed');
});
test('decoration requires a classified Skin reward and two unlocked skins, with two distinct0.8s delays and a popup callback',()=>{
 const s=createTutorialExtension(c),ctx=example('ChangeDecoration');const locked=structuredClone(ctx);locked.decorationRewards[0].unlockedSkins.pop();assert.equal(act(s,'ChangeDecoration',{type:'decoration-reward'},locked).status,'blocked');
 act(s,'ChangeDecoration',{type:'decoration-reward'},ctx);assert.equal(s.registeredFinished.length,1);assert.equal(s.active.phase,'dialogue-delay');act(s,'ChangeDecoration',{type:'clock',now:.8},ctx);assert.equal(s.active.phase,'dialogue');act(s,'ChangeDecoration',{type:'mask-click',now:.8},ctx);assert.equal(s.active.dueAt,1.6);
 assert.equal(act(s,'ChangeDecoration',{type:'decoration-popup-completed',now:1.2},ctx).status,'ignored');assert.equal(s.completed.length,0);act(s,'ChangeDecoration',{type:'clock',now:1.6},ctx);assert.deepEqual(s.active.target,{popup:'TutorialChangeDecorationContent',parameter:7});assert.equal(act(s,'ChangeDecoration',{type:'decoration-popup-completed'},ctx).status,'completed');
});
test('factory preserves prerequisite registration, captured random candidates, phase-only tap callback and inventory finish',()=>{
 const s=createTutorialExtension(c),ctx=example('GeneratorFactoryAcquire');assert.equal(act(s,'GeneratorFactoryAcquire',{type:'factory-poll'},{...ctx,registeredTutorials:[]}).status,'blocked');
 act(s,'GeneratorFactoryAcquire',{type:'factory-poll'},ctx);assert.equal(s.registeredFinished.length,0);const missing=structuredClone(ctx);delete missing.factoryRandomRoll;const before=structuredClone(s);assert.equal(act(s,'GeneratorFactoryAcquire',{type:'clock',now:.3},missing).status,'unknown');assert.deepEqual(s,before);
 ctx.factoryCandidates=[];act(s,'GeneratorFactoryAcquire',{type:'clock',now:.3},ctx);assert.equal(s.active.phase,'tap-item');assert.equal(s.active.target.uid,'research-factory-item-1');assert.equal(s.active.target.dialogHeight,30);assert.equal(s.registeredFinished.length,1);
 act(s,'GeneratorFactoryAcquire',{type:'factory-item-tapped',uid:'not-the-target'},ctx);assert.equal(s.active.phase,'inventory-highlight');assert.equal(act(s,'GeneratorFactoryAcquire',{type:'mask-click'},ctx).status,'completed');
});
test('factory close before its scheduled visual start is ignored, while close after registration finishes',()=>{
 const s=createTutorialExtension(c),ctx=example('GeneratorFactoryAcquire');act(s,'GeneratorFactoryAcquire',{type:'factory-poll'},ctx);
 assert.equal(act(s,'GeneratorFactoryAcquire',{type:'factory-state-changed',isOpen:false},ctx).status,'ignored');ctx.generatorFactoryOpen=false;act(s,'GeneratorFactoryAcquire',{type:'clock',now:.3},ctx);assert.equal(s.active.phase,'tap-item');
 assert.equal(act(s,'GeneratorFactoryAcquire',{type:'factory-state-changed',isOpen:false},ctx).status,'completed');
});
test('isolated guide coordination, monotonic time and explicit reset never mutate external game or existing guide objects',()=>{
 const s=createTutorialExtension(c),ctx=example('ChangeDecoration'),game={wallet:{coins:26,gems:200},onboarding:{registeredFinished:['tutorial_3'],completed:[]}};const gameBefore=structuredClone(game);
 act(s,'ChangeDecoration',{type:'decoration-reward',now:10},ctx);const before=structuredClone(s);assert.equal(act(s,'StoryRecap',{type:'view-opened',name:'TaskWindow',now:10},example('StoryRecap')).status,'blocked');assert.deepEqual(s,before);
 assert.equal(act(s,'ChangeDecoration',{type:'clock',now:9},ctx).status,'blocked');assert.deepEqual(s,before);act(s,'ChangeDecoration',{type:'reset',now:10},ctx);assert.deepEqual(s.registeredFinished,[]);assert.deepEqual(game,gameBefore);assert.equal(validTutorialExtension(s,c),true);assert.equal(extensionView(s,{},c).unknown[0],'mode=research');
 const bad=structuredClone(s);bad.completed.push(guides.ChangeDecoration.id);assert.equal(validTutorialExtension(bad,c),false);
});

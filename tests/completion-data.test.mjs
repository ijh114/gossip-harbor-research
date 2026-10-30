import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {integrateCompletionData} from '../src/completion-data.mjs';
import {selectSourceMotion,renderAPKMotionGallery,sourceMotionExpansion} from '../src/apk-motion-gallery.mjs';
import {mediaFor,validMedia} from '../src/visual-model.mjs';
import {mapPresentationView} from '../src/presentation-model.mjs';
import {createSkinLab,skinLabAction} from '../src/skin-lab.mjs';
import {renderSourceMap,renderSkinArt} from '../src/presentation-page.mjs';
import {validItemRepresentationConfig,itemRepresentation} from '../src/item-representation.mjs';
import {sourceScene,sceneCursor,chooseSceneVariant,advanceScene,canCommitScene} from '../src/scene-script.mjs';
import {createPlay,playAction,validPlay} from '../src/play-model.mjs';
import {beginTaskScene,leaveScene,screenFlow} from '../src/screen-flow.mjs';
const read=async n=>JSON.parse(await readFile(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const [sceneConfig,lateSceneStudy,apkExpansion,finalObservations,mediaReview,playConfig,media]=await Promise.all(['scene-config','late-scene-study','apk-media-expansion','media-final-observations','apk-media-review','play-config','media'].map(read));
const data=integrateCompletionData({sceneConfig,lateSceneStudy,apkExpansion,finalObservations,mediaReview,playConfig,media});
const [presentationAssets,remotePresentation,remoteCharacters,cgExpansion,lateSceneArt,skinConfig,itemRepresentationConfig,itemRepresentationRemote]=await Promise.all(['presentation-assets','remote-presentation-assets','remote-character-study','cg-motion-expansion','late-scene-art','skin-lab','item-representation','item-representation-remote'].map(read));
const full=integrateCompletionData({...data,presentationAssets,remotePresentation,remoteCharacters,cgExpansion,lateSceneArt,skinConfig,itemRepresentation:itemRepresentationConfig,itemRepresentationRemote});
test('all929 character/CG clips have unique selectable identities and valid linked media',()=>{
 const expansion=sourceMotionExpansion(full);assert.equal(expansion.studies.length,929);assert.equal(new Set(expansion.studies.map(s=>s.id)).size,929);
 for(const s of expansion.studies)for(const seg of s.segments){assert.ok(validMedia(mediaFor(full,seg.previewMediaKey||seg.posterMediaKey)),s.id);assert.ok(validMedia(mediaFor(full,seg.posterMediaKey)),s.id);}
});
test('exact Area4 and13_2 art join the scene selector and preserve all prior map identities and files',()=>{
 assert.equal(full.presentationAssets.maps[0].id,presentationAssets.maps[0].id);assert.equal(full.presentationAssets.maps[0].slots.length,55);assert.equal(full.presentationAssets.maps[0].slots.reduce((n,s)=>n+s.variants.filter(v=>v.mediaKey).length,0),165);
 for(const slot of ['12_5','12_8','12_9','12_11','13_2']){const row=full.sceneConfig.tasks.flatMap(t=>t.decorSlots).find(s=>s.id===slot);assert.equal(row.variants.length,3);for(const v of row.variants)assert.ok(validMedia(mediaFor(full,v.previewKey)));}
 assert.ok(presentationAssets.mediaEntries.every(m=>full.presentationAssets.mediaEntries.some(r=>r.key===m.key&&r.sha256===m.sha256)));
});
test('Skin preview uses exact26 graphics and whitelisted additive layers without changing main economy or old save compatibility',()=>{
 const s=createPlay(playConfig);s.skinLab=createSkinLab(skinConfig);const before=JSON.stringify({wallet:s.wallet,board:s.board,done:s.questsDone});
 const selected=skinConfig.groups[0].skins[0];assert.equal(skinLabAction(s.skinLab,'select',selected.id,skinConfig).ok,true);assert.equal(skinLabAction(s.skinLab,'acquire-set',null,skinConfig).ok,true);assert.equal(skinLabAction(s.skinLab,'preview-set',null,skinConfig).ok,true);
 const view=mapPresentationView(s,playConfig,full,{skin:true});assert.equal(view.valid,true);assert.ok(view.layers.some(r=>r.blendMode==='plus-lighter'));assert.ok(view.layers.every(r=>validMedia(mediaFor(full,r.mediaKey))));
 const dom=new JSDOM(renderSourceMap(s,playConfig,full,{skin:true})+renderSkinArt(s.skinLab,skinConfig,full));assert.ok(dom.window.document.querySelector('[style*="mix-blend-mode:plus-lighter"]'));assert.equal(dom.window.document.querySelectorAll('.skin-art-missing').length,0);dom.window.close();
 assert.equal(JSON.stringify({wallet:s.wallet,board:s.board,done:s.questsDone}),before);
});
test('remote gift/Temp sources integrate with the existing presentation validator without changing the base544 catalog',()=>{
 assert.equal(validItemRepresentationConfig(full.itemRepresentation),true);assert.equal(itemRepresentation('md_hw_gift_1',{},full.itemRepresentation).status,'exact-source-image');assert.equal(itemRepresentation('t#101',{media},full.itemRepresentation).status,'source-composite');assert.equal(full.itemRepresentation.coverage.baseUsageUnknown,1);assert.equal(full.itemRepresentation.coverage.base544MappingsChanged,0);
});
test('unconfirmed Skin previews stay out of the main map; confirmation persists exact layers without touching the wallet',()=>{
 const s=createPlay(playConfig);s.skinLab=createSkinLab(skinConfig);const wallet=structuredClone(s.wallet);
 skinLabAction(s.skinLab,'acquire-set',null,skinConfig);skinLabAction(s.skinLab,'preview-set',null,skinConfig);
 assert.ok(mapPresentationView(s,playConfig,full,{skin:true}).layers.some(r=>r.slotId==='ex_1'));
 assert.equal(mapPresentationView(s,playConfig,full,{skin:true,skinPreview:false}).layers.some(r=>r.slotId==='ex_1'),false);
 assert.equal(skinLabAction(s.skinLab,'confirm',null,skinConfig).ok,true);const restored=JSON.parse(JSON.stringify(s));
 const applied=mapPresentationView(restored,playConfig,full,{skin:true,skinPreview:false});assert.ok(applied.layers.some(r=>r.slotId==='ex_1'));assert.ok(applied.layers.some(r=>r.blendMode==='plus-lighter'));assert.equal(applied.layers.some(r=>r.isPreview),false);assert.deepEqual(s.wallet,wallet);
});
test('late default timeline sources cover all280 days and the107th quest uses exact13_1 rather than a named variant',()=>{
 assert.equal(lateSceneStudy.days.length,280);assert.deepEqual(lateSceneStudy.days.map(r=>r.day),Array.from({length:280},(_,i)=>i+13));
 for(const day of lateSceneStudy.days){assert.ok(day.commandCount>0);assert.equal(day.bundle.bytes,day.bundle.expectedCatalogBytes);assert.equal(day.bundle.etagMD5Verified,true);assert.equal(typeof day.source.pathId,'string');}
 assert.deepEqual(data.sceneConfig.tasks.slice(0,106),sceneConfig.tasks);assert.equal(data.sceneConfig.tasks.length,116);assert.equal(sourceScene(data.sceneConfig,'13_1').id,playConfig.quests[106].id);
 assert.equal(lateSceneStudy.originalRuntimeObserved,false);assert.equal(lateSceneStudy.fullRecoveredTablesPublished,false);
});
test('all10 new selected task scenes keep choice gates and commit domain cost/reward once using the existing game flow',()=>{
 const s=createPlay(playConfig);s.stage='home';s.questsDone=106;s.wallet.coins=lateSceneStudy.tasks.reduce((n,t)=>n+t.cost,0);
 for(const scene of lateSceneStudy.tasks){assert.equal(playAction(s,'quest-start',null,playConfig).ok,true);assert.equal(beginTaskScene(s,playConfig),true);const f=screenFlow(s,playConfig);
  for(let i=0;i<200&&!canCommitScene(f.task,scene);i++){const step=sceneCursor(f.task,scene).step;if(step.kind==='choice'){assert.equal(advanceScene(f.task,scene),false);assert.equal(chooseSceneVariant(f.task,scene,'3'),true);}assert.equal(advanceScene(f.task,scene),true);}
  assert.equal(canCommitScene(f.task,scene),true);assert.equal(playAction(s,'quest-finish',null,playConfig).ok,true);assert.equal(playAction(s,'quest-finish',null,playConfig).ok,false);leaveScene(s,playConfig);assert.equal(validPlay(s,playConfig),true);
 }
 assert.equal(s.questsDone,116);assert.equal(s.wallet.coins,0);
});
test('all410 source motions can be selected and long timelines expose every contiguous segment with playable media',()=>{
 assert.equal(selectSourceMotion(apkExpansion).rows.length,410);const longest=apkExpansion.studies.reduce((a,b)=>a.declaredDuration>b.declaredDuration?a:b);
 const selected=selectSourceMotion(apkExpansion,{role:longest.role,clip:longest.id});assert.equal(selected.selected.id,longest.id);assert.ok(selected.rows.every(s=>s.role===longest.role));
 const dom=new JSDOM(renderAPKMotionGallery(data,{role:longest.role,clip:longest.id}));assert.equal(dom.window.document.querySelectorAll('.apk-motion-segments figure').length,longest.segments.length);assert.equal(dom.window.document.querySelectorAll('[data-apk-motion-role] option').length,16);dom.window.close();
});
test('actual observations are attached to their original checklist identities and source captures stay distinct from source replays',()=>{
 for(const s of finalObservations.studies)for(const id of s.checklistIds)assert.ok(data.mediaReview.tasks.find(t=>t.id===id).studyIds.includes(s.id));
 const clock=data.mediaReview.studies.find(s=>s.id==='observed-clock-storage');assert.equal(clock.actualTimeSkipUseVerified,false);assert.equal(clock.actualStorageTransitionObserved,true);assert.equal(clock.kind,'observed-frame-study');
 assert.deepEqual(sceneConfig.tasks[0],data.sceneConfig.tasks[0]);
});

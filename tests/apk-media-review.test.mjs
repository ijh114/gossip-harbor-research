import test from 'node:test';
import assert from 'node:assert/strict';
import {validItemResolutionFollowup} from '../src/item-resolution-followup.mjs';
import {validRegisteredActivityConfig} from '../src/registered-activity.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {mediaFor,validMedia} from '../src/visual-model.mjs';
import {renderAPKMediaReview,renderAPKMediaLinks,revealAPKTask} from '../src/apk-media-review.mjs';
import {mountInteractionLoops} from '../src/interaction-gallery.mjs';
import {DOMAIN_IDS} from '../src/domain-model.mjs';
import {STUDIO_PAGES,RESEARCH_ROUTES,VISUAL_ROUTES,renderNavigation} from '../src/navigation.mjs';
const read=async n=>JSON.parse(await readFile(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const [mediaReview,media,presentationAssets,refinement,itemRepresentation,apkMediaAssets,masterChecklist]=await Promise.all(['apk-media-review','media','presentation-assets','media-refinement','item-representation','apk-media-assets','master-checklist'].map(read));
const data={mediaReview,media,presentationAssets,refinement,itemRepresentation,apkMediaAssets,masterChecklist};
const [followup,registered]=await Promise.all(['item-resolution-followup','registered-activity'].map(read));
const sha=b=>createHash('sha256').update(b).digest('hex');
test('4.03–4.13 keep eleven fixed identities and original acceptance criteria with evidence-gated registered-item completion',()=>{
 assert.deepEqual(mediaReview.tasks.map(t=>t.id),Array.from({length:11},(_,i)=>'4.'+String(i+3).padStart(2,'0')));
 assert.equal(mediaReview.originalRuntimeObserved,false);assert.equal(mediaReview.listenedSeconds,0);
 assert.equal(new Set(mediaReview.studies.map(s=>s.id)).size,mediaReview.studies.length);
 const dom=new JSDOM(renderAPKMediaReview(data)),doc=dom.window.document;
 assert.equal(doc.querySelectorAll('[data-apk-task]').length,11);
 for(const row of mediaReview.tasks){const canonical=masterChecklist.tasks.find(t=>t.id===row.id);assert.ok(canonical);assert.ok(doc.querySelector(`[data-apk-task="${row.id}"]`).textContent.includes(canonical.acceptance));if(['4.03','4.04','4.09','4.13'].includes(row.id))assert.equal(canonical.status,'완료');else assert.notEqual(canonical.status,'완료');}
 assert.equal(validItemResolutionFollowup(followup),true);assert.equal(validRegisteredActivityConfig(registered),true);assert.equal(followup.coverage.exactSpriteIdentities,70);assert.equal(followup.coverage.uniquePublishedPNGContents,32);
 assert.equal(revealAPKTask(doc,'4.10'),true);assert.equal(doc.querySelector('[data-apk-task="4.10"]').open,true);assert.equal(revealAPKTask(doc,'4.99'),false);dom.window.close();
});
test('every added derivative and poster matches its published hash; no guessed fallback or private recording audio',async()=>{
 const keys=new Set();for(const m of mediaReview.mediaEntries){assert.ok(!keys.has(m.key));keys.add(m.key);assert.ok(validMedia(m),m.key);assert.equal(sha(await readFile(new URL('../src/'+m.src.slice(2),import.meta.url))),m.sha256,m.key);if(m.poster){assert.equal(sha(await readFile(new URL('../src/'+m.poster.slice(2),import.meta.url))),m.posterSha256,m.key+' poster');}assert.equal(m.originalRuntimeObserved===true,false);}
 for(const s of mediaReview.studies){for(const key of [...(s.mediaKeys||[]),...(s.selectedFrameKeys||[])])assert.ok(validMedia(mediaFor(data,key)),s.id+' '+key);}
 assert.equal(itemRepresentation.coverage.representativeEventImagesResolved,0);assert.equal(itemRepresentation.coverage.shared24CountedAsEventArt,0);
 assert.equal(mediaReview.mediaEntries.filter(m=>m.origin==='observed-user-capture'&&m.kind==='video').every(m=>m.audioRemoved===true&&m.speed===1),true);
 assert.doesNotMatch(JSON.stringify(mediaReview),/[CD]:[\\/]|@gmail\.com|originalPath|\.xapk"/);
});
test('all ten research chapters have valid visual comparison links and the APK page belongs to Research',()=>{
 for(const domain of DOMAIN_IDS){const html=renderAPKMediaLinks(data,domain),dom=new JSDOM(html);assert.ok(dom.window.document.querySelector('[data-media-key]'),domain);assert.ok(html.includes('#apk-media'));dom.window.close();}
 assert.equal(STUDIO_PAGES['apk-media'],'APK 자료 보강');assert.ok(RESEARCH_ROUTES.includes('apk-media'));assert.ok(!VISUAL_ROUTES.includes('apk-media'));assert.ok(renderNavigation().includes('data-route="apk-media"'));
});
test('new source loops honor closed disclosures, reduced motion, manual pause and route cleanup',()=>{
 const dom=new JSDOM(renderAPKMediaReview(data),{pretendToBeVisual:true}),doc=dom.window.document;dom.window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 const stop=mountInteractionLoops(doc,{gallerySelector:'[data-apk-loop-gallery]',cardSelector:'[data-apk-loop-card]'}),img=doc.querySelector('[data-apk-task="4.06"] [data-loop-src]');assert.ok(img);assert.equal(img.dataset.loopState,'paused');doc.querySelector('[data-loop-all]').click();assert.equal(img.dataset.loopState,'playing');
 const closed=doc.querySelector('[data-apk-task="4.07"] [data-loop-src]');assert.equal(closed.dataset.loopState,'paused');revealAPKTask(doc,'4.07');closed.closest('details').dispatchEvent(new dom.window.Event('toggle'));assert.equal(closed.dataset.loopState,'playing');stop();assert.ok([...doc.querySelectorAll('[data-loop-src]')].every(i=>i.dataset.loopState==='paused'));dom.window.close();
});
test('signal/PTS review retains bounded frame and zero-audition status',()=>{
 const s=mediaReview.studies.find(s=>s.id==='frame-audio-alignment');assert.equal(s.nativeFrameCount,326);assert.equal(s.selectedFrameKeys.length,6);assert.deepEqual(s.nativePTSRange,[1.805656,4.545767]);assert.equal(s.listenedSeconds,0);assert.equal(s.originalRealtimePlaybackReviewed,false);assert.equal(s.audioCandidates.length,2);
});
test('registered-only resources and unpreviewed character animations remain reviewable under the same IDs',()=>{
 const dom=new JSDOM(renderAPKMediaReview(data)),doc=dom.window.document;
 assert.equal(doc.querySelector('[aria-label="Area4 후보 등록 표"] tbody').rows.length,12);
 assert.equal(doc.querySelector('[aria-label="후속 타임라인 등록 표"] tbody').rows.length,280);
 assert.equal(doc.querySelector('[aria-label="캐릭터 확보 표"] tbody').rows.length,44);
 assert.equal(doc.querySelector('[aria-label="캐릭터 모션 목록"] tbody').rows.length,410);
 assert.equal(doc.querySelector('[data-apk-task="4.10"] [data-media-key="apk-role-motion:Buster:gif"]'),null);
 const buster=mediaReview.studies.find(s=>s.staticPose);assert.ok(buster);assert.equal(mediaFor(data,buster.mediaKeys[0]).kind,'image');assert.ok(doc.body.textContent.includes('395개는 미시연'));dom.window.close();
});

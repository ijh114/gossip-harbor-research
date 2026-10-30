import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {createStoryRecap,createStoryRecapInputs,validStoryRecap,validStoryRecapInputs,storyRecapView,storyRecapAction} from '../src/story-recap.mjs';
import {renderStoryRecap} from '../src/story-recap-page.mjs';
const load=async n=>JSON.parse(await readFile(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const c=await load('story-recap'),scenes=await load('scene-config');
const context=(currentTask={day:53,id:1},serverEnabled=true)=>({currentTask,serverEnabled});
const act=(s,type,values={},ctx=context())=>storyRecapAction(s,{type,...values},ctx,c);
function opened(book=1,ctx=context()){const s=createStoryRecap(c);assert.equal(act(s,'open-shelf',{},ctx).ok,true);assert.equal(act(s,'open-book',{book},ctx).ok,true);return s;}

test('recap gates retain missing server/task unknowns and strict source task comparison',()=>{
 const s=createStoryRecap(c);
 assert.equal(storyRecapView(s,{},c).state,'unknown');assert.equal(storyRecapView(s,context(null,null),c).state,'unknown');
 assert.equal(storyRecapView(s,context(undefined,false),c).state,'closed');
 for(const [task,expected]of [[{day:20,id:11},[]],[{day:20,id:12},[1]],[{day:37,id:10},[1]],[{day:37,id:11},[1,2]],[{day:52,id:11},[1,2,3,4]],[{day:52,id:12},[1,2,3,4,5]],[null,[1,2,3,4,5]]])assert.deepEqual(storyRecapView(s,context(task),c).unlocked,expected);
 const prior=structuredClone(s);assert.equal(act(s,'open-shelf',{},context(null,null)).ok,false);assert.deepEqual(s,prior);
});
test('shelf uses unlocked books then ComingSoon and empty slots, in groups of three',()=>{
 for(const [task,count]of [[{day:1,id:1},0],[{day:20,id:12},1],[null,5]]){
  const s=createStoryRecap(c);assert.equal(act(s,'open-shelf',{},context(task)).ok,true);const v=storyRecapView(s,context(task),c);
  assert.equal(v.slots.length,9);assert.equal(v.rows.length,3);assert.equal(v.slots.filter(s=>s.kind==='book').length,count);assert.equal(v.slots[count].kind,'coming-soon');
  assert.equal(v.slots.filter(s=>s.kind==='empty').length,8-count);assert.equal(act(s,'open-book',{book:count+1},context(task)).ok,false);
 }
});
test('opening marks shown once; reopen starts at page1 while reload preserves explicit web presentation state',()=>{
 const s=opened();assert.deepEqual(s.seen,[1]);assert.equal(s.page,1);assert.equal(storyRecapView(s,context(),c).hasAnyNewBook,true);
 assert.equal(act(s,'next').ok,true);assert.equal(act(s,'advance',{seconds:0.25}).ok,true);assert.equal(s.page,2);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(validStoryRecap(restored,c),true);assert.equal(storyRecapView(restored,context(),c).book.page.id,2);
 assert.equal(act(restored,'close-book').ok,true);assert.equal(act(restored,'open-book',{book:1}).ok,true);assert.equal(restored.page,1);assert.deepEqual(restored.seen,[1]);
 assert.equal(act(restored,'close-book').ok,true);const out=act(restored,'close-shelf');assert.equal(out.returnTo,'task-list');assert.equal(restored.phase,'closed');assert.deepEqual(restored.seen,[1]);
});
test('directional page locks and delayed content updates match declared next and previous callback timing',()=>{
 const s=opened(),nonce=s.scrollResetNonce;
 let out=act(s,'next');assert.equal(out.unlockAfter,0.25);assert.equal(out.contentAfter,0.1);assert.equal(s.page,2);assert.equal(s.displayPage,1);
 const before=structuredClone(s);assert.equal(act(s,'next').status,'input-locked');assert.equal(act(s,'close-book').status,'input-locked');assert.deepEqual(s,before);
 act(s,'advance',{seconds:0.099});assert.equal(s.displayPage,1);assert.equal(validStoryRecap(s,c),true);
 act(s,'advance',{seconds:0.001});assert.equal(s.displayPage,2);assert.equal(s.scrollResetNonce,nonce+1);assert.equal(storyRecapView(s,context(),c).locked,true);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(validStoryRecap(restored,c),true);act(restored,'advance',{seconds:0.15});assert.equal(restored.transition,null);
 out=act(restored,'previous');assert.equal(out.unlockAfter,0.5);assert.equal(out.contentAfter,0.3);assert.equal(restored.displayPage,2);
 act(restored,'advance',{seconds:0.29});assert.equal(restored.displayPage,2);act(restored,'advance',{seconds:0.01});assert.equal(restored.displayPage,1);assert.equal(storyRecapView(restored,context(),c).locked,true);act(restored,'advance',{seconds:0.2});assert.equal(restored.transition,null);assert.equal(validStoryRecap(restored,c),true);
});
test('swipe requires dt>=.01, strict horizontal ratio and strictly greater than1000px/sec',()=>{
 for(const input of [{dx:-100,dy:0,seconds:0.1},{dx:-150,dy:100,seconds:0.1},{dx:-11,dy:0,seconds:0.009},{dx:-100,dy:200,seconds:0.1}]){
  const s=opened(),before=structuredClone(s);assert.equal(act(s,'swipe',input).status,'swipe-ignored');assert.deepEqual(s,before);
 }
 const s=opened();assert.equal(act(s,'swipe',{dx:-11,dy:0,seconds:0.01}).ok,true);act(s,'advance',{seconds:0.25});assert.equal(s.page,2);assert.equal(act(s,'swipe',{dx:101,dy:0,seconds:0.1}).ok,true);assert.equal(s.page,1);
});
test('all5 books/22 pages are traversable with edge guards, no duplicate seen flags or finance mutation',()=>{
 const s=createStoryRecap(c),ctx={...context(),wallet:{gems:99,coins:12},questsDone:0},before=structuredClone(ctx);let pages=0;
 act(s,'open-shelf',{},ctx);
 for(const b of c.books){
  assert.equal(act(s,'open-book',{book:b.id},ctx).ok,true);assert.equal(act(s,'previous',{},ctx).status,'edge');pages++;
  for(let page=2;page<=b.pages.length;page++){assert.equal(act(s,'next',{},ctx).ok,true);act(s,'advance',{seconds:0.25},ctx);assert.equal(s.page,page);assert.equal(validStoryRecap(s,c),true);pages++;}
  const prior=structuredClone(s);assert.equal(act(s,'next',{},ctx).status,'edge');assert.deepEqual(s,prior);act(s,'close-book',{},ctx);
 }
 assert.equal(pages,22);assert.deepEqual(s.seen,[1,2,3,4,5]);assert.equal(storyRecapView(s,ctx,c).hasAnyNewBook,false);assert.deepEqual(ctx,before);assert.equal(Object.hasOwn(s,'wallet'),false);
});
test('explicit research snapshots are separate from main progress and withdrawals cannot reveal locked book content',()=>{
 const s=createStoryRecap(c),ctx=context({day:1,id:1},null),inputs={...createStoryRecapInputs(),serverEnabled:true,taskMode:'research',taskOverride:{day:20,id:12}};
 assert.equal(act(s,'configure',{inputs},ctx).ok,true);assert.deepEqual(storyRecapView(s,ctx,c).unlocked,[1]);assert.equal(ctx.currentTask.day,1);act(s,'open-shelf',{},ctx);act(s,'open-book',{book:1},ctx);
 assert.equal(act(s,'configure',{inputs},ctx).status,'book-open');
 const main=opened(),v=storyRecapView(main,context({day:1,id:1}),c);assert.equal(v.book,null);assert.equal(v.canRead,false);assert.equal(act(main,'next',{},context({day:1,id:1})).ok,false);
 act(main,'leave');assert.equal(main.phase,'closed');assert.equal(main.transition,null);assert.deepEqual(main.seen,[1]);
});
test('optional old-save field remains compatible; defined malformed state is retained without reset',()=>{
 assert.equal(validStoryRecap(undefined,c),true);assert.equal(validStoryRecap(null,c),false);
 const good=opened();for(const change of [s=>s.seen.push(1),s=>s.page=999,s=>s.revision='other',s=>s.inputs.serverEnabled=1,s=>s.inputs.taskOverride={day:99,id:1},s=>s.wallet={coins:999},s=>s.seen=Array(1)]){
  const s=structuredClone(good);change(s);const before=structuredClone(s);assert.equal(validStoryRecap(s,c),false);assert.equal(act(s,'leave').ok,false);assert.deepEqual(s,before);
 }
 assert.equal(validStoryRecapInputs({...createStoryRecapInputs(),taskMode:'research',taskOverride:null}),true);
});
test('curated story data retains keys and22 short excerpts, links all40 body images and5 covers while retaining22 short excerpts',async()=>{
 assert.equal(c.originalRuntimeObserved,false);assert.equal(c.summary.fullTextPublished,false);assert.equal(c.summary.originalTextBlocks,225);assert.equal(c.summary.publishedExcerptBlocks,22);
 let excerpts=0,omitted=0,images=0,known=0;for(const book of c.books)for(const page of book.pages)for(const element of page.elements){
  if(element.kind==='text-excerpt'){excerpts++;assert.ok(Array.from(element.text).length<=80);}
  if(element.kind==='omitted-text'){omitted+=element.blocks;assert.equal(Object.hasOwn(element,'text'),false);assert.equal(Object.hasOwn(element,'key'),false);}
  if(element.kind==='image'){images++;if(element.available){known++;const m=[...(c.mediaEntries||[]),...scenes.mediaEntries].find(m=>m.key===element.mediaKey);assert.ok(m);assert.equal(m.sha256,element.media.sha256);const bytes=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);}else{assert.equal(element.media,null);assert.equal(element.mediaKey,null);}}
 }
 assert.equal(excerpts,22);assert.equal(omitted,203);assert.equal(images,40);assert.equal(known,40);
 assert.equal(c.mediaEntries.length,43);assert.equal(c.summary.imageReferencesWithCuratedMedia,40);assert.equal(c.summary.uniqueCuratedImages,40);assert.equal(c.summary.bodyImageKeysRegisteredOnly,0);assert.equal(c.summary.coverImagesAvailable,5);
 assert.equal(c.resourceAudit.requestedUniqueBodyKeys,40);assert.equal(c.resourceAudit.exactLocalSprites,11);assert.equal(c.resourceAudit.records.length,45);assert.equal(c.resourceAudit.registeredOnlyKeys.length,0);assert.equal(c.resourceAudit.exactSpritesAllSources,45);assert.equal(c.resourceAudit.exactRemoteSprites,34);
 for(const r of c.resourceAudit.records.filter(r=>r.status==='registered-only-not-found-in-supplied-local-inventory')){assert.equal(r.exactContainerMatches,0);assert.equal(r.exactSpriteNameMatches,0);assert.equal(r.caseInsensitiveContainerMatches,0);assert.deepEqual(r.physicalSprites,[]);assert.match(r.imageFileConfig.assetGuid,/^[a-f0-9]{32}$/);}
 for(const m of c.mediaEntries){assert.ok(m.width>0&&m.width<=960);assert.ok(m.height>0&&m.height<=960);assert.equal(m.kind,'image');assert.ok(['packaged-sprite','apk-catalog-remote-sprite'].includes(m.origin));assert.match(m.rgbaSha256,/^[a-f0-9]{64}$/);assert.equal(typeof m.identity.path_id,'string');assert.equal(m.mapping.shortName,m.identity.name);assert.equal(m.originalRuntimeObserved,false);assert.ok(m.privacyReview);}
 for(const s of c.sources){assert.ok(s.path.startsWith('analysis/'));assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.equal(s.originalRuntimeObserved,false);for(const r of s.ranges)assert.ok(r[0]>0&&r[1]>=r[0]);}
});
test('book UI renders accessible shelf/content, exact known media and verified cover images and corrupt-save controls',()=>{
 const s=opened(),dom=new JSDOM(renderStoryRecap({storyRecap:s,board:[]},{storyRecapConfig:c,sceneConfig:scenes},{mainTask:null,serverEnabled:true}));
 try{const d=dom.window.document;assert.equal(d.querySelectorAll('.recap-image img').length,2);assert.ok(d.querySelector('[data-play="recap:next"]'));assert.ok(d.querySelector('[data-recap-swipe]'));assert.match(d.body.textContent,/선정 본문 발췌/);assert.match(d.querySelector('.recap-book-toolbar').textContent,/1권 · 1\/8페이지/);assert.doesNotMatch(d.querySelector('.recap-content').textContent,/undefined/);assert.ok(d.querySelector('[data-recap-flag]'));}finally{dom.window.close();}
 const newMediaPage=c.books[0].pages.find(p=>p.elements.some(el=>el.mediaKey?.startsWith('recap:')));assert.ok(newMediaPage);s.page=newMediaPage.id;s.displayPage=newMediaPage.id;
 const newlyRecovered=new JSDOM(renderStoryRecap({storyRecap:s,board:[]},{storyRecapConfig:c,sceneConfig:scenes},{mainTask:null,serverEnabled:true}));try{assert.ok([...newlyRecovered.window.document.querySelectorAll('.recap-image img')].some(im=>im.getAttribute('src').startsWith('./assets/media/story-recap/')));}finally{newlyRecovered.window.close();}
 act(s,'close-book');const shelf=new JSDOM(renderStoryRecap({storyRecap:s,board:[]},{storyRecapConfig:c},{mainTask:null,serverEnabled:true}));
 try{assert.equal(shelf.window.document.querySelectorAll('[role=listitem]').length,9);assert.equal(shelf.window.document.querySelectorAll('[data-play="recap:open-book"]').length,5);assert.equal(shelf.window.document.querySelectorAll('.recap-book-cover').length,5);assert.doesNotMatch(shelf.window.document.body.textContent,/표지 미확보/);}finally{shelf.window.close();}
 const invalid=new JSDOM(renderStoryRecap({storyRecap:null,board:[]},{storyRecapConfig:c},{mainTask:null}));try{assert.ok(invalid.window.document.querySelector('[data-play="recap:reset-invalid"]'));assert.ok(invalid.window.document.querySelector('[data-play=export]'));}finally{invalid.window.close();}
});
test('remote visual declarations and one exact short page-turn effect stay separate from recovered pictures and runtime verification',async()=>{
 assert.equal(c.mediaEntries.length,43);assert.equal(c.audioEntries.length,1);assert.equal(c.resourceAudit.remoteCatalog.exactGUIDMatches,34);assert.equal(c.resourceAudit.remoteCatalog.resolvedURLs,34);
 assert.equal(c.presentationEvidence.prefabs.length,3);for(const p of c.presentationEvidence.prefabs){assert.equal(p.exactBindingsToSpineVerified,false);assert.equal(p.staticDistributionVerified,true);assert.equal(p.staticPhysicalTargets.length,1);assert.equal(p.originalRuntimeObserved,false);assert.ok(p.catalogBundles.some(b=>b.bundleFile.includes('storyrecap_assets_all_')));}
 const a=c.audioEntries[0];assert.equal(a.key,'recap:audio:sfxStoryIn');assert.equal(a.kind,'audio');assert.equal(a.mapping.shortName,'sfxStoryIn');assert.deepEqual(a.trigger.actions,['next','previous']);assert.equal(a.trigger.newBookOpen,false);assert.equal(a.trigger.close,false);assert.equal(a.auditionVerified,false);assert.equal(a.runtimeSynchronizationVerified,false);
 const bytes=await readFile(new URL('../src/'+a.src.slice(2),import.meta.url));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);assert.equal(bytes.length,a.bytes);assert.ok(Math.abs(a.duration-a.declaredDuration)<1e-6);assert.equal(a.channels,1);assert.equal(a.frequency,44100);
 const dom=new JSDOM(renderStoryRecap({storyRecap:opened(),board:[]},{storyRecapConfig:c,sceneConfig:scenes},{mainTask:null,serverEnabled:true}));try{const audio=dom.window.document.querySelector('audio');assert.ok(audio);assert.equal(audio.hasAttribute('autoplay'),false);assert.equal(audio.getAttribute('preload'),'none');assert.equal(audio.getAttribute('src'),a.src);assert.match(dom.window.document.body.textContent,/회수한 원격 대상은 34개/);}finally{dom.window.close();}
});

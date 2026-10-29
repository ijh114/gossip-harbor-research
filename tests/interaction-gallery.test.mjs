import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {INTERACTION_SAMPLES} from '../src/interaction-samples.mjs';
import {renderInteractionGallery,mountInteractionLoops} from '../src/interaction-gallery.mjs';
import {mergeResearch} from '../src/domain-model.mjs';
const media=JSON.parse(await readFile(new URL('../src/data/media.json',import.meta.url),'utf8'));
const data={media};

test('all requested interactions remain visible together with real animated files and truthful provenance',async()=>{
 const [base,domains,followup]=await Promise.all(['research.json','domains.json','followup.json'].map(async n=>JSON.parse(await readFile(new URL('../src/data/'+n,import.meta.url),'utf8'))));
 const facts=new Set(mergeResearch(base,domains,followup).facts.map(f=>f.id));
 const modelHash=createHash('sha256').update(await readFile(new URL('../src/play-model.mjs',import.meta.url))).digest('hex');
 assert.equal(INTERACTION_SAMPLES.length,12);
 assert.deepEqual(INTERACTION_SAMPLES.map(x=>x.id),['select','move','merge','blocked','rainbow','scissors','hourglass','swap','drag','hint','unlock-web','unlock-box']);
 const dom=new JSDOM(renderInteractionGallery(data));
 assert.equal(dom.window.document.querySelectorAll('[data-interaction-card]').length,12);
 assert.equal(dom.window.document.querySelectorAll('video, [data-interaction], [role="tab"]').length,0);
 for(const sample of INTERACTION_SAMPLES){
  assert.ok(facts.has(sample.source),'existing research reference '+sample.source);
  const m=media.entries.find(x=>x.key===sample.mediaKey);assert.equal(m.kind,'gif');assert.ok(m.poster);
  const bytes=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));
  assert.match(bytes.subarray(0,6).toString(),/^GIF8[79]a$/);assert.equal(bytes.readUInt16LE(6),560);assert.equal(bytes.readUInt16LE(8),400);
  assert.ok(bytes.includes(Buffer.from('NETSCAPE2.0')),'infinite loop');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);
  if(sample.id==='merge'){assert.equal(m.origin,'observed-user-capture');assert.equal(m.version,null);assert.ok(m.originalSha256);}
  else {assert.equal(m.origin,'apk-rule-replay');assert.equal(m.replay.illustrativeTiming,true);assert.equal(m.replay.modelSha256,modelHash);assert.ok(m.replay.spriteSources.length);}
 }
 assert.match(dom.window.document.querySelector('#interaction-unlock-box').textContent,/거미줄이 남습니다/);
 dom.window.close();
});

function environment(reduced=false){
 const dom=new JSDOM(renderInteractionGallery(data),{url:'http://localhost/',pretendToBeVisual:true}),win=dom.window,doc=win.document,listeners=new Set();let observer,hidden=false;
 Object.defineProperty(doc,'hidden',{get:()=>hidden});
 win.matchMedia=()=>({matches:reduced,addEventListener:(_,f)=>listeners.add(f),removeEventListener:(_,f)=>listeners.delete(f)});
 win.IntersectionObserver=class{constructor(callback){this.callback=callback;this.disconnected=false;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
 const stop=mountInteractionLoops(doc),images=[...doc.querySelectorAll('[data-loop-src]')],button=doc.querySelector('[data-loop-all]');
 return {dom,win,doc,images,button,stop,get observer(){return observer;},hide(value){hidden=value;doc.dispatchEvent(new win.Event('visibilitychange'));},reduce(){for(const f of listeners)f({matches:true});},listeners};
}
test('autoplay starts only in view, pauses globally and when hidden, and releases GIFs when leaving the page',()=>{
 const e=environment();const {images,button,observer}=e;
 assert.ok(images.every(i=>i.getAttribute('src')===i.dataset.loopPoster));
 observer.callback([{target:images[0],isIntersecting:true}]);assert.equal(images[0].getAttribute('src'),images[0].dataset.loopSrc);assert.equal(images[1].dataset.loopState,'paused');
 button.click();assert.equal(images[0].getAttribute('src'),images[0].dataset.loopPoster);assert.equal(button.textContent,'모두 재생');
 button.click();assert.equal(images[0].dataset.loopState,'playing');
 e.hide(true);assert.equal(images[0].dataset.loopState,'paused');e.hide(false);assert.equal(images[0].dataset.loopState,'playing');
 observer.callback([{target:images[0],isIntersecting:false}]);assert.equal(images[0].dataset.loopState,'paused');
 e.stop();assert.equal(observer.disconnected,true);assert.equal(e.listeners.size,0);assert.ok(images.every(i=>i.dataset.loopState==='paused'));e.dom.window.close();
});
test('reduced motion defaults to posters, allows explicit replay, and failed GIFs retain a readable fallback',()=>{
 const e=environment(true),img=e.images[0];e.observer.callback([{target:img,isIntersecting:true}]);assert.equal(img.dataset.loopState,'paused');
 assert.match(e.doc.querySelector('[data-loop-status]').textContent,/움직임 줄이기/);e.button.click();assert.equal(img.dataset.loopState,'playing');
 e.reduce();assert.equal(img.dataset.loopState,'paused');e.button.click();img.dispatchEvent(new e.win.Event('error'));
 assert.equal(img.getAttribute('src'),img.dataset.loopPoster);assert.equal(img.closest('[data-interaction-card]').querySelector('[data-loop-error]').hidden,false);
 e.stop();e.dom.window.close();
});

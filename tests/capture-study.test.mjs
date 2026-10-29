import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderCaptureStudies,renderStudyLinks,renderAudioStudy,selectStudies,waveformPath} from '../src/capture-study.mjs';
import {mediaFor} from '../src/visual-model.mjs';
import {mountInteractionLoops} from '../src/interaction-gallery.mjs';
const media=(key,extra={})=>({key,kind:'image',src:'./assets/media/refinement/'+key+'.webp',alt:'관측',source:'GH-V0001 · 원본 PTS',sha256:'a'.repeat(64),originalSha256:'b'.repeat(64),...extra});
const data={refinement:{mediaEntries:[media('before'),media('after'),media('gif',{kind:'gif',src:'./assets/media/refinement/merge.gif',poster:'./assets/media/refinement/after.webp'})],studies:[{id:'merge',title:'실제 합성',topic:'puzzle',sourceId:'GH-V0001',evidenceType:'actual-play',sourceRange:{startSeconds:1,endSeconds:2},imageKey:'before',mediaKeys:['gif'],frames:[{key:'after',timeSeconds:1.156,caption:'결과가 나타난 원본 프레임'}],annotations:[{id:'item',label:'합성 대상',x:.1,y:.2,width:.4,height:.3,note:'해당 시점의 실제 아이템'}],observations:['합성 뒤 결과 아이템이 나타난다.'],unknowns:['정확한 클릭 시각은 미확인'],measurements:[{label:'변화',fromSeconds:1.05,toSeconds:1.156,method:'인접 원본 PTS 프레임',uncertaintySeconds:.017,note:'입력 잠금 측정이 아니다.'}],comparison:{beforeKey:'before',afterKey:'after',explanation:'같은 녹화의 두 프레임.'}},{id:'help',title:'도구 도움말',topic:'ui',sourceId:'GH-V0002',evidenceType:'help-demo',imageKey:'after',mediaKeys:['after'],observations:[],unknowns:['실제 사용 아님']}],corrections:[{title:'오관측 정정',previous:'도구 확인창',corrected:'버블 삭제 확인창',reason:'원본 해상도 문구 확인',sourceId:'GH-V0001'}]}};
test('study filtering retains evidence categories and explicit selected source frames',()=>{
 assert.equal(selectStudies(data,{topic:'puzzle'}).length,1);assert.equal(selectStudies(data,{query:'GH-V0002'}).length,1);assert.equal(mediaFor(data,'after').key,'after');
 const dom=new JSDOM(renderCaptureStudies(data,{selected:'merge',region:'item',frame:'after'})),d=dom.window.document;
 assert.equal(d.querySelector('[data-study-selected]').dataset.studySelected,'merge');assert.equal(d.querySelectorAll('.study-hotspot').length,0);assert.match(d.querySelector('.study-main-figure').textContent,/1.156초/);assert.equal(d.querySelectorAll('.study-comparison figure').length,2);assert.match(d.body.textContent,/버블 삭제 확인창/);assert.ok(d.querySelector('a[href="#media-audit?source=GH-V0001"]'));dom.window.close();
 const annotated=new JSDOM(renderCaptureStudies(data,{selected:'merge'}));assert.equal(annotated.window.document.querySelectorAll('.study-hotspot').length,1);assert.match(annotated.window.document.querySelector('.study-region-detail').textContent,/합성 대상/);annotated.window.close();
});
test('study previews are image-led links and unsafe captions remain text',()=>{
 const clone=structuredClone(data);clone.refinement.studies[0].title='<script>bad</script>';clone.refinement.studies[0].annotations[0].note='<img src=x onerror=bad>';
 const dom=new JSDOM(renderStudyLinks(clone,['puzzle'])+renderCaptureStudies(clone,{topic:'puzzle'}));assert.equal(dom.window.document.querySelectorAll('script,[onerror]').length,0);assert.equal(dom.window.document.querySelectorAll('.study-preview').length,1);assert.equal(dom.window.document.querySelectorAll('[data-study-select]').length,1);dom.window.close();assert.match(renderCaptureStudies(data,{query:'notfound'}),/검색 결과가 없습니다/);
});
test('audio plots clamp values and keep static routing separate from unperformed listening',()=>{
 assert.equal(waveformPath([0,1,2,-1,NaN],4,10),'M0.00,10.00 L1.00,0.00 L2.00,0.00 L3.00,10.00 L4.00,10.00');
 const audio={boundary:'정적 연결 확인 · 직접 청취 미수행',summary:{recordingsMeasured:110,recordingsListened:0},recordings:[{sourceId:'GH-V0001',duration:2,waveform:[.1,.5],meanDb:-20,maxDb:-1}],clips:[{title:'합성',src:'./assets/media/refinement/audio/merge.ogg',duration:1,waveform:[0,.8,0],classification:'정적 라우팅',note:'청취 미확인',source:'APK AudioClip',sha256:'c'.repeat(64)}]};
 const dom=new JSDOM(renderAudioStudy({refinement:{audio}}));assert.equal(dom.window.document.querySelectorAll('audio').length,1);assert.equal(dom.window.document.querySelector('audio').autoplay,false);assert.equal(dom.window.document.querySelectorAll('svg').length,2);assert.match(dom.window.document.body.textContent,/직접 청취 0개/);dom.window.close();
});

test('refinement GIF previews stop inside a collapsed picker and resume only after expansion',()=>{
 const dom=new JSDOM(renderCaptureStudies(data,{selected:'merge'}),{pretendToBeVisual:true}),w=dom.window;
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 const cleanup=mountInteractionLoops(w.document,{gallerySelector:'[data-study-loop-gallery]',cardSelector:'[data-study-select]'});
 const picker=w.document.querySelector('[data-study-loop-gallery]'),img=picker.querySelector('[data-loop-src]');
 assert.equal(img.src.endsWith('after.webp'),true);picker.open=true;picker.dispatchEvent(new w.Event('toggle'));assert.equal(img.src.endsWith('merge.gif'),true);
 picker.open=false;picker.dispatchEvent(new w.Event('toggle'));assert.equal(img.src.endsWith('after.webp'),true);cleanup();w.close();
});

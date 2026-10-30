import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { renderCaptureFollowupStudy,mountCaptureFollowupStudy } from '../src/capture-followup-study.mjs';

const data=JSON.parse(readFileSync(new URL('../src/data/capture-followup-study.json',import.meta.url),'utf8'));
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const setup=()=>{const dom=new JSDOM(renderCaptureFollowupStudy(data));dom.window.HTMLMediaElement.prototype.pause=()=>{};const cleanup=mountCaptureFollowupStudy(dom.window.document,data);return {dom,document:dom.window.document,cleanup};};

test('bounded observations keep all five original task states and unknowns',()=>{
  assert.deepEqual(data.tasks.map(row=>[row.id,row.status]),[['4.06','자료 필요'],['4.07','자료 필요'],['4.08','자료 필요'],['4.11','부분'],['4.12','미완료']]);
  assert.equal(data.originalRuntimeObserved,false);assert.equal(data.inputLogAvailable,false);assert.equal(data.listenedSeconds,0);
  assert.equal(data.completeOriginalRecordingsReviewed,false);assert.equal(data.everyOriginalFrameVisuallyReviewed,false);
  assert.equal(data.summary.newSuccessfulTargetTransitionsConfirmed,0);assert.equal(data.summary.additionalNativePointsVisuallyReviewed,33);
  assert.equal(data.summary.additionalSampleFrames,930);assert.equal(data.summary.distinctCandidatePairsVisuallyReviewed,6);
  for(const row of data.studies){assert.ok(row.cannotConclude.length);assert.ok(row.unresolvedAcceptance);assert.equal(row.requiredCapture,undefined);assert.ok(!/성공(?:-observed|을 확인)/.test(row.evidenceStatus));}
});

test('every public media hash and original source identity resolves; clips declare audio removal',()=>{
  assert.equal(new Set(data.mediaEntries.map(row=>row.key)).size,data.mediaEntries.length);
  for(const row of data.mediaEntries){
    assert.match(row.src,/^\.\/assets\/media\/capture-followup-study\/[\w.-]+$/);const p=new URL('../src/'+row.src.slice(2),import.meta.url);
    assert.ok(existsSync(p),row.src);assert.equal(digest(readFileSync(p)),row.sha256,row.key);
    const source=data.sources.find(source=>source.id===row.sourceId);assert.equal(source.sha256,row.originalSha256);assert.equal(row.version,null);assert.equal(row.sourceManifestVersionVerified,false);
    assert.equal(row.privacyReview.status,'reviewed');assert.equal(row.originalRuntimeObserved,false);
    if(row.kind==='video'||row.kind==='gif'){assert.equal(row.transform.speed,1);assert.equal(row.transform.audioRemoved,true);assert.equal(row.encodedVerification.hasAudio,false);assert.ok(row.transform.firstIncludedSourcePTS>=row.sourceRange.startSeconds);assert.ok(row.transform.lastIncludedSourcePTS<=row.sourceRange.endSeconds);}
    if(row.poster){assert.equal(digest(readFileSync(new URL('../src/'+row.poster.slice(2),import.meta.url))),row.posterSha256);}
  }
  for(const study of data.studies)for(const frame of study.frames){const media=data.mediaEntries.find(row=>row.key===frame.mediaKey);assert.ok(media);assert.equal(media.sourcePTS,frame.sourcePTS);}
});

test('task filter and frame scrubber preserve native PTS and disable boundary navigation',()=>{
  const {document,dom,cleanup}=setup();const filter=document.querySelector('[data-capture-filter]');filter.value='4.08';filter.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal([...document.querySelectorAll('[data-capture-study]')].filter(row=>!row.hidden).length,1);assert.match(document.querySelector('[data-capture-count]').textContent,/1개/);
  filter.value='4.11';filter.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal([...document.querySelectorAll('[data-capture-study]')].filter(row=>!row.hidden).length,3);
  const card=document.querySelector('[data-capture-study="idle-not-proven-hint"]');const slider=card.querySelector('[data-capture-scrub]');const next=card.querySelector('[data-capture-step="1"]');
  assert.equal(card.querySelector('[data-capture-step="-1"]').disabled,true);next.click();assert.equal(slider.value,'1');assert.match(card.querySelector('[data-capture-caption]').textContent,/54\.502956초/);
  next.click();assert.equal(slider.value,'2');assert.equal(next.disabled,true);assert.match(card.querySelector('[data-capture-index]').textContent,/3 \/ 3/);cleanup();
});

test('GIF starts only by explicit toggle; cleanup removes handlers and rendering rejects external media URLs',()=>{
  const {document,cleanup}=setup();const toggle=document.querySelector('[data-capture-gif-toggle]');const image=toggle.parentElement.querySelector('[data-capture-gif]');assert.equal(image.hidden,true);assert.doesNotMatch(image.src,/\.gif$/);
  toggle.click();assert.equal(image.hidden,false);assert.match(image.src,/\.gif$/);toggle.click();assert.equal(image.hidden,true);assert.equal(image.getAttribute('src'),null);cleanup();toggle.click();assert.equal(image.hidden,true);
  const bad=structuredClone(data);bad.studies[0].title='<script>bad</script>';bad.mediaEntries[0].src='https://invalid.example/private.mp4';const html=renderCaptureFollowupStudy(bad);assert.ok(!html.includes('<script>bad</script>'));assert.ok(!html.includes('https://invalid.example'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {validMedia} from '../src/visual-model.mjs';
import {selectBMObservationRows,summarizeBMObservationAudit,renderBMObservationAudit,mountBMObservationAudit} from '../src/bm-observation-audit.mjs';

const load=async name=>JSON.parse(await readFile(new URL('../src/data/'+name,import.meta.url),'utf8'));
const data=await load('bm-observation-audit.json');
const timeline=await load('bm-timeline.json');
const mediaAudit=await load('media-audit.json');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('each of 54 question/type cells owns observation evidence exactly once; 42 timeline points are context only',()=>{
 assert.equal(data.types.length,9);assert.equal(data.questions.length,6);assert.equal(data.rows.length,54);assert.equal(data.contextPoints.length,42);
 const credits=new Map(),ids=new Set();
 for(const row of data.rows){assert.equal(row.id,`${row.typeId}--${row.questionId}`);assert.ok(!ids.has(row.id));ids.add(row.id);assert.equal(row.lifecycleComplete,false);
  for(const id of row.observationIds){const observation=data.observations.find(o=>o.id===id);assert.ok(observation,id);assert.equal(observation.typeId,row.typeId);assert.equal(observation.questionId,row.questionId);assert.equal(observation.creditedQuestionId,row.questionId);credits.set(id,(credits.get(id)||0)+1);}
 }
 assert.equal(credits.size,data.observations.length);for(const count of credits.values())assert.equal(count,1);
 for(const point of data.contextPoints){assert.equal(point.coverageCredit,false);const entry=timeline.entries.find(e=>e.id===point.typeId),original=entry.milestones.find(p=>p.id===point.milestoneId);assert.ok(original);assert.equal(point.originalSha256,original.evidence.originalSha256);assert.equal(point.atSeconds,original.atSeconds);assert.deepEqual(point.mediaKeys,original.mediaKeys);}
});

test('file-local reappearance does not certify automatic delivery, first ever exposure, expiry or popup competition',()=>{
 const repeat=data.rows.filter(r=>r.questionId==='reappearance'&&r.status==='observed-scoped');assert.deepEqual(repeat.map(r=>r.typeId).sort(),['level-offer','selected-card']);
 for(const observation of data.observations){assert.equal(observation.automaticExposureConfirmed,false);assert.equal(observation.skuIdentityConfirmed,false);assert.equal(observation.version,null);assert.equal(observation.capturedAt,null);assert.ok(observation.unknowns.length);assert.match(observation.originalSha256,/^[a-f0-9]{64}$/);}
 assert.ok(data.rows.filter(r=>r.questionId==='first-exposure').every(r=>r.status!=='observed-scoped'));
 assert.ok(data.rows.filter(r=>['expiry','competition'].includes(r.questionId)).every(r=>r.status!=='observed-scoped'));
 for(const key of ['newOriginalRuntimeObservations','newVerifiedPaymentReceipts','accountFirstExposureConfirmed','automaticReappearanceConfirmed','expiryTransitionsConfirmed','competingPopupPriorityConfirmed'])assert.equal(data.summary[key],0,key);
 assert.equal(data.historicalRuntime.bmCoverageCredit,false);assert.equal(data.summary.newSourceFiles,0);
 assert.equal(data.rows.find(r=>r.typeId==='selected-card'&&r.questionId==='expiry').status,'unconfirmed');
 assert.equal(data.rows.find(r=>r.typeId==='selected-card'&&r.questionId==='first-exposure').codeScope,'not-established');
 assert.equal(data.rows.find(r=>r.typeId==='energy-challenge'&&r.questionId==='expiry').codeScope,'general-comparison');
});

test('public projection retains source identity, timestamps, static anchors and uncertainty without private paths',async()=>{
 for(const input of data.inputRefs){const bytes=await readFile(new URL('../'+input.path,import.meta.url));assert.equal(digest(bytes),input.sha256,input.id);}
 const sourceHashes=new Map(mediaAudit.videos.map(v=>[v.id,v.sha256]));
 for(const observation of data.observations){if(sourceHashes.has(observation.sourceId))assert.equal(sourceHashes.get(observation.sourceId),observation.originalSha256);if(observation.sourceRange){const video=mediaAudit.videos.find(v=>v.id===observation.sourceId);assert.ok(observation.sourceRange.startSeconds>=0);assert.ok(observation.sourceRange.endSeconds>observation.sourceRange.startSeconds);assert.ok(observation.sourceRange.endSeconds<=video.duration);}}
 for(const source of data.staticAnchors){assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.ok(source.path.startsWith('analysis/lua/'));assert.ok(source.line_start>=1&&source.line_end>=source.line_start);assert.equal(source.evidenceType,'static-code');assert.equal(source.captureObjectIdentityConfirmed,false);}
 assert.doesNotMatch(JSON.stringify(data),/[CD]:[\\/]|@gmail\.com|originalPath|privateReviewPath/);
});

test('new media remain bounded muted derivatives with verifiable posters, frames and original hashes',async()=>{
 assert.equal(data.mediaEntries.length,10);let bytesTotal=0;
 for(const media of data.mediaEntries){assert.ok(validMedia(media),media.key);assert.equal(media.version,null);assert.equal(media.capturedAt,null);assert.equal(media.originalSha256,mediaAudit.videos.find(v=>v.id===media.sourceId).sha256);assert.match(media.src,/^\.\/assets\/media\/bm-observation\/[\w.-]+$/);assert.ok(media.sourceRange.durationSeconds<=3.4+.001);assert.equal(media.origin,'observed-user-capture');
  const bytes=await readFile(new URL('../src/'+media.src.slice(2),import.meta.url));assert.equal(digest(bytes),media.sha256);assert.equal(bytes.length,media.bytes);bytesTotal+=bytes.length;
  if(media.poster){const poster=await readFile(new URL('../src/'+media.poster.slice(2),import.meta.url));assert.equal(digest(poster),media.posterSha256);bytesTotal+=poster.length;}
  if(media.kind==='video'){assert.equal(media.encodedVerification.decodedAllFrames,true);assert.equal(media.encodedVerification.decoderErrorCount,0);assert.equal(media.encodedVerification.audioStreams,0);assert.equal(media.transform.muted,true);}
  if(media.kind==='gif'){assert.equal(media.transform.timingIsMeasurementSource,false);assert.equal(bytes.readUInt16LE(6),media.width);assert.equal(bytes.readUInt16LE(8),media.height);}
 }
 assert.ok(bytesTotal<10_000_000);assert.equal(data.summary.newPublicMediaBytes,bytesTotal);
});

test('filters intersect question, type, status and source search while summaries recompute rather than duplicate credits',()=>{
 const rows=selectBMObservationRows(data,{question:'reappearance',status:'observed-scoped'});assert.equal(rows.length,2);
 assert.deepEqual(selectBMObservationRows(data,{type:'selected-card',question:'reappearance'}).map(r=>r.id),['selected-card--reappearance']);
 assert.equal(selectBMObservationRows(data,{query:'GH-V0003',question:'reappearance'}).length,1);
 assert.equal(selectBMObservationRows(data,{type:'missing'}).length,0);
 const summary=summarizeBMObservationAudit(data,{question:'reappearance',status:'observed-scoped'});assert.equal(summary.visibleCells,2);assert.equal(summary.uniqueObservations,2);assert.equal(summary.newRuntimeObservations,0);
});

test('render supplies a labeled keyboard-scrollable matrix, native disclosures and honest empty data',()=>{
 const dom=new JSDOM(renderBMObservationAudit(data,{question:'reappearance',status:'observed-scoped'}));const document=dom.window.document;
 assert.equal(document.querySelectorAll('tbody tr').length,2);assert.ok(document.querySelector('table caption'));assert.equal(document.querySelector('[role="region"][tabindex="0"]').getAttribute('aria-label'),'BM 질문별 근거 매트릭스');
 assert.equal(document.querySelectorAll('select').length,3);for(const control of document.querySelectorAll('select,input'))assert.ok(control.closest('label'));
 assert.ok(document.querySelector('details'));assert.ok(document.querySelector('[data-media-key]'));assert.ok(document.querySelector('[role="status"]'));
 assert.match(document.body.textContent,/자동 재노출.*미확인/);assert.match(renderBMObservationAudit(null),/자료가 없습니다/);
 assert.match(renderBMObservationAudit(data,{type:'missing'}),/조건에 맞는 항목이 없습니다/);
});

test('untrusted query and record content cannot inject HTML or unsafe media URLs',()=>{
 const clone=structuredClone(data);clone.rows[0].answer='<img src=x onerror=alert(1)>';clone.observations[0].claim='<script>alert(1)</script>';
 const html=renderBMObservationAudit(clone,{query:'"><svg onload=alert(2)>'});const dom=new JSDOM(html);assert.equal(dom.window.document.querySelector('script,svg[onload],img[onerror]'),null);assert.equal(dom.window.document.querySelector('input').value,'"><svg onload=alert(2)>');
 const unsafe=structuredClone(data);unsafe.mediaEntries[0].src='javascript:alert(1)';assert.doesNotMatch(renderBMObservationAudit(unsafe,{question:'reappearance'}),/src="javascript:/);
});

test('mounted native filters update only their local audit surface and keep focus without navigation',()=>{
 const dom=new JSDOM('<main><div id="one"></div><div id="two">untouched</div></main>');const root=dom.window.document.querySelector('#one');
 const dispose=mountBMObservationAudit(root,data);const question=root.querySelector('[data-bm-audit-question]');question.value='reappearance';question.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.equal(root.querySelectorAll('tbody tr').length,9);const status=root.querySelector('[data-bm-audit-status]');status.value='observed-scoped';status.focus();status.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.equal(root.querySelectorAll('tbody tr').length,2);assert.equal(dom.window.document.activeElement.getAttribute('data-bm-audit-status'),'');assert.equal(dom.window.document.querySelector('#two').textContent,'untouched');
 dispose();const after=root.innerHTML;root.querySelector('[data-bm-audit-type]').dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(root.innerHTML,after);
});

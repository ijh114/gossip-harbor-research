import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
import {renderMediaAudit,selectAuditVideos} from '../src/media-audit-page.mjs';
const d=JSON.parse(await readFile(new URL('../src/data/media-audit.json',import.meta.url),'utf8'));
test('video ledger separates full decode, chronological visual review, excluded games, and unperformed listening',()=>{
 assert.equal(d.videos.length,113);assert.equal(d.summary.inScopeVideos,110);assert.equal(d.videos.filter(v=>v.excluded).length,3);assert.equal(d.summary.audioListenedVideos,0);assert.equal(d.summary.nativeRealtimePlaybackVideos,0);
 assert.equal(d.summary.decodedVideos,d.videos.filter(v=>v.decode.status==='success').length);
 assert.equal(d.summary.visualTimelineReviewedVideos,d.videos.filter(v=>!v.excluded&&v.timeline.visualReviewStatus==='reviewed').length);
 assert.equal(d.summary.decodedVideos,113);assert.equal(d.summary.visualTimelineReviewedVideos,110);assert.equal(d.meta.verification.errorCount,0);assert.equal(d.summary.decoderErrors,0);
 assert.equal(d.summary.decodedFrames,d.videos.reduce((n,v)=>n+v.decode.frames,0));assert.equal(d.summary.sampleFrames,d.videos.reduce((n,v)=>n+v.timeline.sampleCount,0));assert.equal(d.summary.inScopeSampleFrames,d.videos.filter(v=>!v.excluded).reduce((n,v)=>n+v.timeline.sampleCount,0));
 assert.equal(d.technical.originalSourceHashesRecheckedAfterDecode,113);assert.equal(d.technical.actualMaximumSampleSpacingSeconds,1.493112);
 for(const v of d.videos){assert.match(v.sha256,/^[a-f0-9]{64}$/);assert.equal(v.version,null);assert.equal(v.capturedAt,null);if(v.timeline.visualReviewStatus==='reviewed'){assert.ok(v.timeline.reviewedRanges.length);assert.ok(v.timeline.segments.length);}}
 assert.doesNotMatch(JSON.stringify(d),/[CD]:[\\/]|@gmail\.com/);
});
test('audit page exposes real counts and source ranges while filters do not turn pending or excluded records into reviewed',()=>{
 const html=renderMediaAudit({mediaAudit:d,media:{entries:[]}},{}),dom=new JSDOM(html);assert.equal(dom.window.document.querySelectorAll('.audit-video').length,113);assert.match(dom.window.document.body.textContent,/약 0.5초/);assert.match(dom.window.document.body.textContent,/오디오 정밀 청취 0개/);dom.window.close();
 assert.equal(selectAuditVideos(d,{status:'excluded'}).length,3);assert.equal(selectAuditVideos(d,{status:'reviewed'}).length,d.summary.visualTimelineReviewedVideos);assert.equal(selectAuditVideos(d,{query:'zznomatch'}).length,0);
});

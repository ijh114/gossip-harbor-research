import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validMedia} from '../src/visual-model.mjs';
const data=JSON.parse(await readFile(new URL('../src/data/media-refinement.json',import.meta.url),'utf8'));
const audit=JSON.parse(await readFile(new URL('../src/data/media-audit.json',import.meta.url),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function verifyFile(src,sha){assert.match(src,/^\.\/assets\/media\/refinement\/[a-z0-9/_.-]+$/);assert.ok(!src.includes('..'));assert.match(sha,/^[a-f0-9]{64}$/);const b=await readFile(new URL('../src/'+src.slice(2),import.meta.url));assert.equal(hash(b),sha,src);}
test('refined captures retain exact file and original source digests without shipping originals',async()=>{
 assert.equal(hash(await readFile(new URL('../src/data/media-refinement.json',import.meta.url))),audit.meta.refinement.sha256);
 assert.equal(data.studies.length,25);assert.equal(data.studies.filter(s=>s.id.startsWith('motion-')).length,12);assert.equal(data.studies.filter(s=>s.evidenceType==='help-demo').length,2);assert.equal(data.coverage.length,11);assert.equal(data.corrections.length,3);assert.equal(new Set(data.mediaEntries.map(m=>m.key)).size,data.mediaEntries.length);
 for(const m of data.mediaEntries){assert.ok(validMedia(m));assert.equal(m.version,null);assert.equal(m.capturedAt,null);assert.equal(data.sourceIndex.find(s=>s.id===m.sourceId)?.sha256,m.originalSha256);await verifyFile(m.src,m.sha256);if(m.poster)await verifyFile(m.poster,m.posterSha256);if(m.kind==='gif'){const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(b.readUInt16LE(6),m.width);assert.equal(b.readUInt16LE(8),m.height);assert.equal(m.transform.width,m.width);assert.equal(m.transform.height,m.height);assert.equal(m.transform.timingIsMeasurementSource,false);}}
 assert.doesNotMatch(JSON.stringify(data),/[CD]:[\\/]|@gmail\.com|privateReviewPath/);
});
test('frame-specific annotations, nonaligned comparison pairs and measured windows have explicit boundaries',()=>{
 const media=new Map(data.mediaEntries.map(m=>[m.key,m]));assert.equal(data.studies.filter(s=>s.comparison).length,3);
 for(const s of data.studies){assert.equal(media.get(s.imageKey)?.kind,'image');assert.ok(s.observations.length);assert.ok(s.unknowns.length);for(const key of s.mediaKeys)assert.ok(media.has(key));
  const original=audit.videos.find(v=>v.id===s.sourceId);if(original&&s.sourceRange){assert.ok(s.sourceRange.startSeconds>=0&&s.sourceRange.endSeconds>=s.sourceRange.startSeconds&&s.sourceRange.endSeconds<=original.duration+.001,s.id);for(const f of s.frames)assert.ok(f.timeSeconds>=0&&f.timeSeconds<=original.duration+.001,s.id+' frame');}
  for(const f of s.frames){assert.equal(media.get(f.key)?.kind,'image');for(const a of f.annotations||[]){for(const k of ['x','y','width','height'])assert.ok(Number.isFinite(a[k])&&a[k]>=0&&a[k]<=1);assert.ok(a.x+a.width<=1.000001&&a.y+a.height<=1.000001);assert.ok(a.label&&a.note);}}
  if(s.comparison){assert.equal(s.comparison.pixelAligned,false);assert.ok(media.has(s.comparison.beforeKey)&&media.has(s.comparison.afterKey));}
  for(const m of s.measurements||[]){assert.ok(Number.isFinite(m.fromSeconds)&&Number.isFinite(m.toSeconds)&&m.toSeconds>=m.fromSeconds);assert.ok(m.method);}
 }
});
test('audio evidence covers all 110 tracks and only publishes bounded packaged excerpts, not claimed listening',async()=>{
 const a=data.audio;assert.equal(a.recordings.length,110);assert.equal(a.clips.length,14);assert.equal(a.summary.recordingsListened,0);assert.equal(a.summary.publicRecordedAudioClips,0);
 for(const c of a.clips){assert.equal(c.listeningStatus,'unsupported-model-audio-input');assert.equal(c.listenedSeconds,0);assert.ok(c.duration>0&&c.duration<=6.001);assert.ok(c.sources.length);await verifyFile(c.src,c.sha256);await verifyFile(c.waveformImage.src,c.waveformImage.sha256);await verifyFile(c.spectrogram.src,c.spectrogram.sha256);for(const s of c.sources)assert.match(s.sha256,/^[a-f0-9]{64}$/);}
 for(const r of a.recordings){assert.equal(data.sourceIndex.find(s=>s.id===r.sourceId).sha256,r.sourceSha256);assert.equal(r.listening.listenedSeconds,0);assert.equal(r.timeline.peakDbfs.length,r.timeline.rmsDbfs.length);assert.equal(r.waveform.length,r.timeline.peakDbfs.length);assert.equal(r.audio.packetTimeline.gapsOverTolerance,0);assert.ok(r.timeline.binSeconds>0);}
 assert.equal(a.matching.recordings.length,3);assert.equal(a.matching.summary.representativeSignalCandidates,5);assert.equal(a.matching.summary.listenedSeconds,0);
 for(const c of a.matching.candidates){assert.equal(c.confirmedSoundIdentity,false);assert.equal(c.listened,false);assert.ok(c.ncc>=-1&&c.ncc<=1);assert.ok(a.matching.recordings.some(r=>r.id===c.recordingId));}
});

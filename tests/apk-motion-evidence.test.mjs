import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=async n=>JSON.parse(await readFile(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const [motion,media,factory]=await Promise.all(['apk-motion-evidence','media','factory-play'].map(read));
const card=id=>motion.cards.find(c=>c.id===id);
const phase=(id,name)=>card(id).phases.find(p=>p.name===name);
test('motion evidence preserves scope, known/unknown boundaries, source identities and all eight requested motion cases',()=>{
 assert.equal(motion.targetVersion,'4.10.5');assert.equal(motion.originalRuntimeObserved,false);assert.deepEqual(new Set(motion.cards.map(c=>c.id)),new Set(['hint','unlock-web','unlock-box','scissors','hourglass','factory-flight','factory-threshold','factory-idle']));
 const sources=new Map(motion.sources.map(s=>[s.id,s]));assert.equal(sources.size,motion.sources.length);
 for(const c of motion.cards){assert.equal(c.origin,'apk-rule-replay');assert.equal(c.originalRuntimeObserved,false);assert.match(c.label,/실제 플레이 녹화 아님/);assert.ok(c.fullPlaybackValidation.includes('4.11'));assert.ok(c.known.length);assert.ok(c.unknown.length);for(const id of c.sourceRefs)assert.ok(sources.has(id),id);assert.ok(c.durationSeconds===null||Number.isFinite(c.durationSeconds)&&c.durationSeconds>=0);}
 for(const source of motion.sources){assert.match(source.sha256,/^[0-9a-f]{64}$/);assert.ok(source.path.startsWith('analysis/'));for(const [from,to]of source.ranges||[])assert.ok(from>=1&&to>=from);assert.ok(source.ranges?.length||source.selectors?.length);}
 const {revision,...document}=motion;assert.equal(createHash('sha256').update(JSON.stringify(document)).digest('hex'),revision,'revision covers the curated source specification');
});
test('every selected replay image is an existing APK sprite with the same bytes/hash and no synthetic native capture claim',async()=>{
 const keys=new Map(media.entries.map(m=>[m.key,m]));assert.equal(motion.media.length,10);
 for(const entry of motion.media){const original=keys.get(entry.key);assert.ok(original);assert.equal(entry.sha256,original.sha256);assert.equal(entry.src,original.src);assert.match(entry.origin,/packaged/);const path=new URL('../src/'+entry.src.replace(/^\.\//,''),import.meta.url);assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),entry.sha256);}
 for(const c of motion.cards)for(const key of c.mediaKeys)assert.ok(keys.has(key),key);
});
test('merge hint preserves parallel-tween sequence lengths, three pulses, source idle guards and unknown default easing',()=>{
 const h=card('hint'),pulse=h.phases[0],t=pulse.tweens;
 assert.equal(h.trigger.normalIdleSeconds,2.3);assert.equal(h.trigger.newUserIdleSeconds,.7);assert.equal(pulse.repeat,3);
 assert.equal(Math.max(...t.map(x=>x.startSeconds+x.durationSeconds)),pulse.cycleSeconds);assert.equal(pulse.durationSeconds,pulse.repeat*pulse.cycleSeconds);assert.equal(h.durationSeconds,pulse.durationSeconds+h.phases[1].durationSeconds);
 assert.equal(t.find(x=>x.to===1.15).ease,'OutCubic');assert.equal(t.find(x=>x.property==='scale'&&x.to===1).ease,null);assert.ok(h.stateWire.some(x=>x.includes('movePos=0')));
});
test('seals preserve a normal merge and a zero-duration paperbox hook without inventing a native torn-web clip',()=>{
 assert.equal(card('unlock-web').durationSeconds,.4);assert.equal(phase('unlock-web','consume-source-and-target').durationSeconds,.1);assert.equal(card('unlock-box').durationSeconds,null);assert.equal(phase('unlock-box','unlock-shock-hook').durationSeconds,0);assert.equal(card('unlock-box').inputLock.endSeconds,0);
 assert.ok(motion.poolPolicy.excludedItemTypes.includes('PaperBox'));assert.ok(motion.poolPolicy.excludedItemTypes.includes('Cobweb'));assert.ok(card('unlock-web').unknown.some(x=>x.includes('native')));
});
test('scissors distinguish pre-confirm wait, model consumption and the separate0.4s first result /0.9s second jump',()=>{
 const s=card('scissors');assert.equal(phase('scissors','confirm').excludedFromMotionDuration,true);assert.equal(phase('scissors','confirm').durationSeconds,null);assert.equal(phase('scissors','consume-and-create-models').startSeconds,0);
 assert.equal(phase('scissors','new1-settle').startSeconds+phase('scissors','new1-settle').durationSeconds,.4);assert.equal(phase('scissors','new2-land').startSeconds+phase('scissors','new2-land').durationSeconds,s.durationSeconds);assert.equal(s.durationSeconds,.9);assert.equal(phase('scissors','new2-jump').jumpPower,60);assert.equal(s.inputLock.declared,false);
});
test('hourglass retains all five packaged durations and separates instant logic from Chebyshev wave timing',()=>{
 const h=card('hourglass');assert.equal(h.durationSeconds,null);assert.equal(phase('hourglass','target-rise').durationSeconds,.25);assert.equal(phase('hourglass','target-fall').ease,'InCubic');assert.equal(phase('hourglass','time-skip-effect').durationSeconds,1);assert.equal(h.inputLock.declared,false);
 const rows=motion.configSamples.filter(r=>r.Type.startsWith('time_skip_'));assert.equal(rows.length,5);for(const row of rows)assert.equal(Number(row.CollectRewards[0].split('-')[1]),h.skipSecondsByType[row.Type]);assert.deepEqual(Object.values(h.skipSecondsByType),[600,1200,2400,4800,9600]);assert.match(h.durationFormula,/max\(targetDelaySeconds\)/);assert.match(phase('hourglass','wave-delay').formula,/abs\(dx\)-1/);
});
test('factory reward is committed before view, lock counters overlap, and slider, shake and flying object have separate ends',()=>{
 const c=card('factory-threshold'),events=c.phases.filter(p=>p.anonymousLockDelta).sort((a,b)=>a.startSeconds-b.startSeconds);let count=0;const states=[];for(const e of events){count+=e.anonymousLockDelta;states.push([e.startSeconds,count]);}assert.deepEqual(states,[[0,1],[.4,2],[.5,1],[.95,0]]);
 assert.equal(c.sliderEndSeconds,1.15);assert.equal(c.durationSeconds,1.45);assert.equal(phase('factory-threshold','logical-reward-and-second-lock').startSeconds,.4);assert.equal(phase('factory-threshold','reward-view-and-unlock').startSeconds,.95);assert.equal(phase('factory-flight','bezier-flight').durationSeconds,.4);assert.equal(card('factory-flight').durationSeconds,1.9);
 assert.equal(factory.motionRules.inputLockSourceCorrection.actualCounter,true);assert.equal(factory.motionRules.inputLockSourceCorrection.currentWebModel,'boolean-approximation-unverified');assert.match(factory.motionRules.eventLockPolicy,/counters/);
});
test('seven bounded native curves retain exact controller references,64-bit string identities, paths and cubic endpoint continuity',()=>{
 assert.equal(motion.clips.length,3);let count=0,keys=0;
 for(const clip of motion.clips){assert.match(clip.identity.pathId,/^-?\d+$/);assert.equal(clip.sampleRate,60);assert.ok(clip.controllerUse.length);for(const use of clip.controllerUse){assert.equal(use.clipReferenceMatched,true);assert.ok(use.declaredStateSpeeds.every(x=>x===1));assert.match(use.identity.objectSha256,/^[0-9a-f]{64}$/);}
  for(const curve of clip.curves){count++;assert.ok(curve.nodePath);assert.ok(Number.isFinite(curve.initialValue));assert.ok(curve.keyframes.length>=2&&curve.keyframes.length<=8);keys+=curve.keyframes.length;for(let i=0;i<curve.keyframes.length;i++){const k=curve.keyframes[i];assert.equal(k.coefficients.length,4);assert.ok(k.coefficients.every(Number.isFinite));assert.equal(k.value,k.coefficients[3]);assert.ok(k.time>=0&&k.time<=clip.durationSeconds+.000001);if(i){const before=curve.keyframes[i-1],dt=k.time-before.time,c=before.coefficients;assert.ok(dt>0);const endpoint=((c[0]*dt+c[1])*dt+c[2])*dt+c[3];assert.ok(Math.abs(endpoint-k.value)<.0001,curve.id);}}}
 }
 assert.equal(count,7);assert.ok(keys<=30,'publish only selected numeric curves, not full clips');assert.equal(motion.clips.find(c=>c.identity.name==='GenFactoryItemCell').loop,true);assert.equal(motion.clips.find(c=>c.identity.name==='DetailCell_shake').durationSeconds,.75);
});

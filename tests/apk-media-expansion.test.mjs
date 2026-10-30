import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const d=JSON.parse(await readFile(new URL('../src/data/apk-media-expansion.json',import.meta.url),'utf8'));
const prior=JSON.parse(await readFile(new URL('../src/data/apk-media-assets.json',import.meta.url),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const union=new Map([...prior.mediaEntries,...d.mediaEntries].map(m=>[m.key,m]));
const sourceNames=prior.characterStudies.flatMap(s=>s.animations.map(a=>({role:s.role,...a})));
test('all410 locally supplied map-character animations now have bounded material previews; remote29 and native rendering stay unknown',()=>{
 assert.equal(d.schemaVersion,1);assert.equal(d.targetVersion,'4.10.5');assert.equal(d.studies.length,410);assert.equal(d.animationIndex.length,410);
 assert.equal(new Set(d.studies.map(s=>s.id)).size,410);assert.equal(d.summary.newlyPreviewedAnimations,395);assert.equal(d.summary.alreadyPreviewedAnimations,15);assert.equal(d.summary.locallyUnpreviewedAnimations,0);
 assert.equal(d.summary.registeredOnlyMapCharacters,29);assert.equal(d.summary.physicallyRecoveredMapCharacters,15);assert.equal(d.summary.originalRuntimeValidated,0);assert.equal(d.summary.originalFinalRenderingValidated,0);
 assert.deepEqual(d.studies.map(s=>s.role+'\0'+s.declaredAnimation).sort(),sourceNames.map(s=>s.role+'\0'+s.name).sort());
 for(const s of d.studies){const original=sourceNames.find(o=>o.role===s.role&&o.name===s.declaredAnimation);assert.equal(s.declaredDuration,original.duration);assert.equal(s.originalRuntimeObserved,false);assert.equal(s.originalPlaybackVerified,false);assert.equal(s.sourceDeclaredLoop,null);}
});
test('every source timeline is covered0..declared end by contiguous independent source-time segments without gaps or source-time compression',()=>{
 let segments=0;
 for(const s of d.studies){let end=0;for(const seg of s.segments){assert.ok(Math.abs(seg.sourceRange.start-end)<1e-6,s.id+' gap');assert.ok(seg.sourceRange.end>=seg.sourceRange.start);if(!seg.isPreviouslyPreviewed){segments++;assert.ok(seg.sourceRange.end-seg.sourceRange.start<=2.000001);assert.equal(seg.sourceSampleRate,8);assert.equal(seg.sourceSampleTimes[0],seg.sourceRange.start);assert.ok(Math.abs(seg.sourceSampleTimes.at(-1)-seg.sourceRange.end)<1e-6);for(let i=1;i<seg.sourceSampleTimes.length;i++)assert.ok(seg.sourceSampleTimes[i]>seg.sourceSampleTimes[i-1]&&seg.sourceSampleTimes[i]-seg.sourceSampleTimes[i-1]<=.125001);}
  assert.ok(union.has(seg.posterMediaKey));if(seg.previewMediaKey)assert.equal(union.get(seg.previewMediaKey).kind,'gif');else assert.equal(seg.staticPreview,true);
  end=seg.sourceRange.end;
 }assert.ok(Math.abs(end-s.declaredDuration)<1e-6,s.id+' tail');assert.equal(s.sourceTimelineRangeCovered,true);}
 assert.equal(segments,488);assert.equal(d.summary.newlyRenderedSegments,488);
});
function gifInfo(b){
 assert.match(b.subarray(0,6).toString(),/^GIF8[79]a$/);let at=13+((b[10]&128)?3*2**((b[10]&7)+1):0),frames=0,ms=0,delay=0;
 const blocks=()=>{while(true){assert.ok(at<b.length);const size=b[at++];if(!size)break;at+=size;assert.ok(at<=b.length);}};
 while(at<b.length){const marker=b[at++];if(marker===0x3b)break;if(marker===0x21){const label=b[at++];if(label===0xf9){assert.equal(b[at++],4);delay=b.readUInt16LE(at+1)*10;at+=4;assert.equal(b[at++],0);}else blocks();}else if(marker===0x2c){const packed=b[at+8];at+=9;if(packed&128)at+=3*2**((packed&7)+1);at++;blocks();frames++;ms+=delay;delay=0;}else assert.fail('Unexpected GIF block '+marker);}
 return {frames,ms};
}
test('all1046 newly curated PNG/GIF files preserve exact public hashes, dimensions, GIF frames and10ms timing quantization',async()=>{
 assert.equal(d.mediaEntries.length,1046);assert.equal(new Set(d.mediaEntries.map(m=>m.key)).size,1046);let gifs=0,images=0,bytes=0;
 for(const m of d.mediaEntries){assert.match(m.src,/^\.\/assets\/media\/apk-expansion\/[A-Za-z0-9_-]+\.(png|gif)$/);assert.ok(!m.src.includes('..'));const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(sha(b),m.sha256,m.key);assert.equal(b.length,m.bytes);bytes+=b.length;assert.equal(m.originalRuntimeObserved,false);assert.equal(m.originalPlaybackVerified,false);assert.match(m.identity.path_id,/^-?\d+$/);assert.match(m.identity.object_source_sha256,/^[a-f0-9]{64}$/);
  if(m.kind==='image'){images++;assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),m.width);assert.equal(b.readUInt32BE(20),m.height);}
  else{gifs++;assert.equal(m.kind,'gif');assert.equal(b.readUInt16LE(6),240);assert.equal(b.readUInt16LE(8),240);assert.ok(b.includes(Buffer.from('NETSCAPE2.0')));const info=gifInfo(b);assert.ok(info.frames>1);assert.equal(info.ms,m.encodedDurationMs);const duration=(m.sourceSampledRange.end-m.sourceSampledRange.start)*1000;assert.ok(Math.abs(info.ms-(duration+10))<=5.001,m.key+' clock');assert.ok(info.ms<=2015);}
 }
 assert.equal(gifs,487);assert.equal(images,559);assert.equal(bytes,d.summary.newMediaBytes);
});
test('a static0.1second tail is published as a PNG, not inflated into a moving GIF count',()=>{
 const s=d.studies.find(s=>s.role==='Harrison'&&s.declaredAnimation==='Harrison_walkseafoodin'),tail=s.segments.at(-1);assert.equal(tail.staticPreview,true);assert.equal(tail.previewMediaKey,null);assert.equal(tail.sourceRasterUniqueFrames,1);assert.equal(union.get(tail.posterMediaKey).kind,'image');assert.ok(d.studies.find(s=>s.role==='Buster').segments.every(x=>x.previewMediaKey===null));
});
test('animationIndex connects every row and every preview segment to a real sourced media record',()=>{
 for(const row of d.animationIndex){const s=d.studies.find(s=>s.id===row.studyId);assert.ok(s);assert.equal(row.role,s.role);assert.equal(row.animation,s.declaredAnimation);assert.equal(row.segmentCount,s.segments.length);assert.ok(row.segmentMediaKeys.every(key=>union.has(key)));assert.equal(row.hasMaterialPreview,true);assert.ok(s.sourceRefs.every(ref=>d.sources.some(src=>src.id===ref)));}
});
test('dogparkpure prototype35 is not falsely identified as the normally registered dogpark or pureboard route',()=>{
 const a=d.eventRegistrationAudit;assert.equal(a.prototypeTypes.length,35);assert.ok(a.prototypeTypes.every(t=>t.startsWith('adv_dogparkpure_')));assert.equal(a.sourceRegisteredActivityModelBindings.length,8);assert.equal(a.prototypeTableSelectedByTheseDefinitions,false);assert.equal(a.literalReferenceSearch.matchesOutsideTwoConfigurationTables,0);assert.equal(a.literalReferenceSearch.matches.length,2);assert.equal(a.literalReferenceSearch.luaFiles,2495);
 const registered=a.sourceRegisteredActivityModelBindings.flatMap(f=>f.bindings.map(b=>b.modelConfigName));assert.ok(registered.includes('AdventureItemModelConfig_dogpark'));assert.ok(registered.includes('PureboardItemModelConfig_dogpark'));assert.ok(!registered.includes(a.prototypeTable));assert.equal(a.imageFilesRecoveredFor35Types,0);assert.equal(a.substituteOtherThemeArtwork,false);assert.equal(a.currentServerOverrideObserved,false);assert.equal(a.originalRuntimeObserved,false);
});

test('every prototype type has a completed art-binding disposition; the proven CDN does not create an absent GUID or theme alias',()=>{
 const a=d.eventRegistrationAudit.artBindingAudit;assert.equal(a.defaultStaticCDNKnown,true);assert.equal(a.codeDerivedDefaultBaseURL,'https://diary.cdn.mergesigma.com/hotfix/4.10.5/android/');assert.equal(a.imageConfigEntriesChecked,4589);assert.equal(a.imageConfigDogparkEntries,86);assert.equal(a.typeDispositions.length,35);assert.equal(a.exactAssetBindingsRecovered,0);assert.equal(a.otherThemeArtworkSubstituted,0);assert.equal(a.unknownNativeLoaderFallbackAssertedAbsent,false);
 assert.deepEqual(a.typeDispositions.map(x=>x.type),d.eventRegistrationAudit.prototypeTypes);
 for(const r of a.typeDispositions){assert.equal(r.conditionalSpriteKeyIfFixtureWereLoaded,r.type);assert.equal(r.normalActivityRegistrationSelected,false);assert.equal(r.explicitItemViewImageMapping,null);assert.equal(r.stateCollectionImageAlias,null);assert.equal(r.exactImageFileConfigRegistered,false);assert.equal(r.exactCatalogKeyRegistered,false);assert.equal(r.exactCatalogPathBasenameRegistered,false);assert.equal(r.downloadableExactAssetGuid,null);assert.equal(r.remoteRequestForThisType,false);assert.equal(r.nearbyThemeNamesRejectedAsAliases.length,2);assert.ok(r.nearbyThemeNamesRejectedAsAliases.every(x=>!x.shippedAliasFromPrototypeProven&&!x.maySubstituteArtwork));assert.ok(r.sourceRefs.every(ref=>d.sources.some(s=>s.id===ref)));}
});
test('the complete XAPK member boundary contains no separately packaged content asset pack',()=>{
 assert.deepEqual(d.packageArchiveAudit.members.map(m=>m.name),['com.mergegames.gossipharbor.apk','icon.png','config.armeabi_v7a.apk','manifest.json']);assert.equal(d.packageArchiveAudit.additionalAssetPackMembers,0);for(const m of d.packageArchiveAudit.members)assert.match(m.sha256,/^[a-f0-9]{64}$/);assert.equal(d.packageArchiveAudit.xapkSha256,'2e19f0e6ead8a37183387d7c1269fc796ed2948c6ab8a0163de3019e0186a6f9');
});
test('curated expansion preserves safe source IDs and excludes complete binary/atlas/geometry/Lua or private filesystem payloads',()=>{
 const bad=[];function visit(v,p){if(typeof v==='number'&&Number.isInteger(v)&&!Number.isSafeInteger(v))bad.push(p);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))visit(x,p+'.'+k);}visit(d,'root');assert.deepEqual(bad,[]);const text=JSON.stringify(d);assert.doesNotMatch(text,/[CD]:[\\/]|"vertices"\s*:|"triangles"\s*:|"binaryPrivateFile"\s*:|@gmail\.com/);assert.ok(d.boundaries.length>=5);
 const copy=structuredClone(d);delete copy.revision;assert.equal(sha(JSON.stringify(copy)),d.revision);
});

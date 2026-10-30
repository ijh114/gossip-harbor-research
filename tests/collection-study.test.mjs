import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validMedia} from '../src/visual-model.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/collection-study.json',import.meta.url),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('collection identity distinguishes card albums, activity item books and story recollection',()=>{
 assert.equal(c.identity.primarySystem,'AlbumActivity');assert.equal(c.identity.koreanLiteralTabNameVerified,false);assert.equal(c.identity.originalRuntimeObserved,false);assert.equal(c.identity.serverConfigConnected,false);assert.equal(c.taxonomy.length,3);assert.equal(c.systems.length,2);assert.equal(c.systems[0].flow.length,12);assert.equal(c.systems[1].flow.length,3);
 const sourceIds=new Set(c.sources.map(s=>s.id));for(const system of c.systems){const nodes=new Set(system.flow.map(n=>n.id));for(const row of [...system.flow,...system.rules,...system.monetization,...(system.presentationStates||[]),...(system.motionResources||[])]){for(const ref of row.sourceRefs||[])assert.ok(sourceIds.has(ref),ref);for(const next of row.next||[])assert.ok(nodes.has(next),next);}}
 assert.equal(c.systems[0].presentationStates.length,4);assert.equal(c.systems[0].motionResources.length,7);
});
test('exact catalog assets have verified physical objects, source dimensions and thumbnail-only public derivatives',()=>{
 assert.equal(c.summaryCounts.albumImageKeys,483);assert.equal(c.summaryCounts.albumLocalExactImageKeys,0);assert.equal(c.summaryCounts.albumExactPhysicalImageKeys,483);assert.equal(c.summaryCounts.albumExactRemoteImageKeys,483);assert.equal(c.summaryCounts.registeredDependencyBundles,93);assert.equal(c.summaryCounts.exactProductionPrefabs,50);
 assert.equal(c.resourceAssets.length,c.summaryCounts.resourceAssets);assert.equal(new Set(c.resourceAssets.map(r=>r.id)).size,c.resourceAssets.length);
 for(const r of c.resourceAssets){if(r.scope==='album'&&r.kind==='image'){assert.ok(r.mediaKey);assert.ok(r.pixelDimensions.width>0&&r.pixelDimensions.height>0);assert.equal(r.width,r.pixelDimensions.width);assert.equal(r.height,r.pixelDimensions.height);assert.equal(r.status,'exact-remote-Sprite');assert.ok(r.physicalIdentities.length);assert.ok(r.catalog.remoteAvailabilityVerified);}if(r.assetGuid){assert.match(r.assetGuid,/^[a-f0-9]{32}$/);assert.equal(r.catalog.exactGuidFound,true);for(const id of r.catalog.dependencyBundleIds)assert.ok(c.registeredBundles.some(b=>b.id===id));}}
 assert.equal(c.prefabAudit.length,59);assert.ok(c.prefabAudit.every(p=>p.nodeCount>0&&p.unreadableComponents===0));
 assert.equal(c.remoteRetrieval.retrievedBundles,93);assert.equal(c.remoteRetrieval.archiveBytes,84031706);assert.equal(c.remoteRetrieval.originalRuntimeObserved,false);assert.equal(c.remoteRetrieval.accountAPICalled,false);
 for(const b of c.registeredBundles){assert.equal(b.physicalAvailable,true);assert.equal(b.actualBytes,b.sizeBytes);assert.match(b.physicalSha256,/^[a-f0-9]{64}$/);if(b.remoteGETVerified){assert.match(b.resolvedURL,/^https:\/\/diary\.cdn\.mergesigma\.com\/hotfix\/4\.10\.5\/android\//);assert.equal(b.etagMD5Verified,true);}}
 assert.equal(c.resourceGroups.find(g=>g.id==='card-faces').quantity,324);assert.equal(c.resourceGroups.find(g=>g.id==='pack-icons').quantity,24);assert.equal(c.sourceMeasurements.find(r=>r.id==='front-nameplate').pixelSizeOfPNG,false);
 for(const g of c.resourceGroups){assert.ok(g.mediaKeys.length<=8);assert.equal(g.quantity,g.resourceIds.length);}
});
test('every curated PNG and reused captured frame matches the published hash and dimensions',async()=>{
 assert.equal(c.mediaEntries.filter(m=>m.origin==='apk-exact-source-sprite').length,6);assert.equal(c.mediaEntries.filter(m=>m.origin==='official-external-period-reference').length,7);assert.equal(c.mediaEntries.filter(m=>m.reusesExistingDerivative).length,3);assert.equal(c.mediaEntries.filter(m=>m.origin==='apk-catalog-remote-sprite').length,498);
 for(const m of c.mediaEntries){assert.ok(validMedia(m),m.key);const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(hash(b),m.sha256,m.key);if(m.src.endsWith('.png')){assert.equal(b.readUInt32BE(16),m.width);assert.equal(b.readUInt32BE(20),m.height);}if(m.identity){assert.equal(typeof m.identity.path_id,'string');assert.match(m.identity.object_source_sha256,/^[a-f0-9]{64}$/);}}
 for(const m of c.mediaEntries.filter(m=>m.origin==='apk-catalog-remote-sprite')){assert.equal(m.originalRuntimeObserved,false);assert.ok(m.width<=240&&m.height<=300);assert.ok(m.sourceWidth>=m.width&&m.sourceHeight>=m.height);assert.equal(m.transform.method,'exact Sprite decode to RGBA; contain thumbnail only; no recolor/redraw/substitution');}
});
test('official disclosure is date-bounded external evidence and table groups are not mistaken for card counts',()=>{
 const o=c.officialReference;assert.equal(o.sourceType,'official-public-period-disclosure');assert.equal(o.sameBuildAsApkVerified,false);assert.equal(o.currentOperationalValueVerified,false);assert.equal(o.effectiveStartUTC,'2026-08-28T02:10:00Z');assert.equal(o.effectiveEndUTC,'2026-10-06T02:00:00Z');assert.equal(o.packExamples.length,5);assert.deepEqual(o.packExamples.map(p=>p.drawCount),[2,3,3,4,4]);assert.deepEqual(o.packExamples.map(p=>p.probabilityDescriptionGroups),[2,3,3,2,3]);assert.deepEqual(o.pityReference.map(p=>p.consecutiveDuplicatesBeforeGuaranteedNew),[1,4,6,7,9]);assert.ok(c.sources.find(s=>s.id==='probability-link'));assert.match(o.scriptSha256,/^[a-f0-9]{64}$/);
});
test('sources have exact bounded locations and public records omit raw payloads, personal paths and unsafe pointers',()=>{
 for(const source of c.sources){assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.ok(source.path.startsWith('analysis/'));if(source.kind==='apk-decompiled-static-code'){assert.ok(source.lineStart>=1);assert.ok(source.lineEnd>=source.lineStart);}if(source.identity)assert.equal(typeof source.identity.path_id,'string');}
 const failures=[];function inspect(value,path=''){if(typeof value==='number'&&Number.isInteger(value)&&!Number.isSafeInteger(value))failures.push(path);else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))inspect(v,path+'.'+key);}inspect(c);assert.deepEqual(failures,[]);assert.doesNotMatch(JSON.stringify(c),/[CD]:[\\/]|@gmail\.com|originalPath|base64Payload|fullDecodedLua/);
});
test('localized asset labels, serialized book bindings and logical Sprite rectangles remain precise',()=>{
 const fronts=c.resourceAssets.filter(r=>r.groupId==='card-faces');assert.equal(fronts.length,324);assert.ok(fronts.every(r=>r.displayName&&r.displayName!==r.name&&r.localizationKey.endsWith('_name')));assert.deepEqual(c.themes.map(t=>[t.id,t.registeredSetCovers,t.registeredCardImages]),[['moon',18,162],['halloween',18,162]]);
 assert.deepEqual(c.systems[0].packFamilies.map(f=>f.registeredImageKeys),[5,5,5,3,5,1]);assert.equal(c.systems[0].presentationStyles.length,4);
 const book=c.resourceAssets.filter(r=>r.groupId==='activity-book');assert.deepEqual(new Set(book.map(r=>r.sourceBinding.field)),new Set(['m_bgTextureArrowLock','m_bgTextureLock','m_bgTextureUnLock','m_bgTextureArrowUnLock']));for(const r of book){assert.equal(r.sourceBinding.targetPathId,r.physicalIdentities[0].path_id);assert.equal(typeof r.sourceBinding.ownerIdentity.path_id,'string');assert.ok(r.sourceSpriteRect.width>0&&r.sourceSpriteRect.height>0);}
 const {revision,...body}=c;assert.equal(hash(JSON.stringify(body)),revision);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const d=JSON.parse(await readFile(new URL('../src/data/late-scene-art.json',import.meta.url),'utf8'));
const remote=JSON.parse(await readFile(new URL('../src/data/remote-presentation-assets.json',import.meta.url),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');

test('minimal day13 choice has three exact catalog/container prefab projections without original-render claims',()=>{
 assert.equal(d.targetVersion,'4.10.5');assert.equal(d.candidates.length,3);assert.equal(d.summary.meshPartsRecovered,6);assert.equal(d.summary.materialObjects,4);assert.equal(d.summary.textureObjects,4);assert.equal(d.originalRuntimeObserved,false);assert.equal(d.projection.sharedAcrossAllThreeChoices,true);assert.equal(d.projection.originalCameraVerified,false);
 assert.deepEqual(d.candidates.map(x=>x.id),['13_2_1','13_2_2','13_2_3']);
 for(const r of d.candidates){assert.equal(r.slot,'13_2');assert.equal(r.prefab,r.actualContainerPath);assert.equal(r.prefab,r.catalog.assetPath);assert.equal(r.catalog.exactKeyFound,true);assert.equal(r.catalog.bundles.length,7);assert.equal(r.originalRuntimeObserved,false);assert.equal(r.finalNativeRenderingVerified,false);assert.match(r.identity.path_id,/^-?\d+$/);assert.equal(r.meshParts,2);assert.ok(r.catalog.catalogAssetEntries.every(x=>x.internalId===r.prefab));assert.ok(d.mediaEntries.some(m=>m.key===r.mediaKey));for(const b of r.catalog.bundles){assert.match(b.bytesSha256,/^[a-f0-9]{64}$/);assert.equal(b.runtimeTransferOrPreferenceObserved,false);if(b.uriTemplate.includes('AddressableManager'))assert.equal(b.resolvedURL,'https://diary.cdn.mergesigma.com/hotfix/4.10.5/android/'+b.bundleFile);else assert.equal(b.resolvedURL,null);}}
});

test('new13_2 map layers use the existing2455x1705 projection without moving the base or old slots',()=>{
 const patch=d.mapsPatch,map=remote.maps[0];assert.equal(patch.mapId,map.id);assert.equal(patch.width,map.width);assert.equal(patch.height,map.height);assert.equal(patch.baseMediaKey,map.baseMediaKey);assert.equal(patch.projectionRevision,remote.revision);assert.equal(patch.baseRecentered,false);assert.equal(patch.slots.length,1);const s=patch.slots[0];assert.equal(s.id,'13_2');assert.equal(s.variants.length,3);assert.equal(typeof s.slotRootPathId,'string');assert.equal(s.transformChain.length,3);
 for(const v of s.variants){assert.equal(s.variantMediaKeys[v.id],v.mediaKey);const m=d.mediaEntries.find(m=>m.key===v.mediaKey);assert.ok(m);assert.equal(v.cropPixels[2]-v.cropPixels[0],m.width);assert.equal(v.cropPixels[3]-v.cropPixels[1],m.height);assert.equal(v.cropPixels[0]/patch.width,v.boundsNormalized.x);assert.equal(v.cropPixels[1]/patch.height,v.boundsNormalized.y);assert.ok(v.boundsNormalized.x+v.boundsNormalized.width<=1&&v.boundsNormalized.y+v.boundsNormalized.height<=1);assert.equal(d.candidates.find(c=>c.id===v.resourceKey).mapLayerMediaKey,v.mediaKey);}
});

test('six curated image hashes and source identity strings remain exact and publish no full meshes or binary assets',async()=>{
 assert.equal(d.mediaEntries.length,6);let total=0;for(const m of d.mediaEntries){assert.match(m.src,/^\.\/assets\/media\/late-scene-art\/[A-Za-z0-9_-]+\.png$/);const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(sha(b),m.sha256);assert.equal(b.length,m.bytes);assert.equal(b.readUInt32BE(16),m.width);assert.equal(b.readUInt32BE(20),m.height);total+=b.length;assert.equal(m.originalRuntimeObserved,false);assert.equal(m.originalFinalRenderingVerified,false);assert.ok(m.sourceRefs.every(ref=>d.sources.some(s=>s.id===ref)));}assert.equal(total,d.summary.newMediaBytes);
 const bad=[];function visit(v,p){if(typeof v==='number'&&Number.isInteger(v)&&!Number.isSafeInteger(v))bad.push(p);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))visit(x,p+'.'+k);}visit(d,'root');assert.deepEqual(bad,[]);assert.doesNotMatch(JSON.stringify(d),/[CD]:[\\/]|"vertices"\s*:|"triangles"\s*:|@gmail\.com/);const c=structuredClone(d);delete c.revision;assert.equal(sha(JSON.stringify(c)),d.revision);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const d=JSON.parse(await readFile(new URL('../src/data/remote-presentation-assets.json',import.meta.url),'utf8'));
const prior=JSON.parse(await readFile(new URL('../src/data/presentation-assets.json',import.meta.url),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const media=new Map([...prior.mediaEntries,...d.mediaEntries].map(m=>[m.key,m]));

test('Area4 twelve and both Skin themes twenty-six recover exact prefab identities without claiming original game rendering',()=>{
 assert.equal(d.targetVersion,'4.10.5');assert.equal(d.area4Candidates.length,12);assert.equal(d.skins.length,26);assert.equal(d.summary.exactContainerLinks,38);assert.equal(d.summary.meshPartsRecovered,240);assert.equal(d.summary.materialObjects,115);assert.equal(d.summary.textureObjects,110);assert.equal(d.summary.remoteBundlesHTTP200,10);assert.equal(d.summary.packagedDependencyBundles,6);
 assert.equal(d.originalRuntimeObserved,false);
 for(const r of [...d.area4Candidates,...d.skins]){assert.equal(r.prefab,r.actualContainerPath);assert.equal(r.catalog.assetPath,r.prefab);assert.equal(r.catalog.exactKeyFound,true);assert.equal(r.originalRuntimeObserved,false);assert.equal(r.finalNativeRenderingVerified,false);assert.match(r.identity.path_id,/^-?\d+$/);assert.ok(r.meshParts>0);assert.ok(r.textureSpecs.length);assert.ok(media.has(r.mediaKey));assert.ok(media.has(r.mapLayerMediaKey));for(const b of r.catalog.bundles){assert.match(b.bytesSha256,/^[a-f0-9]{64}$/);assert.equal(b.runtimeTransferOrPreferenceObserved,false);if(b.uriTemplate.includes('AddressableManager')){assert.equal(b.resolutionStatus,'code-derived-default-GET-verified');assert.equal(b.resolvedURL,'https://diary.cdn.mergesigma.com/hotfix/4.10.5/android/'+b.bundleFile);}else{assert.equal(b.resolutionStatus,'shipped-local-runtime-path');assert.equal(b.resolvedURL,null);}}}
});

test('expanded shared map preserves pixel scale and old layer alignment while exposing all recovered choices and Skin slots',()=>{
 const m=d.maps[0],o=prior.maps[0],p=m.projection.remoteFramePaddingPixels;assert.equal(m.id,o.id);assert.equal(m.width,2455);assert.equal(m.height,1705);assert.equal(m.projection.pixelScale,o.projection.pixelScale);assert.deepEqual(m.projection.basis,o.projection.basis);assert.equal(m.projection.originalCameraVerified,false);assert.equal(m.defaultStyleId,'0');assert.equal(m.slots.length,54);assert.equal(d.summary.mapVariantImages,162);
 for(const oldSlot of o.slots)for(const oldV of oldSlot.variants){if(!oldV.mediaKey)continue;const v=m.slots.find(s=>s.id===oldSlot.id).variants.find(x=>x.id===oldV.id);assert.equal(v.mediaKey,oldV.mediaKey);assert.ok(Math.abs(v.boundsNormalized.x*m.width-(oldV.boundsNormalized.x*o.width+p.left))<1e-8);assert.ok(Math.abs(v.boundsNormalized.y*m.height-(oldV.boundsNormalized.y*o.height+p.top))<1e-8);assert.ok(Math.abs(v.boundsNormalized.width*m.width-oldV.boundsNormalized.width*o.width)<1e-8);}
 for(const r of [...d.area4Candidates,...d.skins]){const v=m.slots.find(s=>s.id===r.slot).variants.find(v=>v.resourceKey===r.resourceKey);assert.equal(v.mediaKey,r.mapLayerMediaKey);assert.equal(m.slots.find(s=>s.id===r.slot).variantMediaKeys[v.id],v.mediaKey);const b=v.boundsNormalized;assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=1.000001&&b.y+b.height<=1.000001);const im=media.get(v.mediaKey);assert.equal(im.width,v.cropPixels[2]-v.cropPixels[0]);assert.equal(im.height,v.cropPixels[3]-v.cropPixels[1]);}
});

test('three source-declared One/One emission parts stay separate from opaque surfaces and have exact source material links',()=>{
 const glows=d.maps[0].slots.flatMap(s=>s.variants.flatMap(v=>v.emissiveLayers??[]));assert.equal(glows.length,3);assert.equal(d.summary.sourceDeclaredAdditiveMeshParts,3);assert.equal([...d.area4Candidates,...d.skins].reduce((n,x)=>n+x.additiveMaterialParts,0),3);
 for(const g of glows){assert.equal(g.blendMode,'plus-lighter');assert.equal(g.sourceSavedBlendProperties._SrcBlend,1);assert.equal(g.sourceSavedBlendProperties._DstBlend,1);assert.equal(g.finalNativeRenderingVerified,false);assert.ok(media.has(g.mediaKey));assert.ok(d.materials.some(m=>m.identity.serialized_file+':'+m.identity.path_id===g.sourceMaterialKey));const im=media.get(g.mediaKey);assert.equal(im.width,g.cropPixels[2]-g.cropPixels[0]);assert.equal(im.height,g.cropPixels[3]-g.cropPixels[1]);}
 for(const r of d.skins.filter(s=>s.additiveMaterialParts))assert.equal(r.isolatedPreviewBackground,'#eff3ee');
});

test('all eighty curated PNG bytes match dimensions and provenance without publishing complete bundles or source geometry',async()=>{
 assert.equal(d.mediaEntries.length,80);assert.equal(new Set(d.mediaEntries.map(m=>m.key)).size,80);let size=0;for(const m of d.mediaEntries){assert.match(m.src,/^\.\/assets\/media\/remote-presentation\/[A-Za-z0-9_-]+\.png$/);const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(sha(b),m.sha256,m.key);assert.equal(b.length,m.bytes);assert.equal(b.readUInt32BE(16),m.width);assert.equal(b.readUInt32BE(20),m.height);assert.equal(m.originalRuntimeObserved,false);assert.equal(m.originalFinalRenderingVerified,false);size+=b.length;}assert.equal(size,d.summary.newMediaBytes);
 const bad=[];function visit(v,p){if(typeof v==='number'&&Number.isInteger(v)&&!Number.isSafeInteger(v))bad.push(p);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))visit(x,p+'.'+k);}visit(d,'root');assert.deepEqual(bad,[]);assert.doesNotMatch(JSON.stringify(d),/[CD]:[\\/]|"vertices"\s*:|"triangles"\s*:|@gmail\.com/);const c=structuredClone(d);delete c.revision;assert.equal(sha(JSON.stringify(c)),d.revision);
});

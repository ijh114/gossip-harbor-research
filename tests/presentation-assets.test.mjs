import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const c=JSON.parse(await readFile(new URL('../src/data/presentation-assets.json',import.meta.url),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('common map projection preserves exact hierarchy evidence while keeping original camera and runtime unknown',()=>{
 const m=c.maps[0];assert.equal(c.originalRuntimeObserved,false);assert.equal(c.status,'partial');assert.equal(m.width,1600);assert.equal(m.height,1481);
 assert.equal(m.slots.length,41);assert.equal(m.projection.originalCameraVerified,false);assert.equal(m.projection.worldCoordinatesPreserved,true);assert.equal(m.projection.baseOcclusionMask,true);
 assert.equal(m.defaultStyleId,'0');assert.equal(m.initialVariants.filter(x=>x.status==='physical').length,15);assert.equal(m.initialVariants.filter(x=>x.status==='not-registered').length,26);
 const vs=m.slots.flatMap(s=>s.variants);assert.equal(vs.filter(v=>['1','2','3'].includes(v.id)&&v.mediaKey).length,111);assert.equal(vs.filter(v=>['1','2','3'].includes(v.id)&&!v.mediaKey).length,12);
 assert.equal(vs.filter(v=>v.id==='0'&&v.mediaKey).length,13);assert.equal(vs.filter(v=>v.id==='0'&&!v.mediaKey).length,2);
 for(const s of m.slots){assert.equal(s.transformChain?.length,s.slotRootPathId===s.slotTransformPathId?3:4);assert.equal(typeof s.slotRootPathId,'string');for(const v of s.variants){assert.equal(s.variantMediaKeys[v.id],v.mediaKey);if(!v.mediaKey){assert.equal(v.boundsNormalized,null);continue;}const b=v.boundsNormalized;for(const n of Object.values(b))assert.ok(Number.isFinite(n)&&n>=0&&n<=1);assert.ok(b.x+b.width<=1+1e-10&&b.y+b.height<=1+1e-10);assert.ok(Number.isFinite(v.depth));assert.equal(typeof v.identity.path_id,'string');assert.equal(v.sourceRefs.includes('presentation:slot-loading'),true);}}
 assert.equal(m.slots.find(s=>s.id==='1_4').transformChain[2].position[1],1.600000023841858);const absolute=[];function inspect(value,path=''){if(typeof value==='string'&&/[DC]:\\/.test(value))absolute.push(path);else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))inspect(v,path+'.'+k);}inspect(c);assert.deepEqual(absolute,[]);
 assert.equal(c.audit.baseMeshParts,800);assert.match(m.projection.layerOrdering,/Painter/);assert.match(m.projection.baseOmissions[0].reason,/Builtin/);
});

test('all curated map and CG image bytes match provenance hashes and PNG crop dimensions',async()=>{
 assert.equal(new Set(c.mediaEntries.map(m=>m.key)).size,c.mediaEntries.length);const byKey=new Map(c.mediaEntries.map(m=>[m.key,m]));
 for(const m of c.mediaEntries){assert.equal(m.kind,'image');assert.match(m.src,/^\.\/assets\/media\/[\w./-]+\.(png|webp)$/);const bytes=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(sha(bytes),m.sha256);assert.equal(bytes.length,m.bytes);assert.ok(m.width>0&&m.height>0);if(m.src.endsWith('.png')){assert.equal(bytes.readUInt32BE(16),m.width);assert.equal(bytes.readUInt32BE(20),m.height);}if(m.origin==='packaged-mesh-curated-raster')assert.equal(m.originalRuntimeObserved,false);}
 for(const s of c.maps[0].slots)for(const v of s.variants){if(!v.mediaKey)continue;const image=byKey.get(v.mediaKey);assert.ok(image);assert.equal(v.cropPixels[2]-v.cropPixels[0],image.width);assert.equal(v.cropPixels[3]-v.cropPixels[1],image.height);assert.equal(v.cropPixels[0]/c.maps[0].width,v.boundsNormalized.x);assert.equal(v.cropPixels[1]/c.maps[0].height,v.boundsNormalized.y);}
});

test('CG layers, skeletal declarations and C# callbacks are not conflated with original intro playback',()=>{
 const o=c.opening;assert.equal(o.introLinkedToCG,false);assert.equal(o.titleMediaKey,null);assert.equal(o.loadingMediaKey,'presentation:native:loading_bg');assert.equal(o.cgScenes.length,3);assert.equal(o.frames.length,24);assert.equal(new Set(o.frames.map(x=>x.mediaKey)).size,22);
 for(const f of o.frames){assert.equal(f.kind,'static-layer-not-temporal-frame');assert.equal(f.introLinked,false);assert.equal(f.declaredDuration,null);assert.ok(c.mediaEntries.some(m=>m.key===f.mediaKey));}
 assert.ok(o.cgScenes[0].callbacks.some(x=>x.method==='OnNextBtnClicked'&&x.targetAssemblyType.includes('SceneCGFirstSceneManager')));
 const all=o.cgScenes.flatMap(s=>s.nodes);assert.ok(all.some(n=>n.startingAnimation==='scene1_curtain_loop'&&n.startingLoop));
 const leftWindow=all.find(n=>n.path==='/SceneCGThirdScene/center/scene3_1a'),rightWindow=all.find(n=>n.path==='/SceneCGThirdScene/center/scene3_1b');assert.equal(leftWindow.rotation[2],0.3967146873474121);assert.equal(rightWindow.rotation[2],-0.38580167293548584);assert.ok(leftWindow.rotationZDegrees>46&&leftWindow.rotationZDegrees<47);assert.ok(rightWindow.rotationZDegrees< -45&&rightWindow.rotationZDegrees> -46);
 for(const s of o.cgScenes){assert.equal(s.originalRuntimeObserved,false);assert.equal(s.introLinkVerified,false);assert.equal(s.animators.length,0);for(const n of s.nodes)if(n.kind==='spine-skeleton-graphic'){assert.equal(n.mediaKey,null);assert.equal(n.runtimeActiveAnimationVerified,false);}}
 assert.equal(o.audioClips.length,18);for(const a of o.audioClips){assert.equal(a.auditionVerified,false);assert.equal(a.runtimeSynchronizationVerified,false);assert.equal(a.mediaKey,null);assert.ok(a.declaredDuration>0);}
});

test('all26 Skin prefabs and34 missing recap images have exact catalog GUID dependencies without guessed CDN URLs',()=>{
 assert.equal(c.skins.length,26);assert.equal(c.remoteResourceAudit.targets.length,60);assert.equal(c.remoteResourceAudit.summary.exactKeys,60);assert.equal(c.remoteResourceAudit.summary.resolvedURLs,0);
 assert.equal(c.remoteResourceAudit.catalog.networkRequests,0);assert.equal(c.remoteResourceAudit.catalog.sizeFieldValidation.samples,245);assert.equal(c.remoteResourceAudit.catalog.sizeFieldValidation.mismatchCount,0);
 for(const s of c.skins){assert.equal(s.mediaKey,null);assert.match(s.status,/not-in-local/);assert.equal(s.resourceKey,s.slot+'_'+s.itemId);assert.equal(s.catalog.assetPath,s.prefab);}
 for(const t of c.remoteResourceAudit.targets){assert.equal(t.exactKeyFound,true);assert.match(t.assetGuid,/^[a-f0-9]{32}$/);assert.ok(t.bundles.length);for(const b of t.bundles){assert.equal(b.resolvedURL,null);assert.ok(b.uriTemplate.startsWith('{AddressableManager.remoteLoadPathPrefix}/{AddressableManager.remoteLoadFolder}/')||b.uriTemplate.startsWith('{UnityEngine.AddressableAssets.Addressables.RuntimePath}/'));assert.equal(b.hashAlsoPresentInSerializedOptions,true);assert.match(b.hashFromFilename,/^[a-f0-9]{32}$/);assert.ok(Number.isInteger(b.sizeBytes)&&b.sizeBytes>0);}}
});

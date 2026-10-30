import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const study=JSON.parse(await readFile(new URL('../src/data/native-map-study.json',import.meta.url),'utf8'));
test('all55 selected physical slots retain34 task poses and21 explicit source fallbacks without recentering',()=>{
 assert.equal(study.views.length,55);assert.equal(new Set(study.views.map(v=>v.slotId)).size,55);assert.equal(study.views.filter(v=>v.source.positionMode==='MainTaskConfig.edit_pos').length,34);assert.equal(study.views.filter(v=>v.source.positionMode==='serialized edit root child1 fallback').length,21);
 assert.equal(study.coverage.selectedVariantLayers,167);assert.equal(study.coverage.attemptedVariantLayers,167);assert.equal(study.coverage.zeroVisibleVariantLayers,0);assert.equal(study.runtimeObserved,false);assert.equal(study.finalNativeRenderingVerified,false);
 const unseen=study.views.flatMap(v=>v.unseenLayers||[]).map(l=>l.resourceKey).sort();assert.deepEqual(unseen,[]);assert.equal(study.coverage.sourceSpriteRendererParts,5);
 for(const v of study.views){assert.equal(v.positionIsAnalystRecentering,false);assert.deepEqual(v.position,v.source.taskEditPosition);assert.ok(v.position.every(Number.isFinite));if(v.source.positionMode.includes('fallback'))assert.deepEqual(v.position,v.source.slotSerializedEditFallback);}
});
test('all222 bounded PNG derivatives match hashes and normalized crops without publishing raw geometry',async()=>{
 const files=study.views.flatMap(v=>[v.base,...v.layers.map(l=>l.media)]);assert.equal(files.length,222);
 for(let i=0;i<files.length;i+=12)await Promise.all(files.slice(i,i+12).map(async f=>{assert.match(f.src,/^\.\/assets\/media\/current-material-review\/map-native\//);const bytes=await readFile(new URL('../src/'+f.src.slice(2),import.meta.url));assert.equal(bytes.length,f.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);assert.equal(f.originalRuntimeObserved,false);}));
 for(const v of study.views)for(const l of v.layers){const b=l.boundsNormalized;assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=1.000001&&b.y+b.height<=1.000001);assert.ok(l.media.width>0&&l.media.height>0);assert.equal(l.sourceIdentity.type,'GameObject');}
 const forbidden=new Set(['vertices','triangles','uv','parts','geometryPath']);function visit(x){if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){assert.equal(forbidden.has(k),false,k);visit(v);}}visit(study);
 assert.equal(study.coverage.sourceMeshPartsIndependentlyVerified,1453);assert.equal(study.coverage.sourceTexturesPixelCompared,474);assert.equal(study.coverage.sourceBundlesRehashed,8);
});

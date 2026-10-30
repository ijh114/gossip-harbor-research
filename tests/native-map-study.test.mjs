import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {validNativeMapStudy,nativeMapFrame,projectNativeMapPoint,createNativeMapProjector,nativeMapWorldAtDepth,nativeMapPlaneIntersection,nativeMapPixelScale,renderNativeMapStudy,renderNativeMapPreview,mountNativeMapStudy} from '../src/native-map-study.mjs';
const data=JSON.parse(await readFile(new URL('../src/data/native-map-study.json',import.meta.url),'utf8'));
const close=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('55 exact source task/fallback poses and167 source-keyed layers retain static/runtime boundaries',()=>{
 assert.equal(validNativeMapStudy(data),true);assert.equal(data.views.length,55);for(const id of ['1_4','12_5','13_2'])assert.ok(data.views.some(v=>v.slotId===id));assert.equal(data.views.flatMap(v=>v.layers).length,167);
 assert.deepEqual(data.views.find(v=>v.slotId==='1_4').position,[30.4,175,-266]);assert.equal(data.camera.serializedEnabled,false);assert.equal(data.camera.loadPoseVisibleBasePixels,0);assert.equal(data.camera.runtimeAspectObserved,false);assert.equal(data.raster.aspect,9/16);
 assert.equal(data.camera.modeBinding.cameraPathId,'374');assert.equal(data.camera.modeBinding.mapRootTransformPathId,'350');assert.ok(data.camera.fovConsistencyAbsoluteError<1e-5);
 assert.equal(data.raster.crossSlotSceneReconstructionClaimed,false);assert.equal(data.coverage.publicPNGFiles,222);
});

test('every new raster and prior-comparison source is a local exact rehashed PNG',async()=>{
 const unique=new Map();for(const view of data.views){for(const m of [view.base,view.priorComparison.base,...view.layers.map(l=>l.media),...view.priorComparison.layers.map(l=>l.media)])unique.set(m.src,m);for(const layer of view.layers){assert.equal(layer.resourceKey,view.slotId+'_'+layer.variantId);close(layer.cropPixels[0]/540,layer.boundsNormalized.x);close(layer.cropPixels[1]/960,layer.boundsNormalized.y);}}
 for(const m of unique.values()){const bytes=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);}
});

test('unsupported slots and unavailable exact variants never select a nearby image',()=>{
 assert.equal(nativeMapFrame(data,{slotId:'1_4',variantId:'2'}).resourceKey,'1_4_2');
 assert.equal(nativeMapFrame(data,{slotId:'1_5',variantId:'1'}).status,'unsupported-source-camera');assert.equal(nativeMapFrame(data,{slotId:'13_2',variantId:'0'}).status,'source-layer-unavailable');
 assert.match(renderNativeMapPreview(data,{slotId:'1_5',variantId:'1'}),/다른 슬롯·타입으로 치환하지/);
 assert.doesNotMatch(renderNativeMapStudy(data,{slotId:'1_5',variantId:'1'}),/data-native-map-stage/);
});

test('perspective center and off-axis point roundtrips preserve source-camera depth',()=>{
 for(const view of data.views){for(const [x,y,z]of[[270,480,100],[10,950,400],[539,1,800]]){const point=nativeMapWorldAtDepth(data,view.slotId,x,y,z);assert.ok(point);const projected=projectNativeMapPoint(data,view.slotId,point);close(projected.x,x);close(projected.y,y);close(projected.depth,z);assert.equal(projected.visible,true);}}
 assert.equal(nativeMapWorldAtDepth(data,'1_4',0,0,24),null);assert.equal(nativeMapWorldAtDepth(data,'1_4',0,0,1501),null);
 const behind=data.views.find(v=>v.slotId==='1_4').position.map((n,i)=>n-data.camera.rotationMatrix[i][2]*10);assert.equal(projectNativeMapPoint(data,'1_4',behind).behindCamera,true);
});

test('pixel-to-world is explicitly depth-dependent; Y=0 hit reprojects to the same pixel',()=>{
 close(nativeMapPixelScale(data,400),4*nativeMapPixelScale(data,100));
 for(const view of data.views){const hit=nativeMapPlaneIntersection(data,view.slotId,270,480);assert.ok(hit);close(hit.world[1],0);const pixel=projectNativeMapPoint(data,view.slotId,hit.world);close(pixel.x,270);close(pixel.y,480);assert.equal(hit.kind,'research-plane-intersection-not-mesh-hit');}
 assert.equal(nativeMapPlaneIntersection(data,'1_4',-1,0),null);assert.equal(nativeMapPlaneIntersection(data,'1_4',NaN,0),null);assert.equal(nativeMapPlaneIntersection(data,'unsupported',270,480),null);
});

test('switching source slot/variant and measurement works without changing game or study data; cleanup detaches',()=>{
 const before=JSON.stringify(data),dom=new JSDOM(renderNativeMapStudy(data)),doc=dom.window.document,cleanup=mountNativeMapStudy(doc,data);
 doc.querySelector('[data-native-map-variant="2"]').click();assert.equal(doc.querySelector('[data-native-map-study]').dataset.nativeMapVariantId,'2');
 const picker=doc.querySelector('[data-native-map-slot]');picker.value='13_2';picker.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(doc.querySelector('[data-native-map-study]').dataset.nativeMapSlotId,'13_2');assert.equal(doc.querySelectorAll('[data-native-map-variant]').length,3);
 doc.querySelector('[data-native-map-measure]').click();assert.match(doc.querySelector('[data-native-map-output]').textContent,/Y=0 연구 교점/);
 assert.equal(JSON.stringify(data),before);cleanup();doc.querySelector('[data-native-map-variant="3"]').click();assert.equal(doc.querySelector('[data-native-map-study]').dataset.nativeMapVariantId,'1');
});

test('public data contains no raw mesh vertex/index/UV arrays and source files keep LF',async()=>{
 const raw=await readFile(new URL('../src/data/native-map-study.json',import.meta.url),'utf8');assert.doesNotMatch(raw,/"(?:vertices|triangles|uv|parts)"\s*:/);assert.equal(raw.includes('\r\n'),false);
 const bad=structuredClone(data);bad.views[0].layers[0].media.src='https://example.com/replacement.png';assert.equal(validNativeMapStudy(bad),false);
 const wrong=structuredClone(data);wrong.views[0].layers[0].resourceKey='12_5_1';assert.equal(validNativeMapStudy(wrong),false);
});


test('exact SpriteRenderer zero-variants render without substituting an absent old comparison',()=>{
 for(const id of ['2_6','5_7']){const frame=nativeMapFrame(data,{slotId:id,variantId:'0'});assert.equal(frame.valid,true);assert.match(frame.layer.projectionKind,/SpriteRenderer/);assert.equal(frame.layer.originalShaderCompared,false);const html=renderNativeMapStudy(data,{slotId:id,variantId:'0'});assert.match(html,/기존 정사영의 같은 선택 레이어는 없습니다/);assert.match(html,/ppu/);assert.match(html,/data-native-map-stage/);}
 const missing=structuredClone(data);delete missing.views[0].priorComparison;assert.equal(validNativeMapStudy(missing),true);assert.match(renderNativeMapStudy(missing,{slotId:missing.views[0].slotId,variantId:missing.views[0].layers[0].variantId}),/다른 타입 이미지로 대체하지/);
});

test('source fallback changes, missing declared variants and invented prior aliases are rejected',()=>{
 const changed=structuredClone(data),fallback=changed.views.find(v=>v.source.positionMode.includes('fallback'));fallback.position[0]++;assert.equal(validNativeMapStudy(changed),false);
 const missing=structuredClone(data);missing.views[0].layers.pop();assert.equal(validNativeMapStudy(missing),false);
 const alias=structuredClone(data);alias.views[0].priorComparison.layers[0].resourceKey='unrelated_1';assert.equal(validNativeMapStudy(alias),false);
});

test('one-time projector exactly matches source camera math for all55 views including clipped and behind points',()=>{
 for(const view of data.views){
  const project=createNativeMapProjector(data,view.slotId);assert.equal(typeof project,'function');
  const points=[[0,0,0],view.position,...[[270,480,100],[10,950,400],[539,1,800],[-100,1000,600]].map(([x,y,z])=>nativeMapWorldAtDepth(data,view.slotId,x,y,z)),view.position.map((n,i)=>n-data.camera.rotationMatrix[i][2]*10)];
  for(const point of points)assert.deepEqual(project(point),projectNativeMapPoint(data,view.slotId,point));
  assert.equal(project([1,2,NaN]),null);assert.equal(project([1,2]),null);
 }
 assert.equal(createNativeMapProjector(data,'unknown'),null);assert.equal(createNativeMapProjector({},'1_4'),null);
});

test('repeated projector calls do not re-read the manifest and use an isolated numeric snapshot',()=>{
 const snapshot=structuredClone(data);let reads=0;const observed=new Proxy(snapshot,{get(target,key,receiver){reads++;return Reflect.get(target,key,receiver);}});
 const project=createNativeMapProjector(observed,'1_4'),point=nativeMapWorldAtDepth(data,'1_4',270,480,100),before=project(point),initialReads=reads;
 for(let i=0;i<1000;i++)assert.deepEqual(project(point),before);
 assert.equal(reads,initialReads);
 snapshot.camera.near=1200;snapshot.camera.rotationMatrix[0][0]=99;snapshot.views.find(v=>v.slotId==='1_4').position[0]=9999;
 assert.deepEqual(project(point),before);assert.equal(reads,initialReads);
});

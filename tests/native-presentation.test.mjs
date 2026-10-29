import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {renderNativeLoading,renderNativeEvidence} from '../src/native-presentation.mjs';
const presentationAssets=JSON.parse(await readFile(new URL('../src/data/presentation-assets.json',import.meta.url),'utf8'));
test('native loading art is bound through exact Image/Sprite pointers without inventing an original title screen',()=>{
 const n=presentationAssets.nativePlayer,o=presentationAssets.opening;assert.equal(n.inventory.typeTreeHashMatchedBehaviours,373);assert.equal(n.inventory.typedReadErrors,0);assert.equal(o.titleMediaKey,null);assert.equal(n.mapCamera.modeBinding.field,'m_mapCam');assert.equal(n.mapCamera.modeBinding.cameraPathId,n.mapCamera.identity.path_id);assert.equal(n.mapCamera.projection,'perspective');assert.ok(n.mapCamera.fieldOfViewYDegrees>19&&n.mapCamera.fieldOfViewYDegrees<20);assert.equal(n.mapCamera.runtimeCameraFrameVerified,false);
 const bg=n.selectedLoadingImages.find(x=>x.role==='loading_bg');assert.equal(bg.imageIdentity.path_id,'1096');assert.equal(bg.spriteIdentity.path_id,'149');for(const r of n.selectedLoadingImages){assert.match(r.templateTypeHash,/^[a-f0-9]{32}$/);assert.match(r.imageIdentity.object_source_sha256,/^[a-f0-9]{64}$/);assert.equal(r.runtimeActiveVerified,false);}
 const dom=new JSDOM(renderNativeLoading({presentationAssets}));try{assert.ok(dom.window.document.querySelector('.native-loading-bg'));assert.ok(dom.window.document.querySelector('.native-loading-logo'));assert.match(dom.window.document.body.textContent,/원작 진행률·실행 시간과 별도/);assert.equal(dom.window.document.querySelector('progress').hasAttribute('value'),false);}finally{dom.window.close();}
});
test('the native UI appendix exposes source geometry and retained unknown font/runtime limits',()=>{
 const n=presentationAssets.nativePlayer,html=renderNativeEvidence({nativePlayer:n});assert.equal(n.canvasScalers.length,7);assert.equal(n.selectedSerializedFonts.length,16);assert.match(html,/373개/);assert.match(html,/실제 활성 한국어 폰트/);assert.match(html,/웹의40° 직교 투영과 다릅니다/);assert.equal(renderNativeLoading({}), '');
});

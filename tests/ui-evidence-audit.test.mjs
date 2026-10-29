import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const data=JSON.parse(await readFile(new URL('../src/data/ui-evidence-audit.json',import.meta.url),'utf8'));
const refinement=JSON.parse(await readFile(new URL('../src/data/media-refinement.json',import.meta.url),'utf8'));

test('UI audit covers the selected prefab/controller/clip inventory without promoting it to runtime verification',()=>{
 assert.equal(data.checklistId,'0.04');assert.equal(data.status,'partial');assert.equal(data.originalRuntimeObserved,false);
 assert.equal(data.prefabs.length,11);assert.equal(data.controllers.length,14);assert.equal(data.clips.length,26);
 assert.equal(data.summary.observedScreenStudies,5);assert.equal(data.observedRegions.length,29);assert.equal(data.comparisons.length,8);
 assert.equal(data.summary.exactRuntimeCoordinateMatches,0);assert.equal(data.summary.confirmedCaptureFontMatches,0);
 assert.equal(data.newNativeFramesReviewed,0);assert.equal(data.newAssetsRecovered,4);
 assert.equal(new Set(data.prefabs.map(p=>p.assetPath)).size,11);
 for(const p of data.prefabs){assert.ok(p.rectTransformCount<=p.gameObjectCount);assert.equal(p.runtimeLoaded,null);for(const c of p.canvases)assert.equal(c.runtimeActive,null);}
 for(const c of data.clips){assert.equal(c.measuredRuntimeSeconds,null);assert.equal(c.runtimePlaybackVerified,false);assert.equal(c.declaredSeconds,c.end-c.start);assert.ok(c.declaredSeconds>0);}
});
test('observed rectangles and hashes reproduce the existing historical annotation ledger, not inferred click targets',async()=>{
 const media=new Map(refinement.mediaEntries.map(m=>[m.key,m]));
 for(const row of data.observedRegions){
  const study=refinement.studies.find(s=>s.id===row.studyId),a=study.annotations.find(a=>row.id===study.id+':'+a.id),m=media.get(row.mediaKey);
  assert.ok(a);assert.ok(m);assert.equal(row.derivativeSha256,m.sha256);assert.equal(row.originalSha256,m.originalSha256);
  assert.deepEqual(row.normalizedRect,Object.fromEntries(['x','y','width','height'].map(k=>[k,a[k]])));
  const {x,y,width,height}=row.normalizedRect;assert.ok(x>=0&&y>=0&&width>0&&height>0&&x+width<=1.00001&&y+height<=1.00001);
  assert.equal(row.captureVersion,null);assert.equal(row.pixelClickRect,null);assert.equal(row.exactComponentIdentity,null);
  const bytes=await readFile(new URL('../src/'+row.mediaSrc.replace(/^\.\//,''),import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.derivativeSha256);
 }
});
test('raw HUD branches, external fonts and serialized path IDs stay distinct from active screen layout',()=>{
 const hud=data.comparisons.find(c=>c.id==='hud-resources');assert.equal(hud.staticNodes.length,6);
 assert.ok(hud.staticNodes.some(n=>n.nodePath.includes('/TopRight/')));assert.ok(hud.staticNodes.some(n=>n.nodePath.includes('/TopLeft/')));
 const energy=hud.staticNodes.find(n=>n.nodePath.endsWith('/TopRight/TopHudButtonContainer/EnergyHudButton'));
 assert.equal(energy.rect.m_AnchoredPosition.y,-49);assert.equal(energy.coordinateSpace,'raw-parent-local-RectTransform');
 assert.ok(data.fontInventory.some(f=>f.name==='PoetsenOne-Regular'));assert.ok(data.fontInventory.some(f=>f.name==='RixGamgijosimhae'));
 assert.ok(data.fontCases.some(f=>f.resolvedStaticFont?.name==='PoetsenOne-Regular SDF'));
 function ids(value){if(Array.isArray(value))value.forEach(ids);else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(key==='path_id')assert.match(v,/^-?\d+$/);else ids(v);}}
 ids(data);
 for(const f of data.fontCases){assert.equal(f.runtimeFont,null);assert.equal(f.runtimePixelSize,null);assert.equal(typeof f.fontPointer.pathId,'string');}
 assert.equal(data.coordinatePolicy.pixelDifferenceComparable,false);
 assert.equal(data.canvasScalers.length,8);assert.deepEqual(data.canvasScalers.find(s=>s.nodePath==='/UIRoot/Canvas').fields.m_ReferenceResolution,{x:1080,y:1920});
 assert.ok(data.canvasScalers.some(s=>s.fields.m_ReferenceResolution.x===800));
 for(const row of data.comparisons){assert.equal(row.pixelDelta,null);assert.equal(row.runtimeMatchVerified,false);assert.ok(row.unknowns.length);for(const id of row.observedRegionIds)assert.ok(data.observedRegions.some(r=>r.id===id));}
 for(const row of data.comparisons.filter(r=>r.staticNodes.length===0))assert.equal(row.comparisonKind,'observed-only-outside-selected-prefabs');
 assert.equal(data.unresolved.length,5);
});
test('public UI audit retains bounded source references and excludes raw tree/font/clip bodies',()=>{
 const sources=new Map(data.sources.map(s=>[s.id,s]));
 for(const s of sources.values()){assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.ok(s.path.startsWith('analysis/')||s.path.startsWith('sites/harbor-bm-lab/src/'));assert.equal(s.originalRuntimeObserved,false);}
 for(const row of [...data.fontInventory,...data.fontCases,...data.observedRegions,...data.controllers,...data.clips])assert.ok(sources.has(row.sourceRef));
 for(const row of data.comparisons){for(const id of row.sourceRefs)assert.ok(sources.has(id));for(const node of row.staticNodes)assert.ok(sources.has(node.sourceRef));}
 const s=JSON.stringify(data);assert.doesNotMatch(s,/[CD]:[\\/]/);assert.doesNotMatch(s,/"serialized_clip"|"serialized_controller"|"m_FontData"|"m_Controller"|"m_Children"/);
});

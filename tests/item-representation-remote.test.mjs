import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validMedia} from '../src/visual-model.mjs';
const data=JSON.parse(await readFile(new URL('../src/data/item-representation-remote.json',import.meta.url),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const media=new Map(data.mediaEntries.map(m=>[m.key,m]));

test('recovered remote item sprites retain exact catalog and object identities with verified image bytes',async()=>{
 assert.equal(data.targetVersion,'4.10.5');assert.equal(data.originalRuntimeObserved,false);
 assert.equal(data.sprites.length,3);assert.equal(media.size,3);assert.equal(data.downloads.length,2);
 for(const d of data.downloads){
  assert.equal(d.httpStatus,200);assert.equal(d.bytes,d.expectedCatalogBytes);assert.equal(d.etagMD5Verified,true);
  assert.equal(d.runtimeTransferOrPreferenceObserved,false);assert.equal(d.accountAPICalled,false);
  assert.equal(d.catalogFilenameHashIsByteMD5,false);assert.match(d.sha256,/^[a-f0-9]{64}$/);
 }
 for(const s of data.sprites){
  assert.equal(s.containerPath,'Assets/'+s.fileKey);assert.equal(s.registeredAndExactContainerResolved,true);
  for(const id of [s.spriteIdentity,s.textureIdentity]){
   assert.match(id.path_id,/^-?\d+$/);assert.match(id.object_source_sha256,/^[a-f0-9]{64}$/);
   assert.ok(data.downloads.some(d=>d.bundleFile===id.bundle&&d.sha256===id.bundle_sha256));
  }
  const m=media.get(s.mediaKey);assert.ok(validMedia(m));
  assert.match(m.src,/^\.\/assets\/media\/item-representation-remote\/[A-Za-z0-9_]+\.png$/);
  const b=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(hash(b),m.sha256);
  assert.equal(b.length,m.bytes);assert.equal(b.readUInt32BE(16),m.width);assert.equal(b.readUInt32BE(20),m.height);
  assert.deepEqual([m.width,m.height],s.decodedSpriteSize);
  assert.equal(m.pixelsToUnits,s.pixelsToUnits);assert.equal(s.pixelsToUnits,1);
  assert.ok(s.sourceSpriteRect.width>=m.width&&s.sourceSpriteRect.height>=m.height);
  assert.deepEqual(m.sourceSpriteRect,s.sourceSpriteRect);assert.deepEqual(m.textureRectOffset,s.textureRectOffset);
 }
 assert.doesNotMatch(JSON.stringify(data),/[CD]:[\\/]|@gmail\.com|localPath|privateReviewPath/);
});

test('four gift types share two exact images and temp is a composited item with an actual countdown binding',()=>{
 const gifts=data.entries.filter(e=>['md_hw_gift_1','md_hw_gift_2','deco_event_gift_s_1','deco_event_gift_b_1'].includes(e.type));
 assert.equal(gifts.length,4);assert.equal(new Set(gifts.map(e=>e.mediaKey)).size,2);
 for(const e of gifts){assert.equal(e.representationResolved,true);assert.equal(e.standaloneImageResolved,true);assert.equal(e.image.available,true);}
 const temp=data.entries.find(e=>e.type==='temp_1');assert.equal(temp.representationResolved,true);
 assert.equal(temp.standaloneImageRequired,false);assert.equal(temp.standaloneImageResolved,false);assert.equal(temp.outer.available,true);
 const p=data.tempPrefab;assert.equal(p.componentType,'ItemTempView');assert.equal(p.countdownBindingName,'m_countdownImage');
 assert.equal(p.serializedImageType,3);assert.equal(p.serializedFillMethod,1);assert.equal(p.innerScaleXY,.8);
 assert.equal(p.runtimeFillExpression,'1 - itemTempModel:GetTimerAmount()');assert.equal(p.prefabParticleSystems,3);
 assert.equal(p.countdownSpriteName,'starwish_time_icon1');assert.equal(p.countdownSpriteIdentity.authority,'shipped-artifact');
 assert.equal(data.giftNameAudit.EventActivityGift4Registered,false);assert.equal(data.giftNameAudit.EventActivityGift4ExactContainerPresent,false);
 assert.deepEqual(data.giftNameAudit.requiredGiftImagesForBaseFourTypes,['EventActivityGift2','EventActivityGift3']);
});

test('unresolved property-bubble declaration remains a bounded unknown instead of invented visual completion',()=>{
 const p=data.propertyBubbleUsage;assert.equal(p.type,'property_bubble_1');assert.equal(p.luaFilesSearched,2495);
 assert.equal(p.exactTokenHits.length,4);assert.equal(p.executableReferencesBeyondDeclarations,0);
 for(const h of p.exactTokenHits){assert.equal(h.role,'empty-model-declaration');assert.match(h.sha256,/^[a-f0-9]{64}$/);assert.ok(h.line>0);}
 for(const k of ['imageFileConfigMatches','catalogExactKeyMatches','catalogExactPNGBaseMatches','shippedObjectInventoryExactMatches','nativeSpriteInventoryExactMatches'])assert.equal(p[k],0,k);
 assert.equal(p.normalBubbleModelType,'3401');assert.equal(p.normalBubblePrefix,'b#');
 const row=data.entries.find(e=>e.type===p.type);assert.equal(row.representationResolved,false);assert.equal(row.standaloneImageRequired,null);
 assert.equal(data.coverage.baseExceptions,8);assert.equal(data.coverage.baseRepresentationRulesResolved,7);
 assert.equal(data.coverage.baseUsageStillUnknown,1);assert.equal(data.coverage.allBaseExceptionsComplete,false);
 assert.equal(data.coverage.base544MappingsChanged,0);
});

test('published object identifiers remain strings and contain no unsafe serialized integers',()=>{
 function walk(v,path='root'){
  if(typeof v==='number'&&Number.isInteger(v))assert.ok(Number.isSafeInteger(v),path);
  if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){
   if(k==='path_id')assert.equal(typeof x,'string',path+'.'+k);
   walk(x,path+'.'+k);
  }
 }
 walk(data);
});

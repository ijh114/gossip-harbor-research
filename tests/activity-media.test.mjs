import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=async name=>JSON.parse(await readFile(new URL('../src/data/'+name,import.meta.url),'utf8'));
const [media,c,base]=await Promise.all(['activity-media.json','activity-play.json','media.json'].map(read));
test('representative event imagery keeps all missing type identities and does not promote related names into images',()=>{
 assert.equal(media.types.length,c.event.items.length);assert.equal(media.summary.eventTypes,35);assert.equal(media.summary.eventAvailable,0);assert.equal(media.summary.eventUnavailable,35);
 assert.deepEqual(media.types.map(x=>x.type),c.event.items.map(x=>x.type));assert.deepEqual(media.entries,[]);assert.equal(media.summary.newImageFiles,0);
 for(const row of media.types){assert.equal(row.status,'unavailable');assert.equal(row.physicalLocalSprites,0);assert.ok(row.reason);assert.equal(row.src,undefined);if(row.relatedDeclaration){assert.equal(row.relatedDeclaration.physicalLocalSprites,0);assert.match(row.relatedDeclaration.boundary,/채택하지/);}}
 assert.equal(media.themeCrosscheck.rows.length,17);assert.equal(media.summary.otherThemeEventImagesMatched,0);assert.ok(media.themeCrosscheck.rows.some(x=>x.boardAvailable));
});
test('shared event resource references retain existing Sprite identities and public image hashes without inflating event image coverage',async()=>{
 assert.equal(media.sharedResources.length,24);assert.equal(media.summary.sharedExistingVerified,24);
 for(const row of media.sharedResources){const prior=base.entries.find(x=>x.key===row.key);assert.ok(prior);assert.equal(prior.src,row.src);assert.equal(prior.sha256,row.sha256);assert.deepEqual(prior.identity,row.identity);assert.equal(row.identity.type,'Sprite');assert.equal(typeof row.identity.path_id,'string');
  const bytes=await readFile(new URL('../src/'+row.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),row.width);assert.equal(bytes.readUInt32BE(20),row.height);assert.match(row.pixelSha256,/^[a-f0-9]{64}$/);
 }
 for(const source of media.sources){assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.equal(/^[A-Z]:/i.test(source.path),false);}
});

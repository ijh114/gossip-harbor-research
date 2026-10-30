import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {validItemResolutionFollowup, selectBubbleImageKey, shippedBubbleRepresentation, renderItemResolutionFollowup, mountItemResolutionFollowup} from '../src/item-resolution-followup.mjs';
const data = JSON.parse(await readFile(new URL('../src/data/item-resolution-followup.json',import.meta.url),'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('shipped exact source identity and Lua two-TEST control flow remain intact', () => {
  assert.equal(validItemResolutionFollowup(data),true);
  assert.deepEqual(data.bubble.bytecode.constants,['m_instant','ImageFileConfigName','BubbleInstant','Bubble']);
  assert.deepEqual(data.bubble.bytecode.instructions.map(x=>x.op),[7,34,30,6,7,34,30,6,7,38,38]);
  assert.equal(data.bubble.bytecode.originalSourceLineStart,160);
  assert.equal(data.bubble.bytecode.originalSourceLineEnd,162);
  assert.equal(data.bubble.instantConstantDefined,false);
});

test('normal and instant with a nil key select Bubble; genuine defined keys are not overwritten', () => {
  assert.equal(selectBubbleImageKey(false,undefined),'Bubble');
  assert.equal(selectBubbleImageKey(true,undefined),'Bubble');
  assert.equal(selectBubbleImageKey(true,null),'Bubble');
  assert.equal(selectBubbleImageKey(true,false),'Bubble');
  assert.equal(selectBubbleImageKey(true,'counterfactual-defined-key'),'counterfactual-defined-key');
  // Lua regards 0 and the empty string as true, unlike JavaScript.
  assert.equal(selectBubbleImageKey(true,''),'');
  assert.equal(selectBubbleImageKey(true,0),0);
  assert.equal(shippedBubbleRepresentation(true,data).imageKey,'Bubble');
  assert.equal(shippedBubbleRepresentation(true,data).runtimeObserved,false);
});

test('70 registered identities use 70 exact rehashed source pictures, with no fixture alias', async () => {
  const fixtureTypes=new Set(data.fixture.types.map(x=>x.type));
  assert.equal(fixtureTypes.size,35);
  const entries=data.registeredGroups.flatMap(x=>x.entries);
  assert.equal(entries.length,70);
  assert.equal(new Set(entries.map(x=>x.type)).size,70);
  assert.equal(new Set(entries.map(x=>x.sha256)).size,32);
  assert.equal(data.coverage.exactSpriteIdentities,70);
  assert.equal(data.coverage.uniquePublishedPNGContents,32);
  for(const entry of entries){
    assert.equal(fixtureTypes.has(entry.type),false);
    assert.equal(entry.imageKey,entry.type);
    assert.equal(hash(await readFile(new URL('../src/'+entry.src.slice(2),import.meta.url))),entry.sha256);
    assert.equal(typeof entry.identity.path_id,'string');
  }
});

test('unresolved purpose and dynamic/server boundaries cannot be promoted to observed evidence', () => {
  assert.equal(data.propertyBubble.status,'declared-only-purpose-unresolved');
  assert.equal(data.propertyBubble.modelDeclarations.length,4);
  assert.ok(data.propertyBubble.modelDeclarations.every(x=>JSON.stringify(x.fields)==='["Type"]'));
  assert.equal(data.fixture.registered,false);
  assert.equal(data.scope.nativeRecordStatuses['partial-common-prefix-only'],1);
  assert.equal(data.scope.nativeRecordStatuses['partial-prefix-and-font-reference'],2);
  const bad=structuredClone(data);bad.registeredGroups[0].entries[0].src='https://example.com/art.png';
  assert.equal(validItemResolutionFollowup(bad),false);
  assert.equal(shippedBubbleRepresentation(true,bad).status,'invalid-evidence');
});

test('gallery filters, bubble explanation, escaped labels and cleanup work without save mutation', () => {
  const dom=new JSDOM(renderItemResolutionFollowup(data));
  const root=dom.window.document.body;
  const before=JSON.stringify(data);
  const cleanup=mountItemResolutionFollowup(root,data);
  assert.equal(root.querySelectorAll('.irf-art-card').length,70);
  root.querySelector('[data-item-resolution-filter="dogpark-pureboard"]').click();
  assert.equal(root.querySelectorAll('[data-item-resolution-group]:not([hidden])').length,1);
  assert.match(root.querySelector('[data-item-resolution-count]').textContent,/35타입/);
  root.querySelector('[data-item-resolution-bubble="instant"]').click();
  assert.match(root.querySelector('[data-item-resolution-bubble-label]').textContent,/즉시 버블.*Bubble/);
  assert.equal(JSON.stringify(data),before);
  cleanup();
  root.querySelector('[data-item-resolution-filter="all"]').click();
  assert.match(root.querySelector('[data-item-resolution-count]').textContent,/35타입/);
  const escaped=structuredClone(data);escaped.registeredGroups[0].entries[0].type='<script>alert(1)</script>';
  const unsafe=new JSDOM(renderItemResolutionFollowup(escaped));
  assert.equal(unsafe.window.document.querySelectorAll('script').length,0);
  assert.match(unsafe.window.document.body.textContent,/<script>alert\(1\)<\/script>/);
});

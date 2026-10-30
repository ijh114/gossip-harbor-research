import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {renderArtifactAvailability,selectArtifactAvailability} from '../src/artifact-availability.mjs';
import {STUDIO_PAGES,RESEARCH_ROUTES} from '../src/navigation.mjs';

const json = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`,import.meta.url),'utf8'));
const [data,scene,activity,media,visual] = await Promise.all(['artifact-availability','scene-config','activity-media','media','visual-index'].map(json));
const entry = id => data.entries.find(r => r.id === id);

test('availability ledger keeps current artifact boundaries and typed counts consistent with published source projections', async () => {
  const s = data.summary, base = visual.items.filter(r => r.table === 'ItemModelConfig'), keys = new Set(media.entries.map(r => r.key));
  const missingBase = base.filter(r => !keys.has(`item:${r.key}`));
  const recap=JSON.parse(await readFile(new URL('../src/data/story-recap.json',import.meta.url),'utf8'));assert.equal(s.curatedRecapMediaEntries,recap.mediaEntries.length);assert.equal(s.newlyCuratedImageEntries,39);assert.equal(s.storyRecapImagesCurated,recap.summary.uniqueCuratedImages);
  assert.equal(s.sceneTasksProjected,scene.tasks.length);
  assert.equal(s.sceneLastTask,scene.tasks.at(-1).id);
  assert.equal(s.nextMissingTimelineTask,'13_1');
  assert.equal(s.decorationPreviews,scene.summary.technicalMeshPreviews);
  assert.equal(s.decorationRegisteredOnly,scene.summary.missingPhysicalChoiceVariants);
  assert.equal(s.baseCatalogTypes,base.length);
  assert.equal(s.baseTypeImagesCurated,base.length-missingBase.length);
  assert.equal(s.baseTypesWithoutStandaloneImageKey,missingBase.length);
  assert.equal(s.eventTypesMissing,activity.types.filter(r => r.status === 'unavailable').length);
  assert.equal(s.eventSharedImagesVerified,activity.sharedResources.length);
  assert.equal(s.sceneCuratedImages,scene.mediaEntries.filter(r => r.origin === 'packaged-sprite-derivative').length);
  assert.equal(s.records,data.entries.length);
  for (const [status,count] of Object.entries(s.statusRecords)) assert.equal(count,data.entries.filter(r => r.status === status).length);
  assert.equal(entry('scene-next-timeline').status,'missing');
  assert.equal(entry('event-35-images').subjectIds.length,35);
  assert.equal(data.entries.filter(r => r.id.startsWith('decor-') && r.status === 'registered-only').reduce((n,r) => n+r.count,0),12);
});

test('helper explanation does not invent a missing icon or turn component declarations into recovered artwork', () => {
  assert.equal(entry('base-bubble-component').standaloneTypeSpriteRequired,false);
  assert.equal(entry('base-bubble-component').physicalSourcePresent,true);
  assert.equal(entry('base-bubble-component').status,'research-projection');
  assert.match(entry('base-bubble-component').boundary,/새 공개 이미지 파일/);
  assert.equal(entry('base-temp-component').standaloneTypeSpriteRequired,false);
  assert.equal(entry('base-temp-component').status,'registered-only');
  assert.match(entry('base-temp-component').claim,/외곽은 등록만/);
  assert.equal(entry('base-locked-component').standaloneTypeSpriteRequired,false);
  assert.match(entry('base-locked-component').claim,/직접 요청하지 않습니다/);
  assert.equal(entry('base-property-bubble').status,'missing');
  assert.equal(entry('base-gift-images').count,4);
  assert.equal(entry('base-gift-images').status,'registered-only');
  for (const r of data.entries.filter(r => ['missing','registered-only'].includes(r.status))) assert.deepEqual(r.mediaKeys,[]);
  assert.equal(data.hypotheses.length,3);
  assert.ok(data.hypotheses.every(h => h.newAssetsRecovered === 0));
});

test('every exposed artifact claim has source path, exact text anchors and SHA; no guessed asset URL or machine path is published', async () => {
  const sources = new Map(data.sources.map(s => [s.id,s]));
  const statuses = new Set(data.statuses.map(s => s.id)), routes = new Set([...Object.keys(STUDIO_PAGES),...RESEARCH_ROUTES]);
  const recap=JSON.parse(await readFile(new URL('../src/data/story-recap.json',import.meta.url),'utf8'));const presentation=JSON.parse(await readFile(new URL('../src/data/presentation-assets.json',import.meta.url),'utf8'));const mediaKeys = new Set([...media.entries,...scene.mediaEntries,...recap.mediaEntries,...presentation.mediaEntries].map(m => m.key));
  assert.equal(sources.size,data.sources.length);
  for (const s of sources.values()) {
    assert.match(s.sha256,/^[a-f0-9]{64}$/);
    assert.match(s.path,/^(analysis|sites)\//);
    assert.ok(Number.isInteger(s.lineStart) && s.lineStart > 0);
    assert.ok(Number.isInteger(s.lineEnd) && s.lineEnd >= s.lineStart);
  }
  for (const r of data.entries) {
    assert.ok(statuses.has(r.status));
    assert.ok(r.sourceRefs.length);
    assert.ok(r.sourceRefs.every(id => sources.has(id)));
    assert.ok(r.targets.every(t => routes.has(t.href.slice(1))));
    assert.ok(r.mediaKeys.every(key => mediaKeys.has(key)));
    assert.ok(Number.isInteger(r.count) && r.count > 0);
  }
  assert.doesNotMatch(JSON.stringify(data),/[CD]:[\\/]|@gmail\.com|https?:\/\/|\.x?apk\b/i);
});

test('filters work with ledger and full app context without changing availability status or mutating the records', () => {
  const before = JSON.stringify(data), missing = data.entries.filter(r => r.status === 'missing');
  assert.deepEqual(selectArtifactAvailability(data,{filter:'missing'}),missing);
  assert.deepEqual(selectArtifactAvailability({artifactAvailability:data},{filter:{status:'missing'}}),missing);
  assert.equal(selectArtifactAvailability(data,{filter:{group:'decoration',status:'registered-only'}}).length,4);
  assert.equal(selectArtifactAvailability(data,{filter:{query:'12_5'}})[0].id,'decor-12_5');
  assert.ok(selectArtifactAvailability(data,{filter:{target:'#experience'}}).every(r => r.targets.some(t => t.href === '#experience')));
  assert.equal(selectArtifactAvailability(data,{filter:{query:'no-such-artifact-abc'}}).length,0);
  assert.equal(selectArtifactAvailability(data,{filter:'invalid-status'}).length,0);
  assert.equal(JSON.stringify(data),before);
});

test('evidence table has keyboard-native toggles, labelled controls, local links and host filter hooks', () => {
  const dom = new JSDOM(renderArtifactAvailability({artifactAvailability:data},{filter:{status:'registered-only',group:'decoration'}}));
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('tbody tr').length,4);
  assert.equal(doc.querySelectorAll('th[scope="row"]').length,4);
  assert.equal(doc.querySelectorAll('thead th[scope="col"]').length,3);
  assert.ok(doc.querySelector('caption'));
  assert.equal(doc.querySelector('[data-artifact-filter="registered-only"]').getAttribute('aria-pressed'),'true');
  assert.equal(doc.querySelectorAll('[data-artifact-filter]').length,5);
  assert.ok(doc.querySelector('[data-artifact-group]').closest('label'));
  assert.ok(doc.querySelector('[data-artifact-query]').closest('label'));
  assert.ok(doc.querySelectorAll('.av-evidence > summary').length);
  assert.ok(doc.querySelector('.av-table-scroll[tabindex="0"]'));
  assert.ok([...doc.querySelectorAll('a')].every(a => a.getAttribute('href').startsWith('#')));
  assert.match(doc.body.textContent,/SHA-256/);
  assert.match(doc.body.textContent,/등록만 확인/);
  assert.equal(doc.querySelectorAll('img,video,iframe,script').length,0);
  dom.window.close();
});

test('renderer escapes untrusted labels and rejects executable targets; empty filters stay explicit', () => {
  const unsafe = structuredClone(data);
  unsafe.entries = [{...unsafe.entries[0],title:'<img src=x onerror=alert(1)>',claim:'<script>bad()</script>',
    targets:[{label:'bad',href:'javascript:alert(1)'},{label:'external',href:'https://example.test/'},{label:'safe',href:'#experience'}]}];
  const dom = new JSDOM(renderArtifactAvailability(unsafe));
  assert.equal(dom.window.document.querySelectorAll('script,img').length,0);
  assert.equal(dom.window.document.querySelectorAll('a').length,1);
  assert.match(dom.window.document.body.textContent,/<script>bad\(\)<\/script>/);
  assert.match(renderArtifactAvailability(data,{filter:{query:'no-such-artifact-abc'}}),/이 조건에 맞는 항목이 없습니다/);
  assert.match(renderArtifactAvailability(null),/장부를 준비/);
  dom.window.close();
});

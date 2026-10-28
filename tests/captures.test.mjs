import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderCaptures, selectCaptures} from '../src/capture-pages.mjs';

const capture = (overrides = {}) => ({key:'capture:test',kind:'image',src:'./assets/media/test.jpg',alt:'상점 캡처',source:'GH-S0001 · 사용자 기록',sourceId:'GH-S0001',origin:'observed-user-capture',category:'BM',version:null,observations:['가격과 잠금 상태를 확인했다.'],...overrides});
const data = {
  media:{entries:[capture(), capture({key:'effect:merge',kind:'video',src:'./assets/media/merge.mp4',poster:'./assets/media/merge-poster.jpg',category:'퍼즐',sourceId:'GH-V0089'}),capture({key:'asset:Coffee01',origin:'packaged-sprite'}),capture({key:'unsafe',src:'https://example.com/private.jpg'})]},
  facts:[{id:'CAP-001',kind:'capture',title:'캡처에서 확인한 상품',summary:'특정 계정의 표시 가격이다.',sourceIds:['GH-S0001'],unknowns:['전 계정 공통 조건'],sources:[]},{id:'STATIC-001',kind:'code',title:'정적 코드 규칙',summary:'별도 정적 분석',sources:[]}],
};

test('historical capture counts exclude packaged sprites and invalid media, and combine subject/format filters', () => {
  const all = selectCaptures(data);
  assert.equal(all.entries.length, 2);
  assert.equal(all.images, 1);
  assert.equal(all.videos, 1);
  assert.deepEqual(selectCaptures(data,{category:'퍼즐',kind:'video'}).rows.map(entry=>entry.key),['effect:merge']);
  assert.equal(selectCaptures(data,{category:'BM',kind:'video'}).rows.length,0);
  assert.equal(selectCaptures(data,{category:'bogus',kind:'bogus'}).rows.length,2);
});

test('gallery uses existing media dialog hooks, truthful boundary labels, and source-linked observation notes', () => {
  const dom = new JSDOM(renderCaptures(data));
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.capture-card').length,2);
  assert.equal(doc.querySelectorAll('video[autoplay]').length,0);
  assert.equal(doc.querySelector('[data-capture-category="all"]').getAttribute('aria-pressed'),'true');
  assert.equal(doc.querySelector('.capture-note [data-media-key]').dataset.mediaKey,'capture:test');
  assert.equal(doc.querySelectorAll('[data-evidence="STATIC-001"]').length,0);
  assert.ok(doc.body.textContent.includes('캡처 버전과 실제 촬영일은 미확인'));
  assert.ok(doc.body.textContent.includes('보석 80 단계의 구매와 이후 반복 여부는 확인하지 않았습니다'));
  assert.ok(doc.querySelector('[data-evidence="CAP-001"]'));
  assert.equal(doc.querySelectorAll('.capture-chain-steps>li').length,7);
  dom.window.close();
});

test('filter states render an accessible empty result and escape user-derived captions', () => {
  const escaped = {media:{entries:[capture({alt:'<script>alert(1)</script>',observations:['<img src=x onerror=alert(1)>'],source:'GH-S0001 " onclick="x'})]},facts:[]};
  const dom = new JSDOM(renderCaptures(escaped));
  assert.equal(dom.window.document.querySelectorAll('script,[onclick],[onerror]').length,0);
  assert.equal(dom.window.document.querySelector('.capture-card h3').textContent,'<script>alert(1)</script>');
  dom.window.close();
  const filtered = new JSDOM(renderCaptures(data,{category:'UI',kind:'video'}));
  assert.equal(filtered.window.document.querySelectorAll('.capture-card').length,0);
  assert.equal(filtered.window.document.querySelector('[data-capture-category="UI"]').getAttribute('aria-pressed'),'true');
  assert.equal(filtered.window.document.querySelector('[role="status"]').textContent,'조건에 맞는 자료 0개');
  assert.ok(filtered.window.document.querySelector('.empty-state'));
  filtered.window.close();
});

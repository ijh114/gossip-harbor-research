import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createAuditionBook,recordAudition,validAuditionBook,renderMediaAudition} from '../src/media-audition.mjs';
const refinement=JSON.parse(await readFile(new URL('../src/data/media-refinement.json',import.meta.url),'utf8')),clips=refinement.audio.clips;
test('audio playback does not claim listening; only explicit local attestations attach to exact asset hashes',()=>{
 const book=createAuditionBook(),before=structuredClone(refinement);assert.equal(validAuditionBook(book),true);
 assert.equal(recordAudition(book,clips,{clipId:clips[0].id,verdict:''}).ok,false);
 const out=recordAudition(book,clips,{clipId:clips[0].id,verdict:'heard',note:'직접 재생 후 사용자가 적은 메모',now:'2026-10-30T00:00:00Z'});assert.equal(out.ok,true);assert.equal(book.records.length,0);assert.equal(out.book.records[0].sha256,clips[0].sha256);assert.deepEqual(refinement,before);
 assert.equal(recordAudition(out.book,clips,{clipId:'not-an-asset',verdict:'heard'}).ok,false);
 const changed=structuredClone(clips);changed[0].sha256='b'.repeat(64);const next=recordAudition(out.book,changed,{clipId:clips[0].id,verdict:'uncertain'});assert.equal(next.book.records.length,2);
});
test('all14 bounded source excerpts retain controlled playback, literal notes, and no original-recording review claims',()=>{
 const out=recordAudition(createAuditionBook(),clips,{clipId:clips[0].id,verdict:'uncertain',note:'<img src=x onerror=alert(1)>'});const dom=new JSDOM(renderMediaAudition({refinement},out.book));
 try{const d=dom.window.document;assert.equal(d.querySelectorAll('audio').length,14);assert.ok([...d.querySelectorAll('audio')].every(a=>a.controls&&a.preload==='none'&&!a.autoplay));assert.equal(d.querySelectorAll('img').length,0);assert.equal(d.querySelector('textarea').value,'<img src=x onerror=alert(1)>');assert.match(d.body.textContent,/내 직접 청취 표시 0\/14개/);assert.match(d.body.textContent,/실제 녹화본110개/);}finally{dom.window.close();}
 assert.equal(refinement.audio.summary.recordingsListened,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {searchNotebook} from '../src/reader.mjs';
import {mergeResearch} from '../src/domain-model.mjs';

const data=mergeResearch(JSON.parse(await readFile(new URL('../src/data/research.json',import.meta.url))),JSON.parse(await readFile(new URL('../src/data/domains.json',import.meta.url))));
test('global research search covers chapters, source excerpts and exact product identifiers',()=>{
 assert.ok(searchNotebook(data,'난이도').chapters.some(d=>d.id==='difficulty'));
 assert.ok(searchNotebook(data,'pb#').facts.length>0);
 assert.equal(searchNotebook(data,'GETGEM_1').products[0].id,'getgem_1');
 assert.deepEqual(searchNotebook(data,'  '),{chapters:[],facts:[],products:[]});
 assert.equal(searchNotebook(data,'검색결과가없는문자열').facts.length,0);
});
test('reading palette maintains normal-text contrast on its paired surfaces',async()=>{
 const css=await readFile(new URL('../src/reading.css',import.meta.url),'utf8');
 const lum=hex=>{const parts=hex.replace('#','').match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return parts[0]*.2126+parts[1]*.7152+parts[2]*.0722;};
 for(const [fg,bg]of [['#202e2b','#f7f8f5'],['#526158','#f7f8f5'],['#526158','#edf1eb'],['#18564c','#ffffff'],['#ffffff','#18564c'],['#874223','#f8eee4'],['#5d5225','#f4f0dc']]){
  assert.ok(css.includes(fg)||['#ffffff','#edf1eb'].includes(fg));
  const ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);assert.ok(ratio>=4.5,`${fg} on ${bg}: ${ratio}`);
 }
 const font=await readFile(new URL('../src/assets/fonts/PretendardVariable.woff2',import.meta.url));assert.equal(font.subarray(0,4).toString(),'wOF2');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
test('published data preserves exact large source identities instead of lossy JavaScript integers',async()=>{
 const failures=[];
 function visit(value,path){if(typeof value==='number'&&Number.isInteger(value)&&!Number.isSafeInteger(value))failures.push(path);else if(value&&typeof value==='object')for(const [key,next]of Object.entries(value))visit(next,path+'.'+key);}
 for(const name of await readdir(new URL('../src/data/',import.meta.url))){if(!name.endsWith('.json'))continue;visit(JSON.parse(await readFile(new URL('../src/data/'+name,import.meta.url),'utf8')),name);}
 assert.deepEqual(failures,[],'64bit object identifiers must come from original string values, never rounded JS numbers');
});

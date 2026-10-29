import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {checklistFromMarkdown} from '../scripts/checklist-data.mjs';
import {renderMasterChecklist} from '../src/checklist-page.mjs';
const md=await readFile(new URL('../docs/MASTER-CHECKLIST.md',import.meta.url),'utf8');
test('the published checklist keeps all fixed IDs and matches the canonical document across LF/CRLF',async()=>{
 const c=checklistFromMarkdown(md),saved=JSON.parse(await readFile(new URL('../src/data/master-checklist.json',import.meta.url),'utf8'));
 assert.deepEqual(c,saved);assert.deepEqual(checklistFromMarkdown(md.replace(/\r\n/g,'\n').replace(/\n/g,'\r\n')),c);
 assert.equal(c.tasks.filter(t=>t.group===0).length,6);assert.equal(c.tasks.filter(t=>Number(t.id)>=3.04&&Number(t.id)<=3.13).length,10);
 for(const id of [2,3,4,5])assert.equal(c.groups.find(g=>g.id===id).status,'부분');
 assert.equal(c.tasks.find(t=>t.id==='8.06').status,'보류');
 assert.throws(()=>checklistFromMarkdown(md.replace('| 3.05 |','| 3.04 |')),/unique/);
});
test('status filtering retains the real acceptance criteria and escaped original content',()=>{
 const c=checklistFromMarkdown(md),dom=new JSDOM(renderMasterChecklist({masterChecklist:c},{status:'자료 필요'}));
 try{const d=dom.window.document;assert.equal(d.querySelectorAll('[data-checklist-id]').length,c.tasks.filter(t=>t.status==='자료 필요').length);assert.match(d.body.textContent,/최초 노출 원인/);assert.ok([...d.querySelectorAll('[data-checklist-id]')].every(n=>n.querySelector('[data-state]').dataset.state==='자료 필요'));assert.equal(d.querySelectorAll('script').length,0);}finally{dom.window.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {checklistFromMarkdown,replaceCurrentWork} from '../scripts/checklist-data.mjs';
import {replaceRemainders} from '../scripts/checklist-remainders.mjs';
import {renderMasterChecklist} from '../src/checklist-page.mjs';
const md=await readFile(new URL('../docs/MASTER-CHECKLIST.md',import.meta.url),'utf8'),c=checklistFromMarkdown(md);
const input={schemaVersion:1,assessedAt:'2026-10-30',tasks:c.tasks.filter(t=>[3,4].includes(t.group)).map(t=>({taskId:t.id,evidence:['src/'+t.id+'.mjs'],implementation:[],originalVerification:t.status==='완료'?[]:['원작 확인'],missingOperations:[],planningDecision:[]}))};
input.tasks.find(t=>t.taskId==='3.05').implementation=['구현 <img src=x onerror=alert(1)>'];input.tasks.find(t=>t.taskId==='3.14').missingOperations=['계정 확률표'];
test('all39 durable IDs have four categories, CRLF normalizes, and malformed/incomplete or completed-with-remainder assessments are rejected',()=>{
 const source=replaceRemainders(md,input),parsed=checklistFromMarkdown(source);assert.equal(parsed.remainderClassification.tasks.length,39);assert.deepEqual(checklistFromMarkdown(source.replace(/\n/g,'\r\n')),parsed);
 for(const mutate of [x=>x.tasks.pop(),x=>x.tasks[1]=x.tasks[0],x=>x.tasks[0].implementation.push('완료를 숨김'),x=>x.tasks[2].typo=[],x=>delete x.tasks[3].missingOperations]){const bad=structuredClone(input);mutate(bad);assert.throws(()=>checklistFromMarkdown(replaceRemainders(md,bad)));}
 const rotated=checklistFromMarkdown(replaceCurrentWork(source,{id:'next',date:'2026-10-31',title:'다음 작업',items:[]}));assert.deepEqual(rotated.remainderClassification,parsed.remainderClassification);assert.deepEqual(parsed.tasks,c.tasks);
});
test('remaining filters intersect status and current batch, escape evidence and never promote partial rows',()=>{
 const base=replaceRemainders(md,input),work={id:'current',date:'2026-10-30',title:'이번 검수',items:[{taskId:'3.05',summary:'구현 변경'}]},data={masterChecklist:checklistFromMarkdown(replaceCurrentWork(base,work))};
 const dom=new JSDOM(renderMasterChecklist(data,{status:'부분',currentOnly:true,remainingCategory:'implementation'}));try{const d=dom.window.document;assert.equal(d.querySelectorAll('[data-checklist-id]').length,1);assert.equal(d.querySelector('[data-checklist-id="3.05"] [data-state]').textContent,'부분');assert.equal(d.querySelectorAll('img').length,0);assert.match(d.body.textContent,/<img src=x/);assert.equal(d.querySelectorAll('[data-remainder-category]').length,4);assert.ok(d.querySelector('[data-checklist-remaining]'));}finally{dom.window.close();}
 const clear=new JSDOM(renderMasterChecklist(data,{remainingCategory:'implementation-clear'}));try{assert.equal(clear.window.document.querySelectorAll('[data-checklist-id]').length,38);assert.ok(clear.window.document.querySelector('[data-checklist-id="3.14"]'));assert.equal(clear.window.document.querySelector('[data-checklist-id="0.03"]'),null);}finally{clear.window.close();}
});

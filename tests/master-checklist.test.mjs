import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {checklistFromMarkdown,replaceCurrentWork} from '../scripts/checklist-data.mjs';
import {renderMasterChecklist} from '../src/checklist-page.mjs';
const md=await readFile(new URL('../docs/MASTER-CHECKLIST.md',import.meta.url),'utf8');
const markerFixture={id:'fixture-work',date:'2026-10-30',title:'태그 교체 검사',items:[{taskId:'0.04',summary:'이번 네이티브 필드 조사'},{taskId:'0.05',summary:'이번 체크리스트 표시 수정'}]};
const markerMD=replaceCurrentWork(md,markerFixture);
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
test('latest changes are marked beside existing status and current-work filtering intersects status without promoting partial work',()=>{
 const c=checklistFromMarkdown(markerMD);c.tasks.find(t=>t.id==='0.04').status='부분';c.tasks.find(t=>t.id==='0.05').status='완료';const dom=new JSDOM(renderMasterChecklist({masterChecklist:c},{currentOnly:true}));
 try{const d=dom.window.document,rows=[...d.querySelectorAll('[data-checklist-id]')];
  assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.dataset.checklistId),c.currentWork.items.map(i=>i.taskId));
  for(const row of rows){const change=c.currentWork.items.find(i=>i.taskId===row.dataset.checklistId);assert.equal(row.querySelectorAll('.checklist-statuses [data-current-work-tag]').length,1);assert.match(row.querySelector('.checklist-work-note').textContent,new RegExp(change.summary.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));}
  assert.equal(d.querySelector('[data-checklist-id="0.04"] [data-state]').dataset.state,'부분');assert.equal(d.querySelector('[data-checklist-current-only]').checked,true);
  assert.match(d.body.textContent,/2 \/ 100항목/);
 }finally{dom.window.close();}
 const filtered=new JSDOM(renderMasterChecklist({masterChecklist:c},{status:'완료',currentOnly:true}));
 try{assert.equal(filtered.window.document.querySelectorAll('[data-checklist-id]').length,1);assert.ok([...filtered.window.document.querySelectorAll('[data-checklist-id] [data-state]')].every(n=>n.dataset.state==='완료'));}finally{filtered.window.close();}
 const empty=new JSDOM(renderMasterChecklist({masterChecklist:c},{status:'자료 필요',currentOnly:true}));
 try{assert.equal(empty.window.document.querySelectorAll('[data-checklist-id]').length,0);assert.match(empty.window.document.querySelector('.checklist-empty').textContent,/조건에 해당하는 항목이 없습니다/);}finally{empty.window.close();}
});
test('starting the next batch removes all previous badges and notes but retains100 task states and completion criteria',()=>{
 const before=checklistFromMarkdown(markerMD),next={id:'next-work',date:'2026-10-31',title:'다음 작업',items:[{taskId:'5.03',summary:'새 변경 <img src=x onerror=alert(1)>'}]};
 const source=replaceCurrentWork(markerMD,next),after=checklistFromMarkdown(source);
 assert.deepEqual(after.tasks,before.tasks);assert.deepEqual(after.groups,before.groups);assert.deepEqual(after.currentWork,next);assert.notEqual(after.sourceSha256,before.sourceSha256);assert.equal(source.includes(before.currentWork.id),false);
 const dom=new JSDOM(renderMasterChecklist({masterChecklist:after}));
 try{const d=dom.window.document;assert.equal(d.querySelectorAll('[data-checklist-id] [data-current-work-tag]').length,1);assert.equal(d.querySelectorAll('[data-checklist-id="0.04"] .checklist-work-note').length,0);assert.equal(d.querySelector('[data-checklist-id="5.03"] .checklist-work-note img'),null);assert.match(d.querySelector('[data-checklist-id="5.03"] .checklist-work-note').textContent,/<img src=x/);assert.equal(d.querySelector('[data-checklist-id="0.03"] [data-current-work-tag]'),null);}finally{dom.window.close();}
 const cleared=checklistFromMarkdown(replaceCurrentWork(source,{...next,id:'new-batch-start',items:[]}));
 const clearDOM=new JSDOM(renderMasterChecklist({masterChecklist:cleared}));try{assert.equal(clearDOM.window.document.querySelectorAll('[data-checklist-id] [data-current-work-tag],.checklist-work-note').length,0);assert.deepEqual(cleared.tasks,before.tasks);}finally{clearDOM.window.close();}
});
test('current-work replacements reject unknown or duplicate task IDs and malformed source blocks',()=>{
 const work=markerFixture;
 assert.throws(()=>replaceCurrentWork(md,{...work,items:[{taskId:'9.99',summary:'없는 작업'}]}),/Unknown/);
 assert.throws(()=>replaceCurrentWork(md,{...work,items:[work.items[0],work.items[0]]}),/duplicate/);
 assert.throws(()=>replaceCurrentWork(md,{...work,items:[{taskId:'0.03',summary:' '}]}),/empty/);
 assert.throws(()=>checklistFromMarkdown(md+'\n<!-- checklist-current-work:start -->'),/exactly one/);
});

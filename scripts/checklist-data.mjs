import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {remaindersFromMarkdown,replaceRemainders} from './checklist-remainders.mjs';
const states=['완료','부분','미완료','자료 필요','결정 필요','보류','선택 범위','제외'];
const workStart='<!-- checklist-current-work:start -->',workEnd='<!-- checklist-current-work:end -->';
function currentWorkFromMarkdown(markdown,tasks){
 const starts=markdown.split(workStart).length-1,ends=markdown.split(workEnd).length-1;
 if(!starts&&!ends)return null;
 if(starts!==1||ends!==1)throw Error('Keep exactly one current-work block');
 const block=markdown.slice(markdown.indexOf(workStart)+workStart.length,markdown.indexOf(workEnd)).trim();
 const match=/^```json\n([\s\S]+)\n```$/.exec(block);
 if(!match)throw Error('Invalid current-work block');
 const work=JSON.parse(match[1]);
 if(!work||typeof work.id!=='string'||!/^[a-z0-9-]+$/.test(work.id)||typeof work.title!=='string'||!work.title.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(work.date)||!Array.isArray(work.items))throw Error('Invalid current-work metadata');
 const ids=new Set();
 for(const item of work.items){
  if(!tasks.some(t=>t.id===item.taskId)||ids.has(item.taskId)||typeof item.summary!=='string'||!item.summary.trim())throw Error('Unknown, duplicate or empty current-work item');
  ids.add(item.taskId);
 }
 return work;
}
export function checklistFromMarkdown(markdown){
 const normalized=markdown.replace(/\r\n/g,'\n'),groups=[],tasks=[];
 for(const line of normalized.split('\n')){
  const cells=line.split('|').slice(1,-1).map(s=>s.trim());if(cells.length<3)continue;
  if(/^\d\.\d\d$/.test(cells[0])){if(!states.includes(cells[1]))throw Error('Unknown checklist state '+cells[0]);tasks.push({id:cells[0],group:Number(cells[0][0]),status:cells[1],title:cells[2],acceptance:cells.slice(3).join(' | ')});}
  else if(/^\d /.test(cells[0])&&cells.length===3)groups.push({id:Number(cells[0][0]),title:cells[0].slice(2),status:cells[1],remaining:cells[2]});
 }
 if(tasks.length!==100||new Set(tasks.map(t=>t.id)).size!==100||groups.length!==9)throw Error('Master checklist must retain 100 unique tasks and 9 groups');
 if(tasks.some(t=>!groups.some(g=>g.id===t.group)))throw Error('Task group missing');
 const remainderClassification=remaindersFromMarkdown(normalized,tasks);
 return {schemaVersion:1,reviewDate:normalized.match(/^기준일:\s*(\d{4}-\d{2}-\d{2})/m)?.[1]??null,source:'docs/MASTER-CHECKLIST.md',sourceHashPolicy:'UTF-8/LF',sourceSha256:createHash('sha256').update(normalized).digest('hex'),states,groups,tasks,currentWork:currentWorkFromMarkdown(normalized,tasks),remainderClassification,boundaries:['미완료 하위 항목이 남은 상위 작업을 완료로 표시하지 않습니다.','자동 검사·정적 규칙·연구 입력·원작 관측은 서로 다른 검증 범위입니다.','선택 범위와 사용자 요청으로 보류한 작업은 구현 완료로 계산하지 않습니다.']};
}
export function replaceCurrentWork(markdown,work){
 const normalized=markdown.replace(/\r\n/g,'\n');
 checklistFromMarkdown(normalized);
 const block=workStart+'\n```json\n'+JSON.stringify(work,null,2)+'\n```\n'+workEnd;
 let next;
 if(normalized.includes(workStart))next=normalized.slice(0,normalized.indexOf(workStart))+block+normalized.slice(normalized.indexOf(workEnd)+workEnd.length);
 else {if(!normalized.includes('## 상위 상태'))throw Error('Missing checklist insertion point');next=normalized.replace('## 상위 상태',block+'\n\n## 상위 상태');}
 checklistFromMarkdown(next);
 return next;
}
export async function syncChecklist(){const source=new URL('../docs/MASTER-CHECKLIST.md',import.meta.url),target=new URL('../src/data/master-checklist.json',import.meta.url),data=checklistFromMarkdown(await readFile(source,'utf8'));await writeFile(target,JSON.stringify(data,null,2)+'\n');return data;}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(new URL('file:///'+process.argv[1].replaceAll('\\','/')))){
 if(process.argv[2]==='--remainders'){
  if(!process.argv[3])throw Error('Provide remainder classification JSON');
  const source=new URL('../docs/MASTER-CHECKLIST.md',import.meta.url),value=JSON.parse(await readFile(process.argv[3],'utf8'));
  const next=replaceRemainders(await readFile(source,'utf8'),value);checklistFromMarkdown(next);await writeFile(source,next);
 }
 if(process.argv[2]==='--current-work'){
  if(!process.argv[3])throw Error('Provide a JSON file containing id, date, title and items');
  const source=new URL('../docs/MASTER-CHECKLIST.md',import.meta.url),work=JSON.parse(await readFile(process.argv[3],'utf8'));
  await writeFile(source,replaceCurrentWork(await readFile(source,'utf8'),work));
 }
 await syncChecklist();
}

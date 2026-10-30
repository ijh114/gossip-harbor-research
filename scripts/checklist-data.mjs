import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const states=['완료','부분','미완료','자료 필요','결정 필요','보류','선택 범위','제외'];
export function checklistFromMarkdown(markdown){
 const normalized=markdown.replace(/\r\n/g,'\n'),groups=[],tasks=[];
 for(const line of normalized.split('\n')){
  const cells=line.split('|').slice(1,-1).map(s=>s.trim());if(cells.length<3)continue;
  if(/^\d\.\d\d$/.test(cells[0])){if(!states.includes(cells[1]))throw Error('Unknown checklist state '+cells[0]);tasks.push({id:cells[0],group:Number(cells[0][0]),status:cells[1],title:cells[2],acceptance:cells.slice(3).join(' | ')});}
  else if(/^\d /.test(cells[0])&&cells.length===3)groups.push({id:Number(cells[0][0]),title:cells[0].slice(2),status:cells[1],remaining:cells[2]});
 }
 if(tasks.length!==100||new Set(tasks.map(t=>t.id)).size!==100||groups.length!==9)throw Error('Master checklist must retain 100 unique tasks and 9 groups');
 if(tasks.some(t=>!groups.some(g=>g.id===t.group)))throw Error('Task group missing');
 return {schemaVersion:1,reviewDate:normalized.match(/^기준일:\s*(\d{4}-\d{2}-\d{2})/m)?.[1]??null,source:'docs/MASTER-CHECKLIST.md',sourceHashPolicy:'UTF-8/LF',sourceSha256:createHash('sha256').update(normalized).digest('hex'),states,groups,tasks,boundaries:['미완료 하위 항목이 남은 상위 작업을 완료로 표시하지 않습니다.','자동 검사·정적 규칙·연구 입력·원작 관측은 서로 다른 검증 범위입니다.','선택 범위와 사용자 요청으로 보류한 작업은 구현 완료로 계산하지 않습니다.']};
}
export async function syncChecklist(){const source=new URL('../docs/MASTER-CHECKLIST.md',import.meta.url),target=new URL('../src/data/master-checklist.json',import.meta.url),data=checklistFromMarkdown(await readFile(source,'utf8'));await writeFile(target,JSON.stringify(data,null,2)+'\n');return data;}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(new URL('file:///'+process.argv[1].replaceAll('\\','/'))))await syncChecklist();

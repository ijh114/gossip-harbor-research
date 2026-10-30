export const REMAINDER_CATEGORIES=[
 {id:'implementation',label:'구현 잔여',description:'현재 확보한 코드·설정·자산으로 추가 구현하거나 검사할 작업'},
 {id:'originalVerification',label:'원작 검증',description:'원본 동작·표현·입력·직접 청취와 대조할 조건. 정적 해석의 미확정도 포함'},
 {id:'missingOperations',label:'운영값 미확보',description:'계정·서버가 배정하는 실제 가격·확률·일정·상품·목표/보상표'},
 {id:'planningDecision',label:'기획 결정',description:'신규 게임의 제작 범위·가격·밸런스·콘텐츠를 확정할 조건'}
];
const start='<!-- checklist-remainders:start -->',end='<!-- checklist-remainders:end -->';
export function remaindersFromMarkdown(markdown,tasks){
 if(!markdown.includes(start)&&!markdown.includes(end))return null;
 if(markdown.split(start).length!==2||markdown.split(end).length!==2)throw Error('Keep exactly one remainder classification block');
 const section=markdown.slice(markdown.indexOf(start)+start.length,markdown.indexOf(end)).trim(),match=/^```json\n([\s\S]+)\n```$/.exec(section);if(!match)throw Error('Invalid remainder block');
 const value=JSON.parse(match[1]),expected=tasks.filter(t=>[3,4].includes(t.group)).map(t=>t.id),seen=new Set();
 if(value?.schemaVersion!==1||!/^\d{4}-\d{2}-\d{2}$/.test(value.assessedAt)||!Array.isArray(value.tasks)||value.tasks.length!==expected.length)throw Error('Classify every existing3/4 task exactly once');
 for(const row of value.tasks){if(!expected.includes(row.taskId)||seen.has(row.taskId)||Object.keys(row).some(k=>!['taskId','evidence',...REMAINDER_CATEGORIES.map(c=>c.id)].includes(k)))throw Error('Unknown or duplicate remainder task');seen.add(row.taskId);
  for(const category of REMAINDER_CATEGORIES){const entries=row[category.id];if(!Array.isArray(entries)||entries.some(x=>typeof x!=='string'||!x.trim()||x.length>1500)||new Set(entries).size!==entries.length)throw Error('Invalid remainder entries '+row.taskId);}
  if(!Array.isArray(row.evidence)||row.evidence.some(p=>typeof p!=='string'||!p.trim()||p.length>500))throw Error('Remainder evidence references required');
  if(tasks.find(t=>t.id===row.taskId).status==='완료'&&REMAINDER_CATEGORIES.some(c=>row[c.id].length))throw Error('Completed row cannot hide required remaining conditions '+row.taskId);
 }
 return {...value,categories:REMAINDER_CATEGORIES};
}
export function replaceRemainders(markdown,value){
 const normalized=markdown.replace(/\r\n/g,'\n'),block=start+'\n```json\n'+JSON.stringify(value,null,2)+'\n```\n'+end;
 if(normalized.includes(start))return normalized.slice(0,normalized.indexOf(start))+block+normalized.slice(normalized.indexOf(end)+end.length);
 return normalized.replace('## 상위 상태',block+'\n\n## 상위 상태');
}

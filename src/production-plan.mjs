// Original project planning, separate from the source game's resource inventory.
export const PLAN_STORAGE_KEY='harbor-production-plan-v1';
const maxQuantity=10000;
const clean=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
export const productionPresetNotes=id=>({core:'MVP: 기본 퍼즐·첫 맵 구역·기본 상점부터 제작합니다. 수량·규격은 제작 범위 협의용 초안입니다.',launch:'MVP 기반 + 패스·앨범·대표 이벤트 1종. 수량·규격은 제작 범위 협의용 초안입니다.',expansion:'출시형에 추가 챕터·시즌 테마·다른 미니게임을 후속 범위로 검토합니다. 수량·규격은 협의용 초안입니다.'}[id]||'수량·규격은 제작 범위 협의용 초안입니다.');
export function createProductionPlan(data,presetId='launch'){
 const preset=data.presets.find(p=>p.id===presetId)||data.presets[0],phases=preset.phases||[preset.id];
 return {schema:1,preset:preset.id,projectName:'신규 머지 게임',notes:productionPresetNotes(preset.id),rows:Object.fromEntries(data.rows.map(r=>[r.id,{included:phases.includes(r.phase),quantity:r.defaultQuantity,dimensions:typeof r.proposal?.dimensions==='string'?r.proposal.dimensions:JSON.stringify(r.proposal?.dimensions||''),notes:''}]))};
}
export function restoreProductionPlan(data,value){
 if(!value||value.schema!==1||!data.presets.some(p=>p.id===value.preset)||typeof value.rows!=='object'||!value.rows)return null;
 const plan=createProductionPlan(data,value.preset);plan.projectName=clean(value.projectName,120)||plan.projectName;plan.notes=clean(value.notes,4000);
 for(const row of data.rows){const saved=value.rows[row.id];if(!saved)continue;if(typeof saved.included!=='boolean'||!Number.isInteger(saved.quantity)||saved.quantity<0||saved.quantity>maxQuantity)return null;plan.rows[row.id]={included:saved.included,quantity:saved.quantity,dimensions:clean(saved.dimensions,500),notes:clean(saved.notes,2000)};}
 return plan;
}
export function updateProductionRow(plan,id,key,value){
 if(!Object.hasOwn(plan.rows,id))return false;
 if(key==='included'){if(typeof value!=='boolean')return false;plan.rows[id].included=value;return true;}
 if(key==='quantity'){if(!Number.isInteger(value)||value<0||value>maxQuantity)return false;plan.rows[id].quantity=value;return true;}
 if(['dimensions','notes'].includes(key)){plan.rows[id][key]=clean(value,key==='dimensions'?500:2000);return true;}
 return false;
}
export function selectedProductionRows(data,plan){return data.rows.filter(r=>plan.rows[r.id]?.included).map(r=>({...r,request:plan.rows[r.id]}));}
export function productionTotals(data,plan){
 const selected=selectedProductionRows(data,plan),units={},phases={};
 for(const r of selected){units[r.unit]=(units[r.unit]||0)+r.request.quantity;phases[r.phase]=(phases[r.phase]||0)+1;}
 const missingDependencies=[...new Set(selected.flatMap(r=>(r.dependencies||[]).filter(id=>!plan.rows[id]?.included)))].map(id=>data.rows.find(r=>r.id===id)?.title||id);
 return {selected:selected.length,units,phases,zeroQuantity:selected.filter(r=>r.request.quantity===0).map(r=>r.title),missingDependencies};
}
const line=v=>String(v??'').replace(/[\r\n]+/g,' · ');
const csvCell=v=>{const text=line(v);return '"'+(/^[\s]*[=+\-@]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';};
export function exportProductionCSV(data,plan){
 const headers=['프로젝트','공통제작요청','항목ID','분류','제작항목','제작단계','요청수량','단위','수량의미','요청규격(초안)','필요상태','납품물','원작관측','제안포맷','추가요청','미확인사항','조사출처'];
 return '\uFEFF'+[headers,...selectedProductionRows(data,plan).map(r=>[plan.projectName,plan.notes,r.id,data.categories.find(c=>c.id===r.category)?.name||r.category,r.title,({core:'MVP 기반',launch:'출시형 추가',expansion:'장기 확장'})[r.phase]||r.phase,r.request.quantity,r.unit,r.quantityBasis,r.request.dimensions,(r.requiredStates||[]).join(' / '),(r.deliverables||[]).join(' / '),r.observed?.summary,typeof r.proposal?.format==='string'?r.proposal.format:JSON.stringify(r.proposal?.format||''),r.request.notes,(r.unknowns||[]).join(' / '),(r.sources||[]).map(s=>s.path+' · SHA256 '+s.sha256).join(' / ')])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function exportProductionMarkdown(data,plan){
 const selected=selectedProductionRows(data,plan),totals=productionTotals(data,plan);
 return `# ${line(plan.projectName)} · 리소스 제작 요청 초안\n\n${plan.notes}\n\n이 문서는 신규 제작 계획입니다. 원작 리소스 수량·완성 규격·제작 공수 견적을 뜻하지 않습니다. 이미지·세트·클립·곡은 서로 다른 단위이므로 합산하지 않습니다. 참고 이미지는 조사용이며 새 게임에는 별도 제작합니다.\n\n선택 항목 ${totals.selected}개 · ${Object.entries(totals.units).map(([u,n])=>n+' '+u).join(' / ')}\n\n`+selected.map(r=>`## ${r.title} · ${r.id}\n\n- 분류/단계: ${r.category} / ${r.phase}\n- 수량: ${r.request.quantity} ${r.unit} (${r.quantityBasis})\n- 용도: ${r.purpose}\n- 요청 규격 초안: ${r.request.dimensions}\n- 원작 관측: ${r.observed?.summary||'미확인'}\n- 상태/변형: ${(r.requiredStates||[]).join(' / ')}\n- 납품물: ${(r.deliverables||[]).join(' / ')}\n- 제안 포맷: ${line(typeof r.proposal?.format==='string'?r.proposal.format:JSON.stringify(r.proposal?.format||''))}\n- 추가 요청: ${r.request.notes||'없음'}\n- 미확인: ${(r.unknowns||[]).join(' / ')||'없음'}\n- 근거: ${(r.sources||[]).map(s=>s.path+' · SHA256 '+s.sha256).join('; ')}\n`).join('\n')+'\n## 납품 확인\n\n- 레이어 분리 원본과 투명 배경 출력물을 함께 납품\n- 파일명·버전·피벗·9-slice·스케일·여백·애니메이션 이벤트 문서 동봉\n- UI 작은 화면, 밝고 어두운 배경, 한국어 긴 문자열에서 확인\n- 아틀라스 압축·음원 루프·메모리 예산은 Unity 실기 테스트 후 확정\n';
}
export function exportProductionJSON(data,plan){return {kind:'original-game-production-request-draft',schemaVersion:1,projectName:plan.projectName,preset:plan.preset,notes:plan.notes,boundary:'New project proposal, not source game counts or final production estimate',totals:productionTotals(data,plan),rows:selectedProductionRows(data,plan)};}

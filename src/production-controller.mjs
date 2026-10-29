import {PLAN_STORAGE_KEY,createProductionPlan,productionPresetNotes,restoreProductionPlan,updateProductionRow,exportProductionCSV,exportProductionMarkdown,exportProductionJSON} from './production-plan.mjs';
import {renderProductionAssets,renderProductionSummary} from './production-page-assets.mjs';
export function createProductionController({getData,render,download,toast}){
 let plan,loaded=false;const filters={category:'all',query:''},invalidQuantities=new Map();
 function ensure(){const data=getData()?.productionAssets;if(!data)return null;if(!loaded){loaded=true;plan=createProductionPlan(data);try{const raw=window.localStorage.getItem(PLAN_STORAGE_KEY);if(raw){const restored=restoreProductionPlan(data,JSON.parse(raw));if(restored)plan=restored;else window.localStorage.setItem(PLAN_STORAGE_KEY+'-previous',raw);}}catch{/* Keep the in-memory draft usable when storage is blocked. */}}return data;}
 function save(){let ok=true;try{window.localStorage.setItem(PLAN_STORAGE_KEY,JSON.stringify(plan));}catch{ok=false;}const status=document.querySelector('[data-production-save]');if(status)status.textContent=ok?'제작 초안을 이 브라우저에 저장했습니다.':'브라우저 저장을 사용할 수 없습니다. 요청서를 내려받아 보관하세요.';}
 function summary(){const target=document.querySelector('#production-summary');if(target)target.innerHTML=renderProductionSummary(ensure(),plan);}
 function rerenderFocus(selector){render();document.querySelector(selector)?.focus({preventScroll:true});}
 document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const data=ensure();if(!data)return;
  if(button.dataset.productionPreset){const preset=data.presets.find(p=>p.id===button.dataset.productionPreset);if(!preset)return;if(plan.notes===productionPresetNotes(plan.preset))plan.notes=productionPresetNotes(preset.id);plan.preset=preset.id;for(const row of data.rows)plan.rows[row.id].included=(preset.phases||[preset.id]).includes(row.phase);save();rerenderFocus(`[data-production-preset="${preset.id}"]`);return;}
  if(button.dataset.productionExport){const kind=button.dataset.productionExport;const invalid=data.rows.find(r=>plan.rows[r.id].included&&invalidQuantities.has(r.id));if(invalid){filters.category='all';filters.query='';rerenderFocus(`[data-production-quantity="${invalid.id}"]`);const field=document.querySelector(`[data-production-quantity="${invalid.id}"]`);field?.setCustomValidity('0부터 10,000 사이 정수를 입력하세요.');field?.reportValidity();toast(`${invalid.title}의 요청 수량을 수정한 뒤 내려받으세요.`);return;}if(!data.rows.some(r=>plan.rows[r.id].included)){toast('요청서에 포함할 제작 항목을 먼저 선택하세요.');return;}if(kind==='md')download('new-game-resource-request.md',exportProductionMarkdown(data,plan),'text/markdown');if(kind==='csv')download('new-game-resource-tasks.csv',exportProductionCSV(data,plan),'text/csv');if(kind==='json')download('new-game-resource-request.json',exportProductionJSON(data,plan));toast('선택한 제작 항목의 요청서를 내려받았습니다.');}
 });
 document.addEventListener('change',event=>{const target=event.target;if(!target.closest('[data-production-row],.production-filter'))return;const data=ensure();if(!data)return;
  if(target.hasAttribute('data-production-include')){updateProductionRow(plan,target.dataset.productionInclude,'included',target.checked);target.closest('[data-production-row]').classList.toggle('is-included',target.checked);save();summary();}
  if(target.hasAttribute('data-production-category')){filters.category=target.value;rerenderFocus('[data-production-category]');}
 });
 document.addEventListener('input',event=>{const t=event.target;if(!t.closest('.production-row,.production-filter,.production-project'))return;const data=ensure();if(!data)return;
  if(t.hasAttribute('data-production-search')){if(event.isComposing)return;const selection=t.selectionStart;filters.query=t.value;rerenderFocus('[data-production-search]');const input=document.querySelector('[data-production-search]');input.setSelectionRange(selection,selection);return;}
  if(t.hasAttribute('data-production-quantity')){const id=t.dataset.productionQuantity,ok=t.value!==''&&updateProductionRow(plan,id,'quantity',Number(t.value));if(ok)invalidQuantities.delete(id);else invalidQuantities.set(id,t.value);t.setCustomValidity(ok?'':'0부터 10,000 사이 정수를 입력하세요.');t.setAttribute('aria-invalid',String(!ok));if(ok){save();summary();}return;}
  if(t.hasAttribute('data-production-dimensions'))updateProductionRow(plan,t.dataset.productionDimensions,'dimensions',t.value);
  if(t.hasAttribute('data-production-notes'))updateProductionRow(plan,t.dataset.productionNotes,'notes',t.value);
  if(t.hasAttribute('data-production-project'))plan.projectName=t.value;
  if(t.hasAttribute('data-production-project-notes'))plan.notes=t.value;
  save();
 });
 return {renderPage(){ensure();return renderProductionAssets(getData(),plan,filters,invalidQuantities);}};
}

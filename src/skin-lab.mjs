// Selected packaged skin groups; ownership is explicit research input.
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const rows=c=>c.groups.flatMap(g=>g.skins.map(s=>({...s,groupId:g.id})));
const row=(c,id)=>rows(c).find(s=>s.id===id);
const out=(ok,message,extra={})=>({ok,message,...extra});
export function createSkinLab(c){return {schema:1,revision:c.revision,groupId:c.groups[0].id,selected:c.groups[0].skins[0].id,owned:[],slots:{},edit:null,researchGrants:0};}
export function validSkinLab(s,c){try{
 const all=rows(c),ids=new Set(all.map(r=>r.id)),slotIds=new Set(all.map(r=>r.slot));
 const slots=v=>object(v)&&Object.entries(v).every(([k,x])=>slotIds.has(k)&&all.some(r=>r.slot===k&&r.itemId===x));
 if(!object(s)||s.schema!==1||s.revision!==c.revision||!c.groups.some(g=>g.id===s.groupId)||!ids.has(s.selected)||!Array.isArray(s.owned)||new Set(s.owned).size!==s.owned.length||s.owned.some(x=>!ids.has(x))||!slots(s.slots)||!Number.isSafeInteger(s.researchGrants)||s.researchGrants<0)return false;
 if(s.edit!==null){if(!object(s.edit)||!ids.has(s.edit.skinId)||!['single','whole'].includes(s.edit.kind)||!slots(s.edit.preview)||!object(s.edit.original))return false;for(const [k,v]of Object.entries(s.edit.original))if(!slotIds.has(k)||!(v===null||all.some(r=>r.slot===k&&r.itemId===v)))return false;const r=row(c,s.edit.skinId),members=s.edit.kind==='single'?[r]:c.groups.find(g=>g.id===r.groupId).skins;if(Object.keys(s.edit.preview).length!==members.length||Object.keys(s.edit.original).length!==members.length||members.some(m=>s.edit.preview[m.slot]!==m.itemId||!Object.hasOwn(s.edit.original,m.slot)))return false;}
 return true;
}catch{return false;}}
export function skinLabAction(s,action,value,c){
 if(!validSkinLab(s,c))return out(false,'장식 연구 저장을 보존 중입니다. 백업 후 연구 상태를 초기화하세요.');
 if(action==='select'){if(s.edit)return out(false,'현재 미리보기를 취소하거나 확정한 뒤 다른 장식을 선택하세요.');const r=row(c,value);if(!r)return out(false,'선정한 장식 ID가 아닙니다.');s.selected=r.id;s.groupId=r.groupId;return out(true,'선택한 동봉 장식을 확인합니다.');}
 const r=row(c,s.selected),members=c.groups.find(g=>g.id===r.groupId).skins;
 if(action==='acquire'||action==='acquire-set'){
  const added=(action==='acquire'?[r]:members).filter(x=>!s.owned.includes(x.id));for(const x of added)s.owned.push(x.id);s.researchGrants+=added.length;
  return out(true,'연구 소유권을 명시했습니다. 원작 지급·구매·메인 재화 변동은 없습니다.',{acquired:added.map(x=>x.id)});
 }
 if(action==='preview'||action==='preview-set'){
  if(s.edit)return out(false,'현재 미리보기를 취소하거나 확정한 뒤 다른 장식을 확인하세요.');
  const targets=action==='preview'?[r]:members;s.edit={skinId:r.id,kind:action==='preview'?'single':'whole',original:Object.fromEntries(targets.map(x=>[x.slot,s.slots[x.slot]??null])),preview:Object.fromEntries(targets.map(x=>[x.slot,x.itemId]))};return out(true,'선정 장식 ID의 적용 관계를 미리 봅니다. 실제 그림·완성 맵 렌더는 미확보입니다.');
 }
 if(action==='cancel'){if(!s.edit)return out(false,'열린 미리보기가 없습니다.');s.edit=null;return out(true,'연동 슬롯 미리보기를 취소했습니다. 기존 기록은 그대로입니다.');}
 if(action==='confirm'){
  if(!s.edit)return out(false,'먼저 장식을 미리 보세요.');const edit=s.edit,chosen=row(c,edit.skinId),targets=edit.kind==='single'?[chosen]:c.groups.find(g=>g.id===chosen.groupId).skins;
  if(targets.some(x=>!s.owned.includes(x.id)))return out(false,'소유를 명시하지 않은 장식이 있습니다. 미리보기만 가능하며 적용·구매하지 않습니다.');
  if(Object.entries(edit.original).some(([k,v])=>(s.slots[k]??null)!==v))return out(false,'편집 중 슬롯 기록이 변경됐습니다. 취소하고 다시 열어주세요.');
  Object.assign(s.slots,edit.preview);s.edit=null;return out(true,'장식 연구의 슬롯 기록만 확정했습니다. 과제·지갑·보상은 변하지 않습니다.');
 }
 return out(false,'지원하는 장식 연구 행동이 아닙니다.');
}
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderSkinLab(s,c){
 if(!c)return '<p>장식 연구 자료를 준비하고 있습니다.</p><button class="game-button" data-play="game-skins-close">메인 맵으로</button>';
 if(!validSkinLab(s,c))return '<section data-game-screen="skins"><h2>장식 연구 저장을 보존했습니다</h2><p>현재 상태 JSON을 보관한 뒤 장식 연구만 초기화하세요.</p><button class="game-button" data-play="export">상태 JSON</button><button class="game-button" data-play="skin:reset-invalid">백업 후 장식 연구 초기화</button><button class="game-button" data-play="game-skins-close">기존 저장을 유지하고 맵으로</button></section>';
 const selected=row(c,s.selected),g=c.groups.find(g=>g.id===selected.groupId),edit=s.edit;
 const button=(a,label,disabled=false)=>`<button class="game-button" data-play="skin:${a}"${disabled?' disabled':''}>${label}</button>`;
 return `<section class="skin-lab" data-game-screen="skins"><h2>Skin 소유권·연동 슬롯 연구</h2><p>동봉 2세트·26장식의 등록을 사용합니다. 소유권은 연구 입력이며 메인 과제·지갑과 별도입니다. 실물 그림은 미확보입니다.</p><label>장식 선택<select data-skin-select>${rows(c).map(r=>`<option value="${e(r.id)}"${s.selected===r.id?' selected':''}>${e(r.groupId)} · ${e(r.slot)} · Skin ${e(r.id)}</option>`).join('')}</select></label><p>선택 ${e(selected.id)} · ${e(g.area)} · ${s.owned.includes(selected.id)?'연구 소유 명시':'미소유 · 미리보기만 가능'}</p><div class="game-tool-actions">${button('acquire','선택 장식 소유 명시')}${button('acquire-set','선정 세트 전체 소유 명시')}${button('preview','단일 장식 미리보기',Boolean(edit))}${button('preview-set','연동 세트 미리보기',Boolean(edit))}</div>${edit?`<p role="status">미리보기: ${edit.kind==='whole'?'연동 세트':'단일 슬롯'} · 아직 저장된 디자인은 바뀌지 않았습니다.</p><div class="game-tool-actions">${button('confirm','미리보기 확정')}${button('cancel','취소 · 기존 기록 유지')}</div>`:''}<div class="skin-slot-table" role="region" tabindex="0" aria-label="선정 장식 세트 슬롯과 저장·미리보기 비교"><table><caption>${e(g.area)} · ID 관계 비교</caption><thead><tr><th>슬롯</th><th>저장된 item_id</th><th>미리보기 item_id</th></tr></thead><tbody>${g.skins.map(r=>`<tr><th scope="row">${e(r.slot)}</th><td>${e(s.slots[r.slot]??'기록 없음')}</td><td>${e(edit?.preview[r.slot]??'—')}</td></tr>`).join('')}</tbody></table></div><details><summary>원작 조건과 웹 제한 · 출처</summary>${c.boundaries.map(x=>'<p>'+e(x)+'</p>').join('')}${c.sources.map(r=>'<p><code>'+e(r.path)+'</code><br>행 '+e(r.ranges.join(', '))+'<br><small>SHA-256 '+e(r.sha256)+'</small></p>').join('')}</details><button class="game-button" data-play="game-skins-close">메인 맵으로</button></section>`;
}

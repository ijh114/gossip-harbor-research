import {getChoices} from './spread-model.mjs';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const definition=(c,t)=>c.items.find(r=>r.type===t);
const name=(c,t)=>definition(c,t)?.displayName||definition(c,t)?.name||t;
function image(d,t){const m=d.media?.entries?.find(r=>r.key==='item:ItemModelConfig:'+t);return m&&/^\.\/assets\/media\/[\w.-]+\.(png|jpg|webp)$/.test(m.src)?`<img src="${e(m.src)}" alt="" width="72" height="72" loading="lazy">`:'<span>이미지 미복구</span>';}
export function renderItemDialog(s,c,d){
 const cell=s.board[s.selected],row=definition(c,s.modal==='item-info'&&s.infoType||cell?.type);if(!row)return '';
 const choice=s.modal==='choice',options=choice?getChoices(s,s.selected,c,{orders:s.orders?.slots||[]}):null;
 const chain=choice?(options.choices||[]).map(t=>definition(c,t)):c.items.filter(r=>r.chainId===row.chainId).sort((a,b)=>a.chainLevel-b.chainLevel);
 return `<dialog id="play-dialog" class="source-play-dialog item-info-dialog" aria-labelledby="source-play-dialog-title"><div class="source-dialog-heading"><h2 id="source-play-dialog-title">${choice?'보상을 선택하세요':e(name(c,row.type))}</h2><button type="button" class="button" data-play="${choice?'close-choice':'close-info'}">닫기</button></div><div class="source-dialog-content"><p>${choice?'선택한 아이템 하나로 상자를 교체합니다. 선택 전에는 소비하지 않습니다.':'같은 타입 두 개를 합성하면 다음 단계로 올라갑니다. 전체 모양과 다음 결과를 비교하세요.'}</p><ol class="item-chain-gallery">${chain.map((r,i)=>`<li>${choice?`<button type="button" class="item-choice" data-play="choose-item" data-value="${i}" aria-label="${e(name(c,r.type))} 선택">${image(d,r.type)}<strong>${e(name(c,r.type))}</strong></button>`:`${image(d,r.type)}<strong>${e(name(c,r.type))}</strong><small>${r.chainLevel}레벨${r.type===row.type?' · 현재 선택':''}</small>`}</li>`).join('')}</ol>${options&&!options.ok?`<p role="alert">${e(options.message)}</p>`:''}<details><summary>내장 설정과 확인 범위</summary><p>Type ${e(row.type)} · chain ${e(row.chainId)}. APK 기본 설정과 정적 Sprite를 연결했습니다. 선택 상자 후보는 현재 주문·재고를 반영하며 원작 난수·활성 서버 변형은 별도입니다.</p></details></div></dialog>`;
}

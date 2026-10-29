const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderRuntimeInline(view){
 if(!view?.valid||!view.enabled||!view.active?.length&&!view.ambiguity)return '';
 const button=(action,label,value)=>`<button class="game-button" data-play="runtime:${action}"${value?' data-value="'+e(JSON.stringify(value))+'"':''}>${e(label)}</button>`;
 return `<aside class="tutorial-runtime-inline" data-runtime-inline aria-label="현재 창의 자동 안내"><p>현재 웹 창에 연결한 안내입니다. 원작 화면 좌표의 일치 여부는 별도 검증입니다.</p>${view.ambiguity?`<p>${e(view.ambiguity.message)}</p>${view.ambiguity.candidates.map(id=>button('choose-order',id+' 먼저',[id,...view.ambiguity.candidates.filter(x=>x!==id)])).join('')}`:view.active.map(a=>`<p><strong>${e(a.name)}</strong> · ${e(a.active?.label||a.active?.phase||'대기')}</p>${(a.allowedActions||[]).map(x=>button('mask',x.label||'원본 마스크 콜백',{guideId:a.id,...(x.callbackId?{callbackId:x.callbackId}:{})})).join('')}`).join('')}${button('disable','자동 안내 중지')}</aside>`;
}

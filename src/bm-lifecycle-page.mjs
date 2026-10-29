import {runBMLifecycle} from './bm-lifecycle.mjs';
const e=v=>String(typeof v==='object'?JSON.stringify(v):v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number.isFinite(v)?Number(v).toLocaleString('ko-KR'):'미확인';
export function createBMLifecycleWorkbench({getData,render,download}){
 let selected='',draft='',result=null,step=0,message='';
 const catalog=()=>getData()?.bmLifecycleConfig;
 function ensure(){const c=catalog();if(!c||selected)return;const p=c.presets[0];selected=p.id;draft=JSON.stringify(p,null,2);}
 function handle(action,value){ensure();const c=catalog();if(!c)return;
  if(action==='preset'){const p=c.presets.find(p=>p.id===value);if(!p)return;selected=p.id;draft=JSON.stringify(p,null,2);result=null;message='연구 예제입니다. 실제 서버·계정 값이 아닙니다.';}
  if(action==='run'){
   draft=document.querySelector('[data-bm-life-json]')?.value??draft;
   if(draft.length>32768){message='시나리오 JSON은32KiB 이하여야 합니다.';render();return;}
   try{result=runBMLifecycle(JSON.parse(draft),c,{playConfig:getData().playConfig});step=0;message=result.ok?(result.status==='replayed-with-unimplemented-paths'?'기존 웹 모델을 재생했습니다. 구매·지급 등 미지원 경로가 포함돼 있습니다.':'기존 웹 모델의 시간순 결과를 계산했습니다.'):'입력 또는 실행 범위를 확인하세요.';}
   catch{result=null;message='JSON 형식과 사건 입력을 확인하세요. 기존 게임 저장은 바꾸지 않았습니다.';}
  }
  if(action==='step'){const v=Number(value);if(Number.isInteger(v)&&v>=0&&v<(result?.events?.length||0))step=v;}
  if(action==='export'){if(result)download('bm-lifecycle-research.json',{scenario:JSON.parse(draft),result});return;}
  render();document.querySelector(action==='step'?`[data-bm-life-action="step"][data-value="${step}"]`:'[data-bm-life-status]')?.focus({preventScroll:true});
 }
 function chart(events){
  const points=events.map(x=>x.after).filter(Boolean),first=Math.min(...points.map(x=>x.now)),last=Math.max(first+1,...points.flatMap(x=>[x.now,x.groupEnd,x.itemEnd,x.cooldownEnd].filter(Number.isFinite))),x=t=>110+(t-first)/(last-first)*520;
  const row=events[step]?.after;if(!row)return '';
  const start=Number.isFinite(row.now)?row.now:first;
  return `<div class="bm-life-chart-wrap" role="region" tabindex="0" aria-label="상품·그룹·쿨다운 시각 그래프 · 작은 화면에서는 좌우로 이동"><svg class="bm-life-chart" viewBox="0 0 660 170" role="img" aria-label="선택 사건의 웹 모델 상품·그룹·쿨다운 종료 시각 비교"><path d="M110 20V135H640" fill="none" stroke="#a2b5ac"/>${[['그룹','groupEnd','#18564c'],['상품','itemEnd','#94631d'],['쿨다운','cooldownEnd','#526158']].map(([label,key,color],i)=>{const end=row[key],y=30+i*35,width=Number.isFinite(end)?Math.max(0,x(Math.max(start,end))-x(start)):0;return `<text x="8" y="${y+12}">${label}</text><rect x="${x(start).toFixed(2)}" y="${y}" width="${width.toFixed(2)}" height="17" rx="3" fill="${color}"/><text x="118" y="${y+29}">${e(n(end))}초</text>`;}).join('')}<text x="110" y="158">${e(n(first))}초</text><text x="540" y="158">${e(n(last))}초</text></svg></div><p class="table-note">길이는 입력한 연구 시각과 웹 모델의 종료 시각입니다. 실제 노출 시간·체류·전환율 측정이 아닙니다.</p>`;
 }
 function renderPage(){ensure();const c=catalog();if(!c)return '<p>BM 시간순 실험 자료를 준비하고 있습니다.</p>';
  const events=result?.events||[],row=events[step],snapshot=row?.after;
  return `<section class="bm-lifecycle" aria-labelledby="bm-life-title"><h2 id="bm-life-title">상품·그룹·쿨다운 시간순 실험</h2><p>새 상품 생성, 기존 상품 노출, 닫기, 상품/그룹 만료와 서버 일 경계를 기존 웹 모델로 재생합니다. 원작 정적 조건과 웹 결과가 다른 지점은 차이로 남깁니다. 실제 결제·계정·운영값을 연결하지 않습니다.</p><label>연구 시나리오<select data-bm-life-preset>${c.presets.map(p=>`<option value="${e(p.id)}"${selected===p.id?' selected':''}>${e(p.label)}</option>`).join('')}</select></label><details><summary>시나리오와 사건 시각 편집</summary><label>명시 연구 JSON<textarea data-bm-life-json maxlength="32768" spellcheck="false">${e(draft)}</textarea></label><p>at는 절대 연구 초입니다. 누락한 서버 필드나 지원하지 않는 구매는 임의로 성공 처리하지 않습니다.</p></details><div class="quick-links"><button class="button primary" data-bm-life-action="run">시간순 실험 실행</button><button class="button" data-bm-life-action="export"${result?'':' disabled'}>연구 결과 JSON</button><a class="button" href="#bm-observation">실제 관측과 비교</a></div><p role="status" tabindex="-1" data-bm-life-status>${e(message||'예제를 선택한 뒤 실행하세요.')}</p>${result?.unknown?.length?`<p class="notice">미확인 입력: ${result.unknown.map(e).join(' · ')}</p>`:''}${events.length?`<div class="bm-life-layout"><nav aria-label="연구 사건 선택"><ol class="bm-life-events">${events.map((r,i)=>`<li><button class="button" data-bm-life-action="step" data-value="${i}" aria-pressed="${step===i}"><span>${e(n(r.now))}초</span><strong>${e(r.label||r.action||r.kind||r.id)}</strong></button></li>`).join('')}</ol></nav><section aria-label="선택 사건 결과"><h3>${e(row.label||row.action||row.kind||row.id)}</h3>${chart(events)}${snapshot?`<dl class="bm-time-values"><dt>그룹 상태</dt><dd>${e(snapshot.groupState)}</dd><dt>신규 생성 횟수</dt><dd>${e(n(snapshot.triggerCount))}</dd><dt>기존 상품</dt><dd>${snapshot.existing===true?'유효':snapshot.existing===false?'무효':'미확인'}</dd><dt>웹 선택 경로</dt><dd>${e(snapshot.route)}</dd></dl>`:''}<details open><summary>정적 비교와 웹 결과</summary><pre>${e(JSON.stringify(row.comparisons||row.result,null,2))}</pre></details><details><summary>사건 전후 스냅샷</summary><pre>${e(JSON.stringify({before:row.before,after:row.after},null,2))}</pre></details></section></div>`:''}<details class="bm-life-sources"><summary>모델 범위·원작 출처·미확인 사항</summary>${(c.boundaries||result?.boundaries||[]).map(x=>'<p>'+e(x)+'</p>').join('')}${(c.sources||[]).map(s=>'<p><code>'+e(s.path)+'</code><br>행 '+e(s.ranges||[s.line_start??s.lineStart,s.line_end??s.lineEnd])+'<br><small>SHA-256 '+e(s.sha256)+'</small></p>').join('')}</details></section>`;
 }
 return {renderPage,handle};
}

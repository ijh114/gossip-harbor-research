// Game-shaped presentation of the same pure research model. Captures guide the
// layout; portrait substitutions, CSS effects and map drawings are web artwork.
import {home,modal,boundaries} from './play-page.mjs';
import {orderStock,orderStatus} from './order-model.mjs';
import {getSpeedUpCost,spreadFor} from './spread-model.mjs';
import {playGuide,renderPlayGuide} from './play-guide.mjs';
import {renderProductionLab} from './production-page.mjs';
import {currentBubbleQuote} from './play-model.mjs';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v||0).toLocaleString('ko-KR');
const seconds=v=>`${Math.floor(Math.max(0,v)/60)}:${String(Math.floor(Math.max(0,v)%60)).padStart(2,'0')}`;
const item=(c,t)=>c.items.find(r=>r.type===String(t));
const name=(c,t)=>item(c,t)?.displayName||item(c,t)?.name||String(t);
function src(d,key){const r=d.media?.entries?.find(r=>r.key===key);return r?.kind==='image'&&/^\.\/assets\/media\/[\w.-]+\.(png|jpg|webp)$/.test(r.src)?r.src:'';}
function ui(d,key,fallback=''){const path=src(d,'ui-play:'+key.replace('task_avatar_','avatar_'))||src(d,'asset:'+key);return path?`<img src="${e(path)}" alt="" draggable="false">`:fallback;}
function image(c,d,t){const row=item(c,t),path=src(d,'item:ItemModelConfig:'+t)||src(d,row?.imageKey)||src(d,'asset:'+row?.imageKey);return path?`<img class="game-item" src="${e(path)}" alt="" draggable="false">`:`<span class="game-item-missing">${e(row?.displayName||'이미지 미복구')}</span>`;}
const button=(a,label,{value,disabled=false,cls='',title=''}={})=>`<button type="button" class="game-button ${cls}" data-play="${a}"${value!==undefined?` data-value="${e(value)}"`:''}${disabled?' disabled':''}${title?` title="${e(title)}"`:''}>${label}</button>`;
const available=(s,t)=>orderStock(s)[t]||0;
function ready(s,q){return q&&s.wallet.level>=q.level&&q.requirements.every(r=>available(s,r.type)>=r.count);}
export function gameClocks(s,c){const quote=c&&getSpeedUpCost(s,s.selected,c,{forcedCost:playGuide(s,c).forcedSkipCost});return {energy:s.wallet.energy>=100?'가득 참':seconds(120-s.wallet.recoveryRemainder),selected:s.selected===null?'':seconds(Math.max(0,(s.generatorState[s.board[s.selected]?.uid]?.readyAt||0)-s.wallet.time)),skipCost:quote?.ok?quote.cost:null};}
function hud(s,c,d){
 const w=s.wallet,level=c.levels.find(r=>r.level===w.level),clocks=gameClocks(s);
 return `<div class="game-hud"><div class="game-profile" aria-label="레벨 ${w.level}, 경험치 ${s.xp}/${level?.exp||'?'}">${ui(d,'task_avatar_quinn','<span>Q</span>')}<strong>${w.level}</strong><progress aria-label="현재 레벨 경험치" max="${level?.exp||100}" value="${s.xp}"></progress></div><div class="game-currencies">${button('open-energy',`${ui(d,'icon_energy')}<strong data-live-energy>${n(w.energy)}</strong><span class="game-plus" aria-hidden="true">+</span>`,{cls:'game-currency',title:'에너지 충전'})}<span class="game-energy-clock" data-live-energy-clock>${clocks.energy}</span><div class="game-currency" aria-label="골드 ${w.coins}">${ui(d,'icon_coin')}<strong data-live-coins>${n(w.coins)}</strong></div>${button('shop',`${ui(d,'icon_gem')}<strong>${n(w.gems)}</strong><span class="game-plus" aria-hidden="true">+</span>`,{cls:'game-currency',disabled:w.level<c.functionGates.shop,title:'젬과 상점 · 레벨3 해금'})}</div>${button('shop',`${ui(d,'icon_shop','<span>상점</span>')}<span class="sr-only">상점</span>`,{cls:'game-shop-icon',disabled:w.level<c.functionGates.shop})}</div>`;
}
function orders(s,c,d){
 const active=s.orders?.slots||[],total=s.queue.reduce((a,r)=>a+r.count,0),queued=s.queue[0];
 return `<section class="game-order-zone" aria-label="고객과 주문"><div class="game-queue">${button('queue',`${queued?image(c,d,queued.type):ui(d,'checkerboard_cache_queue_bg','<span>보상</span>')}<b>${total}</b><span aria-hidden="true">↓</span>`,{disabled:!queued||!item(c,queued.type),title:'맨 앞 보상1개를 보드에 배치'})}</div><div class="game-customer-lane" tabindex="0" aria-label="진행 중인 주문, 좌우로 탐색">${active.map((q,index)=>`<div class="game-customer" aria-label="슬롯${q.slot} ${q.kind==='fixed'?'고정':'일반'} 주문">${ui(d,['avatar_olivia','avatar_colton','avatar_quinn'][index%3])}<span class="game-order-price">${ui(d,'icon_coin')} +${n(q.coins)}</span><div class="game-order-tray">${q.requirements.map(r=>`<span title="${e(name(c,r.type))} ${r.count}개">${button('order-item-info',image(c,d,r.type),{value:q.slot+','+r.type,cls:'game-order-item',title:name(c,r.type)+' 합성 정보'})}${r.count>1?`<b>×${r.count}</b>`:''}${available(s,r.type)>=r.count?'<i aria-label="준비됨">✓</i>':''}</span>`).join('')}</div>${button('deliver',orderStatus(s,q.slot,c).canDeliver?'주문 완료':'아이템을 모아주세요',{value:q.slot,disabled:!orderStatus(s,q.slot,c).canDeliver,cls:'game-deliver'})}</div>`).join('')||'<p class="game-orders-ended">다음 주문을 준비하고 있어요.<br>새 재료를 해금하거나 잠시 기다려 주세요.</p>'}</div><div class="game-order-caption">${active.length}개 주문</div></section>`;
}
function tutorial(s,c,d){
 return renderPlayGuide(s,c);
}
function board(s,c,d){
 const active=s.orders?.slots||[],step=playGuide(s,c).input;
 return `<div class="game-board" role="group" aria-label="7열 9행 게임 보드">${s.board.map((cell,i)=>{
  const definition=cell?item(c,cell.type):null,r=cell&&s.generatorState[cell.uid],bubble=cell&&s.bubbles?.[cell.uid],selected=s.selected===i;
  const needed=cell&&!cell.cover&&!bubble&&active.some(q=>q.requirements.some(req=>req.type===cell.type&&available(s,req.type)>=req.count));
  const guideFrom=step&&(step.kind==='merge'?step.from:step.index??(step.kind==='guide-ack'?step.from:undefined))===i,guideTo=['merge','guide-ack'].includes(step?.kind)&&step.to===i;
  const label=`${Math.floor(i/7)+1}행 ${i%7+1}열, ${cell?name(c,cell.type):'빈칸'}${cell?.cover=== 'box'?', 상자':cell?.cover==='web'?', 거미줄':''}${bubble?', 버블':''}${selected?', 선택됨':''}`;
  return `<button type="button" data-play="game-cell" data-value="${i}" class="game-cell${cell?' occupied':''}${selected?' selected':''}${cell?.cover?' cover-'+cell.cover:''}${bubble?' game-bubble':''}${guideFrom?' guide-from':''}${guideTo?' guide-to':''}${s.lastAction?.ok&&s.lastAction.cells?.includes(i)?' game-cell-pop':''}" aria-label="${e(label)}" aria-pressed="${selected}">${cell?image(c,d,cell.type):''}${cell?.cover==='box'?'<span class="game-box" aria-hidden="true"></span>':cell?.cover==='web'?'<span class="game-web" aria-hidden="true"></span>':''}${!cell?.cover&&r?`<span class="game-generator-mark" aria-hidden="true">${r.charges?'ϟ':'◷'}</span>`:''}${needed?'<span class="game-needed" aria-hidden="true">✓</span>':''}${guideFrom?'<span class="game-guide-label">여기</span>':guideTo?'<span class="game-guide-label">합성</span>':''}${bubble?`<span class="game-bubble-clock" data-bubble-timer="${cell.uid}">${seconds((currentBubbleQuote(s,c,bubble).expiresAt??bubble.expiresAt)-s.wallet.time)}</span>`:''}</button>`;
 }).join('')}</div>`;
}
function selected(s,c,d){
 const cell=s.board[s.selected],definition=cell&&item(c,cell.type),g=definition?.generator,bubble=cell&&s.bubbles?.[cell.uid],collectible=c.specialRules?.collectibles.find(r=>r.type===cell?.type),skip=c.specialRules?.timeSkip.items.find(r=>r.type===cell?.type);
 const guide=playGuide(s,c),state=cell&&s.generatorState[cell.uid],spread=cell&&spreadFor(c,cell.type),quote=state&&getSpeedUpCost(s,s.selected,c,{forcedCost:guide.forcedSkipCost});
 let description='같은 아이템을 합성해 주문을 완성하세요.',act='';
 if(cell?.cover)description=cell.cover==='box'?'옆 칸에서 합성하면 상자가 열려요.':'같은 아이템을 끌어와 합성해 거미줄을 없애세요.';
 else if(bubble){const quote=currentBubbleQuote(s,c,bubble),price=guide.forcedBubbleCost??quote.price;description=quote.status==='known'?`${n(price)}젬으로 꺼내기${quote.sale?' · 할인 일정 가정':''} · 만료되면 코인으로 바뀌어요.`:'버블 가격·기간의 명시 조건을 확인하세요.';act=button('buy-bubble',`${ui(d,'icon_gem')} <span data-live-bubble-price>${quote.status==='known'?n(price):'미확인'}</span>`,{disabled:quote.status!=='known'||s.wallet.gems<price,cls:'game-item-action'});}
 else if(collectible||skip){description=collectible?`지금 수집하거나 합성해 더 큰 보상을 만드세요.`:`모든 진행 중 생성기 충전을 ${n(skip.seconds/60)}분 단축해요.`;act=button('collect','받기',{cls:'game-item-action'});}
 else if(c.spreadRules?.choices?.[cell?.type]){description='현재 주문과 보유 아이템을 반영한 후보 중 하나를 선택하세요.';act=button('open-choice','선택하기',{cls:'game-item-action'});}
 else if(cell?.type==='reward_bubble_1'){description=`${e(cell.rewardType||'미확인 보상')} ×${n(cell.rewardCount)} · 카드팩은 배분 규칙까지만 처리해요.`;act=button('collect-wrapper','보상 받기',{cls:'game-item-action'});}
 else if(g){
  if(state?.phase==='closed'){description='상자를 열면 준비 시간이 시작돼요.';act=button('open-item','열기',{cls:'game-item-action'});}
  else if(['opening','initializing'].includes(state?.phase)){description=`${state.phase==='opening'?'상자 여는 중':'생성기 준비 중'} · <span data-live-selected-clock>${gameClocks(s).selected}</span>`;act=quote?.ok?button('speedup-item',`<span data-live-speedup-cost>${n(quote.cost)}</span>젬 단축`,{cls:'game-item-action',disabled:s.wallet.gems<quote.cost}):'';}
  else {
   const auto=spread?.auto,x=s.selected%7,y=Math.floor(s.selected/7),near=auto&&[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]].some(([dx,dy])=>x+dx>=0&&x+dx<7&&y+dy>=0&&y+dy<9&&s.board[(y+dy)*7+x+dx]===null);
   description=`${n(state?.charges)}/${n(g.batch)}${[3,4,5].includes(spread?.weightType)?'점':'회'} · ${auto?'주변 빈칸에 자동 생성':`에너지 ${g.cost?2**(s.boostRatio||0):0}`} ${state?.charges?'':`· 충전 <span data-live-selected-clock>${gameClocks(s).selected}</span>`}`;
   act=button('generate',auto?'주변 막힘 · 꺼내기':ui(d,'icon_energy')+' 생성',{cls:'game-item-action',disabled:!state?.charges||near});
   if(!state?.charges&&quote?.ok)act=button('speedup-item',`<span data-live-speedup-cost>${n(quote.cost)}</span>젬 단축`,{cls:'game-item-action',disabled:s.wallet.gems<quote.cost});
  }
 }
 else if(cell?.type==='level_up_piece_1'||cell?.type==='level_down_piece_1')description='도구를 사용할 아이템으로 끌어 놓으세요. 확인 후 적용해요.';
 else if(cell&&definition?.sellingPrice)act=button('sell',`${ui(d,'icon_coin')} +${n(definition.sellingPrice)}`,{cls:'game-item-action',title:'선택한 아이템 판매'});
 return `<div class="game-bottom">${button('inventory',`${ui(d,'icon_inventory','<span>보관함</span>')}<span class="sr-only">보관함</span>`,{cls:'game-bottom-icon',disabled:s.wallet.level<(c.inventoryRules?.unlockLevel||2)})}<div class="game-selection">${button('item-info',`${cell?e(name(c,cell.type)):'아이템을 선택하세요'}${definition?.chainLevel?` <small>${definition.chainLevel}레벨 · 정보</small>`:''}`,{cls:'game-item-title',disabled:!cell})}<div><p>${description}</p>${act}</div></div>${button('home',`${'<span class="game-map-label">맵</span>'}<span class="sr-only">맵 진행</span>`,{cls:'game-bottom-icon'})}</div>`;
}
function tools(s,c){
 const assistance=[['2401','코인'],['2501','젬'],['2601','에너지'],['time_skip_1','10분 모래시계'],['level_up_piece_1','무지개'],['level_down_piece_1','가위']];
 return `<aside class="game-research-tools" aria-label="플레이 연구 도구">
 <h2>플레이와 근거 비교</h2><p>APK 규칙을 적용하고, 제공 캡처의 배치를 참고한 웹 재현입니다. 현행 서버 설정과 원작 실행 검증은 구분합니다.</p>
 <div class="game-toolbar">${button('focus',s.focused?'집중 모드 종료':'게임에 집중')}${button('save','저장')}${button('export','상태 JSON')}<label class="button source-import-label">가져오기<input id="play-import" type="file" accept="application/json,.json" aria-label="플레이 상태 가져오기"></label></div>
 <details><summary>시작 배치와 튜토리얼</summary><p>기존 저장을 백업하고 APK 초기 배치에서 시작합니다. 첫 합성·주문·맵 과제·보상 배치·상자·에너지·상점 안내를 연결합니다. 원본 스토리 연출은 별도입니다.</p>${button('new-game','새 게임 · 튜토리얼')}${button('scenario','연구용 열린 배치',{value:'open'})}</details>
 <details><summary>모든 기본 타입 배치</summary><p>552개 기본 타입을 연구용 보상 대기열로 넣습니다. 원작에서의 획득 시점이나 지급 보상이 아닙니다. 닫힌 상자는 선택 후 열고, 선택 상자는 후보를 확인하세요.</p><label class="game-type-picker">아이템 타입<select data-play-aid-type>${c.items.map(row=>`<option value="${e(row.type)}">${e(row.displayName||row.name)} · ${e(row.type)}</option>`).join('')}</select></label>${button('aid-type','선택 타입을 대기열로')}${button('queue','보상1개 배치')}<p>유효한 앨범 설정이 없는 카드팩 포장은 원본 대체 아이템을 대기열로 지급합니다. 실제 카드 추첨은 미확인입니다.</p></details>
 <details><summary>특수 아이템 실험</summary><p>아래 지급은 연구 입력입니다. 대기열에 넣고 보드에서 합성·수집·도구 동작을 비교하세요.</p><div class="game-tool-actions">${assistance.map(([type,label])=>button('aid-special',label,{value:type})).join('')}${button('queue','보상1개 배치')}${button('aid-bubble','빵 버블 배치',{value:'203'})}</div><p>연구 버블은 기본 가격과60초 만료입니다. 자연 출현과 할인 조건은 별도 근거로 검증합니다.</p></details>
 <details><summary>생성 부스트 실험</summary><p>아래 배율은 연구 입력입니다. 실제 계정의 부스트 모드·×8 에너지 임계값을 추정하지 않습니다. 원본 허용 타입에서 주문 부족분과 홀수 잉여분을 반영해 실제 산출 배율을 낮출 수 있습니다.</p><div class="game-tool-actions">${[0,1,2,3].map(r=>button('set-boost',`×${2**r}${(s.boostRatio||0)===r?' · 선택':''}`,{value:r})).join('')}</div><p>서버 충전횟수 비용표가 없으면 코드 fallback1회를 사용합니다. 에너지는 실제 산출 배율에 따라 차감합니다.</p></details>
 ${renderProductionLab(s,c)}
 <details><summary>시간과 재화 실험</summary><div class="game-tool-actions">${button('time','2분 경과',{value:120})}${button('time','1시간 경과',{value:3600})}${button('aid-energy','에너지0')}${button('aid-coins','골드+200')}${button('aid-gems','젬+200')}</div><p>보충 버튼은 원작 지급과 구분합니다. 실제 경과는 회복 타이머에 반영하며, 오프라인 최대7일은 웹 정책입니다.</p></details>
 <details><summary>현재 구현과 남은 차이</summary><dl class="game-parity"><div><dt>APK 규칙 적용</dt><dd>초기63칸·생성기163타입·고정16주문·일반 랜덤5종·보관함·기본과제4277개·레벨300행·재화와 특수도구·상점 갱신</dd></div><div><dt>캡처 참고 재구성</dt><dd>HUD·고객 트레이·보드·선택창·드래그·합성 효과. 얼굴 아이콘은 전신 고객의 대체 표현</dd></div><div><dt>별도 작업</dt><dd>전체 후속 튜토리얼·활동 보정·집 변화·장면 연출·현행 서버 확률/일정/상품 배정·소리와 연출 시간</dd></div></dl><p>보조 지급 없는 모델 실행에서15과제를 거쳐 레벨5까지 확인했습니다. 원작 계정의 실행 기록이나 실제 소요시간 측정은 아닙니다.</p><a href="#captures">캡처 자료와 비교</a> · <a href="#bm-timeline">BM 관측 타임라인</a> · <a href="#bm-validation">BM 조건 실험</a></details>
 <details><summary>최근 행동</summary><ol class="game-action-log">${s.log.slice(0,8).map(r=>`<li>${e(r.message)}</li>`).join('')}</ol></details>${boundaries(c)}<p class="game-save-note">${e(s.storageMessage||'이 브라우저에 자동 저장합니다.')}</p></aside>`;
}
function confirmation(s,c){if(!s.toolPending)return '';const target=s.board.find(r=>r?.uid===s.toolPending.targetUid);return `<dialog id="tool-dialog" class="source-play-dialog game-tool-dialog" aria-labelledby="game-tool-title"><div class="source-dialog-heading"><h2 id="game-tool-title">도구를 사용할까요?</h2>${button('cancel-tool','취소')}</div><div class="source-dialog-content"><p>${e(target?name(c,target.type):'선택 아이템')}에 ${s.toolPending.kind==='rainbow'?'레벨업 도구':'가위'}를 적용합니다. 확정할 때 대상과 공간을 다시 확인합니다.</p><div class="source-dialog-actions">${button('confirm-tool','사용하기',{cls:'game-confirm'})}${button('cancel-tool','취소')}</div></div></dialog>`;}
export function renderGamePlay(s,c,d,{loading=false,notice=''}={}){
 const title=`<header class="studio-intro game-intro"><h1>직접 플레이하며 비교하기</h1><p>APK4.10.5의 규칙과 제공 캡처를 바탕으로 실제 게임에 가까운 플레이를 만들고 있습니다.</p></header>`;
 let content;
 if(loading)content=`<div class="game-title game-loading" role="status"><img src="./assets/gossip-harbor.png" alt=""><h2>플레이 준비 중</h2><progress aria-label="웹 플레이 준비"></progress><p>내장 초기 배치와 튜토리얼을 불러옵니다.</p></div>`;
 else if(s.stage==='title')content=`<div class="game-title"><img src="./assets/gossip-harbor.png" alt="Gossip Harbor 앱 아이콘"><h2>Gossip Harbor</h2><p>합성하고, 주문을 완성하고,<br>집을 바꾸는 과정을 비교해 보세요.</p>${button('new-game','새 게임 시작',{cls:'game-start'})}${button('start','현재 연구 배치로 시작')}<small>APK 기반 웹 재현 · 원작 계정과 별도 저장</small></div>`;
 else if(s.stage==='home')content=`<div class="game-home-frame">${tutorial(s,c,d)}<div class="game-house-view" aria-label="웹 모식도: 과제 진행에 따른 집 변화"><span class="game-house-sun"></span><div class="game-house${s.questsDone>=3?' repaired':''}${s.questsDone>=9?' furnished':''}"><span class="game-house-roof"></span><span class="game-house-window"></span><span class="game-house-door"></span></div><p>집 변화 모식도 · 원작 장면은 추후 연결</p></div>${home(s,c)}</div>`;
 else content=`<div class="game-phone" aria-label="APK 기반 게임형 플레이">${hud(s,c,d)}${orders(s,c,d)}${tutorial(s,c,d)}${board(s,c,d)}${selected(s,c,d)}<p class="game-control-hint">드래그로 이동·합성 · 두 칸 탭도 가능</p></div>`;
 return `<div class="game-play">${title}<div class="game-play-layout"><section class="game-play-stage">${content}<div class="game-feedback" role="status" aria-live="polite">${e(notice||s.message)}</div></section>${tools(s,c)}</div>${modal(s,c,d)}${confirmation(s,c)}</div>`;
}

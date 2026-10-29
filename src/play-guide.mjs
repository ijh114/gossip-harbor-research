import {onboardingConstraints} from './onboarding-model.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const position=i=>`${Math.floor(i/7)+1}행 ${i%7+1}열`;
const action=(kind,label,value)=>`<button type="button" class="game-button game-guide-cta" data-play="${kind}"${value!==undefined?` data-value="${esc(value)}"`:''}>${esc(label)}</button>`;
export function playGuide(s,c){return s.tutorialStep!==undefined&&!s.guidanceSkipped?onboardingConstraints(s,c):{};}
export function renderPlayGuide(s,c){
 const guide=playGuide(s,c),input=guide.input||{};if(!guide.tutorialId)return '';
 let title='다음 플레이 배우기',text='',cta='';
 if(input.kind==='guide-ack'){title='새로운 조작 안내';text=input.message||'강조한 위치를 확인하고 다음 조작을 따라 해보세요.';cta=action('guide-ack','계속');}
 else if(input.kind==='inventory-store'){title='아이템 보관';text='안내한 아이템을 보관함으로 옮겨 보드 공간을 확보하세요.';cta=action('inventory-store','보관하기',input.index);}
 else if(input.kind==='inventory-open'){title='보관함 열기';text='보관한 아이템을 확인하고 다시 보드로 꺼낼 수 있습니다.';cta=action('inventory','보관함 열기');}
 else if(input.kind==='inventory-withdraw'){title='아이템 꺼내기';text='보관함의 안내 아이템을 눌러 빈 보드 칸으로 꺼내세요.';const index=s.inventory?.items.findIndex(r=>r.uid===input.uid);if(index>=0)cta=action('inventory-withdraw','꺼내기',index);}
 else if(input.kind==='order-item-info'){title='주문 아이템 정보';text='고객이 요구하는 아이템을 눌러 합성 단계를 확인하세요.';cta=action('order-item-info','정보 보기',input.slot+','+(input.itemType||input.type));}
 else if(input.kind==='merge'){title='같은 아이템 합성';text=`${position(input.from)}에서 ${position(input.to)}로 끌어 합성하세요. 두 칸을 차례로 눌러도 됩니다.`;}
 else if(input.kind==='generate'){title='생성기 사용';text=`표시된 ${position(input.index)} 생성기를 눌러 재료를 꺼내세요.`;}
 else if(input.kind==='deliver'){title='첫 주문 완성';text='재료가 준비됐습니다. 고객에게 전달하고 골드를 받으세요.';cta=action('deliver','주문 완료',input.slot);}
 else if(input.kind==='open-task'){title='집을 고쳐볼까요?';text='주문으로 모은 골드를 사용해 맵의 첫 과제를 진행하세요.';cta=action('home','맵으로');}
 else if(input.kind==='commit-task'){title='과제 완료';text=s.pendingQuest?'과제를 확정하면 골드가 소비되고 경험치와 보상을 받습니다.':'현재 과제의 시작 버튼을 눌러 진행하세요.';cta=action(s.pendingQuest?'quest-finish':'quest-start',s.pendingQuest?'과제 확정':'과제 시작');}
 else if(input.kind==='queue'){title='받은 보상 배치';text='보상 대기열의 맨 앞 아이템을 빈칸으로 꺼내세요.';cta=action('queue','보상 꺼내기');}
 else if(input.kind==='select'){title=guide.tutorialId==='tutorial_bubble'?'버블 확인':'상자 확인';text=`표시된 ${position(input.index)} 아이템을 선택하세요.`;}
 else if(input.kind==='open'){title='상자 열기';text='상자 열기를 시작하면 준비 시간이 흐릅니다.';cta=action('open-item','열기',input.index);}
 else if(input.kind==='skip'){title='상자 시간 단축';text=`이번 안내의 시간 단축 비용은 ${guide.forcedSkipCost??'미확인'}젬입니다.`;cta=action('speedup-item','시간 단축',input.index);}
 else if(input.kind==='item-info'){title='아이템 합성 정보';text='아이템 이름을 눌러 합성 단계와 생성 정보를 확인하세요.';cta=action('item-info','정보 보기');}
 else if(input.kind==='open-energy'){title='에너지 충전';text='에너지가 모두 소모됐습니다. 충전창을 열어보세요.';cta=action('open-energy','충전창');}
 else if(input.kind==='refill-energy'){title='첫 무료 충전';text='첫 무료 충전으로 에너지를 받아 플레이를 계속하세요.';cta=action('buy-energy','무료로 받기');}
 else if(input.kind==='open-shop'){title='상점 둘러보기';text='새로 열린 상점에서 오늘의 상품과 젬 상품을 확인하세요.';cta=action('shop','상점 열기');}
 else if(input.kind==='claim-free-gift'){title='오늘의 무료 보상';text='오늘의 상품에서 무료 상품의 받기 버튼을 누르세요.';}
 else if(input.kind==='buy-bubble'){title='첫 버블 해제';text=`안내 중인 버블은 ${guide.forcedBubbleCost??'미확인'}젬으로 꺼낼 수 있습니다.`;cta=action('buy-bubble','버블 해제',input.index);}
 else if(guide.waitSeconds!==undefined){title='주문 전달 중';text=`고객에게 전달하고 있습니다. 잠시 기다려 주세요. (${guide.waitSeconds}초)`;}
 else if(guide.highlight==='main-board'){title='주문으로 골드 모으기';text='다음 과제에 사용할 골드가 부족합니다. 보드로 돌아가 주문을 완성하세요.';cta=action('main','보드로');}
 else return '';
 return `<aside class="game-guide" aria-label="진행 안내" data-guide-id="${esc(guide.tutorialId)}" data-guide-step="${esc(input.step||input.kind||'wait')}"><p><strong>${esc(title)}</strong>${esc(text)}</p><span class="game-guide-actions">${cta}${action('skip-tutorial','안내 종료')}</span></aside>`;
}

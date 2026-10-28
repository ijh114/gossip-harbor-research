// Navigation and pure selectors shared by the renderer and contract tests.
export const DOMAIN_DEFS = [
 {id:'difficulty',title:'난이도 설계',short:'DIFFICULTY',number:'01',subtitle:'주문이 어려워지는 조건과 플레이 압력',intro:'목표 아이템의 합성 깊이, 생성 자원, 주문 선택 필터를 분리해 읽습니다. 필터가 존재하는 사실과 유저별 실제 난도는 같은 증거가 아닙니다.',questions:['주문은 어떤 필터로 선택되는가?','합성 깊이·시간·공간이 만드는 부담은 무엇인가?','결제·진행 상태의 영향은 어디까지 확인했는가?'],related:['mechanics','economy','bm']},
 {id:'mechanics',title:'퍼즐 기믹',short:'PUZZLE MECHANICS',number:'02',subtitle:'아이템·생성기·봉인·거품의 규칙',intro:'메인 보드의 규격과 초기 배치, 합성 판정, 생성기와 특수 아이템이 보드를 바꾸는 과정을 추적합니다. 이벤트 전용 보드와 메인 보드는 구분합니다.',questions:['무엇을 합칠 수 있고 무엇이 막히는가?','생성·충전·쿨다운·봉인은 어떻게 연결되는가?','특수 아이템은 상태를 어떻게 바꾸는가?'],related:['interaction','difficulty','puzzle-fx']},
 {id:'interaction',title:'유저 상호작용',short:'PLAYER INTERACTION',number:'03',subtitle:'탭·드래그·드롭·선택과 피드백',intro:'여기서 상호작용은 플레이어 입력과 보드의 반응을 뜻합니다. 입력 시작, 대상 판정, 이동·교환·합성, 튜토리얼 개입을 실제 조건으로 나눕니다.',questions:['입력은 언제 허용·차단되는가?','드래그와 드롭은 어떻게 보정되는가?','힌트와 튜토리얼은 무엇을 유도하는가?'],related:['mechanics','puzzle-fx','ui']},
 {id:'puzzle-fx',title:'퍼즐 연출',short:'PUZZLE PRESENTATION',number:'04',subtitle:'상태 변화가 시각·소리로 전달되는 순서',intro:'합성·생성·거품·주문·보상 연출의 호출과 시간값을 추적합니다. 코드에 지정된 트윈 시간은 실제 기기의 프레임·지각 속도를 측정한 값이 아닙니다.',questions:['판정·모델 반영·애니메이션은 어떤 순서인가?','움직임·스케일·대기 시간의 실제 상수는?','연출 중 입력·리소스·완료 콜백은 어떻게 관리되는가?'],related:['interaction','ui','map-fx']},
 {id:'map',title:'인게임 맵',short:'MAP & PROGRESSION',number:'05',subtitle:'퀘스트·골드·영역·장식 선택의 연결',intro:'메인 맵은 퍼즐 보상에서 진행 비용으로 이어지는 메타 루프입니다. 내장 퀘스트 표의 크기와 현재 서버가 개방한 분량을 구분해 조사합니다.',questions:['퀘스트는 무엇을 소비하고 무엇을 여는가?','영역·슬롯·선택지·스토리는 어떻게 묶이는가?','기본 비용과 서버 보정의 경계는?'],related:['map-fx','economy','bm']},
 {id:'map-fx',title:'맵 연출',short:'MAP PRESENTATION',number:'06',subtitle:'카메라·대사·타임라인·변경 장면',intro:'지도 위 퀘스트 완료가 카메라 이동, 대사, 선택지와 장면 변경으로 이어지는 흐름을 살펴봅니다. 타임라인 선언과 실제 재생 결과는 구분합니다.',questions:['직렬·병렬 액션은 어떻게 재생되는가?','스킵·종료·복구는 어떤 상태를 남기는가?','동봉된 스토리·타임라인 범위는 어디까지인가?'],related:['map','puzzle-fx','ui']},
 {id:'ui',title:'UI 구조',short:'INTERFACE ARCHITECTURE',number:'07',subtitle:'화면 계층·창 상태·팝업 큐·안전 시점',intro:'화면 이름 목록에서 더 나아가, UIManager가 창을 로드·대기·표시·닫기·캐시하는 구조와 게임 플레이·BM 팝업의 접점을 분석합니다.',questions:['메인 HUD·창·팝업은 어떤 계층인가?','중복 열기와 입력 충돌은 어떻게 막는가?','자동 팝업은 언제 안전하게 평가되는가?'],related:['interaction','bm','events']},
 {id:'bm',title:'BM 종합',short:'MONETIZATION',number:'08',subtitle:'재화 부족에서 상품 제안까지의 전환 구조',intro:'상점, 에너지 충전, 상황형 오퍼, 패스와 구매 연동 이벤트를 하나의 자원·노출 루프로 연결합니다. 금액은 내장 기본값이며 현재 스토어 판매가가 아닙니다.',questions:['어떤 부족 상태가 어떤 상품으로 이어지는가?','상품은 어떤 우선순위·제한·재노출을 갖는가?','기본 가격과 실제 운영값은 어디서 갈리는가?'],related:['economy','events','difficulty']},
 {id:'events',title:'이벤트·운영',short:'LIVE EVENTS',number:'09',subtitle:'해금·일정·보상 기간·구매 연동',intro:'이벤트의 레벨·서버 시각·리소스 게이트, 패스와 누적 구매 루프를 함께 봅니다. 이 페이지는 현재 이벤트 달력이나 유저별 배정표가 아닙니다.',questions:['준비·진행·종료·해제 상태의 경계는?','패스와 구매 연동 이벤트는 어떻게 연결되는가?','실제 운영값 확인에 어떤 관측이 필요한가?'],related:['bm','ui','map']},
 {id:'economy',title:'재화·성장',short:'ECONOMY & PROGRESSION',number:'10',subtitle:'에너지·젬·골드·공간의 획득과 소비',intro:'에너지 회복과 충전, 젬 소비처, 맵 진행 비용과 인벤토리를 나누어 경제 구조를 읽습니다. 산술 실험과 원작의 확률·개인화 경제를 구분합니다.',questions:['재화별 유입·유출과 상한은?','시간과 젬은 어떤 비율로 교환되는가?','공간·주문·맵이 만드는 병목은?'],related:['difficulty','map','bm']},
];
export const DOMAIN_IDS=DOMAIN_DEFS.map(x=>x.id);
const eventCategories=new Set(['이벤트·패스']);
const economyCategories=new Set(['재화 소비처','에너지·광고','해금·진행']);
export function inDomain(fact,id){
 if(fact.domain===id||fact.domains?.includes(id))return true;
 if(fact.domain)return false;
 if(id==='bm')return !fact.id?.startsWith('BM-I03');
 if(id==='events')return eventCategories.has(fact.category)||['activity-state-machine','pass-lifecycle-popup','accumulated-spend-loop'].includes(fact.id);
 if(id==='economy')return economyCategories.has(fact.category)||['BM-C003','BM-C010'].includes(fact.id);
 return false;
}
export function selectDomainFacts(facts,id,{query='',kind='all'}={}){
 const needle=query.trim().toLocaleLowerCase();
 return facts.filter(f=>inDomain(f,id)&&(kind==='all'||f.kind===kind)&&(!needle||JSON.stringify(f).toLocaleLowerCase().includes(needle)));
}
export function domainStats(facts,id){
 const selected=selectDomainFacts(facts,id);return {total:selected.length,sources:new Set(selected.flatMap(f=>(f.sources||[]).map(s=>s.path))).size,
   code:selected.filter(f=>f.kind==='code').length,config:selected.filter(f=>f.kind==='config').length,
   text:selected.filter(f=>f.kind==='text').length,inference:selected.filter(f=>f.kind==='inference').length};
}
export function mergeResearch(base,extension){
 if(extension.targetVersion!==base.meta.version)throw new Error('분석 버전이 일치하지 않습니다.');
 const facts=[...base.facts,...extension.findings];
 if(new Set(facts.map(f=>f.id)).size!==facts.length)throw new Error('분석 항목 ID가 중복됩니다.');
 return {...base,facts,domainAnalysis:extension,meta:{...base.meta,factCount:facts.length,domainCount:DOMAIN_DEFS.length}};
}
export function baseMergeUnits(level){
 if(!Number.isInteger(level)||level<1||level>20)throw new RangeError('Level must be1..20');
 return 2**(level-1);
}

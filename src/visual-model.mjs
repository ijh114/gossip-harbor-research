export const ROLE_NAMES={generator:'생성기 설정',merge:'합성 연결',terminal:'다음 합성 없음'};
export const UI_CATEGORY_NAMES={shop:'상점·BM 후보',tutorial:'튜토리얼 후보',hud:'HUD·진입점 후보',window:'창·팝업 후보',other:'기타 컴포넌트'};
export const PUZZLE_DEMOS=[
 {id:'merge',title:'같은 아이템 합성',description:'동일 타입 두 개의 흡수와 결과 아이템 팝을 확인합니다.',source:'FX-002',type:'merge',timing:'코드: 0.1초 흡수 + 0.3초 팝',category:'merge'},
 {id:'generate',title:'생성·착지',description:'생성기에서 산출된 아이템의 이동과 착지를 구조로 봅니다.',source:'FX-001',type:'generate',timing:'순서 시연 · 실기 재생 미관측',category:'generator'},
 {id:'drag',title:'드래그·드롭',description:'포인터 이동과 목표 칸 보정의 관계를 비교합니다.',source:'PZ-031',type:'drag',timing:'코드: 끝 0.15초 · 1칸 이내 보정',category:'input'},
 {id:'bubble',title:'거품 해제',description:'거품의 팽창과 페이드, 내부 아이템 노출을 구분합니다.',source:'FX-007',type:'bubble',timing:'구매·시간 만료 경로는 별도',category:'special'},
 {id:'hint',title:'합성 힌트',description:'합칠 수 있는 대상의 확대와 방향 이동을 확인합니다.',source:'FX-009',type:'hint',timing:'대기 0.7초 / 일반 2.3초는 별도 조건',category:'input'},
 {id:'cooldown',title:'생성기 쿨다운',description:'생성기 충전 상태를 시간표와 함께 읽습니다.',source:'FX-015',type:'cooldown',timing:'웹 시연 시간은 예시',category:'generator'},
 {id:'reward',title:'재화 비행',description:'주문 보상에서 HUD 카운터로 이어지는 경로입니다.',source:'FX-013',type:'reward',timing:'비행 아이콘 수 ≠ 보상량',category:'reward'},
 {id:'unlock',title:'봉인 해제',description:'인접 합성으로 상자 상태가 달라지는 기믹입니다.',source:'PZ-005',type:'unlock',timing:'상하좌우의 인접 판정',category:'special'}
];
export const UI_DEMOS=[
 {id:'window',title:'창 열기·닫기',description:'마스크와 창의 전경/배경 관계를 확인합니다.',source:'UI-005',type:'window',timing:'Animator 트리거 확인 · 외형은 모식도',category:'window'},
 {id:'hud',title:'HUD 숨김·복원',description:'상하 앵커가 이동하고 중앙 영역이 축소됩니다.',source:'UI-011',type:'hud',timing:'코드: 기본 0.2초',category:'hud'},
 {id:'queue',title:'팝업 순서',description:'유휴 상태에서 창이 하나씩 선택되는 FIFO 흐름입니다.',source:'UI-003',type:'queue',timing:'배정과 우선순위는 연구에서 확인',category:'window'},
 {id:'tutorial',title:'튜토리얼 강조',description:'마스크와 선택 대상의 밝은 영역을 비교합니다.',source:'UI-014',type:'tutorial',timing:'시각 영역과 입력 허용 영역을 구분',category:'tutorial'},
 {id:'mask',title:'최상단 창 마스크',description:'위의 창이 닫히면 아래 창이 다시 드러납니다.',source:'UI-009',type:'mask',timing:'창 순서의 구조 시연',category:'window'},
 {id:'counter',title:'HUD 보상 카운터',description:'비행 완료와 카운터 반영을 연결해 봅니다.',source:'FX-013',type:'reward',timing:'웹 시연량 40은 실험값',category:'hud'}
];

export const UI_REGIONS=[
 {id:'top',title:'상단 HUD',note:'레벨·재화·상태 표시를 비교할 캡처 영역입니다. 위치는 웹 모식도입니다.',source:'UI-010'},
 {id:'left',title:'왼쪽 진입점',note:'활동/이벤트 진입점을 연결할 영역입니다. 실제 활성 여부는 서버·진행 조건에 따라 다릅니다.',source:'UI-010'},
 {id:'center',title:'중앙 플레이 영역',note:'메인 맵 또는 퍼즐 보드가 자리하는 중심 영역을 비교합니다.',source:'PZ-001'},
 {id:'right',title:'오른쪽 진입점',note:'상점·상황형 오퍼의 실제 캡처를 연결합니다. 정확한 원작 좌표는 미확인입니다.',source:'UI-012'},
 {id:'bottom',title:'하단 조작 영역',note:'맵 진행·보드 전환 등 주요 행동을 비교하기 위한 배치 모식도입니다.',source:'UI-010'},
 {id:'overlay',title:'팝업·튜토리얼 계층',note:'일반 창은 정렬 간격 10, 튜토리얼/비행/프롬프트는 특수 정렬값을 사용합니다.',source:'UI-008'}
];

export function filterVisualItems(index,{query='',table='ItemModelConfig',role='all',page=1,size=24}={}){
 const q=query.trim().toLocaleLowerCase();const rows=index.items.filter(x=>(table==='all'||x.table===table)&&(role==='all'||x.role===role)&&(!q||[x.type,x.next,x.table,ROLE_NAMES[x.role]].join(' ').toLocaleLowerCase().includes(q)));
 const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.max(1,Math.min(pages,page));return {total:rows.length,pages,page:current,rows:rows.slice((current-1)*size,current*size)};
}
export function filterVisualUI(index,{query='',category='all',page=1,size=24}={}){
 const q=query.trim().toLocaleLowerCase();const rows=index.ui.filter(x=>(category==='all'||x.category===category)&&(!q||[x.name,x.path].join(' ').toLocaleLowerCase().includes(q)));
 const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.max(1,Math.min(pages,page));return {total:rows.length,pages,page:current,rows:rows.slice((current-1)*size,current*size)};
}
export function mediaFor(data,key){return data.media?.entries?.find(x=>x.key===key)||data.refinement?.mediaEntries?.find(x=>x.key===key)||data.sceneConfig?.mediaEntries?.find(x=>x.key===key)||data.bmObservationAudit?.mediaEntries?.find(x=>x.key===key)||data.storyRecapConfig?.mediaEntries?.find(x=>x.key===key)||null;}
export function validMedia(entry){
 if(!entry||!['image','gif','video'].includes(entry.kind)||!entry.alt||!entry.source)return false;
 const safe=p=>typeof p==='string'&&/^\.\/assets\/media\/[\w\-/\.]+$/.test(p)&&!p.includes('..')&&/\.(png|jpe?g|webp|gif|mp4|webm)$/i.test(p);
 return safe(entry.src)&&(!entry.poster||safe(entry.poster));
}

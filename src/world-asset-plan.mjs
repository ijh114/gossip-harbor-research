// Original production estimates. No game code, economy, account or server connection.
export const WORLD_PLAN_KEY='harbor-world-asset-plan-v1';
export const WORLD_FIELDS=[
 ['areas','맵 구역',1,20],['slots','발전 슬롯',1,1000],['choiceSlots','장식 선택 슬롯',0,1000],
 ['humans','고유 인물',0,100],['animals','동물 종류',0,30],['specialRigs','작업·의상 변형 리그',0,100],['customerSets','앉은 손님 세트',0,100],
 ['styles','선택 슬롯당 완성 외형',1,10],['humanClips','인물당 공통 모션',1,100],['storyClips','스토리 전용 모션',0,1000],
 ['animalClips','동물당 모션',0,100],['specialClips','변형 리그당 모션',0,100],['customerClips','손님 세트당 모션',0,100],['expressions','인물당 대사 초상 표정',1,30],['orderExpressions','인물당 주문 초상 표정',1,30],
 ['buildingBases','건물 베이스',0,1000],['propBases','가구·소품 베이스',0,1000],['natureBases','자연물 베이스',0,1000],['mapEffects','공용 맵 연출 계열',0,100],
];
export function estimateWorldAssets(input){
 const errors=[],n={};
 for(const [key,label,min,max]of WORLD_FIELDS){const raw=input?.[key];n[key]=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;if(!Number.isInteger(n[key])||n[key]<min||n[key]>max)errors.push(`${label}: ${min}–${max} 사이 정수를 입력하세요.`);}
 if(!errors.length&&n.choiceSlots>n.slots)errors.push('장식 선택 슬롯은 전체 발전 슬롯 수 이하로 입력하세요.');
 if(!errors.length&&n.customerSets>n.humans)errors.push('앉은 손님은 기존 인물을 재사용합니다. 손님 세트 수를 고유 인물 수 이하로 입력하세요.');
 if(errors.length)return{valid:false,errors};
 const fixedSlots=n.slots-n.choiceSlots,choiceLooks=n.choiceSlots*n.styles,finishedLooks=fixedSlots+choiceLooks;
 const humanMotions=n.humans*n.humanClips,animalMotions=n.animals*n.animalClips,variantMotions=n.specialRigs*n.specialClips,customerMotions=n.customerSets*n.customerClips,bodyRigSets=n.humans+n.animals+n.specialRigs,bodyMotions=humanMotions+n.storyClips+animalMotions+variantMotions;
 return{valid:true,inputs:n,areas:n.areas,slots:n.slots,fixedSlots,choiceLooks,finishedLooks,initialStates:n.slots,statePrefabs:n.slots+finishedLooks,
  baseModels:n.buildingBases+n.propBases+n.natureBases,bodyRigSets,rigSets:bodyRigSets+n.customerSets,customerRuntimeComponents:n.customerSets*2,humanMotions,animalMotions,variantMotions,bodyMotions,customerMotions,
  totalMotions:bodyMotions+customerMotions,portraitStates:n.humans*n.expressions,orderPortraitStates:n.humans*n.orderExpressions,mapEffects:n.mapEffects};
}
export function worldPlanRows(result){if(!result?.valid)return[];const n=result.inputs;return[
 ['terrain','지형 모듈',result.areas,'구역','3D 기반 출시 초안. 화면 수·씬 수와 별개'],
 ['buildings','건물 베이스',n.buildingBases,'모델','슬롯·배경에서 재사용'],['props','가구·소품 베이스',n.propBases,'모델','완성 외형별로 새 모델을 무조건 만들지 않음'],['nature','자연물 베이스',n.natureBases,'모델','나무·수풀·바위 등 공유 키트'],
 ['initial','초기 상태',result.initialStates,'상태','공용 오염·공사 레이어 재사용 가능'],['finished','완성 외형',result.finishedLooks,'외형','고정 슬롯 + 선택 슬롯×선택 외형 수'],['states','상태 프리팹',result.statePrefabs,'프리팹','초기+완성. 위 상태·외형의 조립 산출물, 독립 모델 수가 아님'],
 ['humans','고유 인물',n.humans,'인물','새 시나리오의 배역 수'],['animals','동물 종류',n.animals,'종류','필요한 동작·초상은 별도'],['variants','작업·의상 변형',n.specialRigs,'리그','고유 인물 수에 더하지 않음'],['body-rigs','전신 리그 소계',result.bodyRigSets,'리그','인물+동물+변형'],['customer-rigs','앉은 손님',n.customerSets,'리그','기존 인물의 별도 좌석용 골격. 같은 골격을 상체/하체가 공유'],['rigs','전신·손님 리그 합계',result.rigSets,'리그','전신 소계+앉은 손님. 초상을 Spine으로 만들 때의 리그는 사양 확정 후 별도'],
 ['human-motions','공통 인물 모션',result.humanMotions,'모션','인물 수×인물당 공통 클립'],['story-motions','스토리 전용 모션',n.storyClips,'모션','대화·소품·쌍방향 연기 등 추가'],['animal-motions','동물 모션',result.animalMotions,'모션','동물 수×동물당 클립'],['variant-motions','변형 리그 모션',result.variantMotions,'모션','변형 리그 수×변형당 클립'],['customer-motions','손님 전용 모션',result.customerMotions,'모션','같은 골격의 상체·하체 컴포넌트 공유 참조를 중복 제작하지 않음'],['motions','모션 합계',result.totalMotions,'모션','앞의5개 모션 행 합계. 시작/반복/종료는 개별 항목'],
 ['portraits','대사 초상 표정',result.portraitStates,'표정 상태','전신 모션과 별도. 출력 그림 수/Spine 상태 수는 방식 확정 후 결정'],['order-portraits','주문 초상 표정',result.orderPortraitStates,'표정 상태','대사 초상과 그림 재사용 가능. UI 프레임·표현 규칙은 구분'],['effects','공용 맵 연출',result.mapEffects,'계열','ParticleSystem 객체 수·타임라인 장면 수와 별개'],
 ].map(([id,title,quantity,unit,note])=>({id,title,quantity,unit,note}));}
export function exportWorldPlan(data,input,format='json'){
 const estimate=estimateWorldAssets(input);if(!estimate.valid)return null;
 const rows=worldPlanRows(estimate),boundary='승인 전 신규 게임 제작 제안. 단위가 다른 행과 소계/합계 행을 전체 자산 수로 다시 합산하지 않습니다. 원작 최초 출시 규모는 미확인입니다.';
 if(format==='csv'){const cell=x=>'"'+String(x).replaceAll('"','""')+'"';return '\uFEFF'+[['항목ID','항목','수량','단위','산정 기준','판정'],...rows.map(r=>[r.id,r.title,r.quantity,r.unit,r.note,'신규 제안 · 승인 전'])].map(r=>r.map(cell).join(',')).join('\r\n');}
 if(format==='md')return `# 맵·NPC 제작 요청 초안\n\n${boundary}\n\n기준 APK ${data.targetVersion} · 분석 ${data.reviewDate}\n\n| 항목 | 수량 | 단위 | 산정 기준 |\n| --- | ---: | --- | --- |\n${rows.map(r=>`| ${r.title} | ${r.quantity} | ${r.unit} | ${r.note} |`).join('\n')}\n\n${data.boundaries.map(b=>'- '+b).join('\n')}\n`;
 return JSON.stringify({schemaVersion:1,kind:'original-world-production-proposal',approved:false,referenceVersion:data.targetVersion,reviewDate:data.reviewDate,boundary,inputs:estimate.inputs,rows,limits:data.boundaries},null,2);
}

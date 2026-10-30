// Compose research derivatives without changing the economy or persisted saves.
const unique=rows=>[...new Map(rows.map(r=>[r.id||r.key,r])).values()];
export function integrateCompletionData(data){
 const out={...data};
 if(data.finalObservations&&data.mediaReview){
  const additions=data.finalObservations.studies.map(s=>({...s,kind:'observed-frame-study',domains:['interaction','mechanics','puzzle-fx','ui','difficulty'],description:s.observations[0],findings:s.observations,selectedFrameKeys:s.mediaKeys.slice(2).filter(key=>data.finalObservations.mediaEntries.some(m=>m.key===key&&m.kind==='image')),timeline:(s.frames||[]).map(f=>({label:f.caption,time:Number(f.timeSeconds).toFixed(6)+'초',detail:'원본 PTS 선정 프레임'})),sources:data.finalObservations.sources.filter(r=>r.id===s.sourceId)}));
  out.mediaReview={...data.mediaReview,studies:unique([...data.mediaReview.studies,...additions]),tasks:data.mediaReview.tasks.map(t=>({...t,studyIds:unique([...(t.studyIds||[]).map(id=>({id})),...additions.filter(s=>s.checklistIds.includes(t.id)).map(s=>({id:s.id}))]).map(r=>r.id)}))};
 }
 if(data.lateSceneStudy&&data.sceneConfig){
  out.sceneConfig={...data.sceneConfig,tasks:unique([...data.sceneConfig.tasks,...data.lateSceneStudy.tasks]),sources:unique([...data.sceneConfig.sources,...data.lateSceneStudy.sources]),boundaries:[...data.sceneConfig.boundaries,...data.lateSceneStudy.boundaries]};
  out.sceneConfig.summary={...data.sceneConfig.summary,tasks:out.sceneConfig.tasks.length,taskCommands:out.sceneConfig.tasks.reduce((n,t)=>n+t.commandCount,0)};
  out.sceneConfig.scope=data.sceneConfig.scope+' + exact default day13 selected minimum projection; late day13~292 static counts/source audit separate';
 }
 if(data.itemRepresentationRemote&&data.itemRepresentation){
  const r=data.itemRepresentationRemote,old=data.itemRepresentation;
  const media=r.sprites.map(sprite=>{const m=r.mediaEntries.find(m=>m.key===sprite.mediaKey);return m&&sprite.pixelsToUnits?{...m,identity:sprite.spriteIdentity,pixelsToUnits:sprite.pixelsToUnits}:null;}).filter(Boolean);
  out.itemRepresentation={...old,entries:old.entries.map(row=>r.entries.find(x=>x.type===row.type)||row),media:unique([...old.media,...media]),sources:unique([...old.sources,...r.sources]),remoteResolved:true,remoteEvidence:r,coverage:{...old.coverage,baseRepresentationResolved:r.coverage.baseRepresentationRulesResolved,baseExactRemoteImageMissing:0,baseUsageUnknown:1,baseStandaloneImageUnnecessary:3}};
 }
 const remote=data.remotePresentation;
 if(remote&&data.presentationAssets){
  out.presentationAssets={...data.presentationAssets,mediaEntries:unique([...data.presentationAssets.mediaEntries,...remote.mediaEntries,...(data.lateSceneArt?.mediaEntries||[])])};
  out.presentationAssets.skins=data.presentationAssets.skins.map(s=>remote.skins.find(r=>r.resourceKey===s.resourceKey)||s);
  if(remote.maps?.length)out.presentationAssets.maps=[...remote.maps,...data.presentationAssets.maps.filter(m=>!remote.maps.some(r=>r.id===m.id))];
  if(data.lateSceneArt?.mapsPatch){const p=data.lateSceneArt.mapsPatch;out.presentationAssets.maps=out.presentationAssets.maps.map(m=>m.id===p.mapId?{...m,slots:[...m.slots.filter(s=>!p.slots.some(r=>r.id===s.id)),...p.slots]}:m);}
  if(out.sceneConfig){
   const candidates=new Map([...(remote.area4Candidates||[]),...(data.lateSceneArt?.candidates||[])].map(c=>[c.id,c]));
   out.sceneConfig={...out.sceneConfig,mediaEntries:unique([...out.sceneConfig.mediaEntries,...remote.mediaEntries,...(data.lateSceneArt?.mediaEntries||[])]),tasks:out.sceneConfig.tasks.map(t=>({...t,decorSlots:t.decorSlots.map(slot=>({...slot,variants:slot.variants.map(v=>{const c=candidates.get(v.resourceKey);return c?{...v,previewKey:c.mediaKey,artStatus:'exact-remote-mesh-projection',previewUnavailableReason:null}:v;})}))}))};
  }
  if(data.artifactAvailability){
   out.artifactAvailability={...data.artifactAvailability,entries:data.artifactAvailability.entries.map(row=>{
    if(row.id==='scene-next-timeline'&&data.lateSceneStudy)return {...row,status:'research-projection',claim:'기본 Timeline13~292 전수 복원 및 Story/GameText 대조를 완료했습니다.',impact:'13_1부터13_10까지10개 장면의 최소 투영을 기존 시뮬레이션 흐름에 추가했습니다.',neededEvidence:['77일차8개 원본 텍스트 키 불일치의 실제 런타임 결과','후기 전체 원작 최종 렌더·음향·현재 출시 상한 대조'],sourceRefs:['late-scenes:story-audit'],boundary:'동봉106개 장면을 보존했습니다. 기본 분기를 named/fire 변형으로 교체하지 않았습니다.'};
    if(['base-gift-images','base-temp-component'].includes(row.id)&&data.itemRepresentationRemote)return {...row,status:row.id==='base-temp-component'?'research-projection':'curated',claim:row.id==='base-temp-component'?'정확 item_temp 외곽·만료 게이지의 원본 컴포넌트 연결을 확보했습니다.':'선물4타입이 공유하는 정확 EventActivityGift2/3 Sprite를 회수했습니다.',impact:'8타입 중7타입의 표현 규칙을 설명하고 정확한 외곽·공유 선물 그림을 표시합니다.',mediaKeys:data.itemRepresentationRemote.mediaEntries.map(m=>m.key),neededEvidence:['현재 활성 배정과 원작의 실제 사용 프레임'],boundary:'타입 수와 공유 이미지 파일 수를 구분하며 GIF 재현을 실제 사용 관측으로 취급하지 않습니다.'};
    if(row.id==='event-35-images'&&data.apkExpansion)return {...row,claim:data.apkExpansion.eventRegistrationAudit.sourceScopeCorrection,impact:'35타입별 정확 이미지 GUID·카탈로그·입증된 별칭은 미확보입니다. 다른 dogpark86그림으로 대체하지 않습니다.',neededEvidence:['해당35타입을 실제 사용하도록 연결한 버전의 정확 리소스/별칭 근거'],boundary:'기본 CDN이 확인되지 않아서 막힌 상태가 아닙니다. 기본 정상 등록 경로의 연구 fixture 정정입니다.'};
    const slot=row.id.startsWith('decor-12_')?row.id.slice(6):null,candidates=remote.area4Candidates.filter(c=>c.slot===slot);
    return candidates.length?{...row,status:'research-projection',claim:'정확한 Area4 GUID·카탈로그 의존 번들·프리팹·메시·재질·텍스처를 회수했습니다.',impact:'후보3개의 선정 기술 투영과 선택 레이어를 도감·시뮬레이션에 연결했습니다.',neededEvidence:['원작 실행의 최종 셰이더·카메라·활성 상태와 대조'],mediaKeys:candidates.map(c=>c.mediaKey),sourceRefs:[...(row.sourceRefs||[]),'remote-default-origin-arm32'],boundary:'정적 원격 배포 자산으로 만든 기술 투영이며 최종 원작 렌더와 구분합니다.'}:row;
   }),reviewDate:'2026-10-30',sources:unique([...data.artifactAvailability.sources,...(data.lateSceneStudy?.sources||[]),...(data.remoteOriginAudit?[{id:'remote-default-origin-arm32',path:'analysis/extracted/config.armeabi_v7a/lib/armeabi-v7a/libil2cpp.so',sha256:data.remoteOriginAudit.binarySha256,kind:'ELF32 ARM static default path; exact catalog GET verified'}]:[])])};
   const counts=Object.fromEntries(data.artifactAvailability.statuses.map(s=>[s.id,out.artifactAvailability.entries.filter(r=>r.status===s.id).length]));out.artifactAvailability.summary={...data.artifactAvailability.summary,statusRecords:counts,newlyRecoveredAssets:24,sceneTasksProjected:out.sceneConfig.tasks.length,sceneLastTask:'13_10',nextMissingTimelineTask:null,decorationRegisteredOnly:0};
  }
 }
 return out;
}

const list=x=>Array.isArray(x)?x:[];
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const doc=d=>d?.sceneCastStudy??d;
const sid=o=>o?.scene?.id??o?.scene??o?.task?.id??o?.task??o?.sceneId??'intro_timeline';
const secs=x=>Number.isFinite(Number(x))?Number(x).toFixed(3)+'초':'미확인';
const entry=d=>new Map(list(d?.motions).map(m=>[m.id,m]));
const title=(d,id)=>list(d?.roles).find(r=>r.id===id)?.title??id;
function choices(cue){return list(cue.actions).flatMap((a,i)=>[{key:String(i),action:a},...(a.codeDerivedNext?[{key:i+':loop',action:a.codeDerivedNext,codeDerived:true}]:[])]);}

export function sceneCastView(data,options={}){
 const d=doc(data),id=sid(options),byMotion=entry(d),mode=options.mode==='cg'||String(id).startsWith('cg-')?'cg':'timeline';
 const source=mode==='cg'?list(d?.CGScenes).find(s=>s.id===id):list(d?.scenes).find(s=>s.id===id);
 if(!source)return {valid:false,mode,sceneId:id,actors:[],message:'이 장면의 명시적인 캐릭터 참조를 아직 확보하지 못했습니다.'};
 const selected=options.selections??{},actors=[];
 if(mode==='cg'){
  for(const n of source.nodes){
   const available=n.motionIds.map(id=>byMotion.get(id)).filter(Boolean),key=selected[n.path],manual=Object.hasOwn(selected,n.path);
   const motion=manual?available.find(m=>m.id===key):available.find(m=>m.animation===n.startingAnimation);
   actors.push({key:n.path,role:n.role,title:n.role,CGNode:n,choices:available.map(m=>({key:m.id,label:m.animation,motion:m})),selectedKey:motion?.id??'',motion,
    relation:'serialized-CG-node',selectionNote:motion?'원본 prefab의 시작 선언 또는 사용자가 고른 모션입니다. 실제 C# 재생 순서는 미검증입니다.':'시작 animation이 비어 있습니다. 아래에서 원본 모션을 직접 선택하세요.'});
  }
 }else{
  const orders=list(source.orders).length?source.orders:[...new Set([...source.cues.map(c=>c.order),...source.plotOrders.map(c=>c.order)])].sort((a,b)=>a-b),order=Number.isFinite(Number(options.order))?Number(options.order):(orders[0]??0),candidates=source.cues.filter(c=>c.order<=order),latest=new Map();
  for(const cue of candidates)latest.set(cue.role,cue);
  for(const cue of latest.values()){
   const available=choices(cue),manual=selected[cue.id],key=manual??(cue.randomActionSelection?'':available[0]?.key??''),choice=available.find(c=>c.key===key),motion=byMotion.get(choice?.action.motionId);
   actors.push({key:cue.id,role:cue.role,title:title(d,cue.role),cue,choices:available.map(c=>({key:c.key,label:c.action.name+(c.codeDerived?' · 원본 코드의 다음 loop':''),motion:byMotion.get(c.action.motionId)})),selectedKey:key,motion,
    relation:cue.order===order?'current-source-order':'previous-source-directive',codeDerived:Boolean(choice?.codeDerived),
    selectionNote:cue.order===order?'현재 source order에 명시된 지시입니다.':`source order ${cue.order}의 마지막 지시를 참고합니다. 현재 활성·종료 상태를 뜻하지 않습니다.`});
  }
  return {valid:true,mode,sceneId:id,scene:source,order,orders,actors,speaker:list(d.speakers).find(s=>s.id===options.speaker)??null,requestedSpeaker:options.speaker??null,sourceClockApplied:options.clock==='source-clip'};
 }
 return {valid:true,mode,sceneId:id,scene:source,actors,sourceClockApplied:options.clock==='source-clip'};
}

function media(motion){
 if(!motion)return '<div class="scene-cast-placeholder"><strong>원본 후보를 직접 선택하세요.</strong><p>무작위 후보나 비어 있는 시작값을 기본 idle로 채우지 않습니다.</p></div>';
 const p=motion.projection,v=p?.media?.video,poster=p?.media?.poster;
 if(v)return `<video class="scene-cast-video" data-cast-motion="${e(motion.id)}" controls muted playsinline preload="none" poster="${e(poster.src)}" width="240" height="240" aria-label="${e(motion.role)} / ${e(motion.animation)} · 원작 촬영이 아닌 전 구간 source-time 기술 투영"><source src="${e(v.src)}" type="video/mp4">MP4를 지원하지 않는 브라우저입니다.</video><div class="scene-cast-seek" role="group" aria-label="원본 모션 시점 선택"><button type="button" data-cast-seek="start">시작</button><button type="button" data-cast-seek="middle">중간</button><button type="button" data-cast-seek="end">끝</button></div><output data-cast-time aria-live="polite">source 0–${e(secs(motion.duration))} · 무음 · 고정 bounds</output><p data-cast-error hidden>영상을 열지 못했습니다. <a href="${e(v.src)}" target="_blank" rel="noopener">영상 파일 열기</a></p>`;
 const seg=motion.segments?.[0],image=poster??seg?.poster;
 return image?`<img src="${e(image.src)}" alt="${e(motion.role)} / ${e(motion.animation)} 원본 데이터의 정적 기술 투영" width="${image.width}" height="${image.height}" loading="lazy" decoding="async"><p>정적 미리보기 · 전 구간 시크 영상은 이 항목에 연결하지 않았습니다.</p>`:'<p>연결된 축소 시연이 없습니다.</p>';
}
function proof(actor){
 const c=actor.cue,n=actor.CGNode;
 if(c)return `<p>원본 <code>${e(c.sourceRef)}</code> · 행 ${e(c.sourceRow)} · order ${e(c.order)} · <code>${e(c.type)}</code></p><dl><div><dt>위치 후보 · Unity 좌표</dt><dd><code>${e(JSON.stringify(c.positions))}</code></dd></div><div><dt>scale / flip</dt><dd>${e(c.scale)} / ${c.flip?'res':'nor'}</dd></div><div><dt>원본 loop / delay</dt><dd>${c.declaredLoop?'true':'false'} / ${e(c.delay)}초</dd></div></dl><p>위치·scale·flip은 메타로 보존했습니다. 이 원본 모션 비교 영상에는 장면 변환을 적용하지 않았습니다.</p>${c.randomActionSelection||c.randomPositionSelection?'<p>원본은 action·position 후보를 무작위 선택할 수 있습니다. 이 비교창의 선택을 원작 계정의 실제 선택으로 해석하지 않습니다.</p>':''}${c.selection==='explicit-ordered-action-list'?'<p>원본 action list의 순서와 delay를 보존했습니다. 이 비교창은 각 모션을 따로 재생하며 원작 queue·mix 전환을 자동 실행하지 않습니다.</p>':''}`;
 return `<p><code>${e(n.path)}</code></p><p>serialized active ${e(n.serializedActive)} · 형제 순서 ${e(n.siblingOrder)} · startingAnimation <code>${e(n.startingAnimation||'빈 값')}</code> · startingLoop ${e(n.startingLoop)}</p><p>Rect/scale은 원본 메타입니다. 아래 수치는 최종 화면 좌표로 적용하지 않았습니다.</p><pre>${e(JSON.stringify({rect:n.rect,scale:n.scale,rotationZ:n.rotationZDegrees},null,2))}</pre>`;
}
function actorHTML(actor,d){
 const m=actor.motion,role=list(d.roles).find(r=>r.id===actor.role),source=m?.source;
 return `<article class="scene-cast-actor" data-cast-actor="${e(actor.key)}"><header><h4>${e(actor.title)}</h4><p>${e(actor.selectionNote)}</p></header><label>명시된 원본 모션<select data-cast-select="${e(actor.key)}"><option value="">모션 직접 선택</option>${actor.choices.map(c=>`<option value="${e(c.key)}"${actor.selectedKey===c.key?' selected':''}>${e(c.label)}</option>`).join('')}</select></label>${media(m)}${m?`<p class="scene-cast-caption"><code>${e(m.animation)}</code> · ${e(secs(m.duration))} · APK 데이터 기술 투영</p>`:''}<details><summary>참조·원본 변환·지원 범위</summary>${proof(actor)}${role?`<p>RoleConfig ${e(role.configIndex1Based)}번 · <code>${e(role.prefab)}</code></p>`:''}${source?`<p>실제 skeleton <code>${e(source.serialized_file)} / ${e(source.path_id)}</code></p><p>SHA256 <code>${e(source.object_source_sha256)}</code></p>`:''}${m?.projection?.encoded?`<p>정적 표지 source ${e(secs(m.projection.posterSourceTime))} · 8Hz source 첫·끝 포함 · MP4 ${e(secs(m.projection.encoded.durationSeconds))} · 마지막 pose 유지 ${e(secs(m.projection.encoded.finalPoseHoldSeconds))} · source/PTS 최대 오차 ${e(m.projection.encoded.sourceTimePTSMaximumErrorSeconds)}초</p>`:''}<p>원작 맵 부모 Transform·카메라·셰이더·음향은 이 평면에 포함하지 않았습니다. 재생은 source 모션 자체의 비교이며 장면 전체와 동기화한 원작 실행 결과가 아닙니다.</p></details></article>`;
}

export function renderSceneCast(data,options={}){
 const d=doc(data),v=sceneCastView(d,options);
 if(!v.valid)return `<section class="scene-cast-study"><h3>캐릭터 원본 지시</h3><p>${e(v.message)}</p></section>`;
 const controls=options.controls!==false;
 return `<section class="scene-cast-study" data-cast-scene="${e(v.sceneId)}"><header class="scene-cast-intro"><h3>${v.mode==='cg'?'CG 캐릭터 · 수동 기술 플레이어':'전신 캐릭터 · 원본 Timeline 연결'}</h3><p>${v.mode==='cg'?'실제 prefab 참조로 모션을 연결했습니다. C# 자동 순서·타이틀·인트로에 연결한 완성 CG가 아닙니다.':'현재 및 직전 source 지시를 별도 비교 평면에 표시합니다. 원작 맵 배치나 실제 활성 상태를 뜻하지 않습니다.'}</p></header>${controls?`<div class="scene-cast-controls"><label>참조 장면<select data-cast-scene-select><optgroup label="선택된 Timeline 117장면">${list(d.scenes).map(s=>`<option value="${e(s.id)}"${s.id===v.sceneId?' selected':''}>${e(s.id)} · ${e(s.name)}</option>`).join('')}</optgroup><optgroup label="원본 CG prefab 3종">${list(d.CGScenes).map(s=>`<option value="${e(s.id)}"${s.id===v.sceneId?' selected':''}>${e(s.id)}</option>`).join('')}</optgroup></select></label>${v.mode==='timeline'?`<label>source order<select data-cast-order>${v.orders.map(o=>`<option value="${o}"${o===v.order?' selected':''}>${o}번</option>`).join('')}</select></label>`:''}</div>`:''}${v.requestedSpeaker?`<p class="scene-cast-speaker">대사 화자 <strong>${e(v.speaker?.title??v.requestedSpeaker)}</strong> · ${v.speaker?'UI 초상은 별도 UIPrefabConfig 경로입니다. 대사 감정을 전신 포즈로 자동 변환하지 않았습니다.':'해당 화자의 초상 경로를 이 자료에서 확인하지 못했습니다.'}</p>`:''}${v.actors.length?`<div class="scene-cast-grid">${v.actors.map(a=>actorHTML(a,d)).join('')}</div>`:'<p>이 source order까지 명시된 전신 지시가 없습니다. 임의의 캐릭터·idle을 대신 넣지 않았습니다.</p>'}<details class="scene-cast-boundary"><summary>확보 범위와 원본 실행에 남아 있는 차이</summary><p>117장면의 전신 action 참조 ${d.summary.directActionReferences.toLocaleString('ko-KR')}건을 정확한 RoleConfig·animation 이름으로 연결했습니다. 전체 44역할/888모션 중 이 장면에서 참조하는 고유171모션과 코드의 다음 loop9종을 사용합니다.</p><p>CG 3개 prefab의 21개 node는 원본 skeleton 19개를 재사용합니다. 시작 animation이 비어 있으면 모션을 자동 선택하지 않습니다.</p>${list(d.boundaries).map(x=>`<p>${e(x)}</p>`).join('')}<p><a href="#spine-motions">654개 추가 Spine 모션 도감</a> · <a href="#checklist">전체 체크리스트</a></p></details></section>`;
}

function allVideos(root){return [...root.querySelectorAll('.scene-cast-study video')];}
export function createSceneCast({getData,render,getOptions=()=>({})}){
 let context={},selections={},mounted=null,latestKey='';
 const options=()=>({...getOptions(),...context,selections});
 const stop=()=>{if(mounted)for(const v of allVideos(mounted))v.pause();};
 const repaint=()=>{stop();render();};
 function seek(video,row,time){
  const p=row?.projection;if(!p?.encoded)return;
  const times=p.sourceSampleTimes,index=times.reduce((best,t,i)=>Math.abs(t-time)<Math.abs(times[best]-time)?i:best,0),pts=p.encoded.framePTS[index];
  const apply=()=>{video.pause();video.currentTime=Math.max(0,Math.min(pts,Math.max(0,video.duration-.00001)));const output=video.closest('[data-cast-actor]')?.querySelector('[data-cast-time]');if(output)output.textContent='source '+secs(times[index])+' · 영상 '+secs(pts);};
  if(video.readyState>=1)apply();else{video.addEventListener('loadedmetadata',apply,{once:true});video.load();}
 }
 return {renderPage(external){if(external)context={...context,...external};return renderSceneCast(getData(),options());},
  handleClick(event){const b=event.target.closest('[data-cast-seek]');if(!b)return false;const card=b.closest('[data-cast-actor]'),video=card?.querySelector('video'),m=entry(doc(getData())).get(video?.dataset.castMotion);if(!video||!m)return true;seek(video,m,b.dataset.castSeek==='end'?m.duration:b.dataset.castSeek==='middle'?m.duration/2:0);return true;},
  handleChange(event){const t=event.target;
   if(t.hasAttribute('data-cast-select')){selections={...selections,[t.dataset.castSelect]:t.value};repaint();return true;}
   if(t.hasAttribute('data-cast-scene-select')){context={...context,scene:t.value,mode:String(t.value).startsWith('cg-')?'cg':'timeline'};delete context.order;selections={};repaint();return true;}
   if(t.hasAttribute('data-cast-order')){context={...context,order:Number(t.value)};selections={};repaint();return true;}return false;},
  mount(root=document){mounted=root;const o=options();latestKey=String(sid(o))+':'+o.order;
   for(const video of allVideos(root)){
    video.addEventListener('error',()=>{const n=video.closest('[data-cast-actor]')?.querySelector('[data-cast-error]');if(n)n.hidden=false;},{once:true});
    if(o.clock==='source-clip'&&Number.isFinite(o.time))seek(video,entry(doc(getData())).get(video.dataset.castMotion),o.time);
    // Parent/global scene time is never silently treated as a clip clock.
    if(o.clock==='source-clip'&&o.playing===true)Promise.resolve(video.play()).catch(()=>{});
   }
  },
  update(next={}){const key=String(sid({...getOptions(),...context,...next}))+':'+(next.order??context.order??getOptions().order),changed=key!==latestKey;if(changed){selections={};stop();}context={...context,...next};
   if(mounted&&!changed&&options().clock==='source-clip')for(const v of allVideos(mounted)){
    if(Number.isFinite(next.time))seek(v,entry(doc(getData())).get(v.dataset.castMotion),next.time);
    if(next.playing===true)Promise.resolve(v.play()).catch(()=>{});else if(next.playing===false)v.pause();
   }else if(mounted&&next.playing===false)stop();
  },cleanup(){stop();mounted=null;},reset(){context={};selections={};stop();}};
}

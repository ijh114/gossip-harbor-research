import {renderSourceSceneStage} from './source-scene-stage.mjs';
import {presentationMedia} from './presentation-model.mjs';
const scenes=d=>d.presentationAssets?.opening?.cgScenes||[];
const own=(x,k)=>Object.hasOwn(x,k);
export function createCGPresentation(d){return {schema:1,sceneId:scenes(d)[0]?.id||null,hidden:[],mode:'serialized'};}
export function validCGPresentation(s,d){if(s===undefined)return true;const rows=scenes(d);return s!==null&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).every(k=>['schema','sceneId','hidden','mode'].includes(k))&&s.schema===1&&(s.sceneId===null||rows.some(r=>r.id===s.sceneId))&&['serialized','all'].includes(s.mode)&&Array.isArray(s.hidden)&&s.hidden.length<=300&&new Set(s.hidden).size===s.hidden.length&&s.hidden.every(id=>typeof id==='string'&&rows.some(r=>r.nodes.some(n=>n.path===id)));}
export function cgPresentationAction(s,event,d){
 if(!s||!validCGPresentation(s,d))return {ok:false,message:'CG 표시 저장을 보존했습니다. JSON으로 보관한 뒤 표시 상태만 초기화하세요.'};
 if(event.type==='select'){if(!scenes(d).some(r=>r.id===event.value))return {ok:false};s.sceneId=event.value;}
 else if(event.type==='mode'){if(!['serialized','all'].includes(event.value))return {ok:false};s.mode=event.value;}
 else if(event.type==='toggle-layer'){const row=scenes(d).find(r=>r.id===s.sceneId);if(!row?.nodes.some(n=>n.path===event.value))return {ok:false};if(s.hidden.includes(event.value))s.hidden=s.hidden.filter(x=>x!==event.value);else s.hidden.push(event.value);}
 else return {ok:false};return {ok:true,message:'정적 CG 구성 보기를 변경했습니다. 인트로 진행·과제·재화는 바뀌지 않습니다.'};
}
function parent(path){return path.slice(0,path.lastIndexOf('/'));}
export function cgPresentationView(s,d){
 if(!validCGPresentation(s,d))return {valid:false,scene:null,layers:[],omitted:[]};
 const state=s||createCGPresentation(d),scene=scenes(d).find(r=>r.id===state.sceneId)||scenes(d)[0];if(!scene)return {valid:true,scene:null,layers:[],omitted:[],state};
 const images=scene.nodes.filter(n=>n.kind==='image'&&presentationMedia(d,n.mediaKey)),base=images.filter(n=>n.rect?.sizeDelta?.every(Number.isFinite)).sort((a,b)=>b.rect.sizeDelta[0]*b.rect.sizeDelta[1]-a.rect.sizeDelta[0]*a.rect.sizeDelta[1])[0],width=base?.rect.sizeDelta[0]||1,height=base?.rect.sizeDelta[1]||1,layers=[],omitted=[];
 for(const n of images){const r=n.rect,a=r?.anchorMin,b=r?.anchorMax,p=r?.pivot,at=r?.anchoredPosition,size=r?.sizeDelta;
  const fixed=a?.length===2&&b?.length===2&&a.every((v,i)=>v===b[i])&&[...a,...p||[],...at||[],...size||[],...n.scale||[1,1,1]].every(Number.isFinite)&&p?.length===2&&at?.length===2&&size?.length===2;
  if(!fixed||parent(n.path)!==parent(base?.path||'')){omitted.push({path:n.path,reason:'중첩/늘어나는 Rect의 최종 부모 배치 미확인'});continue;}
  const w=size[0]*(n.scale?.[0]??1),h=size[1]*(n.scale?.[1]??1),alpha=Number.isFinite(n.color?.a)?n.color.a:1;
  if(state.hidden.includes(n.path)||state.mode==='serialized'&&(!n.serializedActive||alpha===0))continue;
  layers.push({path:n.path,media:presentationMedia(d,n.mediaKey),left:a[0]+at[0]/width-p[0]*w/width,top:1-a[1]-at[1]/height-(1-p[1])*h/height,width:w/width,height:h/height,alpha:state.mode==='all'?1:alpha,rotationZDegrees:n.rotationZDegrees||0,pivot:p,order:n.siblingOrder??0});
 }
 layers.sort((a,b)=>a.order-b.order);
 return {valid:true,scene,state,width,height,layers,omitted,images,spines:scene.nodes.filter(n=>n.kind==='spine-skeleton-graphic'),boundaries:['원본 Image의 형제 순서와 고정 Rect를 웹 기준 평면에 투영합니다. 최종 Canvas·부모 배치·실제 재생 좌표 일치는 미확인입니다.','각 그림은 정적 레이어이며 시간순 영상 프레임이 아닙니다. Spine·C# 시퀀스·사운드 동기화는 별도입니다.','이 CG를 Timeline_intro 또는 타이틀의 배경이라고 자동 연결하지 않습니다.']};
}
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(kind,label,value)=>`<button class="game-button" data-play="cg:${kind}"${value===undefined?'':' data-value="'+e(value)+'"'}>${e(label)}</button>`;
export function renderCGPresentation(s,d){
 const v=cgPresentationView(s.cgPresentation,d);
 if(!v.valid)return '<section class="cg-presentation" data-game-screen="cg"><h2>CG 표시 저장을 보존했습니다</h2><button class="game-button" data-play="export">상태 JSON</button>'+button('reset-invalid','백업 후 CG 표시만 초기화')+'<button class="game-button" data-play="game-cg-close">이전 화면으로</button></section>';
 if(!v.scene)return '<section class="cg-presentation" data-game-screen="cg"><h2>CG 정적 구성</h2><p>선정된 CG 자산이 없습니다.</p><button class="game-button" data-play="game-cg-close">이전 화면으로</button></section>';
 return `<section class="cg-presentation" data-game-screen="cg"><header><h2>CG 레이어 · 원본 구성 비교</h2><p>동봉 CG의 실제 이미지와 컴포넌트를 비교합니다. 아래 장면은 완성된 원작 CG 영상 재생이 아닙니다.</p></header>${d.sourceSceneStage?'<div data-live-source-stage>'+renderSourceSceneStage(d.sourceSceneStage,{mode:'cg',scene:v.scene.id,playing:true})+'</div>':''}<label>원본 프리팹<select data-cg-select>${scenes(d).map(r=>'<option value="'+e(r.id)+'"'+(r.id===v.scene.id?' selected':'')+'>'+e(r.id)+' · '+e(r.prefab.split('/').at(-1))+'</option>').join('')}</select></label><div class="game-tool-actions">${button('mode','선언된 활성·투명도','serialized')}${button('mode','확보 레이어 모두 비교','all')}</div><div class="cg-static-plane" style="aspect-ratio:${v.width}/${v.height}" role="img" aria-label="선정 CG 이미지의 정적 순서/좌표 투영">${v.layers.map(r=>`<img src="${e(r.media.src)}" alt="${e(r.media.alt)}" style="left:${r.left*100}%;top:${r.top*100}%;width:${r.width*100}%;height:${r.height*100}%;opacity:${r.alpha};transform:rotate(${-r.rotationZDegrees}deg);transform-origin:${r.pivot[0]*100}% ${(1-r.pivot[1])*100}%" draggable="false">`).join('')}</div><p>${v.layers.length}개 공통 부모 레이어 표시 · 전체 확보 그림 ${v.images.length}개 · Spine ${v.spines.length}개 · 위 합성 무대와 기존 정적 비교 분리</p><details><summary>원본 레이어·선정 실물</summary><div class="cg-layer-gallery">${v.images.map(n=>{const m=presentationMedia(d,n.mediaKey);return `<figure><img src="${e(m.src)}" alt="${e(m.alt)}" width="${m.width}" height="${m.height}" loading="lazy"><figcaption><code>${e(n.path)}</code><br>형제 순서 ${n.siblingOrder} · active ${n.serializedActive} · alpha ${n.color?.a??1}</figcaption>${button('toggle-layer',v.state.hidden.includes(n.path)?'합성에 포함':'합성에서 숨기기',n.path)}</figure>`;}).join('')}</div></details><details><summary>Spine·버튼·원본 근거와 미연결 부분</summary>${v.boundaries.map(x=>'<p>'+e(x)+'</p>').join('')}<ul>${v.spines.map(n=>'<li>'+e(n.path)+' · 초기 애니메이션 '+e(n.startingAnimation||'빈 값/런타임 미확인')+' · loop '+e(n.startingLoop)+'</li>').join('')}</ul>${v.omitted.map(n=>'<p>'+e(n.path)+' · '+e(n.reason)+'</p>').join('')}<p><code>${e(v.scene.prefab)}</code></p><pre>${e(JSON.stringify(v.scene.buttons||v.scene.callbacks||[],null,2))}</pre></details><button class="game-button" data-play="game-cg-close">이전 화면으로</button></section>`;
}

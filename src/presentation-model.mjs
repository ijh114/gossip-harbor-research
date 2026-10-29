import {completedDecorSlots} from './decor-model.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const maps=d=>d.presentationAssets?.maps||[];
export function createMapPresentation(d){return {schema:1,mapId:maps(d)[0]?.id||null,layerMode:'current',selectedSlot:null,surface:'capture'};}
export function validMapPresentation(s,d){
 if(s===undefined)return true;
 return object(s)&&Object.keys(s).every(k=>['schema','mapId','layerMode','selectedSlot','surface'].includes(k))&&s.schema===1&&(s.surface===undefined||['capture','geometry'].includes(s.surface))&&(s.mapId===null||maps(d).some(m=>m.id===s.mapId))&&['current','base'].includes(s.layerMode)&&(s.selectedSlot===null||maps(d).some(m=>m.slots?.some(r=>r.id===s.selectedSlot)));
}
export function mapPresentationAction(s,event,d){
 if(!s||!validMapPresentation(s,d))return {ok:false,message:'맵 표시 저장을 보존했습니다. JSON으로 보관한 뒤 해당 표시 상태만 초기화하세요.'};
 const copy=structuredClone(s);
 if(event.type==='select-map'){const map=maps(d).find(m=>m.id===event.value);if(!map)return {ok:false,message:'확보한 맵만 선택할 수 있습니다.'};copy.mapId=map.id;copy.selectedSlot=null;}
 else if(event.type==='surface'){if(!['capture','geometry'].includes(event.value))return {ok:false};copy.surface=event.value;}
 else if(event.type==='layers'){if(!['current','base'].includes(event.value))return {ok:false};copy.layerMode=event.value;}
 else if(event.type==='select-slot'){const map=maps(d).find(m=>m.slots?.some(r=>r.id===event.value));if(!map)return {ok:false,message:'좌표와 자산이 등록된 슬롯을 선택하세요.'};copy.mapId=map.id;copy.selectedSlot=event.value;}
 else return {ok:false,message:'지원하지 않는 맵 표시 조작입니다.'};
 if(!validMapPresentation(copy,d))return {ok:false};Object.assign(s,copy);return {ok:true,message:'웹 맵 표시를 변경했습니다. 과제·디자인·재화는 바꾸지 않았습니다.'};
}
function variant(slot,id){return (slot.variants||[]).find(v=>String(v.id)===String(id))||(slot.variantMediaKeys?.[id]?{id,mediaKey:slot.variantMediaKeys[id],boundsNormalized:slot.boundsNormalized}:null);}
export function mapPresentationView(s,c,d,{slotId=null,preview=null,skin=false}={}){
 const saved=s.mapPresentation;
 if(!validMapPresentation(saved,d))return {valid:false,map:null,layers:[],unknown:[],message:'호환되지 않는 맵 표시 저장을 보존했습니다.'};
 const settings=saved||createMapPresentation(d),chosen=slotId&&maps(d).find(m=>m.slots?.some(r=>r.id===slotId)),map=chosen||maps(d).find(m=>m.id===settings.mapId)||maps(d)[0];
 if(!map)return {valid:true,map:null,layers:[],unknown:[],message:'공통 시점의 맵 자료를 준비하고 있습니다.'};
 const completed=completedDecorSlots(s,c,d.sceneConfig),records=new Map(completed.map(r=>[r.id,r])),layers=[],unknown=[];
 for(const slot of map.slots||[]){
  const record=records.get(slot.id);let id=record?.current,isPreview=false;
  if(!record&&map.defaultStyleId==='0'&&map.defaultStyleSourceRefs?.length&&variant(slot,'0'))id='0';
  if(preview&&slot.id===preview.slotId&&record){id=preview.variant;isPreview=true;}
  if(skin){const state=s.skinLab,skinChoice=state?.edit?.preview?.[slot.id]??state?.slots?.[slot.id];if(skinChoice!==undefined){id=skinChoice;isPreview=Boolean(state?.edit?.preview&&Object.hasOwn(state.edit.preview,slot.id));}}
  if(id===null||id===undefined){if(record)unknown.push({slotId:slot.id,reason:'이전 저장의 디자인 선택 기록 미확인'});continue;}
  const v=variant(slot,id);if(v?.status==='empty-projected-layer'&&String(id)==='0')continue;if(!v?.mediaKey){unknown.push({slotId:slot.id,variant:String(id),reason:v?.unavailableReason||'동봉 실물 또는 공통 시점 레이어 미확보'});continue;}
  if(settings.layerMode==='current'||isPreview)layers.push({slotId:slot.id,variant:String(id),mediaKey:v.mediaKey,boundsNormalized:v.boundsNormalized||slot.boundsNormalized,depth:v.depth??slot.depth??0,isPreview,sourceRefs:v.sourceRefs||slot.sourceRefs||[]});
 }
 layers.sort((a,b)=>a.depth-b.depth||a.slotId.localeCompare(b.slotId));
 return {valid:true,map,settings,layers,unknown,completed:completed.filter(r=>(map.slots||[]).some(x=>x.id===r.id)),selectedSlot:slotId||settings.selectedSlot,message:'원본 기하·슬롯의 공통 웹 투영입니다. 원작 카메라·조명·재질·활성 상태의 완전 일치는 미확인입니다.'};
}
export function presentationMedia(d,key){
 const entries=[...(d.presentationAssets?.mediaEntries||[]),...(d.sceneConfig?.mediaEntries||[]),...(d.storyRecapConfig?.mediaEntries||[])],m=entries.find(m=>m.key===key);
 return m?.kind==='image'&&/^\.\/assets\/media\/[\w./-]+\.(png|webp|jpg)$/.test(m.src)&&!m.src.includes('..')?m:null;
}

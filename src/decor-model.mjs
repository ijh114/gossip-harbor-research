// Normal player-choice editing only. Skin ownership/purchases and linked-slot
// variants are outside this bounded editor. The main wallet is never touched.
const result=(ok,message)=>({ok,message});
export function completedDecorSlots(s,c,scenes){
 const done=new Set(c.quests.slice(0,s.questsDone).map(q=>q.id)),slots=new Map();
 for(const scene of scenes?.tasks||[])if(done.has(scene.id))for(const slot of scene.decorSlots||[]){
  const current=s.screenFlow?.decor?.[slot.id],valid=slot.variants.some(v=>v.id===current);
  slots.set(slot.id,{...slot,sceneId:scene.id,name:scene.name,area:scene.area,current:valid?current:null,historicalUnknown:!valid});
 }
 return [...slots.values()];
}
function eligible(s,c,scenes,id){
 if(s.stage!=='home'||s.modal||s.pendingQuest)return null;
 return completedDecorSlots(s,c,scenes).find(x=>x.id===id)||null;
}
export function beginDecorEdit(s,c,scenes,id,{inputLocked=false}={}){
 const slot=eligible(s,c,scenes,id);if(!slot||inputLocked)return result(false,'맵에서 진행 중인 안내·과제를 마친 뒤 완료한 기본 장식을 선택하세요.');
 s.screenFlow.decorEdit={slotId:id,original:slot.current,selected:slot.current};s.screenFlow.phase='decor-edit';
 return result(true,slot.historicalUnknown?'이전 웹 저장의 선택 기록이 없습니다. 디자인을 선택하면 새 웹 기록을 만듭니다.':'기존 장식을 미리 보고 다시 선택하세요. 확정 전에는 저장된 디자인을 바꾸지 않습니다.');
}
export function decorEditView(s,c,scenes){
 const edit=s.screenFlow?.decorEdit,slot=edit&&eligible(s,c,scenes,edit.slotId);
 if(!slot||s.screenFlow.phase!=='decor-edit')return null;
 const selected=slot.variants.some(x=>x.id===edit.selected)?edit.selected:null;
 return {slot,selected,original:edit.original,conflict:slot.current!==edit.original,canConfirm:selected!==null&&slot.current===edit.original};
}
export function previewDecor(s,c,scenes,id){
 const view=decorEditView(s,c,scenes);if(!view||!view.slot.variants.some(x=>x.id===id))return result(false,'등록된 디자인만 선택할 수 있습니다.');
 s.screenFlow.decorEdit.selected=id;return result(true,'디자인 미리보기 · 확정하면 웹 장식 기록에 저장됩니다.');
}
export function confirmDecorEdit(s,c,scenes){
 const view=decorEditView(s,c,scenes);if(!view?.canConfirm)return result(false,'선택한 디자인과 현재 장식 기록을 확인하고 다시 열어주세요.');
 s.screenFlow.decor[view.slot.id]=view.selected;s.screenFlow.decorEdit=null;s.screenFlow.phase='decor';
 return result(true,'기본 장식 변경을 저장했습니다. 과제·경험치·재화·보상은 바꾸지 않았습니다.');
}
export function cancelDecorEdit(s){
 if(s.screenFlow?.phase!=='decor-edit')return result(false,'열린 장식 편집이 없습니다.');
 s.screenFlow.decorEdit=null;s.screenFlow.phase='decor';return result(true,'미리보기를 취소하고 이전 장식을 유지했습니다.');
}

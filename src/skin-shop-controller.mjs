import {createSkinAcquisitionState,restoreSkinAcquisition,renderSkinAcquisition,mountSkinAcquisition,getVerifiedSkinAcquisitions} from './skin-acquisition.mjs';
import {createSkinLab,validSkinLab} from './skin-lab.mjs';
export const SKIN_SHOP_KEY='harbor-skin-acquisition-v1';
const clone=x=>structuredClone(x);
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Only replay-verified transaction receipts can enter this bridge. Existing
// research ownership is never copied in the opposite direction into receipts.
export function mergeSkinAcquisitionOwnership(lab,ledger,acquisitionConfig,skinConfig){
 const verified=getVerifiedSkinAcquisitions(ledger,acquisitionConfig);
 const next=lab===undefined?createSkinLab(skinConfig):clone(lab);
 if(!validSkinLab(next,skinConfig))throw Error('기존 Skin 연구 저장을 보존했습니다. 호환 상태를 먼저 확인하세요.');
 const ids=new Set(skinConfig.groups.flatMap(g=>g.skins.map(x=>x.id)));
 if(verified.skinIds.some(id=>!ids.has(id)))throw Error('영수증과 선정 Skin ID가 일치하지 않습니다.');
 const acquired=verified.skinIds.filter(id=>!next.owned.includes(id));
 next.owned.push(...acquired);next.researchGrants+=acquired.length;
 if(!validSkinLab(next,skinConfig))throw Error('장식 소유권 합성 검증에 실패했습니다.');
 return {lab:next,acquired};
}

export function createSkinShopController({getData,download,onAcquire,storage:providedStorage}){
 let state,loaded=false,storage=null,lastRaw=null,invalidRaw=null,notice='',unmount=()=>{};
 const config=()=>getData()?.skinAcquisitionStudy;
 function ensure(){
  const c=config();if(!c)return null;
  if(!loaded){loaded=true;try{storage=providedStorage??globalThis.localStorage;lastRaw=storage?.getItem(SKIN_SHOP_KEY)??null;}catch{storage=null;notice='저장을 읽을 수 없어 메모리에서만 진행합니다. 읽지 못한 원본에는 쓰지 않습니다.';}
   if(lastRaw!==null){try{state=restoreSkinAcquisition(lastRaw,c);}catch{invalidRaw=lastRaw;}}
   else state=createSkinAcquisitionState(c);
  }return c;
 }
 async function persist(draft,{expectedState}){
  if(invalidRaw!==null)return false;
  if(!storage)return true;
  try{const current=storage.getItem(SKIN_SHOP_KEY);if(current!==lastRaw)return false;
   if(JSON.stringify(expectedState)!==JSON.stringify(state))return false;
   const raw=JSON.stringify(draft);storage.setItem(SKIN_SHOP_KEY,raw);lastRaw=raw;return true;
  }catch{return false;}
 }
 function sync(){const c=ensure();if(!c||!state||invalidRaw!==null)return;try{onAcquire?.(clone(state),c);}catch(error){notice=error.message||'영수증은 보존했습니다. 맵 연결을 다시 시도하세요.';}}
 return {
  renderPage(){const c=ensure();if(!c)return '<p>Skin 획득 근거 자료가 필요합니다.</p>';
   if(invalidRaw!==null)return '<section class="skin-acquisition"><h1>Skin 획득 원본을 보존했습니다</h1><p>영수증 재검증에 실패해 저장을 덮어쓰지 않았습니다.</p><button class="button" data-skin-shop-export-raw>보존한 원본 내려받기</button></section>';
   sync();return `<p role="status">${e(notice)}</p>`+renderSkinAcquisition(state,c)+'<p><button class="button" data-skin-shop-sync>영수증으로 맵 소유권 다시 연결</button> · 게임 플레이 → 과제 목록 → Skin 소유권·연동 슬롯 연구에서 미리보기와 적용을 확인할 수 있습니다.</p>';
  },
  handleClick(event){if(event.target.closest?.('[data-skin-shop-export-raw]')){download?.('skin-acquisition-original.txt',invalidRaw,'text/plain');return true;}if(event.target.closest?.('[data-skin-shop-sync]')){sync();const out=event.target.parentElement;out?.insertAdjacentHTML('beforeend',`<span role="status">${e(notice||'검증 영수증을 다시 연결했습니다.')}</span>`);return true;}return false;},
  afterMount(root){unmount();const c=ensure();if(!c||!state||invalidRaw!==null)return;
   unmount=mountSkinAcquisition(root,state,c,{persist,onAcquire:()=>{onAcquire?.(clone(state),c);},onExport:text=>download?.('skin-acquisition-research.json',JSON.parse(text))});
  },cleanup(){unmount();unmount=()=>{};},getState(){ensure();return state?clone(state):null;}
 };
}

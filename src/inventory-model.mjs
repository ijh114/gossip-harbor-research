// Bounded ordinary inventory reconstructed from MainBoardModel, ItemStoreModel
// and InventorySlotConfig. Pure local state transitions: no UI/network/payment.
// Factory, premium inventory and live server flags are not silently simulated.
const integer=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const result=(ok,message,extra={})=>({ok,message,...extra});
const itemFor=(config,type)=>config.items?.find(item=>item.type===type);

function rulesFor(config){
 const r=config?.inventoryRules;
 if(!record(r)||typeof r.enabled!=='boolean'||!integer(r.defaultSlots)||!integer(r.maxSlots,1000)||r.defaultSlots>r.maxSlots||!integer(r.unlockLevel)||!Array.isArray(r.unlockCosts)||r.unlockCosts.length!==r.maxSlots||r.unlockCosts.some(cost=>!integer(cost)))return null;
 return r;
}
export function createInventory(config){
 if(!rulesFor(config))throw new TypeError('Verified inventoryRules are required; no inferred slot defaults.');
 return {schema:1,purchasedSlots:0,items:[]};
}
export function inventoryCapacity(state,config){
 const r=rulesFor(config),n=state?.inventory?.purchasedSlots;
 return r&&integer(n,r.maxSlots-r.defaultSlots)?r.defaultSlots+n:null;
}
export function nextInventoryCost(state,config){
 const r=rulesFor(config),cap=inventoryCapacity(state,config);
 return r&&cap!==null&&cap<r.maxSlots?r.unlockCosts[cap]:null;
}
function factoryOpen(state,config){
 if(typeof state.generatorFactoryOpen==='boolean')return state.generatorFactoryOpen;
 if(state.generatorFactoryOpen===null)return null;
 const required=rulesFor(config)?.factory?.requiredUnlockTypes;
 if(record(state.itemUnlocks)&&Array.isArray(required)&&required.some(type=>state.itemUnlocks[type]!==true))return false;
 return null;
}
function factoryRestriction(state,cell,config){
 if(!rulesFor(config)?.factory?.fragmentTypes?.includes(cell.type))return null;
 const open=factoryOpen(state,config);
 return open===false?null:open===true?'생성기 공장의 조각입니다. 일반 창고와 별도인 공장 이동은 현재 분석 범위에서 실행하지 않습니다.':'생성기 공장의 서버·해금 상태가 미확인입니다. 조각을 임의로 이동하지 않습니다.';
}
function storeRestriction(state,cell,config){
 const rules=rulesFor(config),metadata=state.generatorState?.[cell.uid];
 if(cell.cover!==null||cell.locked===true||rules.forbiddenWrapperTypes?.includes(cell.type))return '상자·거미줄·잠금·버블·임시 아이템은 일반 창고에 넣을 수 없습니다.';
 if(state.bubbles?.[cell.uid]||cell.temporary===true)return '버블·임시 아이템은 먼저 해제해야 합니다.';
 if(rules.timedTransformTypes?.includes(cell.type)||cell.transformDuration!==undefined&&cell.transformDuration!==null||state.transformState?.[cell.uid]?.duration!==undefined&&state.transformState[cell.uid].duration!==null)return '시간에 따라 변형되는 아이템은 보관할 수 없습니다.';
 if(rules.swallowCannotMoveTypes?.includes(cell.type)||cell.swallowAllowTap===false||state.swallowState?.[cell.uid]?.allowTap===false)return '이 삼킴 아이템은 이동·보관이 허용되지 않습니다.';
 if(metadata?.spreadState===2||metadata?.phase==='opening')return '열리는 중인 아이템은 오픈 완료 후 보관하세요.';
 return null;
}
function ready(state,config){
 const rules=rulesFor(config);
 if(!rules||!state?.inventory||!validInventory(state,config)||!Array.isArray(state.board)||state.board.length!==63||!record(state.wallet)||!record(state.generatorState))return '보관함 상태와 분석 설정을 확인하지 못했습니다.';
 if(!rules.enabled)return '현재 기본 설정에서는 보관함 기능이 해제되어 있습니다.';
 if(!integer(state.wallet.level)||state.wallet.level<rules.unlockLevel)return `보관함 해금은 Lv${rules.unlockLevel}입니다.`;
 return null;
}
function sortInventory(state,config){
 if(state.inventoryOrder!==true)return;
 // ItemStoreModel.Sort: preserve each chain's first appearance, then order its
 // members by chain level. Equal-level identity is never merged or recreated.
 const groups=new Map();
 for(const cell of state.inventory.items){
  const item=itemFor(config,cell.type),chain=item.chainId;
  if(!groups.has(chain))groups.set(chain,[]);groups.get(chain).push(cell);
 }
 state.inventory.items=[...groups.values()].flatMap(group=>group.sort((a,b)=>itemFor(config,a.type).chainLevel-itemFor(config,b.type).chainLevel));
}
export function storeItem(state,index,config){
 const error=ready(state,config);if(error)return result(false,error);
 if(!integer(index,62)||!state.board[index])return result(false,'보관할 보드 아이템을 선택하세요.');
 const cell=state.board[index],item=itemFor(config,cell.type);
 if(!item||!integer(cell.uid)||cell.uid===0)return result(false,'타입과 UID가 확인된 아이템만 보관할 수 있습니다.');
 const restriction=storeRestriction(state,cell,config)||factoryRestriction(state,cell,config);
 if(restriction)return result(false,restriction);
 if(item.generator&&!record(state.generatorState[cell.uid]))return result(false,'생성기의 현재 충전 상태를 확인하지 못했습니다.');
 if(state.inventory.items.length>=inventoryCapacity(state,config))return result(false,'보관함이 가득 찼습니다. 출고하거나 다음 슬롯을 구매하세요.');
 state.board[index]=null;state.inventory.items.push(cell);sortInventory(state,config);
 if(state.selected===index)state.selected=null;
 return result(true,'동일 아이템을 보관했습니다. UID·충전량·시작 시각·가위 횟수를 유지합니다.',{cells:[index],inventorySlot:state.inventory.items.indexOf(cell)});
}
export function withdrawItem(state,slot,config){
 const error=ready(state,config);if(error)return result(false,error);
 if(!integer(slot,state.inventory.items.length-1))return result(false,'출고할 보관 아이템을 선택하세요.');
 const cell=state.inventory.items[slot],restriction=factoryRestriction(state,cell,config);
 if(restriction)return result(false,restriction);
 // MainBoardModel.RetrieveStoredItem uses valid-order, not spread-ring order.
 const index=state.board.findIndex(cell=>cell===null);if(index<0)return result(false,'보드가 가득 차 출고하지 않았습니다.');
 state.inventory.items.splice(slot,1);state.board[index]=cell;
 // Do not reset, pause or refresh any UID metadata here. The next ordinary
 // board tick catches up using the retained absolute start timestamp.
 return result(true,'보드의 첫 빈칸으로 출고했습니다. 저장된 아이템 상태를 유지합니다.',{cells:[index],inventorySlot:slot});
}
export function buyInventorySlot(state,config){
 const error=ready(state,config);if(error)return result(false,error);
 const cost=nextInventoryCost(state,config);
 // Original BuyStoreSlot lacks this guard; its public UI has only32 cells.
 if(cost===null)return result(false,'내장 일반 보관함의 최대 슬롯 수에 도달했습니다.');
 if(!integer(state.wallet.gems)||state.wallet.gems<cost)return result(false,`슬롯 구매에 젬 ${cost}개가 필요합니다.`);
 state.wallet.gems-=cost;state.inventory.purchasedSlots++;
 return result(true,`일반 보관함 ${inventoryCapacity(state,config)}칸 해금 · 젬 −${cost}`);
}

/** Inventory subset validator. Old saves with no inventory remain readable.
 * Parent validPlay owns nextUid and all board+stored per-UID metadata values.
 * This function checks dense storage, capacity, known cells, UID duplication and
 * static store restrictions, but not today's factory gate: an older stored
 * fragment may legitimately remain after the factory subsequently unlocks. */
export function validInventory(state,config){
 try{
  if(!record(state))return false;
  if(state.inventory===undefined)return true;
  const rules=rulesFor(config),inv=state.inventory;
  if(!rules||!record(inv)||inv.schema!==1||!integer(inv.purchasedSlots,rules.maxSlots-rules.defaultSlots)||!Array.isArray(inv.items)||inv.items.length>rules.defaultSlots+inv.purchasedSlots||Object.keys(inv.items).length!==inv.items.length)return false;
  if(state.generatorFactoryOpen!==undefined&&state.generatorFactoryOpen!==null&&typeof state.generatorFactoryOpen!=='boolean')return false;
  if(state.inventoryOrder!==undefined&&typeof state.inventoryOrder!=='boolean')return false;
  const uids=new Set((state.board||[]).filter(Boolean).map(cell=>cell.uid));
  for(const cell of inv.items){
   if(!record(cell)||!integer(cell.uid)||cell.uid===0||uids.has(cell.uid)||typeof cell.type!=='string'||cell.cover!==null)return false;
   const item=itemFor(config,cell.type);if(!item||storeRestriction(state,cell,config))return false;
   if(cell.uses!==undefined&&(cell.type!==config.specialRules?.specialTools?.scissors?.type||!integer(cell.uses)||cell.uses===0))return false;
   if(item.generator&&!record(state.generatorState?.[cell.uid]))return false;
   uids.add(cell.uid);
  }
  return true;
 }catch{return false;}
}

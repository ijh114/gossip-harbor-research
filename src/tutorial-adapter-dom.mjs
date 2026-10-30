import {sampleTutorialFireworks} from './tutorial-surfaces.mjs';
import {validTutorialAdapterRegistry,validTutorialAdapterState} from './tutorial-adapter.mjs';
// Registry metadata is JSON; nodes never enter a saved game or research context.
// A host can register a real native-equivalent component explicitly. Unrelated
// event panels are deliberately absent from the built-in mappings.
const registries=new WeakMap(),mounts=new WeakMap();
const CAPABILITIES=['enabled','orderIconEnabled','goButtonEnabled','dragEnabled','scrollEnabled','touchCloseEnabled','sliderEnabled','transformEnabled','buttonsEnabled','effectVisible','characterVisible','glow','prompt','tabs','viewport','maskVisible','harrisonMotion','roomTimeline','timedTip','openWindow','help','refresh','nativeCurve'];
const controlRoles={orderIconEnabled:'order-icon',goButtonEnabled:'go',sliderEnabled:'slider',transformEnabled:'transform',buttonsEnabled:'tutorial-button'};
const partRoles={effectVisible:'effect',characterVisible:'harrison',maskVisible:'mask'};
const getNodes=root=>[...root.querySelectorAll('[data-play]')];
const actionList=node=>[...new Set([node,...getNodes(node)].map(n=>n.dataset?.play).filter(Boolean))];
const attached=node=>Boolean(node&&typeof node.querySelectorAll==='function'&&node.isConnected);
export function registerTutorialAdapterTarget(root,node,definition){
 if(!attached(node)||!root.contains(node))throw new TypeError('현재 실제로 마운트된 컴포넌트만 등록하세요.');
 const entry={...structuredClone(definition),capabilities:[...(definition.capabilities||[])],actions:[...(definition.actions||actionList(node))],origin:'verified-web-adapter'};
 for(const property of entry.capabilities){const role=controlRoles[property];if(role&&!node.matches('[data-tutorial-control="'+role+'"]')&&!node.querySelector('[data-tutorial-control="'+role+'"]'))throw new TypeError(property+'는 해당 원본 하위 컨트롤의 명시 DOM 결합이 필요합니다.');}
 for(const property of entry.capabilities){const role=partRoles[property];if(role&&!node.matches('[data-tutorial-part="'+role+'"]')&&!node.querySelector('[data-tutorial-part="'+role+'"]'))throw new TypeError(property+'는 해당 원본 하위 표시 요소의 명시 DOM 결합이 필요합니다.');}
 entry.controlActions=Object.fromEntries(Object.entries(controlRoles).filter(([property])=>entry.capabilities.includes(property)).map(([property,role])=>[property,[...new Set([node,...node.querySelectorAll('[data-tutorial-control="'+role+'"]')].filter(n=>n.matches('[data-tutorial-control="'+role+'"]')).map(n=>n.dataset.play).filter(Boolean))]]));
 if(entry.capabilities.some(c=>!CAPABILITIES.includes(c))||!validTutorialAdapterRegistry({schema:1,epoch:'explicit-mount',targets:[entry]}))throw new TypeError('구현된 DOM 기능과 정확한 원본 창·대상 계약이 필요합니다.');
 const entries=registries.get(root)||new Map();entries.set(entry.id,{node,entry});registries.set(root,entries);
 return ()=>{if(entries.get(entry.id)?.node===node)entries.delete(entry.id);};
}
export function collectTutorialAdapterTargets(root,{epoch='mounted-web',factoryTipSelector='[data-factory-tutorial-tip]'}={}){
 if(!root||typeof root.querySelector!=='function')throw new TypeError('실제 화면의 루트가 필요합니다.');
 const nodes=new Map(),targets=[];
 function add(id,node,definition){if(!attached(node)||nodes.has(id))return;nodes.set(id,node);targets.push({id,kind:'component',sourceWindow:'MainBoard',capabilities:[],actions:actionList(node),origin:'verified-web-adapter',...definition});}
 // An inventory button is a HUD only within the game board, not an arbitrary
 // settings/example button bearing the same action elsewhere on the page.
 add('hud.inventory',root.querySelector('.game-bottom [data-play="inventory"], .source-play-actions [data-play="inventory"]'),{kind:'hud',role:'hud-inventory',capabilities:['enabled'],actions:['inventory']});
 const inventory=root.querySelector('.inventory-dialog'),factory=root.querySelector('.factory-page');
 const window=inventory||factory;
 add('inventory.window',window,{kind:'window',sourceWindow:'InventoryWindow',role:'window',capabilities:['prompt','scrollEnabled'],actions:window?actionList(window):[]});
 add('inventory.factory-tab',inventory?.querySelector('[data-play="game-factory-open"]'),{sourceWindow:'InventoryWindow',role:'factory-tab',capabilities:['enabled'],actions:['game-factory-open']});
 add('inventory.factory-detail',factory?.querySelector('.factory-groups'),{sourceWindow:'InventoryWindow',role:'factory-detail',capabilities:[],actions:[]});
 add('main.order-area',root.querySelector('.game-customer-lane, .source-order-lanes'),{kind:'viewport',sourceWindow:'MainBoard',role:'order-area',capabilities:['viewport','scrollEnabled']});
 for(const {node,entry}of registries.get(root)?.values()||[])if(attached(node)&&root.contains(node))add(entry.id,node,entry);
 for(const target of targets)target.ancestorIds=targets.filter(p=>p.id!==target.id&&nodes.get(p.id).contains(nodes.get(target.id))).map(p=>p.id);
 const registry={schema:1,epoch:String(epoch),targets};
 if(!validTutorialAdapterRegistry(registry))throw new TypeError('DOM 대상 레지스트리가 유효하지 않습니다.');
 return {root,registry,nodes,factoryTipSelector};
}
function mountState(root){let state=mounts.get(root);if(!state){state={baseline:new WeakMap(),scrolls:new WeakMap(),prompts:new Map(),procedures:new Map(),windows:new Map(),guards:null};mounts.set(root,state);}return state;}
function baseline(node,mount){if(!mount.baseline.has(node))mount.baseline.set(node,{disabled:node.hasAttribute('data-runtime-blocked')?false:Boolean(node.disabled),overflow:node.style.overflow,overflowX:node.style.overflowX,overflowY:node.style.overflowY,draggable:node.getAttribute('draggable'),hidden:node.hidden,outline:node.style.outline,outlineOffset:node.style.outlineOffset});return mount.baseline.get(node);}
function controls(node){return [...new Set([...(node.matches?.('button,input,select,textarea')?[node]:[]),...node.querySelectorAll('button,input,select,textarea')])];}
/** Apply committed values to actual controls. Staging/probing never calls this.
 * Core-disabled buttons keep their baseline; source enable=true cannot bypass
 * an unlock, absent item or insufficient currency gate. */
export function applyTutorialAdapterDOM(bundle,state,{now=0}={}){
 if(!bundle?.root||!validTutorialAdapterRegistry(bundle.registry)||!validTutorialAdapterState(state))return {ok:false,status:'invalid-input',applied:[],missing:[]};
 const mount=mountState(bundle.root),applied=[],missing=[];
 for(const target of bundle.registry.targets){const node=bundle.nodes.get(target.id);if(!attached(node)){missing.push(target.id);continue;}const value=state.targets[target.id]||{},base=baseline(node,mount);
  for(const control of controls(node)){const before=baseline(control,mount),disabled=value.enabled===false||Object.entries(controlRoles).some(([key,role])=>value[key]===false&&control.matches('[data-tutorial-control="'+role+'"]'));control.disabled=before.disabled||control.hasAttribute('data-runtime-blocked')||disabled;control.toggleAttribute('data-tutorial-adapter-disabled',disabled);}
  if(target.capabilities.includes('scrollEnabled')){node.style.overflow=value.scrollEnabled===false?'hidden':base.overflow;node.style.overflowX=value.scrollEnabled===false?'hidden':base.overflowX;node.style.overflowY=value.scrollEnabled===false?'hidden':base.overflowY;node.dataset.tutorialScrollEnabled=String(value.scrollEnabled!==false);}
  if(target.capabilities.includes('dragEnabled')){if(value.dragEnabled===false)node.setAttribute('draggable','false');else if(base.draggable===null)node.removeAttribute('draggable');else node.setAttribute('draggable',base.draggable);node.dataset.tutorialDragEnabled=String(value.dragEnabled!==false);}
  for(const [key,role]of Object.entries(partRoles))if(target.capabilities.includes(key)&&typeof value[key]==='boolean'){const part=node.matches('[data-tutorial-part="'+role+'"]')?node:node.querySelector('[data-tutorial-part="'+role+'"]');if(part)part.hidden=!value[key];}
  if(target.capabilities.includes('glow')){node.style.outline=value.glow?'3px solid #e4a528':base.outline;node.style.outlineOffset=value.glow?'3px':base.outlineOffset;}
  if(target.capabilities.includes('touchCloseEnabled'))node.dataset.tutorialTouchCloseEnabled=String(value.touchCloseEnabled!==false);
  if(value.activeTab&&target.capabilities.includes('tabs'))for(const tab of node.querySelectorAll('[data-tutorial-tab]')){const selected=tab.dataset.tutorialTab===value.activeTab;tab.setAttribute('aria-selected',String(selected));const panel=node.querySelector('[data-tutorial-panel="'+tab.dataset.tutorialTab.replace(/[^a-zA-Z0-9_-]/g,'')+'"]');if(panel)panel.hidden=!selected;}
  if(value.scrollRequest&&target.capabilities.includes('viewport')&&mount.scrolls.get(node)!==value.scrollRequest.generation){const dest=bundle.nodes.get(value.scrollRequest.id);if(dest&&node.contains(dest)){const left=Math.max(0,dest.offsetLeft+dest.offsetWidth/2-node.clientWidth/2),top=Math.max(0,dest.offsetTop+dest.offsetHeight/2-node.clientHeight/2);if(typeof node.scrollTo==='function')node.scrollTo({left,top,behavior:'auto'});else{node.scrollLeft=left;node.scrollTop=top;}mount.scrolls.set(node,value.scrollRequest.generation);}else missing.push(value.scrollRequest.id);}
  if(target.capabilities.includes('prompt')){
   const generation=value.promptGeneration||0;let prompt=mount.prompts.get(target.id);if(!prompt||prompt.generation!==generation){prompt={generation,elapsed:0,last:now,consumed:value.promptCanShow===false,shown:false};mount.prompts.set(target.id,prompt);node.querySelector('[data-tutorial-factory-gesture]')?.remove();}
   const delta=Math.max(0,now-prompt.last);prompt.last=now;if(!value.promptStopped&&!prompt.consumed)prompt.elapsed+=delta;
   if(!prompt.consumed&&prompt.elapsed>2){prompt.consumed=true;const tip=node.querySelector(bundle.factoryTipSelector);prompt.shown=Boolean(tip&&!tip.disabled);}
   if(prompt.shown&&!node.querySelector('[data-tutorial-factory-gesture]')){const tip=node.querySelector(bundle.factoryTipSelector);if(tip&&!tip.disabled){const mark=node.ownerDocument.createElement('span');mark.dataset.tutorialFactoryGesture='';mark.textContent='탭';mark.setAttribute('aria-label','공장 조각 안내');tip.append(mark);}}
   node.dataset.tutorialPromptStopped=String(value.promptStopped===true);node.dataset.tutorialPromptGeneration=String(generation);
  }
  if(target.capabilities.includes('maskVisible'))node.dataset.tutorialMaskVisible=String(value.maskVisible===true);
  if(target.capabilities.includes('help')){const part=node.querySelector('[data-tutorial-part="help-window"]');if(part&&typeof value.helpVisible==='boolean')part.hidden=!value.helpVisible;}
  if(target.capabilities.includes('openWindow')&&value.openWindow&&mount.windows.get(target.id)!==value.openWindow.generation){const part=node.querySelector('[data-tutorial-part="opened-window"]');if(part){part.hidden=false;part.dataset.sourceWindow=value.openWindow.name;mount.windows.set(target.id,value.openWindow.generation);}}
  if(target.capabilities.includes('refresh')){const out=node.querySelector('[data-tutorial-refresh-output]'),model=state.models?.['bakeOut:research-bakeout'];if(out&&model){const cost=model.free?0:model.costs[Math.min(model.exchangeTimes,model.costs.length-1)];out.textContent='연구 비용 '+cost+' gold → 20 token · 무료 '+model.free+' · 유료 횟수 '+model.exchangeTimes;}}
  for(const [property,kind]of [['harrisonGeneration','harrison'],['roomGeneration','room'],['tipGeneration','tip'],['nativeCurveGeneration','native-curve']])if(value[property]){
   const key=target.id+':'+kind;let proc=mount.procedures.get(key);if(!proc||proc.generation!==value[property]){proc={generation:value[property],startedAt:now};mount.procedures.set(key,proc);}const elapsed=Math.max(0,now-proc.startedAt);
   if(kind==='native-curve'){const frame=sampleTutorialFireworks(target.nativeCurveSpec,elapsed),rootPart=node.querySelector('[data-tutorial-part="native-curve-root"]'),icon=node.querySelector('[data-tutorial-part="native-curve-icon"]'),effect=node.querySelector('[data-tutorial-part="native-curve-effect"]');if(frame&&rootPart&&icon&&effect){rootPart.style.transform='scale3d('+frame[''].scale.join(',')+')';icon.style.transform='scale3d('+frame.icon.scale.join(',')+')';effect.hidden=!frame['icon/effect_huojian_sweep'].active;rootPart.dataset.sourceClipTime=String(Math.min(1,elapsed));rootPart.dataset.sourceClipEnded=String(elapsed>=1);}}
   if(kind==='harrison'){const avatar=node.querySelector('[data-tutorial-part="harrison"]'),bubble=node.querySelector('[data-tutorial-part="harrison-bubble"]');if(avatar){avatar.hidden=false;avatar.style.transform='translateX('+(-490*Math.min(1,elapsed/.3))+'px)';avatar.dataset.sourceMoveX=String(-490*Math.min(1,elapsed/.3));}if(bubble)bubble.hidden=elapsed<.3;}
   if(kind==='tip'){const part=node.querySelector('[data-tutorial-part="fireworks-tip"]');if(part)part.hidden=elapsed>=2;}
   if(kind==='room'){const countdown=node.querySelector('[data-tutorial-part="countdown"]'),animator=node.querySelector('[data-tutorial-part="room-animator"]'),audio=node.querySelector('[data-tutorial-part="room-audio"]');if(countdown)countdown.style.opacity='0';node.dataset.tutorialRoomLocked=String(elapsed<1);if(animator){animator.hidden=elapsed<1;if(elapsed>=1)animator.dataset.animatorTrigger='Show';}if(elapsed>=1)node.dataset.researchRoomUnlockMark='removed';if(audio)audio.textContent=elapsed>=1.25?'Audio request: sfxEnergyBoostOn · 실제 음원 동기화 미검증':'';}
  }
  applied.push(target.id);
 }
 for(const id of mount.prompts.keys())if(!bundle.nodes.has(id))mount.prompts.delete(id);
 // Capture handlers block wheel/touch/drag/overlay close where CSS alone does
 // not enforce the source component's input flag. The controller still checks
 // pure tutorialAdapterPermission for button actions.
 if(!mount.guards){const handler=event=>{const element=event.target?.nodeType===1?event.target:event.target?.parentElement;if(!element)return;const denied=event.type==='dragstart'?element.closest('[data-tutorial-drag-enabled="false"]'):['wheel','touchmove'].includes(event.type)?element.closest('[data-tutorial-scroll-enabled="false"]'):event.type==='cancel'?element.closest('[data-tutorial-touch-close-enabled="false"]'):event.type==='click'?element.closest('[data-tutorial-mask-visible="true"], [data-tutorial-room-locked="true"]'):null;if(denied){event.preventDefault();event.stopImmediatePropagation();}};for(const name of ['dragstart','wheel','touchmove','cancel','click'])bundle.root.addEventListener(name,handler,{capture:true,passive:false});mount.guards=handler;}
 return {ok:missing.length===0,status:missing.length?'target-detached':'applied',applied,missing};
}
export function clearTutorialAdapterDOM(root){const mount=mounts.get(root);if(!mount)return;for(const name of ['dragstart','wheel','touchmove','cancel','click'])root.removeEventListener(name,mount.guards,{capture:true});mounts.delete(root);}

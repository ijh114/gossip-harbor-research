import {createTutorialExtension,tutorialExtensionEvent,extensionView,validTutorialExtension} from './tutorial-extension.mjs';
import {createMoreTutorials,moreTutorialEvent,moreTutorialView,validMoreTutorials} from './tutorial-more.mjs';
import {createTutorialCatalog,tutorialCatalogEvent,tutorialCatalogView,validTutorialCatalog} from './tutorial-catalog.mjs';
import {onboardingConstraints} from './onboarding-model.mjs';
import {createFactoryPlay,factoryView} from './factory-play.mjs';
import {factoryContext} from './factory-transaction.mjs';
import {createTutorialAdapterSession,validTutorialAdapterState,validTutorialAdapterRegistry,tutorialAdapterInputLocked,tutorialAdapterPermission} from './tutorial-adapter.mjs';
// TutorialModel.lua:178–217 uses pairs, not a numeric tutorial priority. This
// coordinator preserves concurrent listeners and asks for a research order only
// when a source event would acquire multiple visible/strong masks at once.
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max=300)=>typeof v==='string'&&v.length<=max;
const time=v=>Number.isFinite(v)&&v>=0&&v<=1e9;
const clone=v=>structuredClone(v);
const safe=k=>!['__proto__','prototype','constructor'].includes(k);
function bounded(v,max=1500000){try{if(JSON.stringify(v).length>max)return false;const walk=x=>{if(x===null)return true;if(typeof x==='number')return Number.isFinite(x);if(x&&typeof x==='object'){if(!Array.isArray(x)&&![Object.prototype,null].includes(Object.getPrototypeOf(x)))return false;for(const [k,val]of Object.entries(x))if(!safe(k)||!walk(val))return false;return true;}return typeof x==='string'||typeof x==='boolean';};return walk(v);}catch{return false;}}
const result=(ok,status,message,extra={})=>({ok,status,message,changed:false,events:[],unknown:[],...extra});
const unique=a=>[...new Set(a)];
const emptyConstraints=()=>({forceSource:null,forceTarget:null,forceEffect:null,forceSpreadCode:null,forceSkipCost:null,forceBubbleCost:null,dragLocks:[]});
function validConstraints(c){return obj(c)&&Object.keys(c).length===7&&Object.keys(emptyConstraints()).every(k=>Object.hasOwn(c,k))&&Array.isArray(c.dragLocks)&&c.dragLocks.length<=128&&new Set(c.dragLocks).size===c.dragLocks.length&&c.dragLocks.every(x=>text(x,200)&&x.length>0)&&['forceSource','forceTarget','forceEffect'].every(k=>c[k]===null||obj(c[k])&&Number.isInteger(c[k].x)&&Number.isInteger(c[k].y)&&c[k].x>=0&&c[k].y>=0&&c[k].x<=100&&c[k].y<=100)&&['forceSkipCost','forceBubbleCost'].every(k=>c[k]===null||time(c[k]))&&(c.forceSpreadCode===null||text(c.forceSpreadCode,160)||Number.isSafeInteger(c.forceSpreadCode));}
function applyConstraint(c,delta){const {action,value}=delta;if(action==='ClearTempDatas')return emptyConstraints();if(action==='ClearDragLock'){c.dragLocks=[];return c;}if(action==='AddDragLock'){if(!c.dragLocks.includes(value))c.dragLocks.push(value);return c;}if(action==='UnDragLock'){c.dragLocks=c.dragLocks.filter(x=>x!==value);return c;}const key={SetForceSourceBoardPosition:'forceSource',SetForceTargetBoardPosition:'forceTarget',SetForceEffectBoardPosition:'forceEffect',SetForceSpreadItemCode:'forceSpreadCode',SetForceSkipCost:'forceSkipCost',SetForceUnlockBubbleCost:'forceBubbleCost'}[action];if(!key)throw Error('constraint');c[key]=clone(value);return c;}
function configs(data){return {base:data?.tutorialConfig,more:data?.tutorialMoreConfig,catalog:data?.tutorialCatalogConfig||data?.tutorialCatalog};}
function definitions(data){const c=configs(data);return Object.entries(c).flatMap(([bank,config])=>(config?.guides||[]).map(guide=>({bank,config,guide,id:guide.id})));}
function revisions(data){return Object.fromEntries(Object.entries(configs(data)).filter(([,v])=>v).map(([k,v])=>[k,v.revision]));}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function fingerprint(v){const s=JSON.stringify(v);let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619);}return String(n>>>0)+':'+s.length;}
function adapter(row){return row.bank==='base'?{create:createTutorialExtension,valid:validTutorialExtension,event:tutorialExtensionEvent,view:extensionView}:row.bank==='more'?{create:createMoreTutorials,valid:validMoreTutorials,event:moreTutorialEvent,view:moreTutorialView}:{create:createTutorialCatalog,valid:validTutorialCatalog,event:tutorialCatalogEvent,view:tutorialCatalogView};}
function entryView(entry,row,ctx){const v=adapter(row).view(entry.state,ctx,row.config),poll=Number.isFinite(entry.pollAt)&&!v.active?entry.pollAt:null,due=[v.nextDueAt,poll].filter(Number.isFinite);return {...v,id:row.id,name:row.guide.name||row.id,strong:v.strong??Boolean(v.active?.strong),inputLocked:v.inputLocked??Boolean(v.active?.inputLocked),registered:Array.isArray(v.registered)?v.registered.includes(row.id):v.registered===true,completed:Array.isArray(v.completed)?v.completed.includes(row.id):v.completed===true,nextDueAt:entry.blockedContext===fingerprint(ctx)?null:due.length?Math.min(...due):null};}
const callbackPhases={tutorial_battlepass:['main-tip','ticket-highlight'],tutorial_event_energyboost_simple:['click-1'],tutorial_story_recap:['dialogue'],tutorial_change_decoration:['dialogue'],tutorial_generator_factory_Acquire:['inventory-highlight'],tutorial_battlepass_bonus_task:['bonus-dialog'],tutorial_energyBoosteight_start:['boost-highlight'],tutorial_weekly_quest_bonus_star:['star-area'],tutorial_event_task_extra_reward_entry:['chest-highlight'],tutorial_generator_boost_active:['active-area','close-area']};
function allowedCallbacks(v){return v.allowedActions||callbackPhases[v.id]?.includes(v.active?.phase)?v.allowedActions||[{type:'mask-click',label:'원작 마스크 콜백'}]:[];}
export function createTutorialRuntime(data){return {schema:1,revisions:revisions(data),enabled:true,time:0,entries:{},registered:[],completed:[],diagnostics:{},overrides:{},order:[],constraints:emptyConstraints(),ambiguity:null,deferredEvents:[],seenEvents:[],history:[],lastContext:null,lastManagerContext:null,managerStarted:false,sequence:0};}
export function validTutorialRuntime(s,data){try{
 const rows=definitions(data),byId=new Map(rows.map(r=>[r.id,r]));
 if(s===undefined)return true;
 const expected=revisions(data);if(!obj(s)||s.schema!==1||!obj(s.revisions)||Object.keys(s.revisions).length!==Object.keys(expected).length||Object.entries(expected).some(([k,v])=>s.revisions[k]!==v)||typeof s.enabled!=='boolean'||!time(s.time)||!obj(s.entries)||!obj(s.diagnostics)||!obj(s.overrides)||!Array.isArray(s.registered)||!Array.isArray(s.completed)||!Array.isArray(s.order)||!Array.isArray(s.seenEvents)||s.seenEvents.length>100||!Array.isArray(s.history)||s.history.length>100||!Number.isSafeInteger(s.sequence)||s.sequence<0||!(s.lastContext===null||text(s.lastContext,100))||!bounded(s))return false;
 for(const a of [s.registered,s.completed,s.order])if(a.length>200||new Set(a).size!==a.length||a.some(x=>!text(x,200)))return false;
 if(s.completed.some(id=>!s.registered.includes(id))||s.order.some(id=>!byId.has(id)))return false;
 for(const [id,entry]of Object.entries(s.entries)){const row=byId.get(id);if(!row||!obj(entry)||entry.bank!==row.bank||!adapter(row).valid(entry.state,row.config)||entry.state.time>s.time||['suspendedForManual','externalFinished'].some(k=>entry[k]!==undefined&&typeof entry[k]!=='boolean')||entry.pollAt!==undefined&&entry.pollAt!==null&&!time(entry.pollAt)||entry.blockedContext!==undefined&&!text(entry.blockedContext,100))return false;}
 for(const [id,value]of Object.entries(s.overrides))if(!byId.has(id)||!obj(value)||!bounded(value,32768))return false;
 if(s.ambiguity!==null&&(!obj(s.ambiguity)||!Array.isArray(s.ambiguity.candidates)||s.ambiguity.candidates.length<2||s.ambiguity.candidates.some(id=>!byId.has(id))||!obj(s.ambiguity.event)))return false;
 if(s.deferredEvents!==undefined&&(!Array.isArray(s.deferredEvents)||s.deferredEvents.length>128||s.deferredEvents.some(d=>!obj(d)||!obj(d.event)||d.event.type!=='source-event'||!obj(d.context)||d.context.mode!=='research'||!time(d.event.now)||d.event.now>s.time)))return false;
 if(s.deferredEvents?.length&&!s.ambiguity)return false;
 if(s.managerStarted!==undefined&&typeof s.managerStarted!=='boolean'||s.lastManagerContext!==undefined&&s.lastManagerContext!==null&&!text(s.lastManagerContext,100))return false;
 if(s.constraints!==undefined&&!validConstraints(s.constraints))return false;
 if(new Set(s.seenEvents).size!==s.seenEvents.length||s.seenEvents.some(id=>!text(id,200)))return false;
 for(const h of s.history)if(!obj(h)||!time(h.time)||h.time>s.time||!text(h.kind,100)||!(h.id===null||text(h.id,200))||!text(h.detail,1500))return false;
 for(const d of Object.values(s.diagnostics))if(!obj(d)||!text(d.status,100)||!Array.isArray(d.unknown)||d.unknown.some(x=>!text(x,500))||!text(d.message,1500)||d.contextFingerprint!==undefined&&!text(d.contextFingerprint,100))return false;
 return Object.keys(s.entries).length<=rows.length&&Object.keys(s.diagnostics).every(id=>byId.has(id));
}catch{return false;}}
function normalizeConditions(g){if(Array.isArray(g.configConditions))return g.configConditions;return String(g.condition||'').split(',').filter(Boolean).map(raw=>{const [kind,...a]=raw.split('-');return {raw,kind,args:a.join('-').split('#').filter(Boolean)};});}
function eligible(row,ctx){const unknown=[];for(const r of normalizeConditions(row.guide)){let pass;
 if(r.kind==='TutorialFinished'){if(!Array.isArray(ctx.registeredTutorials))unknown.push('registeredTutorials');else pass=r.args.every(id=>ctx.registeredTutorials.includes(id));}
 else if(r.kind==='MainLevel'){if(!Number.isFinite(ctx.level))unknown.push('level');else pass=ctx.level>=Number(r.args[0]||0);}
 else if(r.kind==='FunctionEnabled'){if(!obj(ctx.functionEnabled))unknown.push('functionEnabled');else{for(const k of r.args)if(typeof ctx.functionEnabled[k]!=='boolean')unknown.push('functionEnabled.'+k);if(!unknown.length)pass=r.args.every(k=>ctx.functionEnabled[k]);}}
 else if(r.kind==='TaskFinished'){if(!Array.isArray(ctx.finishedTasks))unknown.push('finishedTasks');else pass=r.args.every(id=>ctx.finishedTasks.includes(id));}
 else if(r.kind==='CachedItemPushed'){if(!Array.isArray(ctx.cachedItems))unknown.push('cachedItems');else pass=r.args.length?ctx.cachedItems.some(t=>r.args.includes(String(t))):ctx.cachedItems.length>0;}
 else if(r.kind==='BakeOutStart'){if(!obj(ctx.activities)||!Object.hasOwn(ctx.activities,'BakeOut'))unknown.push('activities.BakeOut');else if(ctx.activities.BakeOut===null)pass=false;else if(typeof ctx.activities.BakeOut.bakeOutModeOn!=='boolean')unknown.push('activities.BakeOut.bakeOutModeOn');else pass=ctx.activities.BakeOut.bakeOutModeOn;}
 else if(r.kind==='CashDashStart'){if(!obj(ctx.activities)||!Object.hasOwn(ctx.activities,'CashDash'))unknown.push('activities.CashDash');else if(ctx.activities.CashDash===null)pass=false;else if(typeof ctx.activities.CashDash.state!=='string')unknown.push('activities.CashDash.state');else pass=ctx.activities.CashDash.state!=='Released';}
 else unknown.push('config-condition:'+r.raw);
 if(pass===false)return {eligible:false,status:'ineligible',unknown:[]};
 }return {eligible:unknown.length===0,status:unknown.length?'unknown':'eligible',unknown:unique(unknown)};}
function contextFor(s,id,ctx){const override=s.overrides[id]||{},out={...override,...ctx,mode:'research'};for(const key of ['facts','activities','definitions','constants','collections','targetBindings','effectResults'])out[key]={...(obj(override[key])?override[key]:{}),...(obj(ctx[key])?ctx[key]:{})};out.registeredTutorials=unique([...(ctx.registeredTutorials||[]),...s.registered]);out.ongoingTutorials=Object.entries(s.entries).filter(([key,e])=>key!==ctx.manualGuideId&&!e.externalFinished&&!e.state.completed?.includes(key)&&!['torn-down','registered-not-restored'].includes(e.state.status)).map(([key])=>key);out.globalConstraints=clone(s.constraints||emptyConstraints());return out;}
function log(s,kind,id,detail){s.history.push({time:s.time,kind,id:id||null,detail});s.history=s.history.slice(-100);}
const canonical=name=>String(name||'').replace(/^EEventType\./,'');
function translate(event,row){if(row.bank==='catalog')return {...event,guideId:row.id};
 if(event.type!=='source-event')return {...event,guideId:row.id};const name=canonical(event.sourceEvent),p=event.payload;let mapped;
 const types={GameModeChangeFinished:'game-mode-change-finished',OpenView:'view-opened',CloseView:'view-closed',EnergyBoostModeChanged:'energy-mode-changed',GeneratorFactoryStateChanged:'factory-state-changed',GeneratorFactoryTabBoardItem:'factory-item-tapped',MainDecorNewChangeDecorationTutorial:'decoration-reward',WeeklyActiveQuestBonusStarCollect:'weekly-bonus-star-collected',PassActivityBonusTaskCellCreated:'pass-bonus-cell-created',TaskExtraRewardTutorialStart:'extra-reward-start',GeneratorBoostBuffActiveAniEnd:'generator-buff-animation-ended'};
 mapped=types[name]||name;
 return {type:mapped,guideId:row.id,now:event.now,...(obj(p)?p:{}),...(['OpenView','CloseView'].includes(name)?{name:typeof p==='string'?p:p?.name||p?.viewName}:{}),...(name==='GeneratorFactoryStateChanged'?{isOpen:typeof p==='boolean'?p:p?.isOpen}:{}),...(name==='GeneratorFactoryTabBoardItem'?{uid:p?.uid}:{})};}
function knownMainBindings(ctx,main,data){const config=configs(data).catalog;if(!config)return;
 const bindings={
  'GM.SceneManager:GetGameMode':()=>typeof ctx.gameMode==='string'?ctx.gameMode:undefined,
  'GM.LevelModel:GetCurrentLevel':()=>ctx.level,
  'GM.MainBoardModel:GetCachedItemCount':()=>ctx.cachedItemCount,
  'GM.MainBoardModel:IsGeneratorFactoryOpen':()=>ctx.generatorFactoryOpen,
  'MainBoardView.GetInstance':()=>typeof ctx.mainBoardViewAvailable==='boolean'?(ctx.mainBoardViewAvailable?{$view:'MainBoard'}:null):undefined,
  'GM.UIManager:IsEventLock':()=>ctx.eventLocked,
  'GM.UIManager:GetEventLock':()=>ctx.eventLocked
 };
 function visit(x){if(!x||typeof x!=='object')return;if(x.call&&x.factId&&bindings[x.call]){const value=bindings[x.call]();if(value!==undefined)ctx.facts[x.factId]=clone(value);}for(const v of Object.values(x))if(v&&typeof v==='object')visit(v);}
 for(const g of config.guides)visit(g.programs);
}
/** Only states implemented in this web game are bound automatically. Missing
 * live activity assignment, reward cells and native rectangles stay unknown. */
export function buildTutorialRuntimeContext(main,data,ui={}){
 const p=data.playConfig,ctx={mode:'research',activities:{},facts:{},targetBindings:{},definitions:{},constants:{},effectResults:{},collections:{}};
 if(!main||!p)return ctx;
 ctx.tutorialEconomySupported=ui.tutorialEconomySupported===true;ctx.level=main.wallet?.level;ctx.finishedTasks=Array.isArray(p.quests)&&Number.isInteger(main.questsDone)?p.quests.slice(0,main.questsDone).map(q=>String(q.id)):[];
 ctx.cachedItems=Array.isArray(main.queue)?unique(main.queue.filter(q=>q.count>0).map(q=>String(q.type))):[];ctx.cachedItemCount=Array.isArray(main.queue)?main.queue.reduce((n,q)=>n+(Number.isSafeInteger(q.count)?q.count:0),0):0;
 ctx.registeredTutorials=unique([...(main.onboarding?.registeredFinished||[]),...(main.tutorialBridge?.engine?.registeredFinished||[]),...Object.values(main.tutorialBridge?.savedBanks||{}).flatMap(b=>b.registeredFinished||[])]);if(text(ui.manualGuideId,200)&&ui.manualGuideId)ctx.manualGuideId=ui.manualGuideId;
 ctx.finishedTutorials=unique([...(main.onboarding?.completed||[]),...(main.tutorialBridge?.engine?.completed||[]),...Object.values(main.tutorialBridge?.savedBanks||{}).flatMap(b=>b.completed||[])]);
 ctx.functionEnabled={};for(const [name,level]of Object.entries(p.functionGates||{})){if(Number.isFinite(ctx.level)&&Number.isFinite(level)){ctx.functionEnabled[name]=ctx.level>=level;ctx.functionEnabled[name[0].toUpperCase()+name.slice(1)]=ctx.level>=level;}}
 let core={};try{core=onboardingConstraints(clone(main),p);}catch{}
 ctx.otherStrong=Boolean(core.input||core.waitSeconds||ui.manualStrong||main.tutorialBridge?.enabled&&main.tutorialBridge?.engine?.active?.strong);ctx.coreStrong=Boolean(core.input||core.waitSeconds);
 ctx.gameMode=ui.skin==='activities'?null:main.stage==='play'?'Main':main.stage==='home'?'Map':'Title';ctx.mainBoardViewAvailable=ui.skin!=='activities'&&main.stage==='play'&&!ui.entry&&!ui.loading;ctx.eventLocked=Boolean(main.toolPending||ui.eventLocked);ctx.inputMode=ui.skin==='source'?'source':'game';
 const open=[];if(ui.taskList)open.push('TaskWindow');if(main.modal==='inventory'||ui.presentation==='factory')open.push('InventoryWindow');if(main.modal==='shop')open.push('ShopWindow');if(main.modal==='energy')open.push('BuyEnergyWindow');if(main.modal==='offer')open.push('WebOfferWindow');
 // The research gate/closed panel is not a native StoryRecap window. A book
 // retains the shelf as its source parent, matching the two actual web views.
 if(ui.presentation==='recap'&&['shelf','book'].includes(main.storyRecap?.phase)){open.push('StoryRecapMainWindow');if(main.storyRecap.phase==='book')open.push('StoryRecapBookContentWindow');}
 ctx.openViews=unique([...open,...(Array.isArray(ui.openViews)?ui.openViews:[])]);ctx.topView=ctx.openViews.at(-1)||null;
 ctx.allWindowsClosed=ctx.openViews.length===0&&!main.modal&&!main.toolPending&&!ui.entry&&!ui.loading&&!ui.newPrompt&&!['factory','skins','decor','decor-edit','recap'].includes(ui.presentation);
 ctx.factoryCandidates=[];if(data.factoryConfig){try{const f=main.factoryPlay===undefined?createFactoryPlay(data.factoryConfig):main.factoryPlay,x=factoryContext(main,data.factoryConfig),v=x&&factoryView(f,x,data.factoryConfig);ctx.generatorFactoryOpen=v?.state==='open'?true:v?.state==='closed'?false:null;const types=new Set(data.factoryConfig.groups.flatMap(g=>g.fragments.map(f=>f.type)));ctx.factoryCandidates=main.board.flatMap((cell,index)=>cell&&types.has(cell.type)&&!cell.cover&&!main.bubbles?.[cell.uid]?[{uid:String(cell.uid),hasFactoryComponent:ctx.generatorFactoryOpen===true,position:{x:index%7+1,y:Math.floor(index/7)+1}}]:[]);}catch{ctx.generatorFactoryOpen=null;}}
 if(typeof ui.recapUnlocked==='boolean')ctx.recapUnlocked=ui.recapUnlocked;if(typeof ui.recapEntryAvailable==='boolean')ctx.recapEntryAvailable=ui.recapEntryAvailable;
 if(typeof ui.storyRecapOpen==='boolean'||ui.storyRecapOpen===null)ctx.storyRecapOpen=ui.storyRecapOpen;if(Array.isArray(ui.storyUnlockedBooks))ctx.storyUnlockedBooks=clone(ui.storyUnlockedBooks);
 ctx.energyBoostHudAvailable=ctx.mainBoardViewAvailable;if(main.boostRatio!==undefined)ctx.boostRatio=main.boostRatio;
 if(typeof main.energyBoostLevel==='number')ctx.energyBoostLevel=main.energyBoostLevel;
 if(ui.selectedCellUid!==undefined)ctx.selectedCellUid=ui.selectedCellUid;
 ctx.availableHud={Inventory:ctx.mainBoardViewAvailable,EnergyBoost:ctx.mainBoardViewAvailable,Task:main.stage==='home'&&!ui.entry&&!ui.loading};
 ctx.availableActions=Array.isArray(ui.availableActions)?ui.availableActions.filter(x=>text(x,100)):[];
 ctx.selectedIndex=Number.isInteger(main.selected)?main.selected:null;ctx.board=Array.isArray(main.board)?main.board.map((c,index)=>c?{uid:c.uid,type:c.type,index,cover:c.cover,bubbled:Boolean(main.bubbles?.[c.uid]),generator:Boolean(p.items?.find(i=>i.type===c.type)?.generator)}:null):[];
 knownMainBindings(ctx,main,data);return ctx;
}
function strongIds(s,rows,ctx,except=null){return rows.filter(row=>row.id!==except&&row.id!==ctx.manualGuideId&&!s.entries[row.id]?.externalFinished&&s.entries[row.id]&&entryView(s.entries[row.id],row,contextFor(s,row.id,ctx)).strong).map(row=>row.id);}
function applyEvent(entry,row,event,ctx,external=null){
 const state=clone(entry.state),e=translate(event,row),api=adapter(row),next={...clone(entry),state};delete next.blockedContext;
 if(row.id==='tutorial_energyBoosteight_start'&&e.type==='executer-started')ctx={...ctx,persistedOngoingData:state.active?'1':''};
 if(row.id==='tutorial_generator_factory_Acquire'&&event.type==='clock'&&!state.active&&Number.isFinite(entry.pollAt)&&event.now>=entry.pollAt){e.type='factory-poll';next.pollAt=event.now+1;}
 const session=external&&row.bank==='catalog'?createTutorialAdapterSession(clone(external.state),external.registry,{context:ctx,catalog:row.config}):null;
 const out=api.event(state,e,ctx,row.config,session?{externalAdapter:session}:{});if(row.id==='tutorial_generator_factory_Acquire'&&state.active)next.pollAt=null;return {entry:next,out,contextFingerprint:fingerprint(ctx),before:entryView(entry,row,ctx),after:entryView(next,row,session?{...ctx,adapterInputLocked:session.inputLocked()}:ctx),adapterState:session?.state,adapterWrites:session?.writes||[],adapterReads:session?.reads||[]};
}
function ordered(rows,order){const index=new Map(order.map((id,i)=>[id,i]));return [...rows].sort((a,b)=>(index.get(a.id)??1e6)-(index.get(b.id)??1e6));}
/** Actual mounted target metadata and auxiliary web DB revision. This does not
 * turn a research season into a native activity assignment. */
export function tutorialAdapterContext(state,registry,context){
 if(!validTutorialAdapterState(state)||!validTutorialAdapterRegistry(registry))return {...context,adapterInvalid:true};
 return {...context,adapterInputLocked:tutorialAdapterInputLocked(state),adapterRevision:fingerprint(state),adapterControls:clone(state.targets),adapterTargets:clone(registry.targets),adapterEpoch:registry.epoch};
}
/** Pure coordinator over optional per-guide engines. Main wallet, board, RNG,
 * activity assignments and storage are never changed or invented here. */
export function tutorialRuntimeEvent(state,event,context,data,options={}){
 if(!obj(state)||!validTutorialRuntime(state,data))return result(false,'invalid-state','기존 자동 안내 저장을 보존했습니다. 내보내기 후 명시적으로 복구하세요.');
 if(!obj(event)||!text(event.type,100)||!obj(context)||context.mode!=='research'||!bounded(context,400000)||!bounded(event,32768))return result(false,'invalid-input','실제 웹 맥락과 유효한 사건이 필요합니다.');
 const hasAdapter=options.adapterState!==undefined;if(hasAdapter&&(!validTutorialAdapterState(options.adapterState)||!validTutorialAdapterRegistry(options.registry)))return result(false,'invalid-adapter-state','전용 어댑터 저장·실제 마운트 대상을 확인하기 전에는 기존 기록을 유지합니다.');
 const external=hasAdapter?{state:clone(options.adapterState),registry:options.registry}:null;
 const now=event.now??state.time;if(!time(now)||now<state.time)return result(false,'invalid-time','자동 안내 시각은 저장 시각 이상이어야 합니다.');
 const s=clone(state),rows=definitions(data),byId=new Map(rows.map(r=>[r.id,r])),output=[],events=[];let ctx=clone(context);if(external)ctx=tutorialAdapterContext(external.state,external.registry,ctx);const signature=fingerprint(ctx),managerSignature=fingerprint({level:ctx.level??null,functionEnabled:ctx.functionEnabled??null,finishedTasks:ctx.finishedTasks??null,cachedItems:ctx.cachedItems??null,cachedItemCount:ctx.cachedItemCount??null,finishedTutorials:ctx.finishedTutorials??null,BakeOut:ctx.activities?.BakeOut??'unknown',CashDash:ctx.activities?.CashDash??'unknown'}),checkManager=!s.managerStarted||s.lastManagerContext!==managerSignature||event.type==='source-event'&&['FunctionOpen','CacheItems','LevelUp','MainTaskFinished','CashDashStateChanged','BakeOutModeChanged','TutorialFinished'].includes(canonical(event.sourceEvent));s.time=now;s.deferredEvents??=[];s.constraints??=emptyConstraints();
 const eventId=event.eventId??event.id;if(eventId!==undefined){if(!text(eventId,200))return result(false,'invalid-input','사건 ID를 확인하세요.');if(s.seenEvents.includes(eventId)||s.deferredEvents.some(d=>(d.event.eventId??d.event.id)===eventId)||(s.ambiguity?.event.eventId??s.ambiguity?.event.id)===eventId)return result(true,'duplicate-event','같은 사건 ID를 다시 처리하지 않았습니다.');}
 let budget=0,replaying=false;const queue=[];
 function diagnose(id,out,contextFingerprint){s.diagnostics[id]={status:out.status||'waiting',unknown:unique((out.unknown||[]).filter(v=>text(v,500))).slice(0,100),message:String(out.message||'').slice(0,1500),...(out.requiredEffect?{requiredEffect:clone(out.requiredEffect)}:{}),...(contextFingerprint?{contextFingerprint}:{})};}
 function localCtx(id){const current=external?tutorialAdapterContext(external.state,external.registry,ctx):ctx,c=contextFor(s,id,current);c.otherStrong=Boolean(ctx.otherStrong||strongIds(s,rows,current,id).length);return c;}
 const probeEvent=(entry,row,event,c)=>applyEvent(entry,row,event,c,external);
 function commit(row,probe){
  if(!probe.out.ok){diagnose(row.id,probe.out,probe.contextFingerprint);if(s.entries[row.id]){s.entries[row.id].blockedContext=probe.contextFingerprint;if(Number.isFinite(probe.entry.pollAt))s.entries[row.id].pollAt=probe.entry.pollAt;}return [];}
  s.entries[row.id]=probe.entry;diagnose(row.id,probe.out);
  if(external&&probe.adapterState){if(!validTutorialAdapterState(probe.adapterState))throw Error('invalid-adapter-result');external.state=probe.adapterState;}
  for(const delta of probe.out.constraintUpdates||[]){s.constraints=applyConstraint(s.constraints,delta);log(s,'constraint-update',row.id,(delta.action+' '+JSON.stringify(delta.value)).slice(0,1500));}
  const raw=probe.entry.state;for(const id of unique([...(raw.registeredFinished||[]),...(probe.out.registrations||[]).map(r=>typeof r==='string'?r:r.id).filter(Boolean)]))if(!s.registered.includes(id)){s.registered.push(id);log(s,'registered',id,'Finished DB 등록. 시각 종료/전역 TutorialFinished와 구분합니다.');}
  const finished=[];if(probe.after.completed&&!s.completed.includes(row.id)){s.completed.push(row.id);if(!s.registered.includes(row.id))s.registered.push(row.id);finished.push(row.id);}
  for(const emitted of probe.out.emitted||[])if(emitted.event)queue.push({type:'source-event',sourceEvent:emitted.event,payload:emitted.payload,now:s.time,internal:true});
  output.push({guideId:row.id,status:probe.out.status,changed:probe.out.changed===true});return finished;
 }
 function ambiguity(probes,currentEvent){
  const claims=probes.filter(p=>p.probe.out.ok&&(p.probe.after.strong&&!p.probe.before.strong||p.probe.after.inputLocked&&!p.probe.before.inputLocked||p.probe.after.active?.target&&!p.probe.before.active?.target));
  const writes=p=>{let c=emptyConstraints(),keys=new Set();for(const d of p.probe.out.constraintUpdates||[]){c=applyConstraint(c,d);if(d.action==='ClearTempDatas')Object.keys(c).forEach(k=>keys.add(k));else if(/DragLock/.test(d.action))keys.add('dragLocks');else keys.add({SetForceSourceBoardPosition:'forceSource',SetForceTargetBoardPosition:'forceTarget',SetForceEffectBoardPosition:'forceEffect',SetForceSpreadItemCode:'forceSpreadCode',SetForceSkipCost:'forceSkipCost',SetForceUnlockBubbleCost:'forceBubbleCost'}[d.action]);}return {c,keys};};
  for(let i=0;i<probes.length;i++)for(let j=i+1;j<probes.length;j++){const a=probes[i],b=probes[j];if(!a.probe.out.ok||!b.probe.out.ok)continue;const x=writes(a),y=writes(b);if([...x.keys].some(k=>y.keys.has(k)&&!same(x.c[k],y.c[k]))){if(!claims.includes(a))claims.push(a);if(!claims.includes(b))claims.push(b);}}
  const overlap=(write,other)=>other.some(x=>x.key===write.key||write.key.startsWith('owner-lock:')&&x.key==='global-input-lock');
  for(let i=0;i<probes.length;i++)for(let j=i+1;j<probes.length;j++){const a=probes[i],b=probes[j];if(!a.probe.out.ok||!b.probe.out.ok)continue;if(a.probe.adapterWrites.some(w=>overlap(w,[...b.probe.adapterWrites,...b.probe.adapterReads]))||b.probe.adapterWrites.some(w=>overlap(w,a.probe.adapterReads))){if(!claims.includes(a))claims.push(a);if(!claims.includes(b))claims.push(b);}}
  if(claims.length<2)return false;const candidates=claims.map(p=>p.row.id),chosen=s.order.filter(id=>candidates.includes(id));
  if(chosen.length===candidates.length)return false;
  s.ambiguity={kind:'source-pairs-order-unknown',candidates,event:clone({...currentEvent,now:s.time}),context:clone(ctx),message:'동시에 표시/강제 안내가 적격입니다. 원작 pairs 순서는 미확인이라 연구 순서를 명시해야 합니다.'};log(s,'ambiguous',null,candidates.join(' → '));return true;
 }
 function startEligible(){
  if(++budget>256)throw Error('budget');const probes=[];
  for(const row of rows){if(row.id===ctx.manualGuideId||s.entries[row.id]||s.registered.includes(row.id)||ctx.registeredTutorials?.includes(row.id))continue;const c=localCtx(row.id),sig=fingerprint(c);if(s.diagnostics[row.id]?.contextFingerprint===sig&&['unknown','unimplemented','ineligible'].includes(s.diagnostics[row.id].status))continue;const gate=eligible(row,c);if(!gate.eligible){diagnose(row.id,{...gate,message:gate.status==='unknown'?'시작 조건의 자료가 미확인입니다.':'현재 실제 플레이 시작 조건을 충족하지 않습니다.'},sig);continue;}
   const entry={bank:row.bank,state:adapter(row).create(row.config,row.id),...(row.id==='tutorial_generator_factory_Acquire'?{pollAt:s.time+1}:{})},probe=probeEvent(entry,row,{type:'executer-started',now:s.time},c);probes.push({row,probe});
  }
  const startsEvent={type:'reconcile',now:s.time};if(ambiguity(probes,startsEvent)){for(const {row,probe}of probes)if(!s.ambiguity.candidates.includes(row.id)&&!probe.after.strong&&!probe.after.active?.target)commit(row,probe);return [];}
  const completed=[];for(const {row,probe}of ordered(probes.map(x=>({...x,id:x.row.id})),s.order)){
   // A specified order is an analyst input. Re-evaluate each source branch
   // after the previous guide, so CheckOtherTutorialInStrong can finish it.
   const p=(external||s.order.includes(row.id))?probeEvent({bank:row.bank,state:adapter(row).create(row.config,row.id)},row,{type:'executer-started',now:s.time},localCtx(row.id)):probe;
   completed.push(...commit(row,p));
  }return completed;
 }
 function finishCascade(ids,depth=0){
  if(depth>128)throw Error('budget');for(const id of ids){log(s,'OnRemove',id,'원작 엔진 정리 후 전역 완료 순서를 처리합니다.');log(s,'SetTutorialFinished',id,'등록 완료');log(s,'TryToStartTutorials',id,'TutorialFinished를 보내기 전에 재평가합니다.');finishCascade(startEligible(),depth+1);log(s,'TutorialFinished',id,'재평가 이후 전역 사건');events.push({type:'TutorialFinished',id});queue.push({type:'source-event',sourceEvent:'TutorialFinished',payload:{id},now:s.time,internal:true});}
 }
 function dispatch(currentEvent){
  if(++budget>256)throw Error('budget');const targets=currentEvent.guideId?[byId.get(currentEvent.guideId)].filter(Boolean):rows.filter(r=>s.entries[r.id]);const probes=[];
  for(const row of targets){const entry=s.entries[row.id];if(!entry||row.id===ctx.manualGuideId||entry.externalFinished)continue;const v=entryView(entry,row,localCtx(row.id));if(v.completed)continue;if(currentEvent.type==='clock'&&(v.nextDueAt===null||v.nextDueAt>(currentEvent.now??s.time)))continue;
   const probe=probeEvent(entry,row,currentEvent,localCtx(row.id));probes.push({row,probe});
  }
  if(ambiguity(probes,currentEvent))return;
  for(const {row,probe}of ordered(probes.map(x=>({...x,id:x.row.id})),s.order)){
   const next=(external||s.order.includes(row.id))?probeEvent(s.entries[row.id],row,currentEvent,localCtx(row.id)):probe;finishCascade(commit(row,next));
  }
 }
 function drainBefore(until,includeEqual=false){
  while(!s.ambiguity){const due=rows.flatMap(row=>{const e=s.entries[row.id];if(!e||row.id===ctx.manualGuideId||e.externalFinished)return [];const d=entryView(e,row,localCtx(row.id)).nextDueAt;return Number.isFinite(d)?[d]:[];});if(!due.length)return;const next=Math.min(...due);if(next>until||!includeEqual&&next===until)return;const at=Math.max(next,s.time);s.time=at;dispatch({type:'clock',now:at});while(queue.length&&!s.ambiguity){if(++budget>256)throw Error('budget');dispatch(queue.shift());}}
 }
 try{
  for(const [id,entry]of Object.entries(s.entries)){
   if(id===ctx.manualGuideId)entry.suspendedForManual=true;
   else if(entry.suspendedForManual){entry.suspendedForManual=false;if(ctx.registeredTutorials?.includes(id)){entry.externalFinished=true;if(!s.registered.includes(id))s.registered.push(id);log(s,'external-registration',id,'수동 안내의 Finished DB를 반영하고 자동 중복 실행을 중단했습니다.');}}
  }
  if(event.type==='disable'){
   for(const row of rows){const e=s.entries[row.id];if(!e)continue;if(row.bank==='catalog'){const p=probeEvent(e,row,{type:'teardown',now},localCtx(row.id));if(p.out.ok)s.entries[row.id]=p.entry;else diagnose(row.id,p.out);}else e.state.active=null;}
   if(external){external.state.targets={};external.state.ownerLocks={};external.state.anonymousLocks=0;}log(s,'deferred-cancelled',null,'명시 중지로 경쟁 중 원본 사건과 대기 사건 '+s.deferredEvents.length+'개를 재생하지 않고 보존 이력으로 남깁니다.');s.deferredEvents=[];s.constraints=emptyConstraints();s.enabled=false;s.ambiguity=null;log(s,'disabled',null,'표시·예약·리스너를 중단했습니다. 완료로 등록하지 않았습니다.');
  }else if(event.type==='enable'){
   s.enabled=true;s.lastContext=null;s.constraints=emptyConstraints();if(external){external.state.targets={};external.state.ownerLocks={};external.state.anonymousLocks=0;}
   for(const row of rows){const entry=s.entries[row.id];if(!entry||row.id===ctx.manualGuideId||entry.externalFinished)continue;if(row.bank==='catalog')finishCascade(commit(row,probeEvent(entry,row,{type:'resume',now},localCtx(row.id))));else if(!entry.state.registeredFinished.includes(row.id))finishCascade(commit(row,probeEvent(entry,row,{type:'executer-started',now},localCtx(row.id))));}
   finishCascade(startEligible());
  }
  else if(event.type==='configure'){
   if(!byId.has(event.guideId)||!obj(event.context)||!bounded(event.context,32768))return result(false,'invalid-input','안내 ID와32KiB 이하의 명시 연구 맥락을 확인하세요.');s.overrides[event.guideId]=clone(event.context);s.lastContext=null;log(s,'explicit-context',event.guideId,'사용자가 직접 명시한 연구 맥락. 자동 예제 적용 아님.');if(s.enabled&&!s.ambiguity)finishCascade(startEligible());
  }else if(event.type==='reset'){
   if(s.ambiguity)return result(false,'resolve-order-first','경쟁 중인 사건을 잃지 않도록 순서를 먼저 해결하거나 자동 안내 전체를 명시 중지하세요.');
   if(!byId.has(event.guideId))return result(false,'invalid-input','초기화할 안내 ID가 필요합니다.');delete s.entries[event.guideId];delete s.diagnostics[event.guideId];s.registered=s.registered.filter(id=>id!==event.guideId);s.completed=s.completed.filter(id=>id!==event.guideId);s.ambiguity=null;s.lastContext=null;log(s,'reset',event.guideId,'이 자동 안내 기록만 명시 초기화했습니다. 메인/수동 안내는 유지합니다.');
  }else if(!s.enabled)return result(true,'disabled','자동 안내가 중지되어 있습니다.');
  else if(event.type==='choose-order'){
   if(!s.ambiguity||!Array.isArray(event.order)||new Set(event.order).size!==event.order.length||s.ambiguity.candidates.some(id=>!event.order.includes(id))||event.order.some(id=>!s.ambiguity.candidates.includes(id)))return result(false,'invalid-order','경쟁 중인 모든 안내를 한 번씩 포함한 연구 순서가 필요합니다.');
   const pending=clone(s.ambiguity),deferred=s.deferredEvents;const finalNow=s.time,finalContext=ctx;s.order=unique([...event.order,...s.order]);s.ambiguity=null;s.deferredEvents=[];log(s,'research-order',null,event.order.join(' → '));replaying=true;
   const replay=[{event:pending.event,context:pending.context||ctx},...deferred];ctx=clone(replay[0].context);s.time=replay[0].event.now;
   for(let i=0;i<replay.length;i++){
    const item=replay[i];if(i>0)drainBefore(item.event.now);if(s.ambiguity){s.deferredEvents=replay.slice(i);break;}s.time=item.event.now;ctx=clone(item.context);if(item.event.type==='reconcile'||item.event.type==='source-event'&&['FunctionOpen','CacheItems','LevelUp','MainTaskFinished','CashDashStateChanged','BakeOutModeChanged','TutorialFinished'].includes(canonical(item.event.sourceEvent)))finishCascade(startEligible());if(!s.ambiguity&&item.event.type!=='reconcile')dispatch(item.event);while(queue.length&&!s.ambiguity){if(++budget>256)throw Error('budget');dispatch(queue.shift());}
    if(s.ambiguity){s.deferredEvents=replay.slice(i+1);break;}
   }if(!s.ambiguity)drainBefore(finalNow,true);s.time=finalNow;ctx=finalContext;
  }else if(event.type==='resume'){
   if(external){external.state.targets={};external.state.ownerLocks={};external.state.anonymousLocks=0;}
   if(s.ambiguity||s.deferredEvents.length)log(s,'deferred-cancelled',null,'명시 재접속은 원작 manager의 현재 상태로 리스너를 재구성합니다. 이전 경쟁/대기 사건을 임의 재생하지 않습니다.');s.ambiguity=null;s.deferredEvents=[];s.constraints=emptyConstraints();for(const row of rows){const entry=s.entries[row.id];if(!entry||row.id===ctx.manualGuideId||entry.externalFinished)continue;if(row.bank==='catalog')finishCascade(commit(row,probeEvent(entry,row,{type:'resume',now},localCtx(row.id))));else if(entry.state.registeredFinished.includes(row.id)){entry.state.active=null;log(s,'registered-not-restored',row.id,'원작 manager의 Finished 등록 안내는 다시 표시하지 않습니다. 시각 완료로 추가하지 않습니다.');}else if(row.id==='tutorial_energyBoosteight_start')finishCascade(commit(row,probeEvent(entry,row,{type:'executer-started',now}, {...localCtx(row.id),persistedOngoingData:entry.state.active?'1':''})));}
   finishCascade(startEligible());
  }else{
   const due=rows.some(r=>s.entries[r.id]&&entryView(s.entries[r.id],r,localCtx(r.id)).nextDueAt!==null&&entryView(s.entries[r.id],r,localCtx(r.id)).nextDueAt<=now);
   if(event.type==='reconcile'&&s.lastContext===signature&&!due&&!s.ambiguity)return result(true,'unchanged','같은 실제 맥락의 재평가를 생략했습니다.');
   if(s.ambiguity){
    if(event.type!=='source-event')return result(true,'ambiguous-order',s.ambiguity.message,{ambiguity:clone(s.ambiguity)});
    if(s.deferredEvents.length>=128)return result(false,'deferred-capacity','경쟁 대기 사건128개 한도에 도달했습니다. 순서를 해결하거나 명시 중지하기 전 새 사건을 처리하지 않았습니다.',{unknown:['runtime.deferredEvents.capacity']});
    s.deferredEvents.push({event:clone({...event,now}),context:clone(ctx)});if(eventId!==undefined){s.seenEvents.push(eventId);s.seenEvents=s.seenEvents.slice(-100);}s.lastContext=signature;s.sequence++;log(s,'source-event-deferred',null,canonical(event.sourceEvent)+' · '+(eventId||'ID 없음'));
    if(!validTutorialRuntime(s,data))return result(false,'deferred-capacity','대기 사건과 맥락의 저장 한도를 넘어 기존 기록을 유지했습니다.');Object.assign(state,s);return result(true,'source-event-deferred','실제 UI 사건을 경쟁 해결 뒤 원래 맥락·시각 순서로 재생하도록 저장했습니다.',{changed:true,deferredEvents:s.deferredEvents.length,ambiguity:clone(s.ambiguity)});
   }
   if(checkManager){finishCascade(startEligible());s.managerStarted=true;}if(!s.ambiguity){if(event.type==='reconcile'&&due)drainBefore(now,true);else if(event.type!=='reconcile')dispatch({...event,now});}
  }
  while(queue.length&&!s.ambiguity){if(++budget>256)throw Error('budget');dispatch(queue.shift());}
  if(eventId!==undefined){s.seenEvents.push(eventId);s.seenEvents=s.seenEvents.slice(-100);}s.lastContext=signature;s.lastManagerContext=managerSignature;s.sequence++;
  if(!validTutorialRuntime(s,data))return result(false,'invalid-result','변경 후 자동 안내 저장 검사가 실패해 기존 기록을 보존했습니다.');
  if(external&&!validTutorialAdapterState(external.state))return result(false,'invalid-adapter-result','어댑터 저장 검사 실패로 안내와 전용 상태 모두 유지했습니다.');const adapterChanged=external&&!same(external.state,options.adapterState),changed=!same(s,state)||Boolean(adapterChanged);if(changed)Object.assign(state,s);if(external&&adapterChanged)Object.assign(options.adapterState,external.state);return result(true,s.ambiguity?'ambiguous-order':'processed',s.ambiguity?.message||'실제 웹 사건과 명시된 연구 조건으로 안내를 처리했습니다.',{changed,events,results:output,adapterChanged:Boolean(adapterChanged),ambiguity:s.ambiguity?clone(s.ambiguity):null,researchOrderApplied:replaying});
 }catch(error){return result(false,'capacity-or-handler','안내 재진입·사건 한도 또는 처리 실패로 기존 기록 전체를 유지했습니다.',{diagnostic:String(error?.message||error).slice(0,300)});}
}
export function restoreTutorialRuntime(state,context,data,options={}){return tutorialRuntimeEvent(state,{type:'resume',now:Math.max(state?.time||0,context.now||0)},context,data,options);}
function bindingFor(v,ctx){const t=v.active?.target;if(!t)return null;
 if(v.id==='tutorial_generator_factory'&&t.sourceId==='TC-S021'){
  const id={1:'hud.inventory',2:'inventory.factory-tab',3:'inventory.factory-detail'}[v.active.phase],target=ctx.adapterTargets?.find(t=>t.id===id);if(target)return {kind:'component',key:id,actions:target.actions,selector:{'hud.inventory':'[data-play="inventory"]','inventory.factory-tab':'.inventory-dialog [data-play="game-factory-open"]','inventory.factory-detail':'.factory-page .factory-groups'}[id],origin:'verified-web-adapter',nativeGeometryResolved:false};
 }
 if(t.area==='story-recap'&&ctx.recapEntryAvailable===true&&ctx.openViews?.some(n=>['TaskWindow','NoTaskWindow'].includes(n)))return {kind:'hud',key:'StoryRecapEntry',actions:['recap:open-shelf'],selector:'[data-play="recap:open-shelf"]',origin:'verified-web-adapter',nativeGeometryResolved:false};
 if(t.hud&&ctx.availableHud?.[t.hud]){const actions={Inventory:['inventory','game-factory-open'],Task:['game-task-list','home'],EnergyBoost:['set-boost']}[t.hud];if(actions)return {kind:'hud',key:t.hud,actions,selector:t.hud==='Inventory'?'[data-play="inventory"]':t.hud==='Task'?'[data-play="game-task-list"]':'[data-play="set-boost"]',origin:'verified-web-adapter',nativeGeometryResolved:false};}
 if(t.uid!==undefined){const cell=ctx.board?.find(x=>x&&String(x.uid)===String(t.uid));if(cell&&!cell.cover&&!cell.bubbled)return {kind:'cell',uid:cell.uid,index:cell.index,actions:['game-cell','cell','factory:store','game-factory-open'],selector:`[data-play="${ctx.inputMode==='source'?'cell':'game-cell'}"][data-value="${cell.index}"]`,origin:'verified-web-adapter',nativeGeometryResolved:false};}
 if(t.kind==='action'&&t.origin==='verified-web-adapter'&&text(t.action,100)&&ctx.availableActions?.includes(t.action))return {kind:'action',actions:[t.action],selector:`[data-play="${t.action.replace(/[^a-zA-Z0-9:_-]/g,'')}"]`,origin:'verified-web-adapter',nativeGeometryResolved:false};
 return null;
}
const boardIndex=p=>obj(p)&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=1&&p.x<=7&&p.y>=1&&p.y<=9?(p.y-1)*7+p.x-1:null;
function positionBinding(constraints,ctx){const source=boardIndex(constraints.forceSource),target=boardIndex(constraints.forceTarget);if(source===null&&target===null)return null;return {kind:'source-positions',sourceIndex:source,targetIndex:target,actions:['game-cell','cell','move','drag-start','generate'],selector:`[data-play="${ctx?.inputMode==='source'?'cell':'game-cell'}"][data-value="${source??target}"]`,origin:'verified-web-grid-coordinate',nativeGeometryResolved:false};}
function constraintPermission(view,action,value){const c=view.constraints||emptyConstraints(),input=view.inputSnapshot||{},boardActions=['game-cell','cell','move','drag-start','generate'];
 if(c.dragLocks.length&&['move','drag-start'].includes(action))return {allowed:false,reason:'source-drag-lock',message:'원작 안내의 드래그 잠금이 유지되는 구간입니다.'};
 const index=['game-cell','cell'].includes(action)?Number(value):null,cell=Number.isInteger(index)?input.board?.find(x=>x&&x.index===index):null;
 if(!input.tutorialEconomySupported&&c.forceSpreadCode!==null&&(action==='generate'||cell?.generator&&index===input.selectedIndex))return {allowed:false,reason:'source-effect-unimplemented',message:'강제 생성 타입이 메인 생성기에 아직 연결되지 않아 재화 소비를 차단했습니다.',unknown:['forceSpreadCode']};
 if(!input.tutorialEconomySupported&&c.forceSkipCost!==null&&action==='speedup-item')return {allowed:false,reason:'source-effect-unimplemented',message:'강제 가속 비용을 메인 비용 계산에 적용하기 전에는 지급/소비하지 않습니다.',unknown:['forceSkipCost']};
 if(!input.tutorialEconomySupported&&c.forceBubbleCost!==null&&action==='buy-bubble')return {allowed:false,reason:'source-effect-unimplemented',message:'강제 버블 비용을 메인 비용 계산에 적용하기 전에는 지급/소비하지 않습니다.',unknown:['forceBubbleCost']};
 if(!boardActions.includes(action))return null;const from=boardIndex(c.forceSource),to=boardIndex(c.forceTarget);
 if(c.forceSource!==null&&from===null||c.forceTarget!==null&&to===null)return {allowed:false,reason:'source-position-unresolved',message:'원작 위치를 현재7×9 보드 좌표로 확정할 수 없어 입력을 보류했습니다.'};
 if(action==='move'){const pair=String(value).split(',').map(Number);if(pair.length!==2||pair.some(v=>!Number.isInteger(v))||from!==null&&pair[0]!==from||to!==null&&pair[1]!==to)return {allowed:false,reason:'source-forced-position',message:'원작 안내에 지정된 시작·도착 칸으로만 이동할 수 있습니다.'};}
 else if(action==='drag-start'&&from!==null&&Number(value)!==from)return {allowed:false,reason:'source-forced-position',message:'원작 안내가 지정한 시작 칸만 드래그할 수 있습니다.'};
 else if(['game-cell','cell'].includes(action)){const expected=input.selectedIndex===null?from:to;if(expected!==null&&index!==expected)return {allowed:false,reason:'source-forced-position',message:'원작 안내가 지정한 칸만 선택할 수 있습니다.'};}
 else if(action==='generate'&&from!==null&&input.selectedIndex!==from)return {allowed:false,reason:'source-forced-position',message:'원작 안내의 시작 생성기를 먼저 선택하세요.'};
 return null;
}
export function tutorialRuntimeView(state,context,data){
 if(state===undefined)state=createTutorialRuntime(data);if(!validTutorialRuntime(state,data))return {valid:false,enabled:false,active:[],unknown:['incompatible-save'],nextDueAt:null,rows:[]};const constraints=clone(state.constraints||emptyConstraints()),rows=definitions(data),views=rows.map(row=>{const entry=state.entries[row.id],ctx=contextFor(state,row.id,context||{mode:'research'}),v=entry?entryView(entry,row,ctx):{id:row.id,name:row.guide.name||row.id,active:null,strong:false,inputLocked:false,registered:state.registered.includes(row.id),completed:state.completed.includes(row.id),nextDueAt:null};if(row.id===context?.manualGuideId||entry?.suspendedForManual||entry?.externalFinished){v.active=null;v.strong=false;v.inputLocked=false;v.nextDueAt=null;}return {...v,allowedActions:allowedCallbacks(v),suspended:row.id===context?.manualGuideId||entry?.suspendedForManual===true,externalFinished:entry?.externalFinished===true,bank:row.bank,diagnostic:state.diagnostics[row.id]||null,binding:bindingFor(v,context||{})||positionBinding(constraints,context),sourceRefs:row.guide.sourceRefs||[],researchOverride:Object.hasOwn(state.overrides,row.id)};});const due=views.map(v=>v.nextDueAt).filter(Number.isFinite);
 return {valid:true,enabled:state.enabled,time:state.time,rows:views,active:state.enabled?views.filter(v=>v.active||v.strong||v.inputLocked):[],registered:[...state.registered],completed:[...state.completed],nextDueAt:state.enabled&&due.length?Math.min(...due):null,ambiguity:clone(state.ambiguity),deferredEventCount:state.deferredEvents?.length||0,order:[...state.order],constraints,inputSnapshot:{tutorialEconomySupported:context?.tutorialEconomySupported===true,selectedIndex:context?.selectedIndex??null,board:clone(context?.board||[])},adapterInputLocked:context?.adapterInputLocked===true||context?.eventLocked===true,adapterControls:clone(context?.adapterControls||{}),adapterTargets:clone(context?.adapterTargets||[]),history:clone(state.history),unknown:unique([...views.flatMap(v=>v.diagnostic?.unknown||[]),...['forceSpreadCode','forceSkipCost','forceBubbleCost'].filter(k=>constraints[k]!==null&&context?.tutorialEconomySupported!==true)]),originalRuntimeObserved:false};
}
export function tutorialRuntimePermissionFromView(view,action,value){
 const safeActions=['export','save','focus','game-title','game-continue','game-new-prompt','game-new-cancel','new-game','reset','game-sound','cancel-tool','game-task-list-close','game-factory-close','game-recap-close','close-info'];
 if(safeActions.includes(action)||action.startsWith('runtime:')&&action!=='runtime:mask')return {allowed:true};if(!view.valid||!view.enabled)return {allowed:true};if(view.ambiguity)return {allowed:false,reason:'ambiguous-order',message:'자동 안내의 경쟁 순서를 연구 입력으로 선택하거나 중지하세요.'};if(view.adapterInputLocked)return {allowed:false,reason:'source-event-lock',message:'원작 UIManager의 소유자별 입력 잠금이 남아 있습니다.'};if(action==='runtime:mask')return {allowed:true};const adapterPermission=tutorialAdapterPermission({schema:1,misc:{},activityFlags:{},targets:view.adapterControls||{},ownerLocks:{},anonymousLocks:0,operations:[],sequence:0},{schema:1,epoch:'view',targets:view.adapterTargets||[]},action,value);if(!adapterPermission.allowed)return adapterPermission;const constraint=constraintPermission(view,action,value);if(constraint)return constraint;const guards=view.active.filter(a=>a.strong||a.inputLocked);if(!guards.length)return {allowed:true};
 const bindings=guards.map(g=>g.binding).filter(Boolean);const permitted=bindings.length===guards.length&&bindings.every(b=>{if(!b.actions.includes(action))return false;if(b.kind!=='cell'||action==='game-factory-open')return true;if(['game-cell','cell'].includes(action))return Number(value)===b.index;return String(value).split(':').at(-1)===String(b.uid);});
 return permitted?{allowed:true,bindings}:{allowed:false,reason:bindings.length<guards.length?'target-unresolved':'target-only',message:'자동 안내의 실제 웹 대상만 조작할 수 있습니다. 대상 미확인이면 연구 맥락을 확인하거나 안내를 중지하세요.',bindings};
}
export function tutorialRuntimePermission(state,action,value,context,data,cachedView=null){return tutorialRuntimePermissionFromView(cachedView||tutorialRuntimeView(state,context,data),action,value);}
/** A real click on a verified mounted target may invoke its sole source mask
 * callback. Unmapped targets, ambiguous callbacks and locked intervals retain
 * their existing source wait; a successful mask click does not also perform
 * the underlying game transaction. */
export function tutorialRuntimeActionCallback(view,action,value){
 if(!view?.valid||!view.enabled||view.ambiguity||view.adapterInputLocked||String(action).startsWith('runtime:')||!tutorialRuntimePermissionFromView(view,action,value).allowed)return null;
 const matches=view.active.filter(a=>a.binding?.origin==='verified-web-adapter'&&a.binding.actions?.includes(action)&&a.allowedActions?.length===1&&a.allowedActions[0].type==='mask-click'&&(a.binding.kind!=='cell'||(['game-cell','cell'].includes(action)?Number(value)===a.binding.index:String(value).split(':').at(-1)===String(a.binding.uid))));
 if(matches.length!==1)return null;const row=matches[0],callback=row.allowedActions[0];
 return {type:'mask-click',guideId:row.id,...(callback.callbackId?{callbackId:callback.callbackId}:{}),webAction:String(action)};
}
export const runtimePermission=tutorialRuntimePermission;

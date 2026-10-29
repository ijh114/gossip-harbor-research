// Source-shaped progression projections for 87 tutorial executers. This module
// does not execute Lua, contact a game service, render native UI or issue items.
// Unknown predicates / external effects stop the transaction, never act as true.
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const own=(x,k)=>x!==null&&typeof x==='object'&&Object.hasOwn(x,k);
const safe=k=>typeof k==='string'&&!['__proto__','prototype','constructor'].includes(k);
const string=(v,max=500)=>typeof v==='string'&&v.length<=max;
const time=v=>Number.isFinite(v)&&v>=0&&v<=1e9;
const list=(v,max=300)=>Array.isArray(v)&&v.length<=max&&Object.keys(v).length===v.length;
const clone=v=>structuredClone(v);
const result=(ok,status,message,more={})=>({ok,status,message,unknown:[],changed:false,emitted:[],effects:[],...more});
class Halt extends Error{constructor(status,message,unknown=[],details={}){super(message);this.status=status;this.unknown=unknown;this.details=details;}}
const unknown=(id,message)=>{throw new Halt('unknown',message||'원작 분기를 판단할 컨텍스트가 없습니다.',[id]);};
const unimplemented=(id,message,details)=>{throw new Halt('unimplemented',message||'이 원작 연산에는 검증된 웹 어댑터가 필요합니다.',[id],details);};
const truth=v=>v!==false&&v!==null&&v!==undefined;
const scalar=v=>object(v)&&typeof v.$symbol==='string'?v.value??v.$symbol:v;
const isTuple=v=>object(v)&&Object.keys(v).length===1&&list(v.$luaTuple,128);
const first=v=>isTuple(v)?v.$luaTuple[0]??null:v;
const emptyConstraints=()=>({forceSource:null,forceTarget:null,forceEffect:null,forceSpreadCode:null,forceSkipCost:null,forceBubbleCost:null,dragLocks:[]});
function validConstraints(v){return object(v)&&Object.keys(v).length===7&&Object.keys(emptyConstraints()).every(k=>own(v,k))&&list(v.dragLocks,128)&&new Set(v.dragLocks).size===v.dragLocks.length&&v.dragLocks.every(x=>string(x,200)&&x.length>0)&&!['forceSource','forceTarget','forceEffect'].some(k=>v[k]!==null&&(!object(v[k])||!Number.isInteger(v[k].x)||!Number.isInteger(v[k].y)||v[k].x<0||v[k].y<0||v[k].x>100||v[k].y>100))&&!['forceSkipCost','forceBubbleCost'].some(k=>v[k]!==null&&(!Number.isFinite(v[k])||v[k]<0||v[k]>1e9))&&(v.forceSpreadCode===null||string(v.forceSpreadCode,160)||Number.isSafeInteger(v.forceSpreadCode));}
const find=(c,id)=>c?.guides?.find(g=>g.id===id);
function jsonSafe(x,max=262144){let count=0;const seen=new Set();function valid(v,depth){if(++count>30000||depth>60)return false;if(v===null||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);if(typeof v==='string')return v.length<=max;if(typeof v!=='object'||seen.has(v))return false;seen.add(v);let ok;if(Array.isArray(v))ok=Object.keys(v).length===v.length&&v.every(y=>valid(y,depth+1));else ok=object(v)&&Object.keys(v).every(k=>safe(k)&&valid(v[k],depth+1));seen.delete(v);return ok;}try{return valid(x,0)&&JSON.stringify(x).length<=max;}catch{return false;}}
function definition(c,id){const g=find(c,id);if(!g||c.schemaVersion!==1||!/^[a-f0-9]{64}$/.test(c.revision)||!object(g.programs)||!g.programs.OnStart)throw new TypeError('출처를 연결한 안내 정의가 필요합니다.');return g;}
export function createTutorialCatalog(config,guideId=config?.guides?.[0]?.id){
 definition(config,guideId);
 return {schema:1,revision:config.revision,guideId,time:0,started:false,registeredFinished:[],completed:[],variables:{m_strOngoingDatas:''},cells:{},nextCell:1,constraints:emptyConstraints(),persistedData:'',phase:null,strong:false,inputLocked:false,active:null,subscriptions:[],pending:[],mask:null,history:[],effects:[],unknown:[],status:'idle',sequence:0};
}
export function validTutorialCatalog(s,c){try{
 const g=definition(c,s?.guideId);
 if(!object(s)||s.schema!==1||s.revision!==c.revision||!time(s.time)||typeof s.started!=='boolean'||!object(s.variables)||!string(s.persistedData,4000)||!(s.phase===null||string(s.phase,200))||typeof s.strong!=='boolean'||typeof s.inputLocked!=='boolean'||!Number.isSafeInteger(s.sequence)||s.sequence<0||s.sequence>1e9)return false;
 if(!object(s.cells)||Object.keys(s.cells).length>4096||!Number.isSafeInteger(s.nextCell)||s.nextCell<1||s.nextCell>1e9||Object.keys(s.cells).some(k=>!/^c[1-9]\d*$/.test(k)||Number(k.slice(1))>=s.nextCell))return false;
 if(!validConstraints(s.constraints))return false;
 if(!list(s.registeredFinished,1)||!list(s.completed,1)||s.registeredFinished.some(x=>x!==s.guideId)||s.completed.some(x=>x!==s.guideId)||s.completed.length>s.registeredFinished.length)return false;
 if(!list(s.subscriptions)||!s.subscriptions.every(x=>object(x)&&string(x.event,500)&&string(x.handler,200)&&own(g.programs,x.handler)))return false;
 if(!list(s.pending,128)||!s.pending.every(x=>object(x)&&time(x.dueAt)&&string(x.id,200)&&string(x.handler,200)&&own(g.programs,x.handler)&&object(x.locals)&&(x.repeatSeconds===null||Number.isFinite(x.repeatSeconds)&&x.repeatSeconds>0)))return false;
 if(!(s.mask===null||object(s.mask)&&string(s.mask.id,200)&&(s.mask.callback===null||string(s.mask.callback,200)&&own(g.programs,s.mask.callback))&&object(s.mask.locals)))return false;
 if(!(s.active===null||object(s.active)&&s.active.id===s.guideId&&s.active.strong===s.strong))return false;
 if(!list(s.history,80)||!list(s.effects,80)||!list(s.unknown,100)||!s.unknown.every(x=>string(x,500))||!string(s.status,100)||!jsonSafe(s))return false;
 const references=[];function scan(v){if(v&&typeof v==='object'){if(own(v,'$cell'))references.push(v.$cell);for(const x of Object.values(v))scan(x);}}scan(s.variables);scan(s.subscriptions);scan(s.pending);scan(s.mask);scan(s.cells);
 return Object.keys(s.variables).every(safe)&&references.every(id=>typeof id==='string'&&own(s.cells,id));
 }catch{return false;}}
function knownContext(ctx){return object(ctx)&&ctx.mode==='research'&&jsonSafe(ctx)&&(!own(ctx,'globalConstraints')||validConstraints(ctx.globalConstraints))&&['facts','definitions','constants','effectResults','collections','targetBindings'].every(k=>ctx[k]===undefined||object(ctx[k]));}
function record(s,kind,detail,at={}){s.history.push({time:s.time,kind,detail,...at});s.history=s.history.slice(-80);}
function updateActive(s){s.phase=string(s.variables.m_strOngoingDatas,200)&&s.variables.m_strOngoingDatas!==''?s.variables.m_strOngoingDatas:null;s.active=s.completed.length||s.status==='torn-down'?null:s.phase!==null||s.strong||s.inputLocked||s.mask?{id:s.guideId,phase:s.phase,sourceStep:s.phase,strong:s.strong,inputLocked:s.inputLocked,registered:s.registeredFinished.includes(s.guideId),target:s.mask?{...s.mask.target,sourceId:s.mask.sourceId,lineStart:s.mask.lineStart}:null}:null;}
function register(s){if(!s.registeredFinished.includes(s.guideId))s.registeredFinished.push(s.guideId);s.persistedData='';record(s,'registered','SetTutorialFinished: 등록 완료와 시각 종료를 구분합니다.');}
function finish(s){register(s);if(!s.completed.includes(s.guideId))s.completed.push(s.guideId);s.strong=false;s.inputLocked=false;s.subscriptions=[];s.pending=[];s.mask=null;s.active=null;record(s,'completed','FinishTutorial: Executer 제거·등록 완료. 전역 재평가/이벤트 순서는 외부 조정기가 담당합니다.');}
function collectCells(s){const retained=new Set();function visit(v){if(v===null||typeof v!=='object')return;if(own(v,'$cell')){const id=v.$cell;if(retained.has(id))return;retained.add(id);if(own(s.cells,id))visit(s.cells[id]);return;}for(const x of Object.values(v))visit(x);}visit(s.variables);visit(s.subscriptions);visit(s.pending);visit(s.mask);for(const id of Object.keys(s.cells))if(!retained.has(id))delete s.cells[id];}
function symbol(path,ctx,config){if(own(ctx.constants,path))return ctx.constants[path];const [root,key]=path.split('.');if(config?.enums?.[root])return own(config.enums[root],key)?config.enums[root][key]:null;return {$symbol:path,value:path.split('.').at(-1)};}
function refPath(expr){if(!expr)return null;if(expr.ref)return expr.ref;if(expr.get&&expr.key){const b=refPath(expr.get);return b?b+'.'+expr.key:null;}return null;}
function runtime(s,g,ctx,config){
 let budget=0;const stack=[],emitted=[],effects=[],registrations=[],constraintUpdates=[],cancelledHandlers=new Set();let removing=false;
 const tick=()=>{if(++budget>3000)unimplemented('execution-budget','한 사건의 원작 분기 실행 한도를 넘어 기존 상태를 유지했습니다.');};
 function get(base,key,at){
  if(!safe(String(key)))unimplemented('unsafe-property','허용하지 않는 속성 키입니다.');
  if(base===null||base===undefined)unknown(at||'nil-target','원작 대상이 nil인 속성 접근입니다. 완료로 추정하지 않습니다.');
  if(typeof base!=='object')unknown(at||'non-table-target','원작 테이블/객체가 아닌 값의 필드 접근을 추정하지 않습니다.');
  if(own(base,'$namespace')){const path=base.$namespace+'.'+key;if(own(ctx.constants,path))return ctx.constants[path];if(own(ctx.definitions,path))return ctx.definitions[path];if(base.$namespace==='GM')return {$namespace:path};if(path==='GM.UIManager.allWindowClosed'){if(typeof ctx.allWindowsClosed!=='boolean')unknown('allWindowsClosed');return ctx.allWindowsClosed;}unknown(path,'원작 전역 필드 '+path+'가 미확인입니다.');}
  if(own(base,'$symbol')){const path=base.$symbol+'.'+key;if(own(ctx.constants,path))return ctx.constants[path];if(own(ctx.definitions,path))return ctx.definitions[path];return symbol(path,ctx,config);}
  if(Array.isArray(base)&&Number.isInteger(Number(key)))return base[Number(key)-1]??null;
  if(own(base,key))return base[key];
  if(base.$self)return own(s.variables,key)?s.variables[key]:null;
  if(base.$tutorialModel)return null;
  return null;
 }
 function cell(value){if(Object.keys(s.cells).length>=4096||s.nextCell>=1e9)unimplemented('lexical-cell-capacity');const id='c'+s.nextCell++;s.cells[id]=clone(value??null);return {$cell:id};}
 function readLocal(locals,name){const v=locals[name];if(object(v)&&typeof v.$cell==='string'){if(!own(s.cells,v.$cell))unimplemented('missing-lexical-cell:'+v.$cell);return s.cells[v.$cell];}return v;}
 function evaluate(e,locals={}){return first(rawEvaluate(e,locals));}
 function rawEvaluate(e,locals={}){tick();if(!e)return null;if(own(e,'v'))return e.v;if(e.handler)return {$handler:e.handler,$environment:clone(locals)};
  if(e.ref){
   if(e.ref==='self')return {$self:true};if(own(locals,e.ref))return readLocal(locals,e.ref);
   if(e.ref==='Step'&&own(g.constants,'Step'))return evaluate(g.constants.Step,locals);
   if(own(g.constants,e.ref)){if(stack.includes('const:'+e.ref))unknown('constant-cycle:'+e.ref);stack.push('const:'+e.ref);const v=evaluate(g.constants[e.ref],locals);stack.pop();return v;}
   if(own(ctx.definitions,e.ref))return ctx.definitions[e.ref];if(own(ctx.constants,e.ref))return ctx.constants[e.ref];
   if(/^(EEventType|ActivityType|ActivityState|ETutorial|UIPrefabConfigName|EGameMode|EPropertyType|EBoard|EItem|ESpecial|EDB|ItemType)/.test(e.ref))return {$symbol:e.ref};
   if(e.ref==='GM')return {$namespace:'GM'};
   if(e.ref==='TutorialHelper')return {$namespace:'TutorialHelper'};
   unknown('binding:'+e.ref,'원작 로컬/정의 값 '+e.ref+'이 미확인입니다.');
  }
  if(e.get){const path=refPath(e);if(path&&own(ctx.constants,path))return ctx.constants[path];if(path&&own(ctx.definitions,path))return ctx.definitions[path];return get(evaluate(e.get,locals),e.key??scalar(evaluate(e.index,locals)),path);}
  if(e.table){const out={};let isArray=true;for(const f of e.table){const key=scalar(evaluate(f.key,locals));if(!safe(String(key)))unimplemented('unsafe-table-key');out[key]=evaluate(f.value,locals);if(!Number.isInteger(key)||key<1)isArray=false;}return isArray?Object.keys(out).sort((a,b)=>a-b).map(k=>out[k]):out;}
  if(e.call)return callValue(e,locals);
  if(e.unknown)unknown(e.unknown,e.label);
  if(e.op){const a=evaluate(e.a,locals),v=scalar(a);if(e.op==='not')return !truth(a);if(e.op==='#'){if(typeof v==='string'||Array.isArray(v))return v.length;unknown('length:unknown-object');}if(e.op==='-'&&!e.b){if(typeof v!=='number')unknown('numeric-negation');return -v;}
   if(e.op==='and')return truth(a)?evaluate(e.b,locals):a;if(e.op==='or')return truth(a)?a:evaluate(e.b,locals);
   const b=scalar(evaluate(e.b,locals));
   if(e.op==='=='||e.op==='~='){let equal;if(v!==null&&b!==null&&typeof v==='object'&&typeof b==='object'){if(v===b)equal=true;else if(string(v.$identity,200)&&string(b.$identity,200))equal=v.$identity===b.$identity;else unknown('object-identity','원작 객체 동일성은 명시 identity가 필요합니다. 같은 UID처럼 보인다고 추정하지 않습니다.');}else equal=v===b;return e.op==='=='?equal:!equal;}if(e.op==='..')return String(v)+String(b);
   if(['<','<=','>','>='].includes(e.op)){if(typeof v!==typeof b||!['number','string'].includes(typeof v))unknown('comparison:'+e.op);return e.op==='<'?v<b:e.op==='<='?v<=b:e.op==='>'?v>b:v>=b;}
   if(!Number.isFinite(v)||!Number.isFinite(b))unknown('arithmetic:'+e.op);const n=e.op==='+'?v+b:e.op==='-'?v-b:e.op==='*'?v*b:e.op==='/'?v/b:e.op==='//'?Math.floor(v/b):e.op==='%'?v%b:e.op==='^'?v**b:NaN;if(!Number.isFinite(n))unimplemented('arithmetic:'+e.op);return n;
  }unimplemented('expression-shape');
 }
 function callValue(e,locals){const c=e.call,m=c.split(/[:.]/).at(-1);if(own(ctx.facts,e.factId))return clone(ctx.facts[e.factId]);
  if(c==='self:GetTutorialId')return s.guideId;
  if(c==='self:IsInStrongTutorial')return s.strong;
  if(c==='self:CheckOtherTutorialInStrong'){if(typeof ctx.otherStrong!=='boolean')unknown('otherStrong');if(!s.strong&&ctx.otherStrong){finishSource();return true;}return false;}
  if(c==='GM.TutorialModel:HasAnyStrongTutorialOngoing'){if(typeof ctx.otherStrong!=='boolean')unknown('otherStrong');return s.strong||ctx.otherStrong;}
  if(c==='StringUtil.IsNilOrEmpty'){const v=evaluate(e.args[0],locals);return v===null||v===undefined||v==='';}
  if(c==='tonumber'){const v=scalar(evaluate(e.args[0],locals));if(typeof v!=='number'&&typeof v!=='string'||typeof v==='string'&&v.trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
  if(c==='tostring')return String(scalar(evaluate(e.args[0],locals)));
  if(c==='type'){const v=evaluate(e.args[0],locals);return v===null?'nil':typeof v==='object'?'table':typeof v;}
  if(c==='BoardPosition.Create'){const x=Number(scalar(evaluate(e.args[0],locals))),y=Number(scalar(evaluate(e.args[1],locals)));if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>100||y>100)unknown(e.factId,'명시 보드 좌표가 필요합니다.');return {x,y,$boardPosition:true};}
  if(c==='Bind'){const fn=e.args.find(a=>a.get&&refPath(a.get)==='self');if(fn)return {$handler:fn.key};}
  if(c==='GM.UIManager:GetOpenedViewByName'){if(!Array.isArray(ctx.openViews))unknown('openViews');const name=String(scalar(evaluate(e.args[0],locals)));return ctx.openViews.includes(name)?{$view:name}:null;}
  if(c==='GM.UIManager:AllWindowClosed'){if(typeof ctx.allWindowsClosed!=='boolean')unknown('allWindowsClosed');return ctx.allWindowsClosed;}
  if(c==='GM.MainBoardModel:IsGeneratorFactoryOpen'){if(typeof ctx.generatorFactoryOpen!=='boolean')unknown('generatorFactoryOpen');return ctx.generatorFactoryOpen;}
  if(c==='GM.SceneManager:GetGameMode'){if(typeof ctx.gameMode!=='string')unknown('gameMode');return ctx.gameMode;}
  if(c==='GM.UIManager:GetOpenedTopView'){if(!own(ctx,'topView'))unknown('topView');return ctx.topView===null?null:{$view:ctx.topView};}
  if(c==='GM.ActivityManager:GetModel'){const type=String(scalar(evaluate(e.args[0],locals)));if(!object(ctx.activities)||!own(ctx.activities,type))unknown('activities.'+type);const v=ctx.activities[type];return v===null?null:{$model:type,...clone(v)};}
  if(c==='self.m_model:IsTutorialFinished'||c==='GM.TutorialModel:IsTutorialFinished'){const id=String(scalar(evaluate(e.args[0],locals)));if(s.registeredFinished.includes(id))return true;if(!Array.isArray(ctx.registeredTutorials))unknown('registeredTutorials');return ctx.registeredTutorials.includes(id);}
  if(c==='self.m_model:IsTutorialOnGoing'||c==='GM.TutorialModel:IsTutorialOnGoing'){const id=String(scalar(evaluate(e.args[0],locals)));if(id===s.guideId)return s.started&&!s.registeredFinished.length;if(!Array.isArray(ctx.ongoingTutorials))unknown('ongoingTutorials');return ctx.ongoingTutorials.includes(id);}
  if(['GetState','GetId','GetType'].includes(m)&&e.base){const obj=evaluate(e.base,locals),key={GetState:'state',GetId:'id',GetType:'type'}[m];if(obj&&own(obj,key))return obj[key];}
  if(['GetX','GetY'].includes(m)&&e.base){const obj=evaluate(e.base,locals),key=m==='GetX'?'x':'y';if(obj&&Number.isInteger(obj[key]))return obj[key];}
  if(/^(?:self\.m_model|GM\.TutorialModel):GetForce/.test(c)){const key={GetForceSourceBoardPosition:'forceSource',GetForceTargetBoardPosition:'forceTarget',GetForceEffectBoardPosition:'forceEffect',GetForceSpreadItemCode:'forceSpreadCode',GetForceSkipCost:'forceSkipCost',GetForceUnlockBubbleCost:'forceBubbleCost'}[m];if(key)return s.constraints[key];}
  if(c==='self.m_model:GetDragLock'||c==='GM.TutorialModel:GetDragLock')return s.constraints.dragLocks.length>0;
  if(c==='Table.ListContain'){const values=evaluate(e.args[0],locals),v=scalar(evaluate(e.args[1],locals));if(!Array.isArray(values))unknown(e.factId);return values.map(scalar).includes(v);}
  if(c==='math.min'||c==='math.max'||c==='math.floor'||c==='math.ceil'){const args=e.args.map(a=>Number(scalar(evaluate(a,locals))));if(args.some(x=>!Number.isFinite(x)))unknown(e.factId);return Math[m](...args);}
  if(c.startsWith('self:')&&own(g.programs,m))return invoke(m,expressionValues(e.args,locals),locals).value;
  if(own(locals,c)){const fn=readLocal(locals,c);if(object(fn)&&typeof fn.$handler==='string')return invoke(fn.$handler,expressionValues(e.args,locals),fn.$environment||{}).value;}
  unknown(e.factId,e.label+' 의 반환값/대상이 미확인입니다.');
 }
 function callback(h,locals){if(!h)return null;if(h.handler&&own(g.programs,h.handler))return {handler:h.handler,locals:h.handler.startsWith('cb@')?clone(locals):{}};if(h.handler){const v=s.variables[h.handler];if(v?.$handler&&own(g.programs,v.$handler))return {handler:v.$handler,locals:clone(v.$environment||{})};}if(h.handlerRef){const v=readLocal(locals,h.handlerRef);if(v?.$handler&&own(g.programs,v.$handler))return {handler:v.$handler,locals:clone(v.$environment||{})};}unknown('callback:'+JSON.stringify(h));}
 function set(target,value,locals,isLocal=false){const parts=target.split('.');if(parts[0]==='self'&&parts.length===2){if(!safe(parts[1]))unimplemented('unsafe-state-key');s.variables[parts[1]]=clone(value??null);return;}if(parts.length===1&&safe(target)){if(isLocal||!own(locals,target))locals[target]=cell(value);else if(object(locals[target])&&own(locals[target],'$cell'))s.cells[locals[target].$cell]=clone(value??null);else locals[target]=cell(value);return;}unimplemented('assignment:'+target);}
 function expressionValues(expressions,locals,{tupleRequired=false}={}){const values=[];for(let index=0;index<expressions.length;index++){const expr=expressions[index],raw=rawEvaluate(expr,locals),last=index===expressions.length-1;if(last&&isTuple(raw))values.push(...raw.$luaTuple);else{if(last&&tupleRequired&&expr?.call&&!isTuple(raw))unknown('return-tuple:'+expr.factId,'복수 반환은 일반 배열과 구분한 {$luaTuple:[...]} 및 명시 arity가 필요합니다.');values.push(first(raw));}}return values;}
 function addEffect(i,locals){const targetBinding=own(ctx.targetBindings,i.id)?ctx.targetBindings[i.id]:null;if(targetBinding!==null&&!object(targetBinding))unknown('targetBindings.'+i.id);const effect={id:i.id,kind:i.kind,callee:i.callee,sourceId:i.sourceId,lineStart:i.lineStart,lineEnd:i.lineEnd,args:i.args||[],targetBinding:clone(targetBinding)};effects.push(effect);s.effects.push(effect);s.effects=s.effects.slice(-80);return effect;}
 function run(body,locals){for(const i of body){tick();if(s.completed.length)return {kind:'return',value:null};
  if(i.op==='assign'){
   if(i.multiReturn&&!i.values.at(-1)?.call)unimplemented('multiple-return-layout','원작 마지막 호출의 복수 반환 위치가 보존되지 않은 프로그램입니다.');
   const values=expressionValues(i.values,locals,{tupleRequired:i.multiReturn===true});for(let n=0;n<i.targets.length;n++)set(i.targets[n],values[n]??null,locals,i.isLocal===true);updateActive(s);continue;
  }
  if(i.op==='callback-var'){locals[i.name]=cell(null);s.cells[locals[i.name].$cell]={$handler:i.handler,$environment:clone(locals)};continue;}
  if(i.op==='callback-field'){if(!safe(i.name))unimplemented('unsafe-callback-key');s.variables[i.name]={$handler:i.handler,$environment:clone(locals)};continue;}
  if(i.op==='if'){let hit=false;for(const clause of i.cases){let value;if(own(ctx.facts,clause.factId)){if(typeof ctx.facts[clause.factId]!=='boolean')unknown(clause.factId);value=ctx.facts[clause.factId];}else{try{value=truth(evaluate(clause.test,locals));}catch(e){if(e instanceof Halt&&e.status==='unknown')throw new Halt('unknown',clause.label+' 분기에 필요한 값이 없습니다.',[clause.factId,...e.unknown]);throw e;}}
    if(value){hit=true;const out=run(clause.body,locals);if(out)return out;break;}}
   if(!hit){const out=run(i.otherwise,locals);if(out)return out;}continue;
  }
  if(i.op==='return')return {kind:'return',value:{$luaTuple:expressionValues(i.values,locals)}};
  if(i.op==='break')return {kind:'break'};
  if(i.op==='invoke'){
   if(i.handler==='Finish'&&!own(g.programs,'Finish')){finishSource();continue;}
   if(i.handler==='CheckOtherTutorialInStrong'){callValue({call:'self:CheckOtherTutorialInStrong',args:[]},locals);continue;}
   const args=expressionValues(i.args,locals);invoke(i.handler,args,locals);continue;
  }
  if(i.op==='register'){const target=String(scalar(evaluate(i.target,locals))||s.guideId);if(target===s.guideId)register(s);else{registrations.push({id:target,sourceId:i.sourceId,lineStart:i.lineStart});record(s,'registered-other',target,{sourceId:i.sourceId,lineStart:i.lineStart});}continue;}if(i.op==='finish'){finishSource();continue;}
  if(i.op==='base-remove'){s.subscriptions=[];s.pending=[];continue;}
  if(i.op==='constraint'){
   const action=i.action,value=i.args.length?evaluate(i.args[0],locals):null;
   if(action==='ClearTempDatas')s.constraints=emptyConstraints();
   else if(action==='ClearDragLock')s.constraints.dragLocks=[];
   else if(action==='AddDragLock'||action==='UnDragLock'){if(!string(value,200)||!value)unknown('drag-lock-id');if(action==='AddDragLock'&&!s.constraints.dragLocks.includes(value))s.constraints.dragLocks.push(value);if(action==='UnDragLock')s.constraints.dragLocks=s.constraints.dragLocks.filter(x=>x!==value);}
   else{const key={SetForceSourceBoardPosition:'forceSource',SetForceTargetBoardPosition:'forceTarget',SetForceEffectBoardPosition:'forceEffect',SetForceSpreadItemCode:'forceSpreadCode',SetForceSkipCost:'forceSkipCost',SetForceUnlockBubbleCost:'forceBubbleCost'}[action];if(!key)unimplemented('constraint:'+action);if(value!==null&&['forceSource','forceTarget','forceEffect'].includes(key)&&(!object(value)||!Number.isInteger(value.x)||!Number.isInteger(value.y)||value.x<0||value.y<0||value.x>100||value.y>100))unknown('board-position:'+action);if(value!==null&&['forceSkipCost','forceBubbleCost'].includes(key)&&(!Number.isFinite(value)||value<0||value>1e9))unknown('constraint-cost:'+action);s.constraints[key]=clone(value);}
   constraintUpdates.push({action,value:clone(value),sourceId:i.sourceId,lineStart:i.lineStart});continue;
  }
  if(i.op==='table-insert'){const args=i.args.map(a=>evaluate(a,locals)),array=args[0];if(!Array.isArray(array)||array.length>=128||args.length<2||args.length>3)unknown('table.insert');const position=args.length===2?array.length+1:Number(args[1]),value=args.at(-1);if(!Number.isInteger(position)||position<1||position>array.length+1)unknown('table.insert.position');array.splice(position-1,0,clone(value));continue;}
  if(i.op==='strong'){s.strong=truth(evaluate(i.value,locals));emitted.push({event:'EEventType.TutorialAnyStrongTutorialUpdated',payload:s.strong});updateActive(s);continue;}
  if(i.op==='input-lock'){s.inputLocked=truth(evaluate(i.value,locals));updateActive(s);continue;}
  if(i.op==='save-ongoing'){const v=s.variables.m_strOngoingDatas;if(!string(v,4000))unknown('ongoingData');s.persistedData=v;record(s,'saved-ongoing',v);continue;}
  if(i.op==='log'){record(s,'source-step',String(scalar(evaluate(i.value,locals))),{sourceId:i.sourceId,lineStart:i.lineStart});continue;}
  if(i.op==='listen'){const event=String(scalar(evaluate(i.event,locals))),fn=callback(i.handler,locals);if(!s.subscriptions.some(r=>r.event===event&&r.handler===fn.handler))s.subscriptions.push({event,handler:fn.handler,locals:fn.locals,sourceId:i.sourceId,lineStart:i.lineStart});continue;}
  if(i.op==='unlisten-all'){s.subscriptions=[];continue;}if(i.op==='unlisten'){const event=String(scalar(evaluate(i.event,locals)));s.subscriptions=s.subscriptions.filter(r=>r.event!==event);continue;}
  if(i.op==='emit'){const event=String(scalar(evaluate(i.event,locals))),payload=evaluate(i.payload,locals);emitted.push({event,payload});continue;}
  if(i.op==='schedule'){const delay=Number(scalar(evaluate(i.delay,locals)));if(!Number.isFinite(delay)||delay<0||delay>86400||i.repeat&&delay===0)unknown('delay:'+i.id);const fn=callback(i.handler,locals);if(s.pending.length>=128)unimplemented('callback-capacity');s.pending.push({id:i.id,handler:fn.handler,dueAt:s.time+delay,repeatSeconds:i.repeat?delay:null,locals:fn.locals,sourceId:i.sourceId,lineStart:i.lineStart});if(i.presentationEffect)addEffect({...i,kind:'declared-animation-only',callee:i.presentationEffect.callee,args:i.presentationEffect.args},locals);continue;}
  if(i.op==='unschedule'){if(i.all){for(const p of s.pending)cancelledHandlers.add(p.handler);cancelledHandlers.add('*');s.pending=[];}else{const fn=callback(i.handler,locals);cancelledHandlers.add(fn.handler);s.pending=s.pending.filter(r=>r.handler!==fn.handler);}continue;}
  if(i.op==='mask'){const ef=addEffect(i,locals),fn=i.callback?callback(i.callback,locals):null;s.mask={id:i.id,callback:fn?.handler??null,locals:fn?.locals||{},target:{kind:'source-mask',sourceCall:i.callee,argumentLabels:i.args,geometryResolved:false,...(ef.targetBinding||{})},sourceId:i.sourceId,lineStart:i.lineStart};updateActive(s);continue;}
  if(i.op==='effect'){addEffect(i,locals);if(i.clearMask){s.mask=null;updateActive(s);}continue;}
  if(i.op==='effect-required'){if(!own(ctx.effectResults,i.id)||ctx.effectResults[i.id]?.applied!==true||!['research','verified-web-adapter'].includes(ctx.effectResults[i.id]?.origin)){const requiredEffect={id:i.id,guideId:s.guideId,effectClass:i.effectClass||'unclassified-external',callee:i.callee,sourceId:i.sourceId,lineStart:i.lineStart,lineEnd:i.lineEnd,arguments:(i.arguments||[]).map((arg,index)=>{try{return {index,known:true,value:clone(evaluate(arg,locals))};}catch(e){if(e instanceof Halt)return {index,known:false,unknown:e.unknown};throw e;}})};unimplemented(i.id,i.callee+'는 외부 연산을 요구합니다. 실제 어댑터 결과 없이 성공 처리하지 않습니다.',{requiredEffect});}addEffect({...i,kind:'acknowledged-external-effect'},locals);continue;}
  if(i.op==='loop'){
   let values;if(i.iterator){if(!own(ctx.collections,i.id)||!Array.isArray(ctx.collections[i.id]))unknown(i.id,'원작 반복 대상과 순서를 명시해야 합니다: '+i.iterator);values=ctx.collections[i.id];}
   else{const start=Number(scalar(evaluate(i.start,locals))),end=Number(scalar(evaluate(i.end,locals))),step=i.step?Number(scalar(evaluate(i.step,locals))):1;if(![start,end,step].every(Number.isFinite)||step===0||Math.abs((end-start)/step)>128)unimplemented(i.id,'수치 반복 범위가 웹 실행 한도를 넘습니다.');values=[];for(let v=start;step>0?v<=end:v>=end;v+=step)values.push([v]);}
   if(values.length>128)unimplemented(i.id,'반복 표본은128개까지입니다.');for(let index=0;index<values.length;index++){const tuple=Array.isArray(values[index])?values[index]:[values[index]];const env={...locals};i.variables.forEach((v,n)=>env[v]=cell(tuple[n]??null));const out=run(i.body,env);if(out?.kind==='return')return out;if(out?.kind==='break')break;}continue;
  }
  unimplemented(i.id||i.op,'지원되지 않은 원작 연산입니다: '+(i.callee||i.kind||i.op));
 }return null;}
 function invoke(handler,args=[],parent={}){tick();if(!own(g.programs,handler))unimplemented('method:'+handler,'상속/외부 메서드 '+handler+'의 전용 투영이 필요합니다.');if(stack.filter(x=>x===handler).length>8)unimplemented('recursive:'+handler);const p=g.programs[handler],locals=handler.startsWith('cb@')?{...parent}:{};p.parameters.forEach((name,i)=>locals[name]=cell(args[i]??null));stack.push(handler);const out=run(p.body,locals);stack.pop();return out||{kind:'return',value:{$luaTuple:[]}};}
 function finishSource(){if(removing)unimplemented('recursive-OnRemove');if(own(g.programs,'OnRemove')){removing=true;invoke('OnRemove');removing=false;}finish(s);}
 return {evaluate,invoke,emitted,effects,registrations,constraintUpdates,cancelledHandlers};
}
function startCondition(g,ctx,s){for(const c of g.configConditions||[]){let pass;
 if(c.kind==='TutorialFinished'){if(!Array.isArray(ctx.registeredTutorials))unknown('registeredTutorials');pass=c.args.every(id=>ctx.registeredTutorials.includes(id)||s.registeredFinished.includes(id));}
 else if(c.kind==='MainLevel'){if(!Number.isFinite(ctx.level))unknown('level');pass=ctx.level>=Number(c.args[0]||0);}
 else if(c.kind==='FunctionEnabled'){if(!object(ctx.functionEnabled))unknown('functionEnabled');for(const k of c.args)if(typeof ctx.functionEnabled[k]!=='boolean')unknown('functionEnabled.'+k);pass=c.args.every(k=>ctx.functionEnabled[k]);}
 else if(c.kind==='TaskFinished'){if(!Array.isArray(ctx.finishedTasks))unknown('finishedTasks');pass=c.args.every(id=>ctx.finishedTasks.includes(id));}
 else if(c.kind==='CachedItemPushed'){if(!Array.isArray(ctx.cachedItems))unknown('cachedItems');pass=c.args.length?ctx.cachedItems.some(t=>c.args.includes(String(t))):ctx.cachedItems.length!==0;}
 else if(c.kind==='BakeOutStart'){if(!own(ctx.activities,'BakeOut'))unknown('activities.BakeOut');const m=ctx.activities.BakeOut;if(m===null)pass=false;else{if(typeof m.bakeOutModeOn!=='boolean')unknown('activities.BakeOut.bakeOutModeOn');pass=m.bakeOutModeOn;}}
 else if(c.kind==='CashDashStart'){if(!own(ctx.activities,'CashDash'))unknown('activities.CashDash');const m=ctx.activities.CashDash;if(m===null)pass=false;else{if(typeof m.state!=='string')unknown('activities.CashDash.state');pass=m.state!=='Released';}}
 else unknown('config-condition:'+c.raw);
 if(!pass)return false;
 }return true;}
export function tutorialCatalogEvent(state,event,context,config){
 if(!validTutorialCatalog(state,config))return result(false,'invalid-state','호환되지 않는 안내 저장은 변경하지 않았습니다.');
 if(!knownContext(context)||!object(event)||!jsonSafe(event,65536)||!string(event.type,100))return result(false,'invalid-input','mode=research의 유효한 컨텍스트와 사건이 필요합니다.');
 const g=definition(config,state.guideId),s=clone(state),ctx={facts:{},definitions:{},constants:{},effectResults:{},collections:{},targetBindings:{},...context};
 if(own(ctx,'globalConstraints'))s.constraints=clone(ctx.globalConstraints);
 if(event.now!==undefined){if(!time(event.now)||event.now<s.time)return result(false,'invalid-time','안내 시각은 유효한 순방향 초여야 합니다.');s.time=event.now;}
 const r=runtime(s,g,ctx,config);let status='ignored';
 try{
  if(event.type==='reset'){const fresh=createTutorialCatalog(config,state.guideId);Object.assign(state,fresh);return result(true,'reset','이 안내 연구만 초기화했습니다.',{changed:true});}
  if(event.type==='executer-started'){
   if(s.started||s.completed.length||s.registeredFinished.length)return result(false,'already-started','이미 시작/등록된 안내입니다. 원작 사건 또는 명시 초기화를 사용하세요.');
   if(!startCondition(g,ctx,s))return result(false,'ineligible','원작 config 시작 조건을 충족하지 않습니다.');
   s.started=true;s.variables.m_model={$tutorialModel:true};s.variables.m_tutorialId=s.guideId;r.invoke('OnStart');status='started';
  }else if(event.type==='source-event'){
   if(!s.started||s.completed.length)return result(true,'ignored','실행 중인 원작 리스너가 없습니다.');
   if(!string(event.sourceEvent,500))return result(false,'invalid-input','원작 구독 사건 이름이 필요합니다.');
   const canonical=event.sourceEvent.startsWith('EEventType.')?event.sourceEvent.slice(11):event.sourceEvent;
   const matches=s.subscriptions.filter(x=>x.event===event.sourceEvent||x.event===canonical);
   for(const listener of matches)r.invoke(listener.handler,[event.payload??{}],listener.locals||{});status=matches.length?'event-dispatched':'ignored';
  }else if(event.type==='mask-click'){
   if(!s.mask?.callback)return result(false,'blocked','현재 원작 마스크에는 진행 콜백이 없습니다. 일반 다음 단계로 바꾸지 않았습니다.');
   if(event.callbackId!==undefined&&event.callbackId!==s.mask.id)return result(false,'stale-callback','이미 바뀐 마스크 콜백입니다.');
   const m=s.mask;r.invoke(m.callback,[],m.locals);status='mask-callback';
  }else if(event.type==='clock'){
   const tasks=s.pending.filter(p=>p.dueAt<=s.time);if(tasks.length>64)unimplemented('clock-capacity');
   for(const pending of tasks){s.pending=s.pending.filter(p=>p!==pending);r.invoke(pending.handler,[],pending.locals);if(pending.repeatSeconds!==null&&!s.completed.length&&!r.cancelledHandlers.has('*')&&!r.cancelledHandlers.has(pending.handler)&&!s.pending.some(p=>p.id===pending.id))s.pending.push({...pending,dueAt:s.time+pending.repeatSeconds});}status=tasks.length?'scheduled-callback':'waiting';
  }else if(event.type==='resume'){
   s.subscriptions=[];s.pending=[];s.mask=null;s.strong=false;s.inputLocked=false;s.active=null;if(!own(ctx,'globalConstraints'))s.constraints=emptyConstraints();
   if(s.registeredFinished.length){s.variables={m_strOngoingDatas:''};s.cells={};s.nextCell=1;s.phase=null;status='registered-not-restored';record(s,'resume','Finished 등록 안내는 원작 manager에서 다시 시작하지 않습니다. 시각 완료로 추가하지 않았습니다.');}
   else if(s.started){const saved=s.persistedData;s.variables={m_model:{$tutorialModel:true},m_tutorialId:s.guideId,m_strOngoingDatas:saved};s.cells={};s.nextCell=1;if(own(g.programs,'_ParseDatasStr'))r.invoke('_ParseDatasStr',[saved]);r.invoke('OnStart');status='restored';}
  }else if(event.type==='teardown'){
   if(s.started&&own(g.programs,'OnRemove'))r.invoke('OnRemove');
   s.subscriptions=[];s.pending=[];s.mask=null;s.strong=false;s.inputLocked=false;s.active=null;status='torn-down';record(s,'teardown','화면/리스너만 제거했습니다. 완료로 등록하지 않았습니다.');
  }else return result(false,'unsupported-event','등록된 원작 사건·마스크·시간·생명주기만 실행할 수 있습니다.');
  s.sequence++;s.unknown=[];s.status=s.completed.length?'completed':status;updateActive(s);collectCells(s);
  if(!validTutorialCatalog(s,config))return result(false,'invalid-result','변경 후 안내 저장 검사에 실패해 원래 기록을 유지했습니다.');
  Object.assign(state,s);return result(true,s.status,'원작에 정의된 안내 경로를 처리했습니다.',{changed:true,emitted:r.emitted,effects:r.effects,registrations:r.registrations,constraintUpdates:r.constraintUpdates,sourceProjection:true});
 }catch(e){if(!(e instanceof Halt))throw e;state.unknown=[...new Set(e.unknown)].slice(0,100);state.status=e.status;return result(false,e.status,e.message,{unknown:state.unknown,sourceProjection:true,...e.details});}
}
export function tutorialCatalogView(s,context={},config){
 if(!validTutorialCatalog(s,config))return {valid:false,status:'invalid-state',active:null,unknown:[],eventOptions:[],allowedActions:[],nextDueAt:null};
 if(own(context,'globalConstraints')&&!validConstraints(context.globalConstraints))return {valid:false,status:'invalid-global-constraints',active:null,unknown:['globalConstraints'],eventOptions:[],allowedActions:[],nextDueAt:null};
 const g=find(config,s.guideId),pending=s.pending.map(x=>({...x,locals:undefined}));
 return {valid:true,id:s.guideId,status:s.status,started:s.started,registered:s.registeredFinished.includes(s.guideId),completed:s.completed.includes(s.guideId),active:clone(s.active),strong:s.strong,inputLocked:s.inputLocked,constraints:clone(context.globalConstraints||s.constraints),time:s.time,ongoingData:s.variables.m_strOngoingDatas,persistedData:s.persistedData,unknown:[...s.unknown],eventOptions:s.subscriptions.map(x=>({type:'source-event',sourceEvent:x.event,handler:x.handler,sourceId:x.sourceId,lineStart:x.lineStart})),allowedActions:s.mask?.callback?[{type:'mask-click',callbackId:s.mask.id,label:'원작 마스크 콜백'}]:[],nextDueAt:pending.length?Math.min(...pending.map(p=>p.dueAt)):null,pending,effects:clone(s.effects),history:clone(s.history),support:g.support,unimplemented:g.unimplemented,sourceRefs:g.sourceRefs,originalRuntimeObserved:false};
}

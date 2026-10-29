import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTutorialCatalog,tutorialCatalogEvent,validTutorialCatalog,tutorialCatalogView} from '../src/tutorial-catalog.mjs';
const v=x=>({v:x}),ref=x=>({ref:x}),get=(base,key)=>({get:base,key});
const assign=(targets,values,more={})=>({op:'assign',targets,values,sourceId:'independent',lineStart:1,lineEnd:1,...more});
const program=body=>({parameters:[],body});
function fixture(body,extra={}){return {schemaVersion:1,revision:'f'.repeat(64),guides:[{id:'independent-probe',constants:{},configConditions:[],programs:{OnStart:program(body),...extra},support:'isolated-Lua-semantics-regression-probe',unimplemented:[],sourceRefs:[]}]};}
function start(c,context={}){const s=createTutorialCatalog(c),ctx={mode:'research',...context};return {s,ctx,out:tutorialCatalogEvent(s,{type:'executer-started'},ctx,c)};}

test('Lua truthiness retains zero and empty string while false/nil choose the alternate branch',()=>{
 for(const [input,expected]of [[0,true],['',true],[false,false],[null,false]]){
  const c=fixture([{op:'if',cases:[{test:v(input),factId:'truth',label:'Lua condition',body:[assign(['self.value'],[v(true)])]}],otherwise:[assign(['self.value'],[v(false)])]}]);
  const {s,out}=start(c);assert.equal(out.ok,true);assert.equal(s.variables.value,expected);assert.equal(validTutorialCatalog(s,c),true);
 }
});
test('Lua numeric array lookup is one-based and parallel assignment reads all RHS values before writes',()=>{
 const arr={table:[{key:v(1),value:v('first')},{key:v(2),value:v('second')}]};
 const c=fixture([assign(['items'],[arr]),assign(['self.first'],[{get:ref('items'),index:v(1)}]),assign(['a','b'],[v(1),v(2)]),assign(['a','b'],[ref('b'),ref('a')]),assign(['self.a','self.b'],[ref('a'),ref('b')])]);
 const {s,out}=start(c);assert.equal(out.ok,true);assert.equal(s.variables.first,'first');assert.equal(s.variables.a,2);assert.equal(s.variables.b,1);
});
test('Lua tonumber rejects nil/booleans/empty strings rather than converting them into a false numeric zero',()=>{
 for(const [input,expected]of [[null,null],[false,null],[true,null],['',null],['  ',null],['0',0],[0,0],['1.5',1.5]]){
  const c=fixture([assign(['self.n'],[{call:'tonumber',args:[v(input)],factId:'num',label:'tonumber'}])]);
  const {s,out}=start(c);assert.equal(out.ok,true);assert.equal(s.variables.n,expected);
 }
});
test('unsupported multiple-return calls stop without inventing a nil second result or completion',()=>{
 const call={call:'External.GetPair',args:[],factId:'pair',label:'external tuple'};
 const c=fixture([assign(['a','b'],[call,v(null)],{multiReturn:true}),{op:'finish'}]);
 const {s,out}=start(c,{facts:{pair:{first:1,second:2}}});assert.equal(out.ok,false);assert.ok(['unknown','unimplemented'].includes(out.status));assert.deepEqual(s.completed,[]);assert.deepEqual(s.registeredFinished,[]);assert.equal(s.started,false);assert.equal(Object.hasOwn(s.variables,'b'),false);
});
test('callbacks preserve mutable Lua upvalues or explicitly halt unsupported capture; stale snapshots cannot succeed',()=>{
 for(const metadata of [{},{mutableCapture:true,capturedLocals:['x'],capturePolicy:'read-only-snapshot-with-mutable-capture-rejection'}]){
  const c=fixture([assign(['x'],[v(1)]),{op:'schedule',id:'later',handler:{handler:'cb@later'},delay:v(1),repeat:false,sourceId:'independent',lineStart:2},assign(['x'],[v(2)])],{'cb@later':{...program([assign(['self.captured'],[ref('x')])]),...metadata}});
  const {s,ctx,out}=start(c);
  if(!out.ok){assert.ok(['unknown','unimplemented'].includes(out.status));continue;}
  const fired=tutorialCatalogEvent(s,{type:'clock',now:1},ctx,c);
  if(!fired.ok){assert.ok(['unknown','unimplemented'].includes(fired.status));continue;}
  assert.equal(s.variables.captured,2,'Lua closure reads the live upvalue, not the value when the callback was scheduled');
 }
});
test('named source methods do not dynamically inherit unrelated caller locals',()=>{
 const c=fixture([assign(['secret'],[v(42)]),{op:'invoke',handler:'Other',args:[]}],{Other:program([assign(['self.seen'],[ref('secret')])])});
 const {s,out}=start(c,{definitions:{secret:9}});assert.equal(out.ok,true);assert.equal(s.variables.seen,9);
});
test('the actual87 catalog preserves external tutorial IDs and flags the source callback with a mutable openView upvalue',async()=>{
 const c=JSON.parse(await readFile(new URL('../src/data/tutorial-catalog.json',import.meta.url),'utf8'));
 assert.equal(c.guides.length,87);assert.equal(c.enums.ETutorialId.AcquireAvatarFrame,'tutorial_acquire_avatar_frame');assert.equal(c.enums.ETutorialId.AcquireAvatar,'tutorial_acquire_avatar');
 const g=c.guides.find(g=>g.id==='tutorial_gomeroom_game'),mutable=Object.values(g.programs).find(p=>p.mutableCapture&&p.capturedLocals?.includes('openView'));
 assert.ok(mutable);assert.equal(mutable.capturePolicy,'serialized-shared-binding-cells');assert.equal(g.unimplemented.some(p=>p.op==='mutable-capture'),false);
 assert.notEqual(g.support,'original-runtime-verified');
});
test('missing runtime global booleans stop as unknown instead of becoming truthy namespace objects',()=>{
 const expr=get(get(ref('GM'),'UIManager'),'allWindowClosed'),c=fixture([{op:'if',cases:[{test:expr,factId:'windows',label:'window condition',body:[assign(['self.closed'],[v(true)])]}],otherwise:[assign(['self.closed'],[v(false)])]}]);
 for(const value of [true,false]){const {s,out}=start(c,{allWindowsClosed:value});assert.equal(out.ok,true);assert.equal(s.variables.closed,value);}
 const {s,out}=start(c);assert.equal(out.ok,false);assert.equal(out.status,'unknown');assert.equal(Object.hasOwn(s.variables,'closed'),false);
});
test('required foreign effects cannot mark a guide finished without an explicit adapter acknowledgement',()=>{
 const c=fixture([{op:'effect-required',id:'give-item',kind:'foreign-effect',callee:'GM.MainBoardModel:AddItem',args:[],sourceId:'independent',lineStart:1,lineEnd:1},{op:'finish'}]);
 const {s,out}=start(c);assert.equal(out.ok,false);assert.equal(out.status,'unimplemented');assert.deepEqual(s.completed,[]);assert.deepEqual(s.registeredFinished,[]);
 const acknowledged=start(c,{effectResults:{'give-item':{applied:true,origin:'research'}}});assert.equal(acknowledged.out.ok,true);assert.deepEqual(acknowledged.s.completed,['independent-probe']);assert.equal(acknowledged.out.effects[0].kind,'acknowledged-external-effect');
});
test('registered-finished, displayed completion and reload remain separate states',()=>{
 const c=fixture([{op:'register',target:v('independent-probe'),sourceId:'independent',lineStart:1},{op:'strong',value:v(true)},{op:'mask',id:'mask1',kind:'source-mask',callee:'TutorialHelper.UpdateMask',args:[],callback:{handler:'finishCallback'},sourceId:'independent',lineStart:3,lineEnd:3}],{finishCallback:program([{op:'finish'}])});
 const first=start(c);assert.equal(first.out.ok,true);let view=tutorialCatalogView(first.s,first.ctx,c);assert.equal(view.registered,true);assert.equal(view.completed,false);assert.ok(view.active);
 const reloaded=JSON.parse(JSON.stringify(first.s));const resumed=tutorialCatalogEvent(reloaded,{type:'resume'},first.ctx,c);assert.equal(resumed.ok,true);view=tutorialCatalogView(reloaded,first.ctx,c);assert.equal(view.registered,true);assert.equal(view.completed,false);assert.equal(view.active,null);
 const clicked=tutorialCatalogEvent(first.s,{type:'mask-click',callbackId:'mask1'},first.ctx,c);assert.equal(clicked.ok,true);assert.equal(tutorialCatalogView(first.s,first.ctx,c).completed,true);
});
test('another strong tutorial finishes and runs source teardown rather than treating the collision as a no-op',()=>{
 const c=fixture([{op:'invoke',handler:'CheckOtherTutorialInStrong',args:[]},assign(['self.shouldNotRun'],[v(true)])],{OnRemove:program([assign(['self.removed'],[v(true)])])});
 const {s,out}=start(c,{otherStrong:true});assert.equal(out.ok,true);assert.deepEqual(s.completed,['independent-probe']);assert.equal(s.variables.removed,true);assert.equal(Object.hasOwn(s.variables,'shouldNotRun'),false);
});
test('non-JSON snapshots and nested prototype fields are rejected before cloning/evaluation can crash',()=>{
 const c=fixture([assign(['self.output'],[{call:'External.Get',args:[],factId:'external',label:'external value'}])]);
 for(const input of [()=>1,new Date(),new Map(),Infinity,JSON.parse('{"__proto__":{"polluted":true}}')]){
  const s=createTutorialCatalog(c);let out;assert.doesNotThrow(()=>out=tutorialCatalogEvent(s,{type:'executer-started'},{mode:'research',facts:{external:input}},c));assert.equal(out.ok,false);assert.equal(out.status,'invalid-input');assert.equal(s.started,false);
 }
});

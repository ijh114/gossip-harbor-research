import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createFactoryPlay,factoryPlan,factoryView,validFactoryPlay} from '../src/factory-play.mjs';
const c=JSON.parse(fs.readFileSync(new URL('../src/data/factory-play.json',import.meta.url),'utf8'));
const ctx=()=>({mode:'research',serverEnabled:true,unlockedTypes:Object.fromEntries(c.groups.map(g=>[g.targetType,true])),board:[],inventory:[],bubbles:{},wallet:{coins:37,gems:29,energy:13}});
const cell=(uid,type)=>({uid,type,cover:null});
function plan(s,action,x){const before=structuredClone({s,x,c}),p=factoryPlan(s,action,x,c);assert.deepEqual({s,x,c},before,'Planner mutates neither the caller nor config');return p;}
function move(s,x,uid,type,source='board'){
 const index=x[source].length;x[source].push(cell(uid,type));const p=plan(s,{type:'store',source,index,uid},x);assert.equal(p.ok,true,p.message);x[source][index]=null;return p.nextState;
}
function add(s,x,targetType,itemType){const p=plan(s,{type:'add-score',targetType,itemType},x);assert.equal(p.ok,true,p.message);return p.nextState;}
test('projection has the actual six target thresholds and 23 typed fragments',()=>{
 assert.deepEqual(c.groups.map(g=>[g.targetType,g.targetScore]),[['104',8],['404',8],['705',16],['1006',32],['1205',16],['1705',16]]);
 assert.equal(c.groups.flatMap(g=>g.fragments).length,23);assert.equal(c.sources.length,13);
 for(const s of c.sources){assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.ok(s.ranges.length);}
 const s=createFactoryPlay(c);assert.equal(validFactoryPlay(s,c),true);assert.deepEqual(s.genData,{});assert.equal(s.receipts.length,0);assert.equal(factoryView(s,ctx(),c).groups.reduce((n,g)=>n+g.storedCount,0),0);
});
test('undefined old-save field is compatible; explicit null or malformed data is not discarded',()=>{
 assert.equal(validFactoryPlay(undefined,c),true);for(const s of [null,false,0,{},[]]){assert.equal(validFactoryPlay(s,c),false);assert.equal(factoryPlan(s,{type:'reward'},ctx(),c).ok,false);}
 const s=createFactoryPlay(c);s.revision='wrong';assert.equal(validFactoryPlay(s,c),false);
});
test('every unresolved gate is unknown, known closures do not create a factory',()=>{
 const s=createFactoryPlay(c),x=ctx();delete x.serverEnabled;
 assert.equal(plan(s,{type:'store'},x).status,'unknown');assert.deepEqual(factoryView(s,x,c).unknown,['serverEnabled']);
 x.serverEnabled=true;x.unlockedTypes['104']=null;assert.equal(plan(s,{type:'reward',targetType:'104'},x).status,'unknown');
 x.unlockedTypes['404']=false;assert.equal(factoryView(s,x,c).state,'closed');assert.equal(plan(s,{type:'reward',targetType:'104'},x).status,'gate-closed');
 x.serverEnabled=false;delete x.unlockedTypes;assert.equal(factoryView(s,x,c).state,'closed');assert.deepEqual(s.genData,{});
});
test('research mode is mandatory and every failed action is fully atomic',()=>{
 const s=createFactoryPlay(c),x=ctx();delete x.mode;assert.equal(plan(s,{type:'reward',targetType:'104'},x).status,'research-required');
 x.mode='research';assert.equal(plan(s,{type:'invent'},x).status,'unsupported');assert.equal(plan(s,{type:'return-closed'},x).status,'gate-open');assert.equal(s.sequence,0);
});
test('explicit open observation preserves IsOpen latch without adding ownership, pieces, or outputs',()=>{
 const s=createFactoryPlay(c),x=ctx();assert.equal(factoryView(s,x,c).state,'open');assert.equal(s.unlockedLatched,false,'View remains pure');
 const p=plan(s,{type:'observe-open'},x);assert.equal(p.ok,true,p.message);assert.equal(p.nextState.unlockedLatched,true);assert.deepEqual(p.nextState.genData,{});assert.deepEqual(p.nextState.receipts,[]);assert.deepEqual(p.removals,[]);assert.deepEqual(p.emissions,[]);assert.equal(validFactoryPlay(p.nextState,c),true);
 x.unlockedTypes={};assert.equal(factoryView(p.nextState,x,c).state,'open');assert.equal(plan(p.nextState,{type:'observe-open'},x).status,'already-observed');
 x.serverEnabled=null;assert.equal(factoryView(p.nextState,x,c).state,'unknown');x.serverEnabled=false;assert.equal(factoryView(p.nextState,x,c).state,'closed');
});
test('board store plans exact UID removal; stored potential is distinct from converted score',()=>{
 const x=ctx(),s=createFactoryPlay(c);x.board=[cell(1,'103')];const p=plan(s,{type:'store',source:'board',index:0,uid:1},x);
 assert.equal(p.ok,true);assert.deepEqual(p.removals,[{source:'board',index:0,uid:1,type:'103'}]);assert.deepEqual(p.emissions,[]);assert.equal(p.expectedSequence,0);assert.equal(p.nextState.sequence,1);
 assert.deepEqual(p.events,['Add2GeneratorFactory','GeneratorFactoryTabBoardItem']);assert.equal(p.nextState.genData['104'].items['103'],1);assert.equal(p.nextState.genData['104'].score,0);
 const v=factoryView(p.nextState,x,c).groups[0];assert.equal(v.itemScore,4);assert.equal(v.score,0);assert.equal(v.canReward,false);assert.deepEqual(x.wallet,{coins:37,gems:29,energy:13});
});
test('inventory intake consumes the same source UID without requiring a free board slot',()=>{
 const x=ctx(),s=createFactoryPlay(c);x.board=Array.from({length:63},(_,i)=>cell(i+1,'106'));x.inventory=[cell(100,'704')];
 const p=plan(s,{type:'store',source:'inventory',index:0,uid:100},x);assert.equal(p.ok,true);assert.deepEqual(p.removals,[{source:'inventory',index:0,uid:100,type:'704'}]);assert.deepEqual(p.events,['InventoryItemUpdate','InventoryItemClicked']);assert.equal(p.nextState.genData['705'].items['704'],1);
});
test('stale index/UID, covered or bubbled pieces, unsupported targets and duplicate identities fail',()=>{
 const s=createFactoryPlay(c),x=ctx();x.board=[cell(1,'103')];
 for(const a of [{source:'board',index:0,uid:2},{source:'board',index:1,uid:1}])assert.equal(plan(s,{type:'store',...a},x).status,'stale-input');
 x.inventory=[cell(1,'101')];assert.equal(plan(s,{type:'store',source:'board',index:0,uid:1},x).status,'invalid-input');x.inventory=[];
 for(const cover of ['box','web']){x.board[0].cover=cover;assert.equal(plan(s,{type:'store',source:'board',index:0,uid:1},x).status,'blocked-item');}x.board[0].cover=null;
 x.bubbles[1]={};assert.equal(plan(s,{type:'store',source:'board',index:0,uid:1},x).status,'blocked-item');x.bubbles={};
 delete x.bubbles;assert.equal(plan(s,{type:'store',source:'board',index:0,uid:1},x).status,'unknown');x.bubbles={};
 for(const type of ['104','106','201','bogus']){x.board[0].type=type;assert.equal(plan(s,{type:'store',source:'board',index:0,uid:1},x).status,'unsupported');}
});
test('already collected UID cannot be collected again even if a stale caller keeps the cell',()=>{
 const x=ctx();x.board=[cell(1,'103')];const p=plan(createFactoryPlay(c),{type:'store',source:'board',index:0,uid:1},x);
 const repeat=plan(p.nextState,{type:'store',source:'board',index:0,uid:1},x);assert.equal(repeat.status,'duplicate-input');
 const same=plan(createFactoryPlay(c),{type:'store',source:'board',index:0,uid:1},x);assert.equal(same.transactionId,p.transactionId);assert.equal(same.expectedSequence,p.expectedSequence,'Caller must compare-and-swap before a second commit');
});
test('all six exact groups complete with two highest fragments and emit one Type2 generator',()=>{
 for(const g of c.groups){const x=ctx();let s=createFactoryPlay(c);const f=g.fragments.at(-1);
  s=move(s,x,1,f.type);s=move(s,x,2,f.type);let v=factoryView(s,x,c);assert.equal(v.groups.find(r=>r.targetType===g.targetType).canMerge,true);assert.equal(v.groups.find(r=>r.targetType===g.targetType).canReward,false);
  assert.equal(plan(s,{type:'reward',targetType:g.targetType},x).status,'insufficient');
  s=add(s,x,g.targetType,f.type);s=add(s,x,g.targetType,f.type);const p=plan(s,{type:'reward',targetType:g.targetType},x);
  assert.equal(p.ok,true,p.message);assert.deepEqual(p.emissions,[{type:g.targetType,count:1,cacheType:2}]);assert.equal(p.nextState.genData[g.targetType].score,0);assert.equal(validFactoryPlay(p.nextState,c),true);
  assert.equal(plan(p.nextState,{type:'reward',targetType:g.targetType},x).status,'insufficient');assert.deepEqual(x.wallet,{coins:37,gems:29,energy:13});
 }
});
test('AddScore consumes one stored unit and cannot cross factory chains',()=>{
 const x=ctx();let s=move(createFactoryPlay(c),x,1,'103');const old=structuredClone(s);
 assert.equal(plan(s,{type:'add-score',targetType:'404',itemType:'103'},x).status,'invalid-input');assert.deepEqual(s,old);
 const p=plan(s,{type:'add-score',targetType:'104',itemType:'103'},x);assert.equal(p.addedScore,4);assert.equal(p.nextState.genData['104'].items['103'],0);assert.equal(p.nextState.genData['104'].score,4);
 assert.equal(plan(p.nextState,{type:'add-score',targetType:'104',itemType:'103'},x).status,'insufficient');
});
test('TryReward takes one threshold per call and retains the remainder',()=>{
 const x=ctx();let s=createFactoryPlay(c);for(let uid=1;uid<=5;uid++){s=move(s,x,uid,'103');s=add(s,x,'104','103');}
 let p=plan(s,{type:'reward',targetType:'104'},x);assert.equal(p.nextState.genData['104'].score,12);assert.equal(p.emissions[0].count,1);
 p=plan(p.nextState,{type:'reward',targetType:'104'},x);assert.equal(p.nextState.genData['104'].score,4);assert.equal(p.nextState.emitted.length,2);
 assert.equal(plan(p.nextState,{type:'reward',targetType:'104'},x).status,'insufficient');
});
test('closed return preserves stored pieces, complete generator portions and exact binary remainder',()=>{
 const x=ctx();let s=createFactoryPlay(c),uid=1;
 for(const type of ['1005','1005','1004','1003','1001']){s=move(s,x,uid++,type);s=add(s,x,'1006',type);} // 45 = 32 + 8 + 4 + 1
 s=move(s,x,uid++,'1002');s=move(s,x,uid++,'403');x.serverEnabled=false;
 const p=plan(s,{type:'return-closed'},x);assert.equal(p.ok,true,p.message);assert.deepEqual(p.nextState.genData,{});
 const quantities={};for(const e of p.emissions){quantities[e.type]=(quantities[e.type]||0)+e.count;assert.equal(e.cacheType,2);}
 assert.deepEqual(quantities,{'403':1,'1002':1,'1006':1,'1004':1,'1003':1,'1001':1});assert.equal(validFactoryPlay(p.nextState,c),true);
 assert.equal(p.nextState.receipts.length,s.receipts.length,'Web UID audit survives original data clearing');assert.equal(plan(p.nextState,{type:'return-closed'},x).status,'empty');
 x.serverEnabled=true;x.unlockedTypes={};assert.equal(factoryView(p.nextState,x,c).state,'open','Original all-unlocked latch survives closure');
});
test('closed return can settle several complete units, never returns when the flag is unknown',()=>{
 const x=ctx();let s=createFactoryPlay(c);for(let i=1;i<=6;i++){s=move(s,x,i,'103');s=add(s,x,'104','103');}
 x.serverEnabled=null;assert.equal(plan(s,{type:'return-closed'},x).status,'unknown');x.serverEnabled=false;
 const p=plan(s,{type:'return-closed'},x);assert.deepEqual(p.emissions,[{type:'104',count:3,cacheType:2}]);assert.equal(validFactoryPlay(p.nextState,c),true);
});
test('save validator checks UID uniqueness, quantity conservation, known groups and journal integrity',()=>{
 const x=ctx(),s=move(createFactoryPlay(c),x,1,'103');
 const mutate=[a=>a.receipts.push({...a.receipts[0]}),a=>a.genData['104'].score++,a=>a.genData['104'].items['103']++,a=>a.genData['104'].items['201']=0,a=>a.genData['201']={items:{},score:0},a=>a.receipts[0].type='104',a=>a.sequence=0,a=>a.emitted.push({type:'104',count:1,reason:'reward',sequence:1}),a=>a.wallet={coins:1}];
 for(const f of mutate){const a=structuredClone(s);f(a);assert.equal(validFactoryPlay(a,c),false);assert.equal(factoryPlan(a,{type:'reward',targetType:'104'},x,c).status,'invalid-state');}
 assert.equal(validFactoryPlay(JSON.parse(JSON.stringify(s)),c),true);
});
test('record/count bounds fail before any caller-owned board or wallet change',()=>{
 const small=structuredClone(c);small.limits.maxCountPerType=1;const x=ctx();x.board=[cell(1,'103'),cell(2,'103')];
 const p=factoryPlan(createFactoryPlay(small),{type:'store',source:'board',index:0,uid:1},x,small);assert.equal(p.ok,true);
 const before=structuredClone({state:p.nextState,x});const q=factoryPlan(p.nextState,{type:'store',source:'board',index:1,uid:2},x,small);assert.equal(q.status,'limit');assert.deepEqual({state:p.nextState,x},before);
 const missing=structuredClone(c);delete missing.groups[0].fragments[0].points;assert.throws(()=>createFactoryPlay(missing));
});

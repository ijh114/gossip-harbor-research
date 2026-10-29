import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpreadState,migrateSpreadState,refreshSpread,openSpreadItem,speedUpSpread,spreadItem,autoSpread,chooseItem,getChoices,validSpreadState} from '../src/spread-model.mjs';
import * as Spread from '../src/spread-model.mjs';

function config(){
 const rule=(type,extra={})=>({type,auto:false,weightType:1,pool:[{type:'201',weight:2},{type:'203',weight:1}],batch:3,storage:6,costEnergy:true,cooldownSeconds:2,storageRecoverySeconds:30,initSeconds:null,openSeconds:null,initSpeedUpCost:null,openSpeedUpCost:null,itemSpeedUpCost:8,storageSpeedUpCost:20,transformAfter:null,transformPool:[],...extra});
 return {items:[{type:'104',chainId:'1',chainLevel:4},...[1,2,3,4,5].map(n=>({type:String(200+n),chainId:'2',chainLevel:n,next:n<5?String(201+n):null})),{type:'2501',chainId:'25',chainLevel:1},{type:'2701',chainId:'27',chainLevel:1},{type:'1006',chainId:'10',chainLevel:6},{type:'fish_trophy_a_1',chainId:'fish_trophy_a',chainLevel:1},{type:'fish_trophy_b_1',chainId:'fish_trophy_b',chainLevel:1},{type:'4001',chainId:'40',chainLevel:1},{type:'os_1_1',chainId:'os_1',chainLevel:1},{type:'order_chest',chainId:'order_chest',chainLevel:1},{type:'custom_chest',chainId:'custom_chest',chainLevel:1},{type:'smart_pot',chainId:'smart_pot',chainLevel:1}],
  orderRules:{itemConfig:[{Code:'201',DiffScore:1,UnlockLevel:1},{Code:'202',DiffScore:2,UnlockLevel:1},{Code:'203',DiffScore:3,UnlockLevel:1},{Code:'204',DiffScore:5,UnlockLevel:1},{Code:'205',DiffScore:10,UnlockLevel:1}],chainGenerators:{'2':['104']}},
  spreadRules:{byType:{'104':rule('104'),'2701':rule('2701',{weightType:2,batch:3,storage:3,costEnergy:false,cooldownSeconds:null,storageRecoverySeconds:null,openSeconds:480,openSpeedUpCost:8}),
   '1006':rule('1006',{auto:true,costEnergy:false,batch:2,storage:4}),
   fish_trophy_a_1:rule('fish_trophy_a_1',{weightType:2,batch:3,storage:3,costEnergy:false,cooldownSeconds:null,storageRecoverySeconds:null,transformAfter:3,transformPool:[{type:'fish_trophy_b_1',weight:10}]}),
   fish_trophy_b_1:rule('fish_trophy_b_1',{initSeconds:86400}),
   order_chest:rule('order_chest',{weightType:3,batch:75,storage:75,costEnergy:false,cooldownSeconds:null,pool:[{type:'201',weight:1},{type:'203',weight:3}]}),
   custom_chest:rule('custom_chest',{weightType:4,batch:450,storage:450,costEnergy:false,cooldownSeconds:null,pool:[]}),
   smart_pot:rule('smart_pot',{weightType:5,batch:35,storage:14,costEnergy:false,cooldownSeconds:null,pool:[]})},
  choices:{'4001':{choices:['201','203','205'],dynamic:false},os_1_1:{choices:['201','202','203','204','205'],dynamic:true}},transforms:{},wrapperMerges:{},boostTargetTypes:['104']}};
}
function state(c=config()){return {board:Array(63).fill(null),wallet:{energy:100,gems:200,level:3,time:0,generated:0},generatorState:{},pools:{},bubbles:{},rng:42,nextUid:1,itemUnlocks:{'104':true},inventory:{items:[]},queue:[]};}
function put(s,c,index,type){const cell={uid:s.nextUid++,type,cover:null};s.board[index]=cell;const r=createSpreadState(type,c,s.wallet.time);if(r)s.generatorState[cell.uid]=r;return cell;}
function hooks(s,c,random){return {makeCell(type){const cell={uid:s.nextUid++,type,cover:null};const r=createSpreadState(type,c,s.wallet.time);if(r)s.generatorState[cell.uid]=r;return cell;},removeCell(index){delete s.generatorState[s.board[index]?.uid];s.board[index]=null;},...(random?{random}:{} )};}

test('phase initialization distinguishes closed/opened/initializing and nullable storage without guessing missing values',()=>{
 const c=config();assert.equal(createSpreadState('201',c),null);assert.equal(createSpreadState('2701',c).phase,'closed');assert.equal(createSpreadState('fish_trophy_b_1',c).readyAt,86400);
 const old={charges:2,storage:6,timerStart:0,readyAt:2};const migrated=migrateSpreadState('104',old,c,1);assert.equal(migrated.charges,2);assert.equal(migrated.phase,'opened');assert.deepEqual(old,{charges:2,storage:6,timerStart:0,readyAt:2});assert.equal(validSpreadState('104',migrated,c,1),true);
 const nullable=config();nullable.spreadRules.byType['104'].storage=null;nullable.spreadRules.byType['104'].cooldownSeconds=null;assert.equal(createSpreadState('104',nullable).storage,null);
});
test('a rejected action on an old16 save does not silently mutate its legacy metadata',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'104');s.generatorState[cell.uid]={charges:3,storage:6,timerStart:null,readyAt:0};s.wallet.energy=0;
 const before=structuredClone(s);assert.equal(spreadItem(s,31,c,hooks(s,c)).ok,false);assert.deepEqual(s,before);
});
test('opening costs no energy, waits exact duration and cannot be restarted or sped up without enough gems',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'2701'),h=hooks(s,c);const before=structuredClone(s);assert.equal(spreadItem(s,31,c,h).ok,false);assert.deepEqual(s,before);
 assert.equal(openSpreadItem(s,31,c).ok,true);assert.equal(s.generatorState[cell.uid].phase,'opening');assert.equal(openSpreadItem(s,31,c).ok,false);
 s.wallet.time=240;refreshSpread(s,31,c);s.wallet.gems=3;const poor=structuredClone(s);assert.equal(speedUpSpread(s,31,c).ok,false);assert.deepEqual(s,poor);
 s.wallet.gems=4;assert.equal(speedUpSpread(s,31,c).ok,true);assert.equal(s.wallet.gems,0);assert.equal(s.generatorState[cell.uid].phase,'opened');assert.equal(s.wallet.energy,100);
});
test('shared fixed decks deplete by type, while full board and energy failure cannot advance RNG, decks or charges',()=>{
 const c=config(),s=state(c);put(s,c,30,'104');put(s,c,31,'104');const h=hooks(s,c),seen={};
 for(let i=0;i<3;i++){const before=s.board.map(x=>x?.uid);assert.equal(spreadItem(s,i%2?30:31,c,h).ok,true);const index=s.board.findIndex(x=>x&&!before.includes(x.uid));seen[s.board[index].type]=(seen[s.board[index].type]||0)+1;s.board[index]=null;}
 assert.deepEqual(seen,{'201':2,'203':1});assert.deepEqual(s.pools['104'],[0,0]);
 for(let i=0;i<63;i++)if(!s.board[i])s.board[i]={uid:s.nextUid++,type:'201',cover:null};let before=structuredClone(s);assert.equal(spreadItem(s,30,c,h).ok,false);assert.deepEqual(s,before);
 s.board[0]=null;s.wallet.energy=0;before=structuredClone(s);assert.equal(spreadItem(s,30,c,h).ok,false);assert.deepEqual(s,before);
});
test('per-instance decremental chests exhaust exact composition and disappear only after their final spread',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'2701');openSpreadItem(s,31,c);s.wallet.time=480;refreshSpread(s,31,c);const h=hooks(s,c),types=[];
 for(let i=0;i<3;i++){const before=s.board.map(x=>x?.uid);assert.equal(spreadItem(s,31,c,h).ok,true);const index=s.board.findIndex(x=>x&&!before.includes(x.uid));types.push(s.board[index].type);if(i<2)assert.equal(s.board[31].uid,cell.uid);}
 assert.deepEqual(types.sort(),['201','201','203']);assert.equal(s.board[31],null);assert.equal(s.generatorState[cell.uid],undefined);assert.equal(s.wallet.energy,100);assert.deepEqual(s.pools,{});
});
test('recovery preserves exact two-reservoir transition and nullable storage remains disposable',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'104');spreadItem(s,31,c,hooks(s,c));let r=s.generatorState[cell.uid];s.wallet.time=2;refreshSpread(s,31,c);assert.equal(r.charges,3);assert.equal(r.storage,5);assert.equal(r.timerStart,null);
 r.charges=2;r.storage=1;r.timerStart=2;r.readyAt=4;s.wallet.time=4;refreshSpread(s,31,c);assert.equal(r.storage,0);assert.equal(r.readyAt,34);s.wallet.time=34;refreshSpread(s,31,c);assert.equal(r.storage,6);assert.equal(r.charges,3);
});
test('auto generators use neighbors without energy debit and stop at zero charges; blocked neighbors do not auto-spread farther away',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'1006'),h=hooks(s,c);assert.equal(autoSpread(s,31,c,h).ok,true);assert.ok(s.board[24]);assert.equal(autoSpread(s,31,c,h).ok,true);assert.ok(s.board[25]);assert.equal(s.wallet.energy,100);assert.equal(s.generatorState[cell.uid].charges,0);assert.equal(autoSpread(s,31,c,h).ok,false);
 const b=state(c);put(b,c,31,'1006');for(const index of [24,25,32,39,38,37,30,23])put(b,c,index,'201');const before=structuredClone(b);assert.equal(autoSpread(b,31,c,hooks(b,c)).ok,false);assert.deepEqual(b,before);assert.equal(spreadItem(b,31,c,hooks(b,c)).ok,true,'manual tap may use a farther spread ring when auto neighbors are blocked');
});
test('exhaustion transform replaces the source and starts the configured next-stage initialization',()=>{
 const c=config(),s=state(c);const old=put(s,c,31,'fish_trophy_a_1'),h=hooks(s,c);for(let i=0;i<3;i++)assert.equal(spreadItem(s,31,c,h).ok,true);
 assert.equal(s.board[31].type,'fish_trophy_b_1');assert.notEqual(s.board[31].uid,old.uid);assert.equal(s.generatorState[old.uid],undefined);assert.equal(s.generatorState[s.board[31].uid].phase,'initializing');assert.equal(s.generatorState[s.board[31].uid].readyAt,86400);
});
test('order chests use missing-order difficulty weights then uniform lower-level candidates and consume configured score',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'order_chest');let n=0;const h=hooks(s,c,()=>n++===0?0:0.99);
 assert.equal(spreadItem(s,31,c,h,{orders:[{requirements:[{type:'205',count:1}]}]}).ok,true);assert.ok(s.board.some(x=>x?.type==='203'));assert.equal(s.generatorState[cell.uid].charges,72,'configured weight3 is a score cost, not repeated draw odds');
 const missing=state(c);put(missing,c,31,'order_chest');const before=structuredClone(missing);assert.equal(spreadItem(missing,31,c,hooks(missing,c)).ok,false);assert.deepEqual(missing,before,'missing orders snapshot must not silently use ordinary weights');
});
test('order chest lack detection includes lower-level stock sufficient to merge a requirement before using unlocked fallback',()=>{
 const c=config(),s=state(c);c.spreadRules.byType.order_chest.pool=[{type:'203',weight:3},{type:'205',weight:10}];
 put(s,c,31,'order_chest');put(s,c,0,'203');put(s,c,1,'203');
 const result=spreadItem(s,31,c,hooks(s,c,()=>0.99),{orders:[{requirements:['204']}]});assert.equal(result.ok,true);assert.equal(result.type,'205','two level3 pieces satisfy a level4 merge requirement; fallback may select level5');
});
test('custom chest fulfills an affordable missing-order item and debits its source DiffScore',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'custom_chest');assert.equal(spreadItem(s,31,c,hooks(s,c),{orders:[{requirements:[{type:'205',count:1}]}]}).ok,true);assert.ok(s.board.some(x=>x?.type==='205'));assert.equal(s.generatorState[cell.uid].charges,440);
});
test('smart pot exposes a verified resolver boundary instead of making up a random fallback',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'smart_pot');const before=structuredClone(s);assert.equal(spreadItem(s,31,c,hooks(s,c),{orders:[]}).ok,false);assert.deepEqual(s,before);
 const h=hooks(s,c);h.resolveSmart=({scoreMap,budget})=>{assert.equal(scoreMap['205'],10);assert.equal(budget,35);return '205';};assert.equal(spreadItem(s,31,c,h,{orders:[]}).ok,true);assert.equal(s.generatorState[cell.uid].charges,25);
});
test('boost prechecks maximum requested energy before order-aware level reduction and uses server charge sequence only when supplied',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'104');s.wallet.energy=3;const context={boostRatio:2,orderLackCounts:{'201':1}};let before=structuredClone(s);assert.equal(spreadItem(s,31,c,hooks(s,c,()=>0),context).ok,false);assert.deepEqual(s,before);
 s.wallet.energy=4;assert.equal(spreadItem(s,31,c,hooks(s,c,()=>0),context).ok,true);assert.equal(s.wallet.energy,3);assert.ok(s.board.some(x=>x?.type==='201'));assert.equal(s.generatorState[cell.uid].charges,2);
 const b=state(c),gen=put(b,c,31,'104');assert.equal(spreadItem(b,31,c,hooks(b,c,()=>0),{boostRatio:1,boostCostSequence:[2,1]}).ok,true);assert.equal(b.wallet.energy,98);assert.equal(b.generatorState[gen.uid].charges,1);assert.ok(b.board.some(x=>x?.type==='202'));
});
test('tutorial forced output bypasses the normal deck and prevents output upgrading',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'104');assert.equal(spreadItem(s,31,c,hooks(s,c),{forceCode:'2501',boostRatio:1}).ok,true);assert.ok(s.board.some(x=>x?.type==='2501'));assert.deepEqual(s.pools,{});assert.equal(s.wallet.energy,99);assert.equal(s.generatorState[cell.uid].charges,2);
});
test('boost shortage map includes stored pieces while odd surplus checks remain board-only',()=>{
 const c=config(),s=state(c);put(s,c,31,'104');s.inventory.items.push({uid:s.nextUid++,type:'201',cover:null});
 const result=spreadItem(s,31,c,hooks(s,c,()=>0),{boostRatio:2,orders:[{requirements:['201']}]});assert.equal(result.ok,true);assert.equal(result.type,'203');assert.equal(s.wallet.energy,96);
});
test('dynamic choices use explicit active orders and cache-inclusive stock; static three-option choices replace once',()=>{
 const c=config(),s=state(c);put(s,c,31,'4001');assert.deepEqual(getChoices(s,31,c).choices,['201','203','205']);assert.equal(chooseItem(s,31,2,c,hooks(s,c)).ok,true);assert.equal(s.board[31].type,'205');
 put(s,c,30,'os_1_1');assert.equal(getChoices(s,30,c).ok,false);const selected=getChoices(s,30,c,{orders:[{requirements:['204']}]});assert.equal(selected.choices[0],'204');
 s.queue.push({type:'204',count:1});assert.deepEqual(getChoices(s,30,c,{orders:[{requirements:['204']}]}).choices,['201','202','203'],'cache satisfies the candidate before fallback');
 const before=structuredClone(s);assert.equal(chooseItem(s,30,99,c,hooks(s,c),{orders:[]}).ok,false);assert.deepEqual(s,before);
});
test('lucky precedes tutorial override, while explicit disco support suppresses lucky and owns its counter branch',()=>{
 const c=config(),s=state(c),cell=put(s,c,31,'104'),h=hooks(s,c);h.resolveLucky=()=>({type:'201',adjustedBoostRatio:1});
 const lucky=spreadItem(s,31,c,h,{luckyActive:true,boostRatio:1,forceCode:'2501'});assert.equal(lucky.type,'202');assert.equal(lucky.branch,'lucky-external');assert.equal(s.generatorState[cell.uid].charges,3);assert.deepEqual(s.pools,{});
 const d=state(c),dc=put(d,c,31,'104'),dh=hooks(d,c);let called=false;dh.resolveLucky=()=>{called=true;return {type:'201'};};dh.resolveDisco=()=>({type:'205'});
 const disco=spreadItem(d,31,c,dh,{luckyActive:true,discoActive:true});assert.equal(disco.type,'205');assert.equal(called,false);assert.equal(d.wallet.energy,100);assert.equal(d.generatorState[dc.uid].charges,3);
});
test('reward wrappers preserve opaque packs while a known levelup payload becomes exactly one new board item',()=>{
 const c=config();c.items.push({type:'reward_bubble_1'},{type:'level_up_piece_1'});c.spreadRules.wrapperMerges={
  main_pack_common_5_3:{code:'rb#pack_common_5',wrapperType:'reward_bubble_1',rewardType:'pack_common_5',rewardCount:1,opaque:true},
  main_level_up_piece_3:{code:'rb#level_up_piece_1',wrapperType:'reward_bubble_1',rewardType:'level_up_piece_1',rewardCount:1,opaque:false}};
 assert.equal(typeof Spread.describeRewardWrapper,'function');assert.equal(typeof Spread.collectRewardWrapper,'function');
 const descriptor=Spread.describeRewardWrapper('rb#pack_common_5',c);assert.equal(descriptor.type,'reward_bubble_1');assert.equal(descriptor.opaque,true);
 const s=state(c);let cell=put(s,c,31,'reward_bubble_1');Object.assign(cell,descriptor);let before=structuredClone(s);assert.equal(Spread.collectRewardWrapper(s,31,c,hooks(s,c)).ok,false);assert.deepEqual(s,before);
 Object.assign(cell,Spread.describeRewardWrapper('rb#level_up_piece_1',c));const old=cell.uid;assert.equal(Spread.collectRewardWrapper(s,31,c,hooks(s,c)).ok,true);assert.equal(s.board[31].type,'level_up_piece_1');assert.notEqual(s.board[31].uid,old);
});
test('active configuration changes reset shared pools but preserve existing instance timer/max/cost snapshots',()=>{
 const c=config(),s=state(c),old=put(s,c,31,'104');s.pools['104']=[2,0];
 const view=structuredClone(c);view.productionView={baseByType:{'104':structuredClone(c.spreadRules.byType['104'])}};
 view.spreadRules.byType['104']={...view.spreadRules.byType['104'],batch:5,storage:10,cooldownSeconds:20,itemSpeedUpCost:80,pool:[{type:'203',weight:4}]};
 assert.equal(spreadItem(s,31,view,hooks(s,view,()=>0)).type,'203');assert.equal(s.generatorState[old.uid].charges,2);assert.equal(s.generatorState[old.uid].readyAt,2);assert.deepEqual(s.pools['104'],[3]);
 const fresh=put(s,view,0,'104');assert.equal(s.generatorState[fresh.uid].charges,5);spreadItem(s,0,view,hooks(s,view,()=>0));assert.equal(s.generatorState[fresh.uid].readyAt,20);
 s.wallet.time=1;assert.equal(Spread.getSpeedUpCost(s,31,view).cost,4);assert.equal(validSpreadState('104',s.generatorState[old.uid],view,1),true);
 const forged=structuredClone(s.generatorState[old.uid]);forged.ruleSnapshot.cooldownSeconds=999;assert.equal(validSpreadState('104',forged,view,1),false);
 c.productionRules={boostItemConfigs:{ExtraProduce:{'104':view.spreadRules.byType['104']}}};assert.equal(Spread.validSpreadPools(s,c),true);const bad=structuredClone(s);bad.poolSignatures['104']='unverified';assert.equal(Spread.validSpreadPools(bad,c),false);
});
test('additional spreads use source ring before replacement and consume neither source count nor a cache fallback',()=>{
 const c=config();Object.assign(c.spreadRules.byType['104'],{batch:1,storage:1,cooldownSeconds:null,storageRecoverySeconds:null,pool:[{type:'201',weight:1}],transformAfter:1,transformPool:[{type:'fish_trophy_b_1',weight:1}]});
 const s=state(c),source=put(s,c,31,'104'),h=hooks(s,c,()=>0);h.planAdditionalSpreads=()=>({additionalSpreads:[{type:'201',count:1,costEnergy:false,reason:'generator-boost-extra'}]});
 const r=spreadItem(s,31,c,h);assert.equal(r.ok,true);assert.equal(s.wallet.energy,99);assert.equal(s.board[24].uid,source.uid+1);assert.equal(s.board[25].uid,source.uid+2);assert.equal(s.board[31].uid,source.uid+3);assert.equal(s.board[31].type,'fish_trophy_b_1');assert.deepEqual(s.queue,[]);
});
test('explicit ItemLandOpt uses direction-first same-type placement and keeps ExtraLucky on the source ring',()=>{
 const c=config(),s=state(c);put(s,c,31,'104');put(s,c,32,'201');put(s,c,0,'201');
 const h=hooks(s,c,()=>0);h.planAdditionalSpreads=()=>({additionalSpreads:[{type:'201',count:1,costEnergy:false,reason:'generator-boost-extra'}]});
 const r=spreadItem(s,31,c,h,{itemLandOpt:true});assert.equal(r.ok,true);assert.deepEqual(r.cells,[33,34]);assert.equal(s.board[24],null);
 const b=state(c);put(b,c,31,'104');put(b,c,32,'201');const hb=hooks(b,c,()=>0);hb.planAdditionalSpreads=()=>({additionalSpreads:[{type:'201',count:1,costEnergy:false,reason:'generator-boost-extra-lucky'}]});
 const rb=spreadItem(b,31,c,hb,{itemLandOpt:true});assert.equal(rb.ok,true);assert.deepEqual(rb.cells,[33,24]);
});
test('ItemLandOpt recognizes cobweb inner matches, excludes boxes and bubbles, and tutorial board keeps ring placement',()=>{
 const c=config(),s=state(c);put(s,c,31,'104');const match=put(s,c,32,'201');match.cover='web';
 assert.equal(Spread.findEmptySpreadPosition(s,'201',c,31),33);
 match.cover='box';assert.equal(Spread.findEmptySpreadPosition(s,'201',c,31),24);
 match.cover=null;s.bubbles[match.uid]={innerType:'201'};assert.equal(Spread.findEmptySpreadPosition(s,'201',c,31),24);
 delete s.bubbles[match.uid];assert.equal(spreadItem(s,31,c,hooks(s,c,()=>0),{itemLandOpt:true,tutorialBoard:true}).cells[0],24);
});
test('modifier hooks run after base selection and energy planning before commit, and hook failure is atomic',()=>{
 const c=config(),s=state(c);put(s,c,31,'104');const seen=[],h=hooks(s,c,()=>0);
 h.afterBaseGeneration=snapshot=>{seen.push(['base',snapshot.outputType,snapshot.random()]);return {extra:true};};
 h.afterEnergyConsumed=snapshot=>{seen.push(['energy',snapshot.energy,snapshot.costEnergy,snapshot.extra,snapshot.random()]);};
 const r=spreadItem(s,31,c,h);assert.equal(r.ok,true);assert.equal(r.extra,true);assert.deepEqual(seen,[['base','201',0],['energy',1,true,true,0]]);
 const failed=state(c);put(failed,c,31,'104');const before=structuredClone(failed),bad=hooks(failed,c);bad.afterEnergyConsumed=()=>{throw Error('invalid modifier snapshot');};assert.equal(spreadItem(failed,31,c,bad).ok,false);assert.deepEqual(failed,before);
});
test('energy subtraction failure after a higher lucky ratio never makes wallet negative; infinite energy keeps the source cost flag',()=>{
 const c=config(),s=state(c);put(s,c,31,'104');s.wallet.energy=1;const h=hooks(s,c);h.resolveLucky=()=>({type:'201',adjustedBoostRatio:2});
 const r=spreadItem(s,31,c,h,{luckyActive:true,boostRatio:0});assert.equal(r.ok,true);assert.equal(r.requestedEnergy,4);assert.equal(r.energy,0);assert.equal(r.debitSucceeded,false);assert.equal(s.wallet.energy,1);
 const infinite=state(c);put(infinite,c,31,'104');infinite.wallet.energy=0;let costFlag;const ih=hooks(infinite,c,()=>0);ih.afterEnergyConsumed=x=>costFlag=x.costEnergy;
 const ir=spreadItem(infinite,31,c,ih,{boostRatio:1,energyInfinite:true});assert.equal(ir.ok,true);assert.equal(ir.energy,0);assert.equal(ir.requestedEnergy,2);assert.equal(costFlag,true);assert.equal(infinite.wallet.energy,0);
});

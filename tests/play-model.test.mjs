import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPlay,playAction,generateFrom,moveOrMerge,deliverFixedOrder,advancePlay,validPlay,itemFor} from '../src/play-model.mjs';
import {encodeSave,decodeSave} from '../src/session-store.mjs';
const config=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
const play=options=>{const s=createPlay(config,options);playAction(s,'start',null,config);return s;};
const snapshot=s=>({energy:s.wallet.energy,rng:s.rng,pools:structuredClone(s.pools),generators:structuredClone(s.generatorState)});
test('initial source board peels only adjacent paperboxes and reaches the first generator via the traced three merges',()=>{
 const s=play({scenario:'initial'});assert.equal(s.board.filter(x=>x.cover==='box').length,60);
 for(const step of config.initialReplay){assert.equal(moveOrMerge(s,step.from,step.to,config).ok,true);assert.equal(s.board[step.to].type,step.result);}
 assert.equal(s.board[31].type,'104');assert.equal(s.board[31].cover,null);
 assert.equal(s.board[24].cover,'web');assert.ok(s.board.some(c=>c?.cover==='box'));
 const before=s.wallet.energy;assert.equal(generateFrom(s,31,config).ok,true);assert.equal(s.wallet.energy,before-1);assert.ok(s.board.some(c=>c?.type==='201'&&!c.cover));
 assert.equal(validPlay(s,config),true);
});
test('fixed generator deck is shared by type and exhausts the exact configured composition before reset',()=>{
 const s=play(),g=itemFor(config,'106').generator;
 const c={uid:s.nextUid++,type:'106',cover:null};s.board[2]=c;s.generatorState[c.uid]={charges:g.batch,storage:g.storage,timerStart:null,readyAt:0};
 const counts={};
 for(let n=0;n<42;n++){const before=s.board.map(c=>c?.uid);assert.equal(generateFrom(s,n%2?2:0,config).ok,true);const slot=s.board.findIndex((c,i)=>c&&!before.includes(c.uid));const type=s.board[slot].type;counts[type]=(counts[type]||0)+1;s.board[slot]=null;}
 assert.deepEqual(counts,{'201':34,'202':2,'203':1,'301':5});assert.deepEqual(s.pools['106'],[0,0,0,0]);
 assert.equal(generateFrom(s,0,config).ok,true);assert.equal(s.pools['106'].reduce((a,b)=>a+b,0),41);
});
test('full board and insufficient energy preserve deck, RNG and generator charges; energy shortage opens a bounded BM flow',()=>{
 const s=play();for(let i=2;i<63;i++)s.board[i]={uid:s.nextUid++,type:'201',cover:null};
 const before=snapshot(s);assert.equal(generateFrom(s,0,config).ok,false);assert.deepEqual(snapshot(s),before);
 s.board[62]=null;s.wallet.energy=0;s.selected=0;const empty=snapshot(s);assert.equal(generateFrom(s,0,config).ok,false);assert.deepEqual(snapshot(s),empty);assert.equal(s.modal,'energy');
 playAction(s,'close-energy',null,config);assert.equal(s.modal,null,'free refill blocks the bundle candidate');
 playAction(s,'open-energy',null,config);playAction(s,'buy-energy',null,config);assert.equal(s.wallet.energy,100);assert.equal(s.wallet.price,20);
 s.wallet.energy=0;generateFrom(s,0,config);playAction(s,'close-energy',null,config);assert.equal(s.modal,'offer');assert.equal(s.offer.chosen,'에너지 번들');
});
test('generator recovery starts after first spend and transitions through both reservoir durations',()=>{
 const s=play({scenario:'initial'});for(const x of config.initialReplay)moveOrMerge(s,x.from,x.to,config);
 generateFrom(s,31,config);const r=s.generatorState[s.board[31].uid];assert.equal(r.timerStart,0);assert.equal(r.charges,79);
 advancePlay(s,1,config);assert.equal(r.charges,79);advancePlay(s,1,config);assert.equal(r.charges,80);assert.equal(r.storage,239);
 r.storage=1;r.charges=79;r.timerStart=s.wallet.time;advancePlay(s,2,config);assert.equal(r.storage,0);assert.equal(r.charges,80);
 advancePlay(s,29,config);assert.equal(r.storage,0);advancePlay(s,1,config);assert.equal(r.storage,240);assert.equal(r.timerStart,null);
});
test('duplicate item requirements are exact and failed submissions neither remove a partial set nor award coins',()=>{
 const s=play();s.orderIndex=10;s.wallet.level=3;s.board[2]={uid:s.nextUid++,type:'504',cover:null};
 const uid=s.board[2].uid;assert.equal(deliverFixedOrder(s,config).ok,false);assert.equal(s.board[2].uid,uid);assert.equal(s.wallet.coins,0);
 s.selected=2;
 s.board[3]={uid:s.nextUid++,type:'504',cover:'web'};assert.equal(deliverFixedOrder(s,config).ok,false);
 s.board[3].cover=null;assert.equal(deliverFixedOrder(s,config).ok,true);assert.equal(s.wallet.coins,8);assert.equal(s.board[2],null);assert.equal(s.board[3],null);
 assert.equal(s.orderIndex,11);assert.equal(deliverFixedOrder(s,config).ok,false);assert.equal(s.wallet.coins,8);
 assert.equal(s.selected,null);assert.equal(validPlay(s,config),true);
});
test('quest start and timeline commit are separate; six default quests deduct161 gold and reach level3/EXP15 exactly once',()=>{
 const s=play();playAction(s,'home',null,config);s.wallet.coins=161;
 for(let n=0;n<6;n++){const before=s.wallet.coins;assert.equal(playAction(s,'quest-start',null,config).ok,true);assert.equal(s.wallet.coins,before);assert.equal(playAction(s,'quest-start',null,config).ok,false);assert.equal(playAction(s,'quest-finish',null,config).ok,true);assert.equal(s.wallet.coins,before-config.quests[n].cost);assert.equal(playAction(s,'quest-finish',null,config).ok,false);}
 assert.equal(s.wallet.coins,0);assert.equal(s.wallet.level,3);assert.equal(s.xp,15);assert.ok(s.queue.some(r=>r.type==='1301'));
 for(let i=0;i<3;i++)playAction(s,'aid-xp',null,config);
 assert.equal(s.wallet.level,4);assert.equal(s.xp,0);
 assert.equal(validPlay(s,config),true);
});
test('historical chain claims stop at the observed80-gem boundary without fabricating pack contents or resetting rewards',()=>{
 const s=play();s.wallet.energy=2;s.wallet.gems=719;s.wallet.coins=244;
 s.wallet.level=3;playAction(s,'shop',null,config);
 playAction(s,'chain-start',null,config);for(let i=0;i<6;i++)assert.equal(playAction(s,'chain-claim',null,config).ok,true);
 assert.equal(s.wallet.energy,237);assert.equal(s.wallet.gems,659);assert.equal(s.wallet.coins,244);assert.equal(s.chainRewards.length,2);assert.ok(s.chainRewards.every(r=>r.contents==='unknown'));
 const before=snapshot(s);assert.equal(playAction(s,'chain-claim',null,config).ok,false);assert.equal(playAction(s,'chain-start',null,config).ok,false);assert.deepEqual(snapshot(s),before);
});
test('saved deck/RNG and cooldowns resume deterministically, while invalid model fields are rejected',()=>{
 const s=play();s.selected=0;for(let i=0;i<5;i++)generateFrom(s,0,config);
 const encoded=encodeSave(s,{revision:config.revision,now:1000,validate:x=>validPlay(x,config)});assert.equal(encoded.ok,true);
 const decoded=decodeSave(encoded.raw,{revision:config.revision,now:121000,validate:x=>validPlay(x,config)});assert.equal(decoded.ok,true);assert.equal(decoded.elapsedSeconds,120);
 generateFrom(s,0,config);generateFrom(decoded.state,0,config);assert.deepEqual(s,decoded.state);
 for(const mutate of [x=>x.board.pop(),x=>x.board[1].uid=x.board[0].uid,x=>x.pools['106'][0]=999,x=>x.wallet.energy=-1,x=>x.wallet.freeTotal=9,x=>x.pendingQuest={id:'fake',cost:0},x=>x.log=[null],x=>{x.modal='offer';x.offer={chosen:'test',steps:[null]};},x=>{const g=x.generatorState[x.board[0].uid];g.charges=0;g.timerStart=null;g.readyAt=0;}]){const bad=structuredClone(s);mutate(bad);assert.equal(validPlay(bad,config),false);}
 const absent=play();absent.wallet.energy=0;absent.wallet.freeUsed=1;absent.wallet.price=20;
 assert.equal(playAction(absent,'close-energy',null,config).ok,false);assert.equal(absent.modal,null);
});
test('declared reward-wrapper merge results remain visible but never consume items into an unsupported saved type',()=>{
 const s=play(),unsupported=config.items.find(x=>x.next&&!itemFor(config,x.next));
 assert.ok(unsupported);s.board[2]={uid:s.nextUid++,type:unsupported.type,cover:null};s.board[3]={uid:s.nextUid++,type:unsupported.type,cover:null};
 const before=structuredClone(s.board);assert.equal(moveOrMerge(s,2,3,config).ok,false);assert.deepEqual(s.board,before);assert.equal(validPlay(s,config),true);
});

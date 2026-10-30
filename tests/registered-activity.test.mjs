import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {REGISTERED_ACTIVITY_KEY,validRegisteredActivityConfig,createRegisteredActivity,validRegisteredActivity,registeredActivityAction,encodeRegisteredActivity,decodeRegisteredActivity,renderRegisteredActivity,createRegisteredActivityController} from '../src/registered-activity.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/registered-activity.json',import.meta.url),'utf8'));
const act=(s,action,value)=>registeredActivityAction(s,action,value,c);
const fresh=()=>{const s=createRegisteredActivity(c);assert.equal(act(s,'start').ok,true);return s;};
const snapshot=()=>{const s=fresh();s.board=Array(70).fill(null);s.queue=[];s.researchInputUsed=true;return s;};
function cell(s,type,overrides={}){const row=[...c.items,...c.sharedItems].find(x=>x.type===type);return {uid:s.nextUid++,type,cover:[],used:0,remaining:structuredClone(row?.pool||[]),...overrides};}
const totalCache=s=>s.queue.reduce((n,q)=>n+(q.kind==='code'?q.count:1),0);

test('exact registered 7×10 source coordinates and 59 rehashed images are present',async()=>{
 assert.equal(validRegisteredActivityConfig(c),true);
 assert.equal(c.items.length,35);assert.equal(c.sourceBoard.length,13);
 const s=createRegisteredActivity(c);assert.equal(validRegisteredActivity(s,c),true);assert.equal(s.board.length,70);
 for(const p of c.initialSourceXY){const index=(p.y-1)*7+p.x-1,raw=c.sourceBoard[p.sourceRow-1][p.x-1],actual=s.board[index];assert.equal(p.sourceRow,3+p.y);if(raw==='0')assert.equal(actual,null);else assert.equal(actual.type,raw.split('#').at(-1));}
 assert.equal(s.board.filter(Boolean).length,67);
 assert.equal(s.board[51],null);assert.equal(s.board[58].type,'pb_dogpark_tar_1');assert.deepEqual(s.board[58].cover,['web']);
 for(const m of c.media){const content=await readFile(new URL('../src/'+m.src.slice(2),import.meta.url));assert.equal(createHash('sha256').update(content).digest('hex'),m.sha256);}
 const rendered=new JSDOM(renderRegisteredActivity(s,c));assert.equal(rendered.window.document.querySelectorAll('[data-ra-cell]').length,70);
});

test('startup grants exactly five once; full-board and invalid actions are transactional',()=>{
 const s=createRegisteredActivity(c),before=JSON.stringify(s);assert.equal(act(s,'pop').ok,false);assert.equal(JSON.stringify(s),before);
 assert.equal(act(s,'start').ok,true);assert.equal(totalCache(s),5);const started=JSON.stringify(s);
 assert.equal(act(s,'start').ok,false);assert.equal(JSON.stringify(s),started);
 for(let i=0;i<3;i++)assert.equal(act(s,'pop').ok,true);
 assert.equal(totalCache(s),2);const full=JSON.stringify(s);assert.equal(act(s,'pop').ok,false);assert.equal(JSON.stringify(s),full);
 assert.equal(act(s,'move',{from:-1,to:1}).ok,false);assert.equal(JSON.stringify(s),full);
});

test('actual initial play merges into cobweb, unlocks adjacent paper and allocates new identities',()=>{
 const s=fresh();act(s,'pop');const source=s.selected,sourceUid=s.board[source].uid,targetUid=s.board[58].uid,neighborUid=s.board[57].uid;
 const out=act(s,'move',{from:source,to:58});assert.equal(out.ok,true);assert.equal(out.kind,'merge');
 assert.equal(s.board[source],null);assert.equal(s.board[58].type,'pb_dogpark_tar_2');assert.deepEqual(s.board[58].cover,[]);
 assert.notEqual(s.board[58].uid,targetUid);assert.notEqual(s.board[58].uid,sourceUid);
 assert.deepEqual(s.board[57].cover,['web']);assert.notEqual(s.board[57].uid,neighborUid);
 assert.equal(s.activityLevel,null);assert.equal(s.merges,1);assert.equal(validRegisteredActivity(s,c),true);
});

test('tap selection, movement and mismatched exchange retain UIDs and pools',()=>{
 const s=snapshot();s.board[0]=cell(s,'pb_dogpark_tar_1');s.board[1]=cell(s,'pb_dogpark_book_1');
 const a=s.board[0].uid,b=s.board[1].uid;assert.equal(act(s,'cell',0).ok,true);assert.equal(act(s,'cell',2).kind,'move');assert.equal(s.board[2].uid,a);
 assert.equal(act(s,'move',{from:2,to:1}).kind,'swap');assert.equal(s.board[1].uid,a);assert.equal(s.board[2].uid,b);
 s.board[3]=cell(s,'pb_dogpark_tar_2',{cover:['web'],remaining:[]});const before=JSON.stringify(s);assert.equal(act(s,'move',{from:1,to:3}).ok,false);assert.equal(JSON.stringify(s),before);
});

test('feed is consumed, dog transforms, eight manual outputs trigger the next dog state',()=>{
 const s=snapshot();s.board[0]=cell(s,'pb_dogpark_baby_1');s.board[1]=cell(s,'pb_dogpark_feed_1');const dog=s.board[0].uid;
 assert.equal(act(s,'move',{from:1,to:0}).kind,'feed');assert.equal(s.board[1],null);assert.equal(s.board[0].type,'pb_dogpark_baby_a_f_1');assert.notEqual(s.board[0].uid,dog);
 for(let i=0;i<8;i++)assert.equal(act(s,'spawn').ok,true);
 assert.equal(s.board[0].type,'pb_dogpark_baby_a_1');assert.equal(s.generated,8);assert.equal(s.board.filter(Boolean).length,9);assert.equal(validRegisteredActivity(s,c),true);
});

test('auto pools decrement to zero and keep the source; partially used auto mergers cache exact remainders',()=>{
 const s=snapshot();s.board[0]=cell(s,'pb_dogpark_tar_6');const uid=s.board[0].uid;
 const out=act(s,'cell',0);assert.equal(out.autoGenerated,2);assert.equal(s.board[0].uid,uid);assert.equal(s.board[0].used,2);assert.equal(s.board[0].remaining[0].count,0);assert.equal(s.board.filter(x=>x?.type==='main_super_gold_1').length,2);
 const t=snapshot();for(let i=0;i<70;i++)t.board[i]=cell(t,'pb_dogpark_tar_1');t.board[0]=cell(t,'pb_dogpark_tar_6',{used:1,remaining:[{type:'main_super_gold_1',count:1}]});t.board[1]=cell(t,'pb_dogpark_tar_6');
 assert.equal(validRegisteredActivity(t,c),true);const merged=act(t,'move',{from:0,to:1});assert.equal(merged.ok,true);assert.equal(t.board[1].type,'pb_dogpark_tar_7');assert.equal(totalCache(t),3);assert.deepEqual(t.queue,[{kind:'code',code:'main_super_gold_1',count:3}]);assert.equal(merged.autoGenerated,1);
});

test('manual terminal producer disappears only after all seventeen configured outputs',()=>{
 const s=snapshot();s.board[0]=cell(s,'pb_dogpark_tar_12');s.selected=0;
 for(let i=0;i<16;i++){assert.equal(act(s,'spawn').ok,true);assert.equal(s.board[0].type,'pb_dogpark_tar_12');}
 assert.equal(act(s,'spawn').ok,true);assert.equal(s.board[0],null);assert.equal(s.selected,null);assert.equal(s.generated,17);assert.equal(validRegisteredActivity(s,c),true);
});

test('collect values are conserved in a separate ledger, unsupported tools and packs are never acknowledged',()=>{
 const s=snapshot();s.board[0]=cell(s,'main_super_gold_4');s.selected=0;assert.equal(act(s,'collect').ok,true);assert.equal(s.ledger.gold,6);assert.equal(s.board[0],null);
 const saved=JSON.stringify(s);assert.equal(act(s,'tool','scissors').ok,false);assert.equal(act(s,'open-pack','rb#pack_common_2').ok,false);assert.equal(JSON.stringify(s),saved);
 const tampered=structuredClone(s);tampered.ledger.gold++;assert.equal(validRegisteredActivity(tampered,c),false);
});

test('source level12 snapshot alone enables the exact 3-row source movement; merges do not invent levels',()=>{
 const s=fresh(),original=structuredClone(s.board);assert.equal(act(s,'scroll').ok,false);
 assert.equal(act(s,'level-snapshot',{level:12,ack:false}).ok,false);
 assert.equal(act(s,'level-snapshot',{level:11,ack:true}).ok,true);assert.equal(act(s,'scroll').ok,false);
 assert.equal(act(s,'level-snapshot',{level:12,ack:true}).ok,true);assert.equal(act(s,'scroll').ok,true);
 assert.equal(s.depth,14);assert.equal(s.scrolledRows,3);assert.equal(totalCache(s),23);
 for(let i=0;i<49;i++)assert.equal(s.board[i+21]?.uid,original[i]?.uid);
 for(let i=0;i<21;i++)assert.equal(s.board[i].type,c.sourceBoard[Math.floor(i/7)][i%7].split('#').at(-1));
 const after=JSON.stringify(s);assert.equal(act(s,'scroll').ok,false);assert.equal(JSON.stringify(s),after);
 assert.equal(validRegisteredActivity(s,c),true);
});

test('scrolled ordinary generator snapshots keep UID and a partially used finite pool across save/resume',()=>{
 const s=fresh();s.board[63]=cell(s,'pb_dogpark_baby_a_f_1',{used:2,remaining:[{type:'pb_dogpark_tar_2',count:3},{type:'pb_dogpark_letter_1',count:2},{type:'pb_dogpark_score_1',count:1}]});const original=structuredClone(s.board[63]);
 act(s,'level-snapshot',{level:12,ack:true});assert.equal(act(s,'scroll').ok,true);const preserved=s.queue.find(x=>x.kind==='cell'&&x.cell.uid===original.uid);assert.deepEqual(preserved?.cell,original);
 const restored=decodeRegisteredActivity(encodeRegisteredActivity(s,c),c);assert.deepEqual(restored,s);
 restored.board[0]=null;restored.queue=[preserved];assert.equal(act(restored,'pop').ok,true);assert.equal(restored.board[0].uid,original.uid);assert.deepEqual(restored.board[0].remaining,original.remaining);
 const broken=structuredClone(s);broken.board[1].uid=broken.board[0].uid;assert.equal(decodeRegisteredActivity(JSON.stringify({format:'harbor-registered-event-v1',state:broken}),c),null);
});

test('controller preserves invalid storage, requires explicit backed-up reset, and never touches other keys',()=>{
 const values=new Map([[REGISTERED_ACTIVITY_KEY,'{broken source'],['harbor-play-session','main unchanged'],['legacy-fixture','legacy unchanged']]);const writes=[];const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{writes.push(k);values.set(k,v);}};let downloaded=false;
 const controller=createRegisteredActivityController({getData:()=>({registeredActivityConfig:c}),render(){},storage,download(){downloaded=true;return true;}});
 let dom=new JSDOM(controller.renderPage());assert.match(dom.window.document.body.textContent,/자동 초기화하거나 덮어쓰지/);assert.equal(writes.length,0);
 controller.handleClick({target:dom.window.document.querySelector('[data-ra-action="reset"]')});assert.equal(values.get(REGISTERED_ACTIVITY_KEY),'{broken source');assert.equal(downloaded,false);
 dom.window.document.querySelector('[data-ra-reset-ack]').checked=true;controller.handleClick({target:dom.window.document.querySelector('[data-ra-action="reset"]')});assert.equal(downloaded,true);assert.equal(writes.every(k=>k===REGISTERED_ACTIVITY_KEY),true);assert.ok(decodeRegisteredActivity(values.get(REGISTERED_ACTIVITY_KEY),c));assert.equal(values.get('harbor-play-session'),'main unchanged');assert.equal(values.get('legacy-fixture'),'legacy unchanged');
 controller.cleanup();
});

test('controller click path, persistent reconnect, drag cleanup and failed backups preserve state',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};let dom,controller;
 const render=()=>{dom=new JSDOM(controller.renderPage());controller.afterMount(dom.window.document);};
 controller=createRegisteredActivityController({getData:()=>({registeredActivityConfig:c}),render,storage,download:()=>false});render();
 const click=action=>controller.handleClick({target:dom.window.document.querySelector(`[data-ra-action="${action}"]`)});
 click('start');click('pop');assert.equal(totalCache(controller.getState()),4);
 const from=controller.getState().selected,to=controller.getState().board.findIndex(x=>x===null),uid=controller.getState().board[from].uid;
 const begin=new dom.window.Event('dragstart',{bubbles:true,cancelable:true});Object.defineProperty(begin,'dataTransfer',{value:{setData(){}}});dom.window.document.querySelector(`[data-ra-cell="${from}"]`).dispatchEvent(begin);
 const over=new dom.window.Event('dragover',{bubbles:true,cancelable:true});dom.window.document.querySelector(`[data-ra-cell="${to}"]`).dispatchEvent(over);assert.equal(over.defaultPrevented,true);
 const drop=new dom.window.Event('drop',{bubbles:true,cancelable:true});dom.window.document.querySelector(`[data-ra-cell="${to}"]`).dispatchEvent(drop);assert.equal(controller.getState().board[to].uid,uid);assert.equal(controller.getState().board[from],null);
 const reconnect=createRegisteredActivityController({getData:()=>({registeredActivityConfig:c}),storage});reconnect.renderPage();assert.deepEqual(reconnect.getState(),controller.getState());
 const raw=values.get(REGISTERED_ACTIVITY_KEY);dom.window.document.querySelector('[data-ra-reset-ack]').checked=true;click('reset');assert.equal(values.get(REGISTERED_ACTIVITY_KEY),raw);
 controller.cleanup();reconnect.cleanup();
});

test('storage read/write failures keep a memory session and never delete the original key',()=>{
 const writes=[];const storage={getItem(){throw Error('read denied');},setItem(k){writes.push(k);throw Error('quota');},removeItem(){throw Error('must never delete');}};
 const controller=createRegisteredActivityController({getData:()=>({registeredActivityConfig:c}),storage});
 let dom=new JSDOM(controller.renderPage());assert.match(dom.window.document.body.textContent,/メモリ|메모리/);
 controller.handleClick({target:dom.window.document.querySelector('[data-ra-action="start"]')});assert.equal(controller.getState().initialGiven,true);assert.deepEqual(writes,[]);assert.match(controller.renderPage(),/기존 저장을 지우지 않았/);controller.cleanup();
});

test('read denial permanently disables writes even when setItem could overwrite an unread original',()=>{
 const original='unread original save';let saved=original,writes=0;const storage={getItem(){throw Error('read denied');},setItem(_key,value){writes++;saved=value;}};
 const controller=createRegisteredActivityController({getData:()=>({registeredActivityConfig:c}),storage});
 const doc=new JSDOM(controller.renderPage()).window.document;
 controller.handleClick({target:doc.querySelector('[data-ra-action="start"]')});
 assert.equal(controller.getState().started,true);assert.equal(writes,0);assert.equal(saved,original);
 assert.match(controller.renderPage(),/메모리|저장에 실패/);controller.cleanup();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createActivityPlay,activityAction,activityView,recordActivityProgress,validActivityPlay} from '../src/activity-play.mjs';
import {renderActivityPlay} from '../src/activity-page.mjs';
import {JSDOM} from 'jsdom';
import {createHash} from 'node:crypto';
const c=JSON.parse(await readFile(new URL('../src/data/activity-play.json',import.meta.url),'utf8'));
const begin=()=>{const a=createActivityPlay(c);assert.equal(validActivityPlay(a,c),true);assert.equal(activityAction(a,'start',undefined,c).ok,true);return a;};
const act=(a,kind,value,ctx)=>activityAction(a,kind,value,c,ctx);
const pop=a=>{const before=new Set(a.event.board.filter(Boolean).map(x=>x.uid));assert.equal(act(a,'event-pop').ok,true);return a.event.board.findIndex(x=>x&&!before.has(x.uid));};
test('research activities stay idle until explicitly started and duplicate main-play records cannot award progress twice',()=>{
 const a=createActivityPlay(c),original=structuredClone(a);assert.equal(recordActivityProgress(a,{kind:'customer',count:2,sequence:1},c).ok,false);assert.deepEqual(a,original);
 act(a,'start');assert.equal(recordActivityProgress(a,{kind:'customer',count:2,sequence:1},c).ok,true);assert.equal(a.pass.tokens,1);
 const after=structuredClone(a);assert.equal(recordActivityProgress(a,{kind:'customer',count:2,sequence:1},c).ok,false);assert.deepEqual(a,after);
 assert.equal(recordActivityProgress(a,{kind:'customer',count:1,sequence:2},c).ok,true);assert.equal(a.album.packs,1);assert.equal(a.pass.taskProgress,1);assert.equal(validActivityPlay(a,c),true);
});
test('pass requirements subtract per tier and free/premium rewards are claimed once into a separate research ledger',()=>{
 const a=begin();recordActivityProgress(a,{kind:'customer',count:32,sequence:1},c);assert.equal(activityView(a,c).level,3);assert.equal(activityView(a,c).remaining,0);
 assert.equal(act(a,'claim-pass',{tier:3,track:'premium'}).ok,false);
 for(let tier=1;tier<=3;tier++)assert.equal(act(a,'claim-pass',{tier,track:'free'}).ok,true);
 const before=structuredClone(a);assert.equal(act(a,'claim-pass',{tier:1,track:'free'}).ok,false);assert.deepEqual(a,before);
 assert.deepEqual(a.ledger,{energy:15,gold:10,gem:0});assert.equal(act(a,'premium',true).ok,true);
 for(let tier=1;tier<=3;tier++)assert.equal(act(a,'claim-pass',{tier,track:'premium'}).ok,true);
 assert.deepEqual(a.ledger,{energy:25,gold:10,gem:3});assert.equal(validActivityPlay(a,c),true);
});
test('activity expiry blocks new play while pass rewards remain available only through the research claim window',()=>{
 const a=begin();recordActivityProgress(a,{kind:'customer',count:6,sequence:1},c);
 assert.equal(activityView(a,c,{now:600}).phase,'Ended');assert.equal(act(a,'claim-pass',{tier:1,track:'free'},{now:600}).ok,true);
 const before=structuredClone(a);assert.equal(act(a,'open-pack',['research-card-1'],{now:601}).ok,false);assert.deepEqual(a,before);
 assert.equal(activityView(a,c,{now:900}).phase,'Released');assert.equal(act(a,'claim-pass',{tier:1,track:'premium'},{now:900}).ok,false);
});
test('explicit card results consume packs, distinguish duplicates, and award completed sets and album exactly once',()=>{
 const a=begin();recordActivityProgress(a,{kind:'customer',count:30,sequence:1},c);
 for(const id of ['research-card-1','research-card-1','research-card-2','research-card-3'])assert.equal(act(a,'open-pack',[id]).ok,true);
 assert.equal(a.album.packs,6);assert.equal(activityView(a,c).uniqueCards,3);assert.equal(activityView(a,c).duplicates,1);assert.equal(a.album.albumClaimed,true);assert.deepEqual(a.ledger,{energy:20,gold:20,gem:0});
 assert.equal(act(a,'open-pack',['research-card-3']).ok,true);assert.equal(a.album.lastOpened[0].isNew,false);assert.deepEqual(a.ledger,{energy:20,gold:20,gem:0});
 const before=structuredClone(a);assert.equal(act(a,'open-pack',['invented-card']).ok,false);assert.deepEqual(a,before);assert.equal(validActivityPlay(a,c),true);
});
test('packaged event board preserves box/web wrappers and the declared research starters unlock through real merge targets',()=>{
 const a=begin();assert.equal(a.event.board.length,72);const one=pop(a),two=pop(a);assert.equal(a.event.board[one].type,'adv_dogparkpure_tar_1');
 assert.equal(act(a,'event-move',{from:one,to:two}).ok,true);assert.equal(a.event.merges,1);assert.equal(a.event.board[two].type,'adv_dogparkpure_tar_2');
 const target=a.event.board.findIndex(x=>x?.cover==='web'&&x.type==='adv_dogparkpure_tar_2');assert.ok(target>=0);assert.equal(act(a,'event-move',{from:two,to:target}).ok,true);assert.equal(a.event.merges,2);assert.equal(a.event.board[target].cover,null);
 assert.equal(validActivityPlay(a,c),true);
});
test('event feed transforms and finite generators use packaged pools; failed full-board generation preserves RNG and deck',()=>{
 const a=begin();act(a,'event-research-item','adv_dogparkpure_baby_1');act(a,'event-research-item','adv_dogparkpure_feed_1');
 pop(a);pop(a);const baby=pop(a),feed=pop(a);assert.equal(act(a,'event-move',{from:feed,to:baby}).ok,true);assert.equal(a.event.board[baby].type,'adv_dogparkpure_baby_a_f_1');
 assert.equal(act(a,'event-spawn').ok,true);assert.equal(a.event.generated,1);assert.equal(a.event.board[baby].used,1);
 while(a.event.board.includes(null)){act(a,'event-research-item','adv_dogparkpure_feed_1');pop(a);}
 const before=structuredClone(a);assert.equal(act(a,'event-spawn').ok,false);assert.deepEqual(a,before);assert.equal(validActivityPlay(a,c),true);
});
test('research event completion and reset never alter an external main wallet or re-award the same objective',()=>{
 const a=begin(),wallet={coins:45,gems:200,energy:60};a.event.merges=c.scenario.event.goalMerges;
 assert.equal(act(a,'event-claim').ok,true);assert.deepEqual(a.ledger,{energy:0,gold:10,gem:0});assert.equal(a.album.packs,1);
 const before=structuredClone(a);assert.equal(act(a,'event-claim').ok,false);assert.deepEqual(a,before);assert.deepEqual(wallet,{coins:45,gems:200,energy:60});
 act(a,'reset');assert.equal(a.startedAt,null);assert.equal(a.pass.tokens,0);assert.deepEqual(a.ledger,{energy:0,gold:0,gem:0});assert.equal(validActivityPlay(a,c),true);
});
test('the declared starter queue can finish the six-merge representative objective without adding extra research items',()=>{
 const a=begin();pop(a);pop(a);
 for(const [from,to]of [[67,66],[66,60],[60,23],[23,8],[68,62],[62,56]])assert.equal(act(a,'event-move',{from,to}).ok,true);
 assert.equal(a.event.merges,6);assert.equal(a.researchInputUsed,false);assert.equal(act(a,'event-claim').ok,true);assert.equal(a.album.packs,1);assert.equal(a.ledger.gold,10);assert.equal(validActivityPlay(a,c),true);
});
test('invalid saved counters, types, item decks and research amounts cannot corrupt activity progress',()=>{
 const a=begin();const before=structuredClone(a);for(const n of [-2,0,Infinity,'nope',1e8]){assert.equal(act(a,'research-progress',n).ok,false);assert.deepEqual(a,before);}
 const bad=structuredClone(a);bad.event.board[0].uid=bad.event.nextUid;assert.equal(validActivityPlay(bad,c),false);
 const badDeck=structuredClone(a),gen=badDeck.event.board.find(x=>x?.remaining);gen.remaining[0].count++;assert.equal(validActivityPlay(badDeck,c),false);
 const forged=structuredClone(a);forged.ledger.gem=100;assert.equal(validActivityPlay(forged,c),false);
});
test('activity surfaces expose honest scenario labels and all controls without presenting unknown card drops as random',()=>{
 const a=begin();let dom=new JSDOM(renderActivityPlay(a,c));let d=dom.window.document;
 assert.equal(d.querySelectorAll('.activity-pass-rows li').length,3);assert.match(d.body.textContent,/研究|연구 예제/);assert.equal(d.querySelectorAll('[data-activity="claim-pass"]').length,6);dom.window.close();
 a.tab='album';dom=new JSDOM(renderActivityPlay(a,c));d=dom.window.document;assert.equal(d.querySelectorAll('.activity-card').length,3);assert.match(d.body.textContent,/결과를 직접 선택/);dom.window.close();
 a.tab='event';dom=new JSDOM(renderActivityPlay(a,c));d=dom.window.document;assert.equal(d.querySelectorAll('.activity-cell').length,72);assert.equal(d.querySelectorAll('[data-activity-type] option').length,59);assert.match(d.body.textContent,/시작 조각2개는 웹 실험 입력/);dom.window.close();
});
test('packaged shared currency chains merge then collect once using their actual declared value, freeing a board slot',()=>{
 const a=begin();act(a,'event-research-item','main_super_energy_1');act(a,'event-research-item','main_super_energy_1');
 pop(a);pop(a);const left=pop(a),right=pop(a);assert.equal(act(a,'event-move',{from:left,to:right}).ok,true);assert.equal(a.event.board[right].type,'main_super_energy_2');
 const dom=new JSDOM(renderActivityPlay({...a,tab:'event'},c));assert.ok(dom.window.document.querySelector('[data-activity="event-collect"]'));dom.window.close();
 assert.equal(act(a,'event-collect').ok,true);assert.equal(a.event.board[right],null);assert.equal(a.ledger.energy,2);assert.equal(a.event.collected.main_super_energy_2,1);
 const before=structuredClone(a);assert.equal(act(a,'event-collect').ok,false);assert.deepEqual(a,before);assert.equal(validActivityPlay(a,c),true);
});
test('activity projection retains source identities and a reproducible revision without pretending the research season is server config',()=>{
 const projection=structuredClone(c);delete projection.revision;assert.equal(createHash('sha256').update(JSON.stringify(projection)).digest('hex'),c.revision);
 assert.equal(c.event.items.length,35);assert.equal(c.event.sharedItems.length,24);assert.equal(c.event.board.length,72);
 for(const s of c.sources){assert.match(s.path,/^analysis\//);assert.match(s.sha256,/^[a-f0-9]{64}$/);}
 assert.match(c.scenario.label,/연구/);assert.ok(c.unknown.length>0);assert.equal(JSON.stringify(c).includes('C:\\'),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createPlay,playAction,advancePlay,validPlay,currentBubbleQuote} from '../src/play-model.mjs';
import {getSpeedUpCost,getChoices} from '../src/spread-model.mjs';
import {renderGamePlay} from '../src/game-page.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
const play=()=>{const s=createPlay(c);playAction(s,'start',undefined,c);return s;};
function place(s,type){assert.equal(playAction(s,'aid-type',type,c).ok,true);const before=s.nextUid;assert.equal(playAction(s,'queue',undefined,c).ok,true);return s.board.findIndex(x=>x?.uid===before);}

test('closed chest UI can open, wait a partial timer, quote current price and finish naturally without an extra reward',()=>{
 const s=play(),index=place(s,'3501');s.selected=index;
 let dom=new JSDOM(renderGamePlay(s,c,{}));assert.ok(dom.window.document.querySelector('[data-play="open-item"]'));dom.window.close();
 const money=s.wallet.gems,energy=s.wallet.energy;assert.equal(playAction(s,'open-item',undefined,c).ok,true);
 const state=s.generatorState[s.board[index].uid],duration=state.readyAt-s.wallet.time,first=getSpeedUpCost(s,index,c).cost;
 assert.equal(s.wallet.gems,money);assert.equal(s.wallet.energy,energy);
 advancePlay(s,Math.floor(duration/2),c);assert.ok(getSpeedUpCost(s,index,c).cost<=first);
 dom=new JSDOM(renderGamePlay(s,c,{}));assert.ok(dom.window.document.querySelector('[data-live-speedup-cost]'));dom.window.close();
 advancePlay(s,duration-Math.floor(duration/2),c);assert.equal(state.phase,'opened');assert.equal(s.wallet.gems,money);assert.equal(validPlay(s,c),true);
});

test('static choice chest replaces itself once and native choice modal prevents a second claim',()=>{
 const s=play(),type=Object.entries(c.spreadRules.choices).find(([,r])=>Array.isArray(r.options)&&r.options.length)?.[0]||Object.keys(c.spreadRules.choices)[0];
 const index=place(s,type);s.selected=index;const options=getChoices(s,index,c,{orders:s.orders.slots});assert.equal(options.ok,true);
 assert.equal(playAction(s,'open-choice',undefined,c).ok,true);assert.equal(s.modal,'choice');
 const uid=s.board[index].uid;assert.equal(playAction(s,'choose-item',0,c).ok,true);assert.equal(s.modal,null);assert.notEqual(s.board[index].uid,uid);assert.equal(s.board[index].type,options.choices[0]);
 const before=structuredClone(s.board);assert.equal(playAction(s,'choose-item',0,c).ok,false);assert.deepEqual(s.board,before);assert.equal(validPlay(s,c),true);
});

test('shop free row commits through the shared queue and forged stock cannot survive save validation',()=>{
 const s=play();s.wallet.level=3;assert.equal(playAction(s,'shop',undefined,c).ok,true);
 const row=s.commerce.daily.rows.find(r=>r.cost===0&&r.left>0);assert.ok(row);
 const wallet=structuredClone(s.wallet);assert.equal(playAction(s,'commerce-buy',row.id,c).ok,true);
 assert.deepEqual(s.wallet,wallet);assert.equal(s.queue[0].type,row.type);assert.equal(validPlay(s,c),true);
 const forged=structuredClone(s);forged.commerce.daily.rows[0].cost=-1;assert.equal(validPlay(forged,c),false);
});

test('initial guidance rejects research aid, shows the next merge and keeps unrelated board clicks atomic',()=>{
 const s=createPlay(c,{scenario:'initial',guide:true});playAction(s,'start',undefined,c);const before=structuredClone(s.board),wallet=structuredClone(s.wallet);
 assert.equal(playAction(s,'aid-coins',undefined,c).ok,false);assert.equal(playAction(s,'cell',0,c).ok,false);
 assert.deepEqual(s.board,before);assert.deepEqual(s.wallet,wallet);
 const dom=new JSDOM(renderGamePlay(s,c,{}));assert.equal(dom.window.document.querySelector('.game-guide').dataset.guideId,'tutorial_3');assert.equal(dom.window.document.querySelectorAll('.guide-from,.guide-to').length,2);dom.window.close();
 assert.equal(validPlay(s,c),true);
});

function mergeFixture(type,{oldSave=false}={}){
 const s=play();s.board.fill(null);s.generatorState={};s.selected=null;s.wallet.level=4;s.rng=1;
 const predecessor=c.items.find(r=>r.next===type);assert.ok(predecessor,type+' must have a merge predecessor');
 s.board[30]={uid:s.nextUid++,type:predecessor.type,cover:null};s.board[31]={uid:s.nextUid++,type:predecessor.type,cover:null};
 if(oldSave)delete s.bubbles;
 assert.equal(playAction(s,'move','30,31',c).ok,true);return s;
}

test('every merge-reachable positive bubble type survives reconciliation without creating an inner generator component',()=>{
 const rows=c.bubbleRules.items.filter(r=>r.chancePercent>0&&c.items.some(i=>i.next===r.type));assert.ok(rows.length>100);
 for(const row of rows){
  const s=mergeFixture(row.type),entry=Object.entries(s.bubbles).find(([,b])=>b.innerType===row.type);
  assert.ok(entry,row.type+' should spawn at source integer roll1');assert.equal(s.generatorState[entry[0]],undefined,row.type);
  assert.equal(validPlay(s,c),true,row.type+' must be saveable');
 }
});

test('natural generator bubble survives an old schema1 save and selected-bubble expiry lock, then unwraps once',()=>{
 const s=mergeFixture('805',{oldSave:true}),[uid,b]=Object.entries(s.bubbles)[0],index=s.board.findIndex(cell=>cell?.uid===Number(uid));
 assert.equal(b.innerType,'805');s.selected=index;advancePlay(s,61,c);
 assert.equal(s.board[index].uid,Number(uid));assert.equal(s.generatorState[uid],undefined);assert.equal(validPlay(s,c),true);
 const before=s.wallet.gems,cost=currentBubbleQuote(s,c,b).price;assert.equal(playAction(s,'buy-bubble',undefined,c).ok,true);
 assert.equal(s.wallet.gems,before-cost);assert.equal(s.board[index].type,'805');assert.ok(s.generatorState[s.board[index].uid]);assert.equal(validPlay(s,c),true);
 const expired=mergeFixture('805'),i=expired.board.findIndex(cell=>cell&&expired.bubbles[cell.uid]);expired.selected=i;advancePlay(expired,61,c);expired.selected=null;advancePlay(expired,0,c);assert.equal(expired.board[i].type,'2401');assert.equal(validPlay(expired,c),true);
});

test('MainBoard saves reject tutorial-board timer injection even when the pure spread library supports a tutorial view',()=>{
 const s=play();s.generatorState[s.board[0].uid].forcedTimerDuration=999;assert.equal(validPlay(s,c),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createPlay,playAction,validPlay} from '../src/play-model.mjs';
import {renderGamePlay} from '../src/game-page.mjs';
const config=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
test('the authored eight tutorial inputs work on the real initial wrappers and yield a deliverable first order',()=>{
 const s=createPlay(config,{scenario:'initial'});s.stage='play';s.tutorialStep=0;
 for(const step of config.tutorialSteps){
  const before=s.tutorialStep;
  if(step.kind==='generate'){s.selected=step.index;assert.equal(playAction(s,'generate',null,config).ok,true);}
  else assert.equal(playAction(s,'move',`${step.from},${step.to}`,config).ok,true);
  assert.equal(s.tutorialStep,before+1);assert.equal(validPlay(s,config),true);
 }
 assert.equal(s.wallet.energy,97);assert.equal(s.board[23].type,'203');
 assert.equal(playAction(s,'deliver',null,config).ok,true);assert.equal(s.wallet.coins,2);assert.equal(s.wallet.orders,1);
});
test('fifteen packaged quests commit477 base gold and225XP once, reaching level5 and15XP',()=>{
 const s=createPlay(config);s.stage='home';s.wallet.coins=477;
 for(let i=0;i<15;i++){assert.equal(playAction(s,'quest-start',null,config).ok,true);assert.equal(playAction(s,'quest-finish',null,config).ok,true);if(i===8)assert.equal(s.wallet.level,4);}
 assert.equal(s.wallet.coins,0);assert.equal(s.wallet.level,5);assert.equal(s.xp,15);assert.equal(s.questsDone,15);
 assert.equal(playAction(s,'quest-start',null,config).ok,false);assert.equal(validPlay(s,config),true);
});
test('game presentation keeps research claims outside63 actionable square cells and displays source-localized item information',()=>{
 const s=createPlay(config,{scenario:'initial'});s.stage='play';s.tutorialStep=0;s.selected=22;
 const dom=new JSDOM(renderGamePlay(s,config,{media:{entries:[]}}));
 const doc=dom.window.document;assert.equal(doc.querySelectorAll('.game-cell').length,63);assert.equal(doc.querySelectorAll('.guide-from').length,1);assert.equal(doc.querySelectorAll('.guide-to').length,1);
 assert.ok(doc.querySelector('.game-selection').textContent.includes(config.items.find(r=>r.type==='101').displayName));
 assert.ok(doc.querySelector('.game-research-tools').textContent.includes('랜덤 주문'));assert.equal(doc.querySelector('.game-phone details'),null);dom.window.close();
});

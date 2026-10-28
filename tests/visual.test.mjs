import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {filterVisualItems,filterVisualUI,validMedia} from '../src/visual-model.mjs';
import {createWalkthrough,walkthroughAction,STAGES,RENOVATIONS} from '../src/walkthrough.mjs';
import {renderNavigation,RESEARCH_ROUTES} from '../src/navigation.mjs';
import {JSDOM} from 'jsdom';
import {mergeResearch} from '../src/domain-model.mjs';
import {PUZZLE_DEMOS,UI_DEMOS,UI_REGIONS} from '../src/visual-model.mjs';

const index=JSON.parse(await readFile(new URL('../src/data/visual-index.json',import.meta.url)));
test('visual index covers every curated item declaration and UI mapping, with separate variant identities',()=>{
 assert.equal(index.items.length,4270);assert.equal(index.tables.length,39);assert.equal(index.ui.length,1644);
 assert.equal(new Set(index.items.map(x=>x.key)).size,index.items.length);
 assert.equal(index.tables.reduce((n,t)=>n+t.count,0),4270);
 assert.ok(index.tables.every(t=>/^[a-f0-9]{64}$/.test(t.sha256)));
 assert.equal(filterVisualItems(index).total,552);
 const first=filterVisualItems(index,{table:'all',query:'106',size:5000});assert.ok(first.rows.length>1);
 assert.ok(first.rows.every(x=>x.type.includes('106')||x.next.includes('106')||x.table.includes('106')));
 assert.equal(filterVisualItems(index,{table:'all',query:'zz-no-results'}).total,0);
 assert.equal(filterVisualItems(index,{page:999}).page,23);
 assert.ok(filterVisualUI(index,{query:'Energy'}).rows.every(x=>/energy/i.test(x.name+' '+x.path)));
});
test('all legacy documents are reachable under the research tree',()=>{
 const dom=new JSDOM(renderNavigation());const research=dom.window.document.querySelector('[data-nav-group="research"]');
 for(const route of RESEARCH_ROUTES)assert.ok(research.querySelector(`[data-route="${route}"]`),route);
 assert.equal(dom.window.document.querySelectorAll('[data-nav-group]').length,3);dom.window.close();
});
test('each motion sample and UI region links to an existing research finding',async()=>{
 const base=JSON.parse(await readFile(new URL('../src/data/research.json',import.meta.url)));
 const extension=JSON.parse(await readFile(new URL('../src/data/domains.json',import.meta.url)));
 const data=mergeResearch(base,extension);
 for(const sample of [...PUZZLE_DEMOS,...UI_DEMOS,...UI_REGIONS])assert.ok(data.facts.some(f=>f.id===sample.source),sample.source);
});
test('only documented local media paths are accepted; captures need an accessible name and provenance',()=>{
 const good={kind:'gif',src:'./assets/media/merge.gif',alt:'합성 캡처',source:'사용자 제공 영상'};
 assert.equal(validMedia(good),true);
 for(const src of ['C:/private/image.png','https://example.com/image.gif','./assets/media/../secret.png','./assets/media/script.svg'])assert.equal(validMedia({...good,src}),false);
 assert.equal(validMedia({...good,alt:''}),false);assert.equal(validMedia({...good,source:''}),false);
});
test('walkthrough gates stages, keeps a 63-cell board, and links earned order gold to all three renovations',()=>{
 const s=createWalkthrough(),act=(a,v)=>walkthroughAction(s,a,v);
 assert.equal(act('play').ok,false);assert.equal(s.stage,'loading');
 act('load');act('load');act('load');assert.equal(s.stage,'title');act('start');
 assert.equal(act('finish-tutorial').ok,false);act('tutorial-generate');assert.equal(s.game.energy,98);
 assert.equal(act('tutorial-cell',1).ok,false);act('tutorial-cell',0);act('tutorial-cell',1);assert.equal(s.game.board[1].level,2);
 act('finish-tutorial');act('home');assert.equal(act('renovate').ok,false);act('play');
 let guard=0;
 while(s.game.coins<200&&guard++<400){
  act('generate');
  let merged=true;
  while(merged){merged=false;for(let i=0;i<s.game.board.length&&!merged;i++){const a=s.game.board[i];if(!a)continue;const j=s.game.board.findIndex((b,k)=>k>i&&b&&b.family===a.family&&b.level===a.level);if(j>=0){act('cell',i);act('cell',j);merged=true;}}}
  while(s.game.board.some(x=>x&&x.level>=4))act('deliver');
 }
 assert.ok(guard<400);assert.equal(s.game.board.length,63);assert.equal(s.game.coins,200);assert.equal(s.game.orders,5);
 act('home');for(const renovation of RENOVATIONS){assert.ok(s.game.coins>=renovation.cost);assert.equal(act('renovate').ok,true);}
 assert.equal(s.homeLevel,3);assert.equal(s.game.coins,20);assert.equal(act('renovate').ok,false);
 assert.deepEqual(s.visited.slice(0,4),STAGES.slice(0,4));assert.deepEqual(new Set(s.visited),new Set(STAGES));act('style','sand');assert.equal(s.style,'sand');
});

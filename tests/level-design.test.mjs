import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {LEVEL_DESIGN_DEFAULTS,levelDesignState,difficultyFilter,requirementAmounts,inspectDifficulty,levelCurve,levelDesignCSV} from '../src/level-design-model.mjs';
import {renderLevelDesign,createLevelDesign} from '../src/level-design.mjs';
const load=async n=>JSON.parse(await readFile(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const [d,play]=await Promise.all(['level-design-study','play-config'].map(load));
test('all level, day, area and generator populations reconcile with existing exact play data and maximum-level semantics',()=>{
 assert.equal(d.originalRuntimeObserved,false);assert.equal(d.levels.length,300);assert.equal(d.days.length,292);assert.equal(d.areas.length,48);assert.equal(d.boards.length,66);assert.equal(d.generators.length,163);
 let reach=0;for(const [i,row]of d.levels.entries()){assert.equal(row.level,i+1);assert.equal(row.reachXP,reach);assert.equal(row.cost,play.levels[i].exp);assert.equal(row.declaredLevel,play.levels[i].declaredLevel);assert.equal(row.consumed,i<299);if(row.consumed)reach+=row.cost;}
 assert.equal(reach,75660);assert.equal(d.levels[84].declaredLevel,75);assert.equal(d.levels[84].level,85);assert.equal(d.levels.at(-1).reachXP,75660);
 assert.equal(d.days.reduce((n,r)=>n+r.count,0),4277);assert.equal(d.days.reduce((n,r)=>n+r.cost,0),1587762);assert.equal(d.days.reduce((n,r)=>n+r.xp,0),64155);
 for(const r of d.days){const rows=play.quests.filter(x=>x.day===r.day);assert.equal(rows.length,r.count);assert.equal(rows.reduce((n,x)=>n+x.cost,0),r.cost);assert.equal(rows.reduce((n,x)=>n+x.exp,0),r.xp);}
 assert.equal(d.areas.reduce((n,r)=>n+r.count,0),4277);assert.equal(d.generators.filter(r=>r.costEnergy).length,51);assert.ok(d.generators.every(r=>!r.selection.includes('pending')));
});
test('all fifteen order policies preserve complete inclusive filters and the daily thresholds remain distinct from chain depth',()=>{
 assert.equal(d.orderPolicies.length,15);assert.equal(d.orderPolicies.reduce((n,p)=>n+p.rows.length,0),126);assert.equal(d.orderPolicies.flatMap(p=>p.rows).reduce((n,r)=>n+r.Filters.length,0),356);
 const config=d.orderVariants[0].rows.find(r=>r.Type===3);
 assert.equal(difficultyFilter(config,{level:36,diff:2000}).filter.FirstMin,8);assert.equal(difficultyFilter(config,{level:36,diff:2001}).filter.FirstMin,9);
 assert.equal(difficultyFilter(config,{level:61,diff:2500}).filter.FirstMin,9);assert.equal(difficultyFilter(config,{level:61,diff:2501}).filter.FirstMin,10);
 assert.equal(d.orderItems.filter(i=>i.DifficultyLevel!=null).length,18);
 for(const p of d.orderPolicies)for(const r of p.rows)for(let level=1;level<=300;level++)for(const diff of [0,2000,2001,2500,2501]){
  const matches=r.Filters.filter(f=>(f.PlayerMin==null||f.PlayerMin<=level)&&(f.PlayerMax==null||f.PlayerMax>=level)&&(f.DiffSumMin==null||f.DiffSumMin<=diff)&&(f.DiffSumMax==null||f.DiffSumMax>=diff));assert.equal(matches.length,1,p.name+' '+r.Type);assert.equal(difficultyFilter(r,{level,diff}).filter,matches[0]);
 }
 assert.equal(d.orderPolicies.flatMap(p=>p.rows.flatMap(r=>r.Filters)).filter(f=>f.sMonthPay!=null||f.eMonthPay!=null).length,0);
 const amounts=requirementAmounts(d,d.orderVariants[0].rows.find(r=>r.Type===12),14);assert.match(amounts.origin,/fallback/);assert.deepEqual(['OneItemWeight','TwoItemsWeight','ThreeItemsWeight'].map(k=>amounts.weights[k]),[30,30,40]);
 for(const type of [1,2,3,4,9])assert.equal(requirementAmounts(d,d.orderVariants[0].rows.find(r=>r.Type===type),14).weights.ThreeItemsWeight,0);
});
test('state clamps invalid controls and curve excludes the unused maximum-level cost without losing raw values',()=>{
 const s=levelDesignState({level:999,day:-1,diff:'bad',variant:'x',type:99,metric:'evil',curve:'x'},d);assert.equal(s.level,300);assert.equal(s.day,1);assert.equal(s.type,1);assert.equal(s.metric,'cost');assert.equal(s.diff,2000);
 const c=levelCurve(d,{...LEVEL_DESIGN_DEFAULTS,level:300});assert.equal(c.rows.length,300);assert.equal(c.rows.at(-1).y,null);
 assert.equal(levelCurve(d,{...LEVEL_DESIGN_DEFAULTS,metric:'reachXP'}).rows.at(-1).y,75660);
 assert.equal(levelCurve(d,{...LEVEL_DESIGN_DEFAULTS,curve:'day',day:209}).rows.find(r=>r.x===209).y,8370);
 assert.equal(inspectDifficulty(d,{level:1,type:3}).unlocked,false);
});
test('all-policy CSV retains second/third lower bounds, dynamic caps and item-count origin; level/day exports stay complete',()=>{
 const csv=levelDesignCSV(d,'orders');assert.equal(csv.split('\r\n').length,357);for(const field of ['SecondMin','ThirdMin','DynamicSecondMax','DynamicThirdMax','sMonthPay','Point','개수출처'])assert.ok(csv.includes('"'+field+'"'));
 assert.ok(csv.includes('OrderRandomRecallConfig'));assert.ok(csv.includes('ChestOrderRandomConfig'));assert.equal(levelDesignCSV(d,'levels').split('\r\n').length,301);assert.equal(levelDesignCSV(d,'days').split('\r\n').length,293);
});
test('study UI exposes every inventory, source type and actual unverified boundary without publishing raw code or sensitive paths',()=>{
 const html=renderLevelDesign({levelDesign:d}),dom=new JSDOM(html),doc=dom.window.document;
 assert.equal(doc.querySelectorAll('h1').length,1);assert.equal(doc.querySelectorAll('[data-ld="level"]').length,2);for(const text of ['전체300레벨','전체292 스토리','전체48구역','기본74행','특수 주문6개','보드 설정66종'])assert.ok(Array.from(doc.querySelectorAll('caption')).some(c=>c.textContent.includes(text)),text);assert.ok(doc.querySelector('svg[aria-label]'));assert.match(doc.body.textContent,/75,660|75660/);assert.match(doc.body.textContent,/원작|미완료/);
 const last=new JSDOM(renderLevelDesign({levelDesign:d},{level:300}));assert.match(last.window.document.querySelector('.ld-selected').textContent,/최대 레벨/);assert.match(renderLevelDesign({levelDesign:d},{level:14,type:12}),/공통 개수표 fallback/);dom.window.close();last.window.close();
 assert.doesNotMatch(JSON.stringify(d),/[CD]:[\\/]|Bearer |function\s+[A-Za-z_]+\(/);assert.ok(d.sources.length>100);for(const s of d.sources){assert.match(s.path,/^(analysis\/|sites\/harbor-bm-lab\/src\/)/);assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.ok(s.lineEnd>=s.lineStart);}
});
test('controller updates both curve and order inspection, rejects invalid values, exports and removes handlers on leave',()=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.test/#level-design'}),saved={document:globalThis.document};globalThis.document=dom.window.document;
 try{const root=document.querySelector('main'),downloads=[];let c;const render=()=>{c.beforeLeave();root.innerHTML=c.renderPage();c.afterMount(root);};c=createLevelDesign({getData:()=>({levelDesign:d}),render,download:(...args)=>downloads.push(args)});render();
  const change=(key,value,index=0)=>{const el=root.querySelectorAll('[data-ld="'+key+'"]').item(index);el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  change('level','61',1);change('diff','2501');assert.match(root.querySelector('.ld-band').textContent,/10 – 10/);change('curve','day');change('day','209');assert.match(root.querySelector('.ld-selected').textContent,/8,370/);
  change('day','9999');assert.match(root.querySelector('.ld-selected').textContent,/day292/);root.querySelector('[data-ld-csv="orders"]').click();assert.equal(downloads[0][1].split('\r\n').length,357);root.querySelector('[data-ld-json]').click();assert.equal(downloads.length,2);
  c.beforeLeave();root.querySelector('[data-ld-json]').click();assert.equal(downloads.length,2);
 }finally{Object.assign(globalThis,saved);dom.window.close();}
});

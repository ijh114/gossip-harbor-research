import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createProductionPlan,restoreProductionPlan,updateProductionRow,productionTotals,exportProductionCSV,exportProductionMarkdown,exportProductionJSON} from '../src/production-plan.mjs';
import {renderProductionAssets} from '../src/production-page-assets.mjs';
const data=JSON.parse(await readFile(new URL('../src/data/production-assets.json',import.meta.url),'utf8'));
const media=JSON.parse(await readFile(new URL('../src/data/media.json',import.meta.url),'utf8'));
test('launch request contains only core plus launch, and quantities keep separate production units',()=>{
 const p=createProductionPlan(data),t=productionTotals(data,p);assert.equal(p.preset,'launch');assert.equal(t.selected,40);assert.equal(t.units['일러스트'],24);assert.equal(t.units['곡'],2);assert.equal(t.units['아이콘'],125);assert.equal(t.missingDependencies.length,0);
 assert.equal(productionTotals(data,createProductionPlan(data,'core')).selected,27);assert.equal(productionTotals(data,createProductionPlan(data,'expansion')).selected,43);
 assert.equal(updateProductionRow(p,'art-direction','included',false),true);assert.ok(productionTotals(data,p).missingDependencies.includes('아트 방향·크기 기준판'));
 assert.equal(updateProductionRow(p,'item-chains','quantity',-1),false);assert.equal(updateProductionRow(p,'item-chains','quantity',1.5),false);assert.equal(updateProductionRow(p,'item-chains','quantity',10001),false);assert.equal(updateProductionRow(p,'unknown','quantity',2),false);
 updateProductionRow(p,'item-chains','quantity',60);assert.equal(restoreProductionPlan(data,JSON.parse(JSON.stringify(p))).rows['item-chains'].quantity,60);
 const corrupt=structuredClone(p);corrupt.rows['item-chains'].quantity=-5;assert.equal(restoreProductionPlan(data,corrupt),null);assert.equal(restoreProductionPlan(data,{schema:9}),null);
});
test('handoff exports only included rows, source/spec boundaries, editable notes, and safe spreadsheet cells',()=>{
 const p=createProductionPlan(data);for(const r of Object.values(p.rows))r.included=false;p.rows['item-chains'].included=true;p.rows['item-chains'].notes='=HYPERLINK("bad")';p.rows['item-chains'].dimensions='512×512 작업 / 256×256 출력';
 const csv=exportProductionCSV(data,p);assert.ok(csv.startsWith('\uFEFF'));assert.equal(csv.split('\r\n').length,2);assert.match(csv,/'=HYPERLINK/);assert.match(csv,/512×512/);
 const md=exportProductionMarkdown(data,p);assert.match(md,/신규 제작 계획/);assert.match(md,/원작 관측/);assert.match(md,/납품 확인/);assert.equal(exportProductionJSON(data,p).rows.length,1);assert.equal(exportProductionJSON(data,p).rows[0].request.quantity,48);
});
test('production view shows all rows with original/spec comparison and filters without changing selections',()=>{
 const p=createProductionPlan(data),context={productionAssets:data,media};const dom=new JSDOM(renderProductionAssets(context,p,{category:'all',query:''})),d=dom.window.document;
 assert.equal(d.querySelectorAll('[data-production-row]').length,43);assert.equal(d.querySelectorAll('[data-production-include]:checked').length,40);assert.equal(d.querySelectorAll('.production-measured-grid figure').length,9);assert.equal(d.querySelectorAll('[data-production-export]').length,3);
 assert.match(d.body.textContent,/총 그림 수/);assert.match(d.body.textContent,/원작에서 확인/);assert.match(d.body.textContent,/새 게임 제작 초안/);assert.ok(d.querySelector('a[href="#media-audit"]'));dom.window.close();
 const safe=structuredClone(p);safe.projectName='<script>alert(1)</script>';safe.rows['item-chains'].notes='</textarea><script>bad</script>';const escaped=new JSDOM(renderProductionAssets(context,safe,{query:'가짜검색어'}));assert.equal(escaped.window.document.querySelector('script'),null);assert.equal(escaped.window.document.querySelectorAll('[data-production-row]').length,0);assert.equal(productionTotals(data,p).selected,40);escaped.window.close();
});


test('draft controls persist edits, switch scope with correct notes, filter, and export only selected requests',async()=>{
 const {createProductionController}=await import('../src/production-controller.mjs');
 const dom=new JSDOM('<main id="app-view"></main>',{url:'https://example.test/#production-assets'}),w=dom.window,previous={document:globalThis.document,window:globalThis.window};
 Object.assign(globalThis,{document:w.document,window:w});const files=[],messages=[];let controller;
 const render=()=>{w.document.querySelector('main').innerHTML=controller.renderPage();};
 controller=createProductionController({getData:()=>({productionAssets:data,media}),render,download:(...args)=>files.push(args),toast:m=>messages.push(m)});
 const click=s=>w.document.querySelector(s).click(),input=(s,value)=>{const i=w.document.querySelector(s);i.value=value;i.dispatchEvent(new w.Event('input',{bubbles:true}));};
 try{render();assert.equal(w.document.querySelectorAll('[data-production-include]:checked').length,40);
  input('[data-production-quantity="item-chains"]','60');input('[data-production-dimensions="item-chains"]','512px master');
  click('[data-production-preset="core"]');assert.equal(w.document.querySelectorAll('[data-production-include]:checked').length,27);assert.match(w.document.querySelector('[data-production-project-notes]').value,/MVP:/);assert.equal(w.document.querySelector('[data-production-quantity="item-chains"]').value,'60');
  input('[data-production-project-notes]','내 프로젝트 요청');click('[data-production-preset="launch"]');assert.equal(w.document.querySelector('[data-production-project-notes]').value,'내 프로젝트 요청');
  input('[data-production-quantity="item-chains"]','-1');input('[data-production-search]','가위');click('[data-production-export="json"]');assert.equal(files.length,0);assert.equal(w.document.activeElement.dataset.productionQuantity,'item-chains');assert.equal(w.document.activeElement.value,'-1');assert.equal(w.document.activeElement.getAttribute('aria-invalid'),'true');
  input('[data-production-quantity="item-chains"]','60');input('[data-production-search]','가위');assert.ok(w.document.querySelectorAll('[data-production-row]').length<43);assert.equal(w.document.activeElement.hasAttribute('data-production-search'),true);
  click('[data-production-export="csv"]');assert.equal(files.length,1);assert.match(files[0][1],/512px master/);assert.match(files[0][1],/60/);assert.equal(files[0][2],'text/csv');
  render();assert.equal(JSON.parse(w.localStorage.getItem('harbor-production-plan-v1')).rows['item-chains'].quantity,60);assert.ok(messages.length);
 }finally{Object.assign(globalThis,previous);w.close();}
});

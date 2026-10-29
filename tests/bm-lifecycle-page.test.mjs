import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
import {createBMLifecycleWorkbench} from '../src/bm-lifecycle-page.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../src/data/'+p,import.meta.url),'utf8'));
const [bmLifecycleConfig,playConfig]=await Promise.all(['bm-lifecycle.json','play-config.json'].map(read));
function harness(run){const dom=new JSDOM('<main></main>',{url:'https://example.test/project/#bm-validation'}),w=dom.window,previous=globalThis.document;globalThis.document=w.document;let tool;const downloads=[];const render=()=>{w.document.querySelector('main').innerHTML=tool.renderPage();};tool=createBMLifecycleWorkbench({getData:()=>({bmLifecycleConfig,playConfig}),render,download:(...args)=>downloads.push(args)});render();try{run({w,tool,downloads});}finally{globalThis.document=previous;w.close();}}
test('lifecycle UI replays an explicit scenario, selects its events and exports research output without a game save',()=>harness(({w,tool,downloads})=>{
 assert.equal(w.document.querySelector('[data-bm-life-preset]').options.length,bmLifecycleConfig.presets.length);tool.handle('run');const buttons=w.document.querySelectorAll('[data-bm-life-action=step]');assert.ok(buttons.length>1);tool.handle('step','1');assert.equal(w.document.querySelector('[data-bm-life-action=step][data-value="1"]').getAttribute('aria-pressed'),'true');for(const r of w.document.querySelectorAll('svg rect'))assert.ok(Number(r.getAttribute('width'))>=0);tool.handle('export');assert.equal(downloads.length,1);assert.ok(downloads[0][1].result.events.length);assert.equal(w.localStorage.length,0);
}));
test('malformed lifecycle JSON produces a recoverable message and a preset restores a runnable scenario',()=>harness(({w,tool})=>{
 w.document.querySelector('[data-bm-life-json]').value='{bad';tool.handle('run');assert.match(w.document.querySelector('[data-bm-life-status]').textContent,/JSON/);tool.handle('preset',bmLifecycleConfig.presets.at(-1).id);assert.doesNotThrow(()=>JSON.parse(w.document.querySelector('[data-bm-life-json]').value));assert.equal(w.localStorage.length,0);
}));

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createTutorialWorkbench,TUTORIAL_RESEARCH_KEY} from '../src/tutorial-page.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/tutorial-extension.json',import.meta.url),'utf8'));
function harness(run,raw=null){const dom=new JSDOM('<main></main>',{url:'https://example.test/project/#tutorial-analysis'}),w=dom.window,prior={window:globalThis.window,document:globalThis.document};Object.assign(globalThis,{window:w,document:w.document});if(raw!==null)w.localStorage.setItem(TUTORIAL_RESEARCH_KEY,raw);
 const downloads=[];let tool;const render=()=>{w.document.querySelector('main').innerHTML=tool.renderPage();};const create=()=>{tool=createTutorialWorkbench({getData:()=>({tutorialConfig:c}),render,download:(...args)=>downloads.push(args)});render();};create();const act=(a,v)=>tool.handle(a,v),saved=()=>JSON.parse(w.localStorage.getItem(TUTORIAL_RESEARCH_KEY));
 try{run({w,act,saved,downloads,recreate:create});}finally{w.close();Object.assign(globalThis,prior);}}
test('research page blocks unknown context and replays source pass timing/registration/flow separately',()=>harness(({w,act,saved,recreate})=>{
 assert.equal(w.document.querySelectorAll('[data-tutorial-action=select]').length,5);act('event','0');assert.match(w.document.querySelector('[data-tutorial-status]').textContent,/입력/);assert.equal(saved().state.active,null);
 act('preset');act('event','0');assert.equal(saved().state.active.phase,'tip-delay');assert.equal(saved().state.registeredFinished.length,1);assert.equal(saved().state.completed.length,0);
 recreate();assert.equal(w.document.querySelectorAll('.tutorial-steps [aria-current=step]').length,1);act('event','1');assert.equal(saved().state.active.phase,'main-tip');act('event','2');act('event','2');assert.equal(saved().state.active,null);assert.equal(saved().state.completed.length,1);
 act('reset-guide');assert.equal(saved().state.completed.length,0);assert.equal(saved().state.registeredFinished.length,0);
}));
test('invalid research JSON and corrupt saves never silently replace original data',()=>harness(({w,act,downloads,saved})=>{
 act('preset');const before=saved().state;w.document.querySelector('textarea').value='bad JSON';act('event','0');assert.deepEqual(saved().state,before);assert.match(w.document.querySelector('[data-tutorial-status]').textContent,/JSON/);
 act('export');assert.equal(downloads.length,1);
}));
test('incompatible tutorial research data requires export and explicit backed-up reset',()=>harness(({w,act,saved,downloads})=>{
 assert.match(w.document.body.textContent,/원본 저장/);act('export');assert.equal(downloads[0][1],'{bad');assert.equal(w.localStorage.getItem(TUTORIAL_RESEARCH_KEY),'{bad');act('reset-all');assert.equal(w.localStorage.getItem(TUTORIAL_RESEARCH_KEY+'-previous'),'{bad');assert.equal(saved().state.active,null);
},'{bad'));

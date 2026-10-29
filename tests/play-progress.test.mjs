import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {renderPlayProgress} from '../src/play-progress.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../src/data/'+name,import.meta.url),'utf8'));
const [playProgress,c]=await Promise.all(['play-progress.json','play-config.json'].map(read));

test('published replay summaries match this exact rule revision and every executable model source hash',async()=>{
 for(const record of [playProgress.natural,playProgress.fixed16]){
  assert.equal(record.configRevision,c.revision);assert.equal(record.kind,'model-action-trace-not-original-runtime');
  for(const [name,hash]of Object.entries(record.sourceHashes))assert.equal(createHash('sha256').update(await readFile(new URL('../src/'+name,import.meta.url))).digest('hex'),hash,name);
  assert.equal(record.assistance.aidActions,0);assert.equal(record.assistance.directResourceStateEdits,0);assert.equal(record.assistance.tutorialSkips,0);assert.equal(record.assistance.paidEnergyPurchases,0);
  assert.equal(record.income.fixedOrders+record.income.randomOrders+record.income.collectibles+record.income.sales-record.income.questCosts,record.final.gold-record.initial.gold);
 }
 assert.equal(playProgress.natural.final.quests,15);assert.equal(playProgress.natural.final.level,5);assert.equal(playProgress.fixed16.final.fixedDone,16);
 assert.doesNotMatch(JSON.stringify(playProgress),/[CD]:\\|privateSources|sessionExport/);
});

test('all115 tutorial identities have provenance and distinguish source logic, actual path coverage and original presentation',()=>{
 const {summary,rows}=playProgress.tutorials;assert.equal(rows.length,115);assert.equal(new Set(rows.map(r=>r.id)).size,115);assert.equal(summary.declarations,116);
 assert.equal(rows.filter(r=>r.status==='web-runtime').length,16);assert.equal(rows.filter(r=>r.status==='original-presentation-required').length,2);
 assert.equal(rows.filter(r=>r.naturalTraceCompleted).length,16);assert.equal(summary.allTutorialGameplayImplemented,false);
 for(const node of c.onboardingRules.nodes)assert.ok(rows.some(r=>r.id===node.id&&['web-runtime','original-presentation-required'].includes(r.status)));
 for(const row of rows){assert.ok(row.requirements);assert.ok(row.sources.length);for(const src of row.sources){assert.ok(src.path.startsWith('analysis/'));assert.match(src.sha256,/^[a-f0-9]{64}$/);}}
});

test('research progress renders real economy and supported/unknown groups without exposing a full private session',()=>{
 const dom=new JSDOM(renderPlayProgress({playProgress})),d=dom.window.document;
 assert.equal(d.querySelectorAll('.progress-flow li').length,5);assert.equal(d.querySelectorAll('.progress-budget-row').length,4);
 assert.equal(d.querySelectorAll('.tutorial-support tbody tr').length,115);assert.match(d.body.textContent,/원작 계정 실행/);assert.match(d.body.textContent,/30개/);
 assert.equal(d.querySelectorAll('[data-evidence="SIM-X008"]').length,1);dom.window.close();
 const data=structuredClone(playProgress);data.tutorials.rows[0].id='<script>bad()</script>';
 const safe=new JSDOM(renderPlayProgress({playProgress:data}));assert.equal(safe.window.document.querySelector('script'),null);safe.window.close();
});

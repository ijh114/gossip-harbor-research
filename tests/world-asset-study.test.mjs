import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {estimateWorldAssets,exportWorldPlan,WORLD_PLAN_KEY} from '../src/world-asset-plan.mjs';
import {renderWorldAssetStudy,createWorldAssetStudy} from '../src/world-asset-study.mjs';
import {STUDIO_PAGES,VISUAL_ROUTES,renderNavigation} from '../src/navigation.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../src/data/'+name+'.json',import.meta.url),'utf8'));
const [d,cast]=await Promise.all(['world-asset-study','scene-cast-study'].map(read));
const launch=d.presets.find(p=>p.id==='launch');
const state=()=>({inputs:{...launch.inputs},preset:'launch',role:'Quinn',motion:null});

test('world count ledger separates raw Mesh, FBX paths, registry rows, slots, actors and original launch unknowns',()=>{
 const m=d.map,r=m.registrations,n=d.npc.summary;
 assert.equal(d.originalRuntimeObserved,false);assert.equal(d.originalLaunchScopeKnown,false);
 assert.equal(m.inventory.bundles,325);assert.equal(m.inventory.typeCounts.Mesh,25600);assert.equal(m.inventory.distinctRawObjectHashesByType.Mesh,24958);assert.equal(m.inventory.uniquePathsByExtension['.fbx'],944);
 assert.equal(m.mainTaskAreas,48);assert.equal(m.areaFolders.length,124);assert.equal(m.areas.length,48);assert.equal(r.rows,8150);assert.equal(r.physicallyBoundRows,8150);
 assert.equal(r.initialRows+r.nonzeroRows,r.numberedStateRows);assert.equal(Object.values(r.stateHistogram).reduce((a,b)=>a+b),7159);assert.equal(r.numberedSlotKeys,3559);assert.equal(r.numberedStateRows+r.specialRows,r.rows);
 assert.equal(m.areaFolders.filter(x=>/^Area[123]$/.test(x.areaFolder)).reduce((n,x)=>n+x.slotKeys,0),49);
 assert.equal(n.registeredRolePrefabs,44);assert.equal(n.embeddedRolePrefabs+n.remoteRolePrefabs,44);assert.equal(n.canonicalKindCounts.human,27);assert.equal(n.canonicalKindCounts.animal,3);assert.equal(n.earlyAreaHumanIdentityCount,11);
 assert.equal(n.portraitSpeakerRows,85);assert.equal(n.uniquePortraitPrefabPaths,59);assert.equal(n.sourceMotionRows,888);assert.equal(n.positiveDurationMotions,887);assert.equal(n.zeroDurationSetupPoses,1);
 assert.equal(Object.values(n.phaseCounts).reduce((a,b)=>a+b),888);
 assert.doesNotMatch(JSON.stringify(d),/[CD]:[\\/]|@gmail\.com|resolvedURL|Bearer /);
 for(const s of d.sources){assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.match(s.path,/^(analysis|sites)\//);}
});

test('44 role and 888 motion references retain exact role ownership, source duration and bounded preview ranges',async()=>{
 const source=new Map(cast.motions.filter(m=>m.kind==='map').map(m=>[m.id,m])),seen=new Set(),posters=new Map();
 for(const role of d.npc.roles){
  assert.equal(role.sourceAnimations,role.animations.length);assert.equal(role.positiveDurationMotions+role.zeroDurationSetupPoses,role.animations.length);
  for(const motion of role.animations){const original=source.get(motion.id);assert.ok(original);assert.equal(original.role,role.id);assert.equal(motion.duration,original.duration);assert.equal(motion.poster.key,original.segments[0].poster.key);assert.equal(seen.has(motion.id),false);seen.add(motion.id);if(motion.previewRange){assert.ok(motion.previewRange.start>=0);assert.ok(motion.previewRange.end<=motion.duration+1e-6);}assert.match(motion.poster.src,/^\.\/assets\/media\/[\w./-]+\.png$/);}
  posters.set(role.poster.src,role.poster.sha256);
 }
 assert.equal(seen.size,888);assert.equal(source.size,seen.size);
 for(const [src,sha]of posters){assert.equal(createHash('sha256').update(await readFile(new URL('../src/'+src.slice(2),import.meta.url))).digest('hex'),sha);}
 for(const src of Object.values(d.downloads))assert.ok((await stat(new URL('../src/'+src.slice(2),import.meta.url))).size>0);
});

test('release estimator counts composed states separately from base models and rig/motion totals',()=>{
 const r=estimateWorldAssets(launch.inputs);
 assert.equal(r.valid,true);assert.equal(r.slots,50);assert.equal(r.fixedSlots,25);assert.equal(r.finishedLooks,100);assert.equal(r.statePrefabs,150);
 assert.equal(r.baseModels,61);assert.equal(r.rigSets,16);assert.equal(r.totalMotions,135);assert.equal(r.portraitStates,64);
 assert.equal(r.bodyRigSets,13);assert.equal(r.bodyMotions,126);assert.equal(r.customerRuntimeComponents,6);assert.equal(r.orderPortraitStates,32);
 const minimal=estimateWorldAssets({...launch.inputs,choiceSlots:0,humans:0,animals:0,specialRigs:0,storyClips:0,customerSets:0});
 assert.equal(minimal.finishedLooks,50);assert.equal(minimal.statePrefabs,100);assert.equal(minimal.totalMotions,0);assert.equal(minimal.rigSets,0);
 assert.equal(estimateWorldAssets({...launch.inputs,choiceSlots:50}).finishedLooks,150);
 for(const input of [{...launch.inputs,slots:''},{...launch.inputs,slots:0},{...launch.inputs,slots:2.5},{...launch.inputs,styles:11},{...launch.inputs,choiceSlots:51},{...launch.inputs,humans:NaN},{...launch.inputs,animals:Infinity}]){assert.equal(estimateWorldAssets(input).valid,false);assert.equal(exportWorldPlan(d,input),null);}
});

test('six seated customer forms reuse six skeleton sources across twelve components and fifteen distinct animations',()=>{
 const customers=d.npc.customerAssets,unique=new Map();
 assert.equal(customers.customers.length,6);assert.equal(customers.dialoguePortraits.length,59);assert.equal(customers.orderPortraits.length,24);
 assert.equal(d.npc.namedHumanUnionProposal,30);
 for(const c of customers.customers){assert.equal(c.nodes.length,2);assert.equal(c.nodes[0].binarySource.sourceSHA256,c.nodes[1].binarySource.sourceSHA256);for(const node of c.nodes){assert.equal(node.fullBytesConsumed,true);unique.set(node.binarySource.sourceSHA256,node);}}
 assert.equal(unique.size,6);assert.equal([...unique.values()].reduce((n,x)=>n+x.animations.length,0),15);assert.equal(customers.summary.animationRows,30);
 assert.equal(estimateWorldAssets({...launch.inputs,customerSets:9}).valid,false);
});

test('exports contain explicit proposal status, units, subtotal boundaries and unchanged planning inputs',()=>{
 const before=structuredClone(launch.inputs),raw=exportWorldPlan(d,before),json=JSON.parse(raw),csv=exportWorldPlan(d,before,'csv'),md=exportWorldPlan(d,before,'md');
 assert.equal(json.approved,false);assert.equal(json.kind,'original-world-production-proposal');assert.deepEqual(json.inputs,before);assert.deepEqual(before,launch.inputs);
 assert.equal(json.rows.find(x=>x.id==='states').quantity,150);assert.match(json.boundary,/합산하지/);assert.match(csv,/신규 제안/);assert.match(md,/승인 전/);assert.match(md,/135/);
});

test('new route and planner entry preserve old request ledger and explicit original/proposal boundaries',()=>{
 const dom=new JSDOM(renderWorldAssetStudy({worldAssetStudy:d},state())),doc=dom.window.document;
 assert.equal(doc.querySelectorAll('[data-world-field]').length,19);assert.equal(doc.querySelectorAll('[data-world-preset]').length,3);assert.equal(doc.querySelectorAll('[data-world-role] option').length,44);
 assert.ok(doc.querySelector('#world-map-counts'));assert.ok(doc.querySelector('#world-npc-counts'));assert.ok(doc.querySelector('#world-launch-plan'));assert.match(doc.body.textContent,/原作|원작/);assert.match(doc.body.textContent,/기존 전체43행/);
 assert.match(STUDIO_PAGES['world-assets'],/NPC/);assert.equal(VISUAL_ROUTES.includes('world-assets'),false);assert.match(renderNavigation(),/href="#world-assets"/);
 const invalid=state();invalid.inputs.choiceSlots=51;doc.body.innerHTML=renderWorldAssetStudy({worldAssetStudy:d},invalid);assert.equal(doc.querySelector('[data-world-field="choiceSlots"]').getAttribute('aria-invalid'),'true');assert.ok(doc.querySelector('[data-world-export]').disabled);
});

test('controller updates live estimates, rejects impossible choices, restores drafts and never overwrites the global 43-row plan',()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test/#world-assets'}),oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window=dom.window;globalThis.document=dom.window.document;
 try{
  const root=document.querySelector('#root'),downloads=[];window.localStorage.setItem('harbor-production-plan-v1','keep-global-plan');
  let controller;const rerender=()=>{controller.beforeLeave();root.innerHTML=controller.renderPage();controller.afterMount(root);};
  controller=createWorldAssetStudy({getData:()=>({worldAssetStudy:d}),render:rerender,download:(...args)=>downloads.push(args)});rerender();
  const set=(key,value)=>{const field=root.querySelector(`[data-world-field="${key}"]`);field.value=value;field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
  set('slots','10');assert.equal(root.querySelector('[data-world-field="choiceSlots"]').getAttribute('aria-invalid'),'true');assert.ok(root.querySelector('[data-world-export]').disabled);root.querySelector('[data-world-export]').click();assert.equal(downloads.length,0);
  set('choiceSlots','5');assert.equal(root.querySelector('[data-world-field="choiceSlots"]').getAttribute('aria-invalid'),'false');assert.match(root.querySelector('[data-world-result]').textContent,/상태 프리팹 30/);assert.equal(JSON.parse(window.localStorage.getItem(WORLD_PLAN_KEY)).inputs.slots,10);
  root.querySelector('[data-world-export="json"]').click();assert.equal(JSON.parse(downloads[0][1]).approved,false);
  const role=root.querySelector('[data-world-role]');role.value='Schoolbus';role.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(root.querySelectorAll('[data-world-motion] option').length,3);assert.match(root.querySelector('[data-world-actor]').textContent,/차량/);
  const motion=root.querySelector('[data-world-motion]');motion.value=motion.options[2].value;motion.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(document.activeElement,root.querySelector('[data-world-motion]'));assert.equal(root.querySelector('[data-world-motion]').value,motion.value);
  controller.beforeLeave();controller=createWorldAssetStudy({getData:()=>({worldAssetStudy:d}),render:rerender,download:(...args)=>downloads.push(args)});rerender();assert.equal(root.querySelector('[data-world-field="slots"]').value,'10');
  root.querySelector('[data-world-preset="mvp"]').click();assert.equal(root.querySelector('[data-world-field="slots"]').value,'6');assert.equal(document.activeElement.dataset.worldPreset,'mvp');
  assert.equal(window.localStorage.getItem('harbor-production-plan-v1'),'keep-global-plan');controller.beforeLeave();
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;dom.window.close();}
});

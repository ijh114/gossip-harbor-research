import {validActivitySeasonConfig} from '../src/activity-season.mjs';
import {activityConfigRevision} from '../src/activity-config.mjs';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {mergeResearch,DOMAIN_DEFS,selectDomainFacts} from '../src/domain-model.mjs';
import {validMedia} from '../src/visual-model.mjs';
import {createTutorialExtension,validTutorialExtension} from '../src/tutorial-extension.mjs';
const base=JSON.parse(await readFile('dist/data/research.json','utf8'));
const extension=JSON.parse(await readFile('dist/data/domains.json','utf8'));
const followup=JSON.parse(await readFile('dist/data/followup.json','utf8'));
const data=mergeResearch(base,extension,followup);
if(data.meta.version!=='4.10.5')throw new Error('Unexpected research version');
if(new Set(data.facts.map(x=>x.id)).size!==data.facts.length)throw new Error('Duplicate fact IDs');
if(data.products.length!==251)throw new Error('Expected 251 packaged global IAP declarations');
for(const fact of data.facts){if(!fact.title||!fact.summary||!Array.isArray(fact.sources))throw new Error('Invalid fact '+fact.id);if(fact.kind!=='inference'&&!fact.sources.length)throw new Error('Missing provenance '+fact.id);}
for(const p of data.products){if(!Number.isFinite(p.priceUsd)||p.priceUsd<0||!p.sources?.length)throw new Error('Invalid product '+p.id);}
for(const def of DOMAIN_DEFS){if(!extension.pages[def.id]?.sections.length||!selectDomainFacts(data.facts,def.id).length)throw new Error('Missing research chapter '+def.id);}
const html=await readFile('dist/index.html','utf8');
for(const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
 const ref=m[1];if(/^(?:#|https?:|data:|mailto:)/.test(ref))continue;
 if(ref.startsWith('/'))throw new Error('Root-relative asset breaks GitHub project Pages: '+ref);
 await stat(path.join('dist',ref.split('?')[0]));
}
async function audit(dir){for(const n of await readdir(dir)){const p=path.join(dir,n),s=await stat(p);if(s.isDirectory())await audit(p);else if(/\.(apk|xapk|luac|bundle|bin|so|dll)$/i.test(n))throw new Error('Raw app binary is not publishable: '+p);}}
await audit('dist');
const visual=JSON.parse(await readFile('dist/data/visual-index.json','utf8'));
const media=JSON.parse(await readFile('dist/data/media.json','utf8'));
if(visual.targetVersion!==data.meta.version||visual.items.length!==4270||visual.ui.length!==1644)throw new Error('Visual index scope changed unexpectedly');
if(new Set(visual.items.map(x=>x.key)).size!==visual.items.length)throw new Error('Duplicate item variant identity');
if(media.targetVersion!==data.meta.version||!Array.isArray(media.entries))throw new Error('Invalid media manifest');
if(new Set(media.entries.map(x=>x.key)).size!==media.entries.length)throw new Error('Duplicate media key');
for(const entry of media.entries){if(!validMedia(entry))throw new Error('Invalid curated media entry: '+entry.key);await stat(path.join('dist',entry.src));if(entry.poster)await stat(path.join('dist',entry.poster));}
console.log(`Verified ${visual.items.length} item declarations, ${visual.ui.length} UI mappings, ${media.entries.filter(x=>x.origin==='packaged-sprite').length} packaged-image references, ${media.entries.filter(x=>x.origin==='observed-user-capture').length} historical capture derivatives.`);
console.log(`Verified ${DOMAIN_DEFS.length} research chapters, ${data.facts.length} sourced findings, ${data.products.length} product defaults, relative asset paths and publish boundary.`);
const play=JSON.parse(await readFile('dist/data/play-config.json','utf8'));
if(play.targetVersion!==data.meta.version||play.items.length!==552||play.orders.length!==16||play.quests.length!==4277||play.levels.length!==300||play.initialBoard.length!==63)throw new Error('Invalid play configuration');
if(Object.keys(play.spreadRules.byType).length!==163||play.bubbleRules.items.filter(r=>r.chancePercent>0).length!==138||play.imageCoverage.available!==544)throw new Error('Incomplete play rule/image expansion');
if(!play.commerceRules.flash||!play.productionRules.luckyConfigs?.length||play.onboardingRules.nodes.length<18)throw new Error('Missing connected shop/modifier/onboarding rules');
const types=new Set(play.items.map(x=>x.type));
for(const item of play.items){if(item.next&&!types.has(item.next)&&!/^rb#/.test(item.next))throw new Error('Unrecognized merge result '+item.next);if(item.generator)for(const drop of item.generator.pool)if(!types.has(drop.type)||!Number.isInteger(drop.weight)||drop.weight<1)throw new Error('Invalid fixed pool');}
for(const s of play.sources)if(!s.path?.startsWith('analysis/')||!/^[a-f0-9]{64}$/.test(s.sha256))throw new Error('Missing simulation provenance');
console.log(`Verified552 base types,16 fixed orders,4277 default quests and300 level rows and configuration source hashes.`);
const progress=JSON.parse(await readFile('dist/data/play-progress.json','utf8'));
if(progress.natural.configRevision!==play.revision||progress.fixed16.configRevision!==play.revision||progress.tutorials.rows.length!==115)throw new Error('Stale or incomplete published play validation');
if(progress.natural.assistance.aidActions!==0||progress.natural.assistance.paidEnergyPurchases!==0||progress.fixed16.final.fixedDone!==16)throw new Error('Natural growth or fixed-order replay is incomplete');
const production=JSON.parse(await readFile('dist/data/production-assets.json','utf8'));
const auditData=JSON.parse(await readFile('dist/data/media-audit.json','utf8'));
if(production.targetVersion!==data.meta.version||production.rows.length!==43||production.meta.defaultPreset!=='launch')throw new Error('Invalid production request inventory');
for(const row of production.rows){if(!row.observed?.summary||!row.proposal?.dimensions||!row.sources?.length)throw new Error('Missing original/proposed specification boundary: '+row.id);for(const key of row.referenceKeys)if(!media.entries.some(m=>m.key===key))throw new Error('Unknown production reference: '+key);}
if(auditData.videos.length!==113||auditData.summary.inScopeVideos!==110||auditData.summary.excludedVideos!==3)throw new Error('Invalid video source boundary');
if(auditData.summary.decodedVideos!==113||auditData.summary.visualTimelineReviewedVideos!==110||auditData.summary.decoderErrors!==0)throw new Error('Incomplete chronological timeline audit');
if(auditData.meta.verification?.errorCount!==0)throw new Error('Timeline source/range verification has unresolved errors');
if(auditData.summary.audioListenedVideos!==0||auditData.summary.nativeRealtimePlaybackVideos!==0)throw new Error('Unverified listening or playback claim');
console.log('Verified 43 production request rows and 113 decoded sources / 110 sampled visual timelines, with unperformed listening kept separate.');
const refinement=JSON.parse(await readFile('dist/data/media-refinement.json','utf8'));
if(refinement.studies.length!==25||refinement.coverage.length!==11||refinement.corrections.length!==3||refinement.audio.recordings.length!==110||refinement.audio.clips.length!==14||refinement.audio.summary.recordingsListened!==0)throw new Error('Incomplete media refinement or unverified listening');
if(refinement.studies.filter(s=>s.id.startsWith('motion-')).some(s=>s.publicReady!==true))throw new Error('Motion derivatives have not completed public QA');
for(const m of refinement.mediaEntries){if(!validMedia(m)||!m.originalSha256)throw new Error('Invalid refined capture '+m.key);await stat(path.join('dist',m.src));if(m.poster)await stat(path.join('dist',m.poster));}
for(const clip of refinement.audio.clips){for(const src of [clip.src,clip.waveformImage.src,clip.spectrogram.src]){if(!/^\.\/assets\/media\/refinement\/audio\/[\w.-]+\.(mp3|svg|png)$/.test(src))throw new Error('Invalid curated audio asset path');await stat(path.join('dist',src));}}
console.log(`Verified ${refinement.studies.length} refined studies, ${refinement.mediaEntries.length} capture derivatives and 14 bounded packaged audio excerpts; recorded audio remains unpublished.`);
const scenes=JSON.parse(await readFile('dist/data/scene-config.json','utf8'));
const completion=JSON.parse(await readFile('dist/data/media-completion.json','utf8'));
const growth=JSON.parse(await readFile('dist/data/progress-extended.json','utf8'));
const activities=JSON.parse(await readFile('dist/data/activity-play.json','utf8'));
const activityMedia=JSON.parse(await readFile('dist/data/activity-media.json','utf8'));
if(scenes.tasks.length!==106||scenes.summary.taskCommands!==1357||scenes.summary.physicalChoiceVariants!==111||scenes.summary.missingPhysicalChoiceVariants!==12||scenes.mediaEntries.length!==116)throw new Error('Incomplete packaged scene projection');
if(completion.studies.length!==2||completion.mediaEntries.length!==12||completion.studies.some(s=>s.publicReady!==true))throw new Error('Incomplete media completion QA');
for(const m of [...scenes.mediaEntries,...completion.mediaEntries]){
 if(!validMedia(m))throw new Error('Invalid selected scene/motion asset '+m.key);
 const bytes=await readFile(path.join('dist',m.src));if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw new Error('Derivative hash mismatch '+m.key);
 if(m.poster)await stat(path.join('dist',m.poster));
}
if(!growth.success||growth.final.level!==12||growth.final.quests!==60||growth.assistance.aidActions!==0||growth.assistance.paidEnergyPurchases!==0||growth.configRevision!==play.revision)throw new Error('Invalid extended natural progression');
if(!growth.late?.success||growth.late.final.level!==21||growth.late.final.quests!==150||growth.late.assistance.aidActions!==0||growth.late.assistance.paidEnergyPurchases!==0)throw new Error('Invalid late natural progression');
if(activities.event.items.length!==35||activities.event.sharedItems.length!==24||activityMedia.summary.eventUnavailable!==35||activityMedia.entries.length!==0)throw new Error('Invalid event image availability boundary');
console.log('Verified 106 source scenes / 111 physical choice previews / 12 explicitly missing, 2 additional motion studies, Lv12/Lv21 growth and explicitly bounded activity play.');
const tutorials=JSON.parse(await readFile('dist/data/tutorial-extension.json','utf8'));
const decor=JSON.parse(await readFile('dist/data/decor-edit.json','utf8'));
if(tutorials.guides.length!==5||!validTutorialExtension(createTutorialExtension(tutorials),tutorials)||decor.sources.length!==4)throw new Error('Invalid additional research boundaries');
for(const s of [...tutorials.sources,...decor.sources])if(!s.path.startsWith('analysis/')||!/^[a-f0-9]{64}$/.test(s.sha256)||!s.ranges.length)throw new Error('Missing selected code provenance');
if(followup.tutorialExtension?.remainingPreviouslyUnsupported!==87)throw new Error('Stale tutorial coverage ledger');
console.log('Verified 5 isolated context-driven tutorials and normal decor edit provenance; no game server or main-wallet connection.');

const more=JSON.parse(await readFile('dist/data/tutorial-more.json','utf8'));
const skins=JSON.parse(await readFile('dist/data/skin-lab.json','utf8'));
const observation=JSON.parse(await readFile('dist/data/bm-observation-audit.json','utf8'));
const availability=JSON.parse(await readFile('dist/data/artifact-availability.json','utf8'));
if(more.guides.length!==5||skins.groups.flatMap(g=>g.skins).length!==26||observation.rows.length!==54||availability.entries.length!==18)throw new Error('Incomplete 1-4 followup data');
for(const m of observation.mediaEntries){if(!validMedia(m))throw new Error('Invalid BM excerpt '+m.key);const bytes=await readFile(path.join('dist',m.src));if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw new Error('BM excerpt hash mismatch '+m.key);if(m.poster)await stat(path.join('dist',m.poster));}
if(observation.summary.automaticReappearanceConfirmed!==0||observation.summary.expiryTransitionsConfirmed!==0||availability.summary.newlyRecoveredAssets!==9)throw new Error('Unreviewed evidence upgrade');
console.log('Verified 10 additional research guides (10 explicit-context play-linked), selected26 Skin identities, 54 BM evidence cells and 18 availability records.');

const lifecycle=JSON.parse(await readFile('dist/data/bm-lifecycle.json','utf8'));
const factory=JSON.parse(await readFile('dist/data/factory-play.json','utf8'));
const progression=JSON.parse(await readFile('dist/data/progression-validation.json','utf8'));
if(lifecycle.presets.length!==3||lifecycle.presets.reduce((sum,p)=>sum+p.events.length,0)!==27||lifecycle.originalRuntimeObserved!==false)throw new Error('Invalid BM lifecycle boundary');
if(factory.groups.length!==6||factory.groups.flatMap(g=>g.fragments).length!==23||factory.sources.length!==13)throw new Error('Incomplete factory source projection');
if(progression.configRevision!==play.revision||progression.continuation.final.level!==26||progression.continuation.final.quests!==210||progression.continuation.points.length!==210||progression.seedComparison.seeds.length!==3)throw new Error('Stale continuation/seed comparison');
if(followup.tutorialExtension.playConnected!==10||followup.followup2to5?.factoryCuratedImages!==29)throw new Error('Stale followup status');
console.log('Verified 3 BM lifecycle scenarios / 27 events, factory6/23, Lv26/210-task continuation and 3 Lv21 seed runs.');

const master=JSON.parse(await readFile('dist/data/master-checklist.json','utf8'));
const uiAudit=JSON.parse(await readFile('dist/data/ui-evidence-audit.json','utf8'));
const recap=JSON.parse(await readFile('dist/data/story-recap.json','utf8'));
const tutorials87=JSON.parse(await readFile('dist/data/tutorial-catalog.json','utf8'));
if(master.tasks.length!==100||new Set(master.tasks.map(t=>t.id)).size!==100||master.groups.find(g=>g.id===3).status!=='부분')throw Error('Checklist identity or parent completion drift');
if(uiAudit.summary.comparisonRows!==8||uiAudit.originalRuntimeObserved!==false||recap.books.length!==5||recap.summary.pages!==22||recap.mediaEntries.length!==9||tutorials87.guides.length!==87)throw Error('Invalid requested0/3 coverage');
for(const m of recap.mediaEntries){if(!validMedia(m))throw Error('Invalid recap media '+m.key);const bytes=await readFile(path.join('dist',m.src));if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw Error('Recap image hash mismatch '+m.key);}
console.log('Verified fixed100 checklist, UI8 bounded comparisons,87 source executers,5 recap books/22pages and9 new exact Sprite PNGs; runtime completeness remains separately classified.');

const presentation=JSON.parse(await readFile('dist/data/presentation-assets.json','utf8'));
const season=JSON.parse(await readFile('dist/data/activity-season.json','utf8'));
const coverage=JSON.parse(await readFile('dist/data/tutorial-adapter-coverage.json','utf8'));
if(presentation.mediaEntries.length!==151||presentation.maps[0].slots.length!==41||presentation.audit.curatedVisibleSlotVariants!==124||presentation.nativePlayer.inventory.typeTreeHashMatchedBehaviours!==373||presentation.opening.frames.length!==24||presentation.opening.introLinkedToCG!==false||presentation.skins.some(s=>s.mediaKey!==null))throw Error('Invalid common map/CG/native source boundary');
if(!validActivitySeasonConfig(season)||season.origin!=='research-example'||season.revision!==activityConfigRevision(season)||coverage.total!==85||coverage.counts['native-target-unavailable']!==54||coverage.counts['native-model-unimplemented']!==2)throw Error('Invalid configured season or external-effect coverage');
for(const m of presentation.mediaEntries){if(!validMedia(m))throw Error('Invalid curated presentation media '+m.key);const bytes=await readFile(path.join('dist',m.src));if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw Error('Presentation derivative mismatch '+m.key);}
if(recap.audioEntries?.length!==1)throw Error('Missing exact page-turn effect');
for(const m of recap.audioEntries){if(m.kind!=='audio'||!/^\.\/assets\/media\/story-recap\/[\w-]+\.wav$/.test(m.src)||m.duration>3||m.auditionVerified!==false||m.runtimeSynchronizationVerified!==false)throw Error('Unverified recap audio upgrade');const bytes=await readFile(path.join('dist',m.src));if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw Error('Recap audio derivative mismatch');}
console.log('Verified151 common-map/CG/native images, source Camera PPtr, exact short page-turn audio, source-shaped opt-in mock season and85 external-effect rows (29 handlers,56 unavailable native targets/models).');

import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {mergeResearch,DOMAIN_DEFS,selectDomainFacts} from '../src/domain-model.mjs';
import {validMedia} from '../src/visual-model.mjs';
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

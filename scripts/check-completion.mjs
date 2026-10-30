import {validItemResolutionFollowup} from '../dist/item-resolution-followup.mjs';
import {validRegisteredActivityConfig} from '../dist/registered-activity.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {integrateCompletionData} from '../dist/completion-data.mjs';
import {sourceMotionExpansion} from '../dist/apk-motion-gallery.mjs';
import {mediaFor,validMedia} from '../dist/visual-model.mjs';
import {validItemRepresentationConfig} from '../dist/item-representation.mjs';
const names={sceneConfig:'scene-config',media:'media',mediaReview:'apk-media-review',apkExpansion:'apk-media-expansion',finalObservations:'media-final-observations',lateSceneStudy:'late-scene-study',remoteOriginAudit:'remote-origin-audit',presentationAssets:'presentation-assets',remotePresentation:'remote-presentation-assets',lateSceneArt:'late-scene-art',remoteCharacters:'remote-character-study',cgExpansion:'cg-motion-expansion',itemRepresentation:'item-representation',itemRepresentationRemote:'item-representation-remote',collectionStudy:'collection-study',masterChecklist:'master-checklist',artifactAvailability:'artifact-availability',itemResolutionFollowup:'item-resolution-followup',registeredActivityConfig:'registered-activity'};
const inputs=Object.fromEntries(await Promise.all(Object.entries(names).map(async([key,name])=>[key,JSON.parse(await readFile('dist/data/'+name+'.json','utf8'))]))),d=integrateCompletionData(inputs),clips=sourceMotionExpansion(d).studies;
if(clips.length!==929||new Set(clips.map(s=>s.id)).size!==929)throw Error('Missing or duplicated character/CG source motion');
for(const s of clips){let end=0;for(const seg of s.segments){if(Math.abs(seg.sourceRange.start-end)>1e-6||!seg.isPreviouslyPreviewed&&seg.sourceRange.end-seg.sourceRange.start>2.000001)throw Error('Source-time gap '+s.id);for(const key of [seg.posterMediaKey,seg.previewMediaKey].filter(Boolean))if(!validMedia(mediaFor(d,key)))throw Error('Unplayable source segment '+key);end=seg.sourceRange.end;}if(Math.abs(end-s.declaredDuration)>1e-6)throw Error('Incomplete source tail '+s.id);}
const extra=['apkExpansion','finalObservations','remotePresentation','lateSceneArt','remoteCharacters','cgExpansion','itemRepresentationRemote','collectionStudy'],files=new Map();
for(const key of extra)for(const m of d[key].mediaEntries){if(!validMedia(m))throw Error('Invalid curated media '+m.key);for(const [p,hash]of [[m.src,m.sha256],...(m.poster?[[m.poster,m.posterSha256]]:[])]){if(files.has(p)&&files.get(p)!==hash)throw Error('Conflicting asset digest '+p);files.set(p,hash);}}
let bytes=0;for(const[p,hash]of files){const b=await readFile('dist/'+p.slice(2));if(createHash('sha256').update(b).digest('hex')!==hash)throw Error('Published derivative digest mismatch '+p);if(b.length>25*1024*1024)throw Error('Cloudflare per-asset size exceeded '+p);bytes+=b.length;}
if(d.sceneConfig.tasks.length!==116||d.presentationAssets.maps[0].slots.length!==55||d.presentationAssets.skins.some(s=>!validMedia(mediaFor(d,s.mediaKey))))throw Error('Scene/map/Skin integration drift');
if(!validItemRepresentationConfig(d.itemRepresentation)||d.itemRepresentation.coverage.baseUsageUnknown!==1)throw Error('Item representation boundary drift');
if(d.collectionStudy.resourceAssets.length!==564||d.lateSceneStudy.days.length!==280||d.lateSceneStudy.storyAudit.missingTextRows!==8)throw Error('Collection/late scene source audit drift');
for(const row of d.masterChecklist.tasks.filter(t=>/^4\.(0[3-9]|1[0-3])$/.test(t.id)))if((row.status==='완료')!==['4.03','4.04','4.09','4.13'].includes(row.id))throw Error('Unsupported completion claim '+row.id);
if(!validItemResolutionFollowup(d.itemResolutionFollowup)||!validRegisteredActivityConfig(d.registeredActivityConfig))throw Error('Registered-item completion lacks exact source/image/play evidence');
console.log(`Verified929 complete source-time character/CG previews,116 selected scenes,55 map slots,26 exact Skin graphics,564 collection resource records and${files.size}curated files (${Math.round(bytes/1024)}KiB). Runtime/input/audition gaps remain explicit.`);

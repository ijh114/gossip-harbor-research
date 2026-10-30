import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validItemResolutionFollowup} from '../src/item-resolution-followup.mjs';
import {validRegisteredActivityConfig} from '../src/registered-activity.mjs';
import {validNativeMapStudy} from '../src/native-map-study.mjs';
import {validRandomRewardStudy} from '../src/random-reward-study.mjs';
const load=async name=>JSON.parse(await readFile('dist/data/'+name+'.json','utf8'));
const names=['item-resolution-followup','registered-activity','skin-acquisition-study','random-reward-study','spine-motion-study','scene-cast-study','capture-followup-study','album-variants-study','recap-motion-study','native-map-study','source-audio','tutorial-surfaces','current-material-review','source-scene-stage'];
const data=Object.fromEntries(await Promise.all(names.map(async name=>[name,await load(name)])));
if(!validItemResolutionFollowup(data['item-resolution-followup'])||!validRegisteredActivityConfig(data['registered-activity'])||!validNativeMapStudy(data['native-map-study'])||!validRandomRewardStudy(data['random-reward-study']))throw Error('Current source-study boundary changed');
const spine=data['spine-motion-study'];
if(spine.summary.fullByteParses!==654||spine.clips.length!==694||spine.summary.projectedAnimations!==694||spine.summary.omittedUnsupported!==0||spine.summary.originalRuntimeObserved!==false)throw Error('Spine source/renderer boundary changed');
const files=new Map();
function add(src,sha){if(!/^\.\/assets\/media\/[\w./-]+\.(png|jpg|jpeg|mp4|gif|webp|wav|mp3)$/.test(src)||src.includes('..')||!/^[a-f0-9]{64}$/.test(sha))throw Error('Invalid research asset identity '+src);if(files.has(src)&&files.get(src)!==sha)throw Error('Conflicting research asset hash '+src);files.set(src,sha);}
function walk(value){if(!value||typeof value!=='object')return;if(typeof value.src==='string'&&value.src.startsWith('./assets/media/')){if(typeof value.sha256==='string')add(value.src,value.sha256);else if(value.output?.sha256)add(value.src,value.output.sha256);}if(typeof value.poster==='string'&&value.poster.startsWith('./assets/media/')&&value.posterSha256)add(value.poster,value.posterSha256);for(const v of Object.values(value))if(typeof v==='object')walk(v);}
for(const study of Object.values(data))walk(study);
for(const [src,sha]of files){const bytes=await readFile('dist/'+src.slice(2));if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Current research derivative mismatch '+src);}
console.log(`Verified ${names.length} current research manifests and ${files.size} exact-hash derived media references; source projections never assert original runtime or audition.`);

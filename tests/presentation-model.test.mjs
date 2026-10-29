import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createPlay} from '../src/play-model.mjs';
import {createMapPresentation,validMapPresentation,mapPresentationAction,mapPresentationView,presentationMedia} from '../src/presentation-model.mjs';
import {renderSourceMap,renderSkinArt} from '../src/presentation-page.mjs';
import {beginDecorEdit,previewDecor,confirmDecorEdit,cancelDecorEdit} from '../src/decor-model.mjs';
const load=async n=>JSON.parse(await readFile(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const [c,scenes,skin]=await Promise.all(['play-config','scene-config','skin-lab'].map(load));
const image=(key,src='./assets/media/test.png')=>({key,kind:'image',src,alt:key,width:1000,height:800});
const fixture=()=>({sceneConfig:scenes,presentationAssets:{maps:[{id:'first',label:'첫 구역',baseMediaKey:'base',slots:[{id:'1_1',depth:4,variants:['1','2','3'].map(id=>({id,mediaKey:'chair'+id,boundsNormalized:{x:.2,y:.3,width:.1,height:.2}}))}]},{id:'later',baseMediaKey:'base',slots:[]}],mediaEntries:[image('base'),...['1','2','3'].map(id=>image('chair'+id))]}});
test('the map applies only completed recorded variants and never fills unknown or future choices',()=>{
 const d=fixture(),s=createPlay(c);s.stage='home';s.screenFlow={schema:1,phase:'map',decor:{'1_1':'2'}};
 assert.equal(mapPresentationView(s,c,d).layers.length,0);s.questsDone=1;assert.equal(mapPresentationView(s,c,d).layers[0].mediaKey,'chair2');delete s.screenFlow.decor['1_1'];const v=mapPresentationView(s,c,d);assert.equal(v.layers.length,0);assert.equal(v.unknown[0].reason,'이전 저장의 디자인 선택 기록 미확인');assert.equal(s.wallet.coins,0);
});
test('same-slot preview uses the common projection while cancel/confirm return to the map without replaying rewards',()=>{
 const d=fixture(),s=createPlay(c);s.stage='home';s.questsDone=1;s.screenFlow={schema:1,phase:'map',decor:{'1_1':'2'}};
 const before=structuredClone({wallet:s.wallet,queue:s.queue,xp:s.xp,quests:s.questsDone});assert.equal(beginDecorEdit(s,c,scenes,'1_1',{returnTo:'map'}).ok,true);assert.equal(previewDecor(s,c,scenes,'3').ok,true);
 const v=mapPresentationView(s,c,d,{slotId:'1_1',preview:{slotId:'1_1',variant:s.screenFlow.decorEdit.selected}});assert.equal(v.layers[0].mediaKey,'chair3');assert.equal(v.layers[0].isPreview,true);assert.equal(s.screenFlow.decor['1_1'],'2');cancelDecorEdit(s);assert.equal(s.screenFlow.phase,'map');assert.equal(s.screenFlow.decor['1_1'],'2');beginDecorEdit(s,c,scenes,'1_1',{returnTo:'map'});previewDecor(s,c,scenes,'1');confirmDecorEdit(s,c,scenes);assert.equal(s.screenFlow.phase,'map');assert.equal(s.screenFlow.decor['1_1'],'1');assert.deepEqual({wallet:s.wallet,queue:s.queue,xp:s.xp,quests:s.questsDone},before);
});
test('map selection is presentation-only and malformed optional state is retained',()=>{
 const d=fixture(),s=createMapPresentation(d);assert.equal(mapPresentationAction(s,{type:'select-map',value:'later'},d).ok,true);assert.equal(s.mapId,'later');mapPresentationAction(s,{type:'select-slot',value:'1_1'},d);assert.equal(s.mapId,'first');mapPresentationAction(s,{type:'layers',value:'base'},d);const domain=createPlay(c);domain.stage='home';domain.questsDone=1;domain.screenFlow={decor:{'1_1':'3'}};domain.mapPresentation=s;assert.equal(mapPresentationView(domain,c,d).layers.length,0);assert.equal(validMapPresentation(undefined,d),true);const broken={...s,mapId:'not-found'},before=structuredClone(broken);assert.equal(mapPresentationAction(broken,{type:'layers',value:'current'},d).ok,false);assert.deepEqual(broken,before);assert.equal(presentationMedia({presentationAssets:{mediaEntries:[image('bad','./assets/media/../private.png')]}},'bad'),null);
});
test('map renders registered bounds instead of invented slot placement and skin misses remain explicit',()=>{
 const d=fixture(),s=createPlay(c);s.stage='home';s.questsDone=1;s.screenFlow={decor:{'1_1':'2'}};const dom=new JSDOM(renderSourceMap(s,c,d));try{const node=dom.window.document.querySelector('[data-map-slot="1_1"]');assert.equal(node.dataset.mapVariant,'2');assert.match(node.getAttribute('style'),/left:20%;top:30%;width:10%;height:20%/);}finally{dom.window.close();}
 const ss={selected:skin.groups[0].skins[0].id,slots:{},edit:null};const html=renderSkinArt(ss,skin,{presentationAssets:{skins:skin.groups[0].skins.map(r=>({id:r.id,assetPath:'Assets/Map/Event-WeddingDay/'+r.slot+'_1.prefab',status:'registered-only',mediaKey:null}))}});assert.match(html,/실물 미확보/);assert.match(html,/Event-WeddingDay/);assert.doesNotMatch(html,/<img/);
});

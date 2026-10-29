import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createCGPresentation,validCGPresentation,cgPresentationView,cgPresentationAction,renderCGPresentation} from '../src/cg-presentation.mjs';
const presentationAssets=JSON.parse(await readFile(new URL('../src/data/presentation-assets.json',import.meta.url),'utf8')),d={presentationAssets};
test('CG stores only inspection state, preserves static order/rotation and never interprets images as timed frames',()=>{
 const s=createCGPresentation(d);assert.equal(cgPresentationAction(s,{type:'select',value:'cg-scene3'},d).ok,true);const v=cgPresentationView(s,d),window=v.layers.find(l=>l.path.endsWith('scene3_1a'));
 assert.ok(window);assert.ok(window.rotationZDegrees>46&&window.rotationZDegrees<47);const dom=new JSDOM(renderCGPresentation({cgPresentation:s},d));try{const imgs=[...dom.window.document.querySelectorAll('.cg-static-plane img')];assert.ok(imgs.some(n=>n.getAttribute('style').includes('rotate(-46.')));assert.match(dom.window.document.body.textContent,/시간순 영상 프레임이 아닙니다/);assert.equal(dom.window.document.querySelectorAll('video').length,0);}finally{dom.window.close();}
 const count=v.layers.length;cgPresentationAction(s,{type:'toggle-layer',value:window.path},d);assert.equal(cgPresentationView(s,d).layers.length,count-1);assert.equal(validCGPresentation(JSON.parse(JSON.stringify(s)),d),true);assert.equal(Object.hasOwn(s,'wallet'),false);
});
test('malformed CG inspection is retained and nested uncertain parent rectangles remain excluded',()=>{
 const s={...createCGPresentation(d),sceneId:'missing'},before=structuredClone(s);assert.equal(cgPresentationAction(s,{type:'mode',value:'all'},d).ok,false);assert.deepEqual(s,before);assert.equal(validCGPresentation(undefined,d),true);assert.equal(validCGPresentation(null,d),false);const good=createCGPresentation(d),v=cgPresentationView(good,d);assert.ok(v.omitted.every(n=>/배치 미확인/.test(n.reason)));
});

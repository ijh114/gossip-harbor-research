import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountDecorHold} from '../src/decor-hold.mjs';
function setup(){const dom=new JSDOM('<section><button data-decor-hold-slot="1_4">누르기</button><p data-decor-hold-status></p></section>',{pretendToBeVisual:true}),w=dom.window,root=w.document.querySelector('section'),b=root.querySelector('button');let t=0,tick,allowed=true,complete=[],loops=0,stops=0;w.setInterval=f=>(tick=f,1);w.clearInterval=()=>{tick=null;};const cleanup=mountDecorHold(root,{now:()=>t,isAllowed:()=>allowed,onLoop:()=>loops++,onStop:()=>stops++,onComplete:id=>complete.push(id)});const event=(name,props={})=>{const ev=new w.Event(name,{bubbles:true,cancelable:true});Object.assign(ev,{button:0,pointerId:42,clientX:10,clientY:10,...props});b.dispatchEvent(ev);};return {dom,w,b,root,event,cleanup,advance:ms=>{t=ms;tick?.();},lock:()=>{allowed=false;},state:()=>({loops,stops,complete})};}
test('0.2s stationary hold starts the exact1.2s progress, stops the loop and enters the selected panel once',()=>{
 const h=setup();try{h.event('pointerdown');h.advance(200);assert.equal(h.state().loops,0);h.advance(201);assert.equal(h.state().loops,1);assert.ok(h.b.querySelector('progress'));h.advance(1399);assert.deepEqual(h.state().complete,[]);h.advance(1400);assert.deepEqual(h.state().complete,['1_4']);assert.equal(h.b.querySelector('progress'),null);h.event('pointerup');h.advance(2000);assert.deepEqual(h.state().complete,['1_4']);assert.match(h.root.textContent,/진행 효과음 중단/);}finally{h.cleanup();h.dom.window.close();}
});
test('release, web movement, locking, focus loss and cleanup cancel without opening or altering the game',()=>{
 for(const cancel of ['pointerup','pointercancel','pointermove','lock','blur','cleanup']){const h=setup();try{h.event('pointerdown');h.advance(400);if(cancel==='pointermove')h.event(cancel,{clientX:19});else if(cancel==='lock'){h.lock();h.advance(500);}else if(cancel==='blur')h.w.dispatchEvent(new h.w.Event('blur'));else if(cancel==='cleanup')h.cleanup();else h.event(cancel);h.advance(2000);assert.deepEqual(h.state().complete,[],cancel);assert.equal(h.b.querySelector('progress'),null,cancel);assert.ok(h.state().stops>0);}finally{h.cleanup();h.dom.window.close();}}
});
test('keyboard hold uses the same source timer and early key release cancels safely',()=>{
 const h=setup();try{h.event('keydown',{key:'Enter',repeat:false});h.advance(201);h.event('keyup',{key:'Enter'});h.advance(1800);assert.deepEqual(h.state().complete,[]);h.event('keydown',{key:'Enter',repeat:false});h.advance(3200);assert.deepEqual(h.state().complete,['1_4']);}finally{h.cleanup();h.dom.window.close();}
});

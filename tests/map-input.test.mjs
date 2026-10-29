import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountMapInput} from '../src/map-input.mjs';
function setup(){const dom=new JSDOM('<div tabindex="0"><button>Task</button></div>'),w=dom.window,node=w.document.querySelector('div');let view={x:0,y:0,zoom:1.2},locked=false;const commits=[];
 node.getBoundingClientRect=()=>({width:200,height:400});
 const controls=mountMapInput(node,{getView:()=>view,isLocked:()=>locked,onCommit:v=>{view=v;commits.push(v);}});
 const pointer=(type,x,y,target=node)=>{const ev=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(ev,{pointerId:1,button:0,clientX:x,clientY:y});target.dispatchEvent(ev);};
 return {w,node,controls,commits,pointer,view:()=>view,lock:()=>{locked=true;},close(){controls.stop();w.close();}};
}
test('map pointer commits only on release, clamps bounds and ignores buttons and short clicks',()=>{const h=setup();try{
 h.pointer('pointerdown',0,0,h.node.querySelector('button'));h.pointer('pointermove',30,20);h.pointer('pointerup',30,20);assert.equal(h.commits.length,0);
 h.pointer('pointerdown',0,0);h.pointer('pointermove',2,2);h.pointer('pointerup',2,2);assert.equal(h.commits.length,0);
 h.pointer('pointerdown',0,0);h.pointer('pointermove',80,-200);assert.equal(h.controls.isDragging(),true);assert.deepEqual(h.view(),{x:0,y:0,zoom:1.2});assert.equal(h.node.style.getPropertyValue('--scene-pan-x'),'25%');h.pointer('pointerup',80,-200);assert.deepEqual(h.view(),{x:25,y:-25,zoom:1.2});assert.equal(h.commits.length,1);
}finally{h.close();}});
test('cancel and unmount discard transient pan; keyboard is repeatable and obeys locks',()=>{const h=setup();try{
 h.pointer('pointerdown',0,0);h.pointer('pointermove',30,0);h.pointer('pointercancel',30,0);assert.equal(h.node.style.getPropertyValue('--scene-pan-x'),'0%');assert.equal(h.commits.length,0);
 for(let i=0;i<2;i++)h.node.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(h.view().x,10);
 h.lock();h.node.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));h.pointer('pointerdown',0,0);h.pointer('pointermove',40,0);h.pointer('pointerup',40,0);assert.equal(h.commits.length,2);
}finally{h.close();}});
test('lost pointer capture or window blur cancels map preview without saving it',()=>{const h=setup();try{
 for(const reason of ['lostpointercapture','blur']){h.pointer('pointerdown',0,0);h.pointer('pointermove',30,20);if(reason==='blur')h.w.dispatchEvent(new h.w.Event('blur'));else h.pointer(reason,30,20);assert.equal(h.controls.isDragging(),false);assert.equal(h.commits.length,0);assert.deepEqual(h.view(),{x:0,y:0,zoom:1.2});}
}finally{h.close();}});

// Web camera control over a reference image, not original Unity world input.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const interactive='button,a,input,select,textarea,label,.game-map-task,.game-map-top';
export function mountMapInput(node,{getView,isLocked=()=>false,onChange,onCommit}){
 if(!node)return {stop(){},isDragging:()=>false};
 let drag=null;
 const paint=view=>{node.style.setProperty('--scene-pan-x',view.x+'%');node.style.setProperty('--scene-pan-y',view.y+'%');node.style.setProperty('--scene-zoom',view.zoom);onChange?.(view);};
 function stopDrag(cancel=false){
  if(!drag)return;const previous=drag;drag=null;node.classList.remove('camera-dragging');try{node.releasePointerCapture?.(previous.id);}catch{}
  if(cancel&&previous.moved)paint(previous.view);
  else if(previous.moved)onCommit({...previous.preview});
 }
 function down(ev){
  if(drag||ev.button!==0||isLocked()||ev.target.closest?.(interactive))return;
  drag={id:ev.pointerId,x:ev.clientX,y:ev.clientY,view:{...getView()},moved:false};try{node.setPointerCapture?.(ev.pointerId);}catch{}
 }
 function move(ev){
  if(!drag||ev.pointerId!==drag.id)return;
  if(isLocked()){stopDrag(true);return;}
  const dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<7)return;
  ev.preventDefault();drag.moved=true;node.classList.add('camera-dragging');
  const rect=node.getBoundingClientRect();drag.preview={...drag.view,x:clamp(drag.view.x+dx/Math.max(1,rect.width)*100,-25,25),y:clamp(drag.view.y+dy/Math.max(1,rect.height)*100,-25,25)};paint(drag.preview);
 }
 const up=ev=>{if(ev.pointerId===drag?.id)stopDrag(false);};
 const cancel=ev=>{if(ev.pointerId===drag?.id)stopDrag(true);};
 const key=ev=>{
  if(ev.target!==node||isLocked())return;const change={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]}[ev.key];if(!change)return;
  ev.preventDefault();const v=getView(),next={...v,x:clamp(v.x+change[0],-25,25),y:clamp(v.y+change[1],-25,25)};paint(next);onCommit(next);
 };
 node.addEventListener('pointerdown',down);node.addEventListener('pointermove',move,{passive:false});node.addEventListener('pointerup',up);node.addEventListener('pointercancel',cancel);node.addEventListener('keydown',key);
 return {isDragging:()=>Boolean(drag?.moved),stop(){stopDrag(true);node.removeEventListener('pointerdown',down);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',cancel);node.removeEventListener('keydown',key);}};
}

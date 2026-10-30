// Highlight only a uniquely mounted, source-bound web target. Native rectangles
// are never inferred; the geometry below belongs to the current web layout.
export function tutorialFocusTargets(root,view,{validateBinding=()=>true}={}){
 if(!root||!view?.valid||!view.enabled||view.ambiguity)return [];
 return (view.active||[]).flatMap(guide=>{
  const binding=guide.binding;if(binding?.origin!=='verified-web-adapter'||typeof binding.selector!=='string'||!validateBinding(binding))return [];
  let nodes;try{nodes=[...root.querySelectorAll(binding.selector)];}catch{return [];}
  if(nodes.length!==1)return [];const node=nodes[0];if(!node.isConnected)return [];
  return [{id:guide.id,name:guide.name||guide.id,binding,node,strong:guide.strong===true}];
 });
}
export function mountTutorialFocus(root,view,options={}){
 const targets=tutorialFocusTargets(root,view,options);if(!targets.length)return ()=>{};
 const doc=root.ownerDocument,win=doc.defaultView,host=doc.createElement('div');host.className='tutorial-focus-layer';host.dataset.tutorialFocus='web-layout';
 host.setAttribute('aria-label','현재 웹 대상 강조 · 원작 화면 좌표 대조는 별도');
 const originalPosition=root.style.position;if(win.getComputedStyle(root).position==='static')root.style.position='relative';
 let active=true,frame=null;
 const boxes=targets.map(target=>{const ring=doc.createElement('div');ring.className='tutorial-focus-ring';ring.dataset.tutorialFocusGuide=target.id;ring.setAttribute('aria-hidden','true');host.append(ring);return {target,ring};});
 const panels=Array.from({length:4},()=>{const panel=doc.createElement('div');panel.className='tutorial-focus-panel';panel.setAttribute('aria-hidden','true');panel.addEventListener('pointerdown',event=>{event.preventDefault();options.onBlocked?.();});host.append(panel);return panel;});
 root.append(host);
 const setRect=(node,x,y,w,h)=>{node.style.left=x+'px';node.style.top=y+'px';node.style.width=Math.max(0,w)+'px';node.style.height=Math.max(0,h)+'px';};
 function update(){frame=null;if(!active)return;const boundary=root.getBoundingClientRect();let strong=null;
  for(const {target,ring}of boxes){const valid=target.node.isConnected&&root.contains(target.node)&&(!options.validateBinding||options.validateBinding(target.binding));const rect=valid?target.node.getBoundingClientRect():null;
   if(!rect||rect.width<=0||rect.height<=0||boundary.width<=0||boundary.height<=0){ring.hidden=true;continue;}
   ring.hidden=false;const x=Math.max(0,rect.left-boundary.left),y=Math.max(0,rect.top-boundary.top),right=Math.min(boundary.width,rect.right-boundary.left),bottom=Math.min(boundary.height,rect.bottom-boundary.top);setRect(ring,x,y,right-x,bottom-y);
   if(target.strong&&right>x&&bottom>y)strong=strong?false:{x,y,right,bottom};
  }
  const lock=strong&&boxes.filter(x=>x.target.strong&&!x.ring.hidden).length===1;for(const p of panels)p.hidden=!lock;
  if(lock){const {x,y,right,bottom}=strong;setRect(panels[0],0,0,boundary.width,y);setRect(panels[1],0,bottom,boundary.width,boundary.height-bottom);setRect(panels[2],0,y,x,bottom-y);setRect(panels[3],right,y,boundary.width-right,bottom-y);}
 }
 const schedule=()=>{if(active&&frame===null)frame=win.requestAnimationFrame(update);};
 const observer=win.ResizeObserver?new win.ResizeObserver(schedule):null;observer?.observe(root);for(const {target}of boxes)observer?.observe(target.node);win.addEventListener('resize',schedule);doc.addEventListener('scroll',schedule,true);update();
 return ()=>{active=false;if(frame!==null)win.cancelAnimationFrame(frame);observer?.disconnect();win.removeEventListener('resize',schedule);doc.removeEventListener('scroll',schedule,true);host.remove();root.style.position=originalPosition;};
}

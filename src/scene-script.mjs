// A bounded web interpreter of selected packaged scene metadata. It does not
// execute recovered Lua, load original prefabs or fabricate omitted dialogue.
export function sourceScene(data,id){return id==='intro_timeline'?data?.intro:data?.tasks?.find(x=>x.id===id)||null;}
export function sceneSteps(scene){
 if(!scene)return [];
 const groups=new Map();for(const c of scene.commands||[]){const rows=groups.get(c.order)||[];rows.push(c);groups.set(c.order,rows);}
 const steps=[];
 for(const [order,rows]of [...groups].sort((a,b)=>a[0]-b[0])){
  const actors=rows.filter(r=>r.character).map(r=>({name:r.character,action:r.actionName}));
  for(const row of rows){
   if(row.type==='plot'){
    const story=scene.stories?.find(s=>s.id===row.storyId),excerpts=story?.excerpts||[],selected=[...excerpts.map(line=>({at:line.step,kind:'dialogue',line})),...(story?.imageSteps||[]).map(image=>({at:image.step,kind:'illustration',image}))].sort((a,b)=>a.at-b.at);
    let previous=0;
    for(const entry of selected){if(entry.at>previous+1)steps.push({kind:'omitted-dialogue',order,storyId:row.storyId,remaining:entry.at-previous-1,actors,sourceRef:row.sourceRef});steps.push({...entry,order,sourceRef:row.sourceRef,storyId:row.storyId,actors});previous=entry.at;}
    if(!selected.length||(story?.stepCount||0)>previous)steps.push({kind:'omitted-dialogue',order,storyId:row.storyId,remaining:Math.max(0,(story?.stepCount||0)-previous),actors,sourceRef:row.sourceRef});
   }else if(['playersChoices','changeChoice'].includes(row.type))steps.push({kind:'choice',order,slotId:row.slotId,variants:row.variants||[],sourceRef:row.sourceRef,actors});
   else if(row.type==='cameraMove')steps.push({kind:'camera',order,camera:row.camera,sourceRef:row.sourceRef,actors});
   else if(row.type==='showMask')steps.push({kind:'mask',order,mask:row.mask,sourceRef:row.sourceRef,actors});
   else if(row.type==='timelineEnd')steps.push({kind:'end',order,camera:row.camera,sourceRef:row.sourceRef,actors});
   else if(!['roleAction','roleActionlist','waitAction','roleAppear'].includes(row.type))steps.push({kind:'cue',order,type:row.type,sourceRef:row.sourceRef,actors});
  }
 }
 return steps;
}
export function sceneCursor(task,scene){
 const steps=sceneSteps(scene);
 if(!task.script||task.script.sceneId!==scene.id)task.script={sceneId:scene.id,index:0,choices:{}};
 const p=task.script;p.index=Number.isInteger(p.index)?Math.max(0,Math.min(p.index,Math.max(0,steps.length-1))):0;
 if(!p.choices||typeof p.choices!=='object'||Array.isArray(p.choices))p.choices={};
 const allowed=new Map(steps.filter(x=>x.kind==='choice').map(x=>[x.slotId,new Set(x.variants.map(v=>v.id))]));
 p.choices=Object.fromEntries(Object.entries(p.choices).filter(([key,value])=>allowed.get(key)?.has(value)));
 const missing=steps.findIndex((step,i)=>i<p.index&&step.kind==='choice'&&!p.choices[step.slotId]);if(missing>=0)p.index=missing;
 return {steps,index:p.index,step:steps[p.index],choices:p.choices};
}
export function chooseSceneVariant(task,scene,variant){
 const c=sceneCursor(task,scene),step=c.step;
 if(step?.kind!=='choice'||!step.variants.some(v=>v.id===variant))return false;
 task.script.choices[step.slotId]=variant;return true;
}
export function advanceScene(task,scene){
 const c=sceneCursor(task,scene);if(!c.step||c.step.kind==='choice'&&!c.choices[c.step.slotId])return false;
 if(c.index<c.steps.length-1){task.script.index++;return true;}return false;
}
export function canCommitScene(task,scene){
 const c=sceneCursor(task,scene);return c.step?.kind==='end'&&c.steps.filter(x=>x.kind==='choice').every(x=>c.choices[x.slotId]);
}
export function commitSceneChoices(flow,task,scene){
 if(!canCommitScene(task,scene))return false;
 flow.decor=Object.fromEntries(Object.entries({...flow.decor,...task.script.choices}).filter(([key,value])=>/^\d+_\d+$/.test(key)&&['1','2','3'].includes(value)));return true;
}
export function webCamera(camera){
 const from=camera?.from,to=camera?.pos;if(!Array.isArray(to)||!to.every(Number.isFinite))return {x:0,y:0,zoom:1};
 // An explicitly schematic projection; world-to-screen geometry is not known.
 const x=Math.max(-12,Math.min(12,(to[0]-(from?.[0]??to[0]))*.04)),y=Math.max(-12,Math.min(12,(to[2]-(from?.[2]??to[2]))*.025));
 const zoom=from?.[1]>0&&to[1]>0?Math.max(1,Math.min(1.25,from[1]/to[1])):1;
 return {x,y,zoom};
}

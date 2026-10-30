/* Source-derived reduced-frame compositor. Never executes recovered game code. */
const indexes = new WeakMap();
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function index(data) {
  if (!indexes.has(data)) indexes.set(data, {
    motions: new Map(data.motions.map(x => [x.motionKey, x])),
    roles: new Map(data.roles.map(x => [x.id, x])),
    scenes: new Map(data.scenes.map(x => [x.id, x])),
    sprites: new Map([...data.recap.sprites, ...data.CG.sprites].map(x => [x.id, x])),
    clips: new Map(data.audio.clips.map(x => [x.id, x])),
  });
  return indexes.get(data);
}

export function sourceFrameAt(motion, seconds, loop = false) {
  if (!motion) return null;
  let t = Math.max(0, finite(seconds));
  if (loop && motion.duration > 0) t %= motion.duration;
  else t = Math.min(t, motion.duration);
  let lo = 0, hi = motion.times.length - 1;
  while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (motion.times[m] <= t + 1e-8) lo = m; else hi = m - 1; }
  const sheet = motion.sheets.find(x => lo >= x.startFrame && lo < x.startFrame + x.frameCount);
  if (!sheet) return null;
  const local = lo - sheet.startFrame;
  return {motion, sheet, frame: lo, sourceTime: motion.times[lo], x: local % sheet.columns * sheet.frameSize, y: Math.floor(local / sheet.columns) * sheet.frameSize, size: sheet.frameSize, requestedTime: t};
}

function qrotate([x,y,z], q) {
  const [a,b,c,w] = q, tx = 2*(b*z-c*y), ty = 2*(c*x-a*z), tz = 2*(a*y-b*x);
  return [x+w*tx+b*tz-c*ty, y+w*ty+c*tx-a*tz, z+w*tz+a*ty-b*tx];
}
function applyTRS(point, trs) {
  const p = qrotate(point.map((v,i) => v*finite(trs.scale?.[i],1)), trs.rotation || [0,0,0,1]);
  return p.map((v,i) => v+finite(trs.position?.[i]));
}
/** Unity source hierarchy, SkeletonData.scale and Role:SetFlip override, in world units. */
export function sourceRolePoint(data, roleId, directive, rawPoint) {
  const role = index(data).roles.get(roleId);
  if (!role) return null;
  let p = [rawPoint[0]*role.skeletonScale, rawPoint[1]*role.skeletonScale, finite(rawPoint[2])*role.skeletonScale];
  for (let i=role.sourceChain.length-1;i>=0;i--) {
    const trs = {...role.sourceChain[i].trs};
    if (i === role.sourceChain.length-1 && typeof directive.flip === 'boolean') trs.rotation = directive.flip ? [0,1,0,0] : [0,0,0,1];
    if (i === 0) { if (directive.position) trs.position = directive.position; if (directive.scale != null) trs.scale = Array.isArray(directive.scale) ? directive.scale : [directive.scale,directive.scale,directive.scale]; }
    p = applyTRS(p, trs);
  }
  return p;
}
function seededChoice(key, length, seed = 42) {
  let v = (finite(seed,42) >>> 0) ^ 2166136261;
  for (const c of String(key)) { v ^= c.charCodeAt(0); v = Math.imul(v,16777619); }
  return length ? (v >>> 0) % length : 0;
}
function pickCue(cue, prior, seed, choices = {}) {
  const actionIndex = clamp(choices[cue.id]?.action ?? seededChoice(cue.id+':action', cue.actions.length, seed),0,Math.max(0,cue.actions.length-1));
  const posIndex = clamp(choices[cue.id]?.position ?? seededChoice(cue.id+':pos', cue.positions.length, seed),0,Math.max(0,cue.positions.length-1));
  return {cue, action: cue.actions[actionIndex], actionIndex, posIndex, position: cue.positions[posIndex] || prior?.position || [0,2000,0], previousPosition: prior?.position || [0,2000,0], flip: typeof cue.flip === 'boolean' ? cue.flip : prior?.flip, scale: cue.scale ?? prior?.scale ?? 1, randomized: cue.actions.length>1 && cue.type!=='roleActionlist' || cue.positions.length>1};
}
function resolveActorMotion(data, actor, elapsed) {
  const {cue,action} = actor, motions = index(data).motions;
  const waiting = elapsed < Math.max(0,finite(cue.delay));
  const t = Math.max(0, elapsed - finite(cue.delay));
  let key = action?.motionId, time = t, loop = !!cue.declaredLoop, compatible = false;
  let position = actor.position;
  if (waiting && cue.type === 'roleAppear') { position = actor.previousPosition; time = 0; loop = false; }
  else if (waiting && cue.delayBehavior === 'idle-before-delay') { key = `role:${cue.role}:${cue.role}_idle`; if (!motions.has(key)) key = `map:${cue.role}:${cue.role}_idle`; time = elapsed; loop = true; }
  else if (cue.type === 'roleActionlist') {
    const queueId = cue.role+':'+cue.actions.map(a => a.name+'#'+String(a.delay)).join(',');
    key = `queue:${cue.role}:${queueId}`; loop = false; compatible = true;
  } else {
    const motion = motions.get(key), next = action?.codeDerivedNext;
    if (motion && next?.motionId && t >= motion.duration) {
      const mixKey = `mix:${cue.role}:${action.name}>${next.name}`, mix = motions.get(mixKey), age = t-motion.duration;
      if (mix && age < mix.duration) { key = mixKey; time = age; loop = false; compatible = true; }
      else { key = next.motionId; time = age; loop = true; }
    }
  }
  const motion = motions.get(key), frame = sourceFrameAt(motion,time,loop);
  return {...actor, position, elapsed, localTime: time, waiting, loop, compatible, motionKey:key, frame, missing:!frame, researchRandomChoice:actor.randomized};
}

/** Stateless projection for restored cursors. Prior directive ages are explicitly unknown. */
export function sourceMapActors(data, {scene, order, time = 0, seed = 42, choices = {}, directiveTimes = {}} = {}) {
  const spec = index(data).scenes.get(scene);
  if (!spec) return [];
  const states = new Map();
  for (const cue of spec.cues.filter(c => c.order <= finite(order,Infinity))) {
    const prior=states.get(cue.role), actor=pickCue(cue,prior,seed,choices);
    actor.elapsed = directiveTimes[cue.id] ?? (cue.order === Number(order) ? time : 0);
    actor.clockKnown = directiveTimes[cue.id] != null || cue.order === Number(order);
    states.set(cue.role,actor);
  }
  return [...states.values()].map(a => resolveActorMotion(data,a,a.elapsed));
}

const I2 = [1,0,0,1,0,0];
function mul2(a,b) { return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]; }
function point2(m,x,y) { return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]; }
/** Canvas reference RectTransform solver, pivot/anchors/native sibling order preserved. */
export function sourceUILayout(prefab, reference = [1080,1920], overrides = {}) {
  const layouts = new Map();
  for (const node of prefab.nodes) {
    const r=node.rect, parent=layouts.get(node.parent), parentSize=parent?.size || reference, parentPivot=parent?.pivot || [0,0];
    const size = [0,1].map(i => parentSize[i]*(r.m_AnchorMax[i]-r.m_AnchorMin[i])+r.m_SizeDelta[i]);
    const pivot=r.m_Pivot, pos=[0,1].map(i => -parentSize[i]*parentPivot[i]+parentSize[i]*(r.m_AnchorMin[i]+(r.m_AnchorMax[i]-r.m_AnchorMin[i])*pivot[i])+r.m_AnchoredPosition[i]);
    const q=r.m_LocalRotation, angle=2*Math.atan2(q[2],q[3]), c=Math.cos(angle),s=Math.sin(angle), scale=r.m_LocalScale, custom=overrides[node.path] || {};
    const m=[c*scale[0],s*scale[0],-s*scale[1],c*scale[1],pos[0],pos[1]];
    if (custom.scale != null) {m[0]*=custom.scale;m[1]*=custom.scale;m[2]*=custom.scale;m[3]*=custom.scale;}
    const matrix=mul2(parent?.matrix||I2,m);
    layouts.set(node.path,{node,path:node.path,size,pivot,matrix,alpha:(parent?.alpha??1)*node.canvasAlpha*(custom.alpha??1),active:(parent?.active??true)&&(custom.active??node.serializedActive)});
  }
  return layouts;
}

export function sourceCGActors(data, {scene = 'cg-scene1', phase, time = 0} = {}) {
  const prefab=data.CG.prefabs.find(x => x.sceneId===scene); if(!prefab)return [];
  const method=data.CG.phases.find(x => x.scene===scene&&x.id===phase), commands=method?.commands||[];
  return prefab.spines.map(n => {
    const command=commands.find(c=>c.nodePath===n.path); let key=command?.motionKey || (n.startingAnimation ? `cg:${n.role}:${n.startingAnimation}` : null), t=time, loop=command ? command.loop : n.startingLoop;
    const first=index(data).motions.get(key);
    if(command?.afterMotionKey&&first&&t>=first.duration){key=command.afterMotionKey;t-=first.duration;loop=true;}
    return {...n,motionKey:key,frame:sourceFrameAt(index(data).motions.get(key),t,loop),commandSource:command?'exact-native-field-and-SetAnimation':'serialized-component-startingAnimation',blankStartingAnimation:!command&&!n.startingAnimation,sourcePhase:method?.nativeMethodIndex};
  });
}
function recapActors(data, options) {
  const t=Math.max(0,finite(options.time)), out=[];
  if(options.recapView==='book') {
    const dir=options.action;
    // Fresh/reconnected books never invent a page-turn event.
    if(dir!=='nextPage'&&dir!=='lastPage')return out;
    const start=dir==='nextPage'?.1:0;
    if(t<start)return out;
    const key=`StoryRecapBookContentWindow:m_rollPageSpine:${dir}`,motion=index(data).motions.get(key);
    if(t-start>finite(motion?.duration))return out;
    out.push({binding:data.recap.bindings.find(b=>b.field==='m_rollPageSpine'),frame:sourceFrameAt(motion,t-start)});
  } else if(options.recapOpened===true) {
    // Source PlayStartAni schedules the Lily queue at 0.4s. Queue calculation is compatible JS, not native C# observation.
    if(t<.4)return out;
    for(const field of ['m_avatarBodySpine','m_avatarHandSpine']) {
      const suffix=field==='m_avatarHandSpine'?'2':'',from=`Lily_story_finished${suffix}`,to=`Lily_story_finished_repeat${suffix}`;
      const queued=index(data).motions.get(`recap-queue:${field}:${from}>${to}`),local=t-.4;
      let frame;
      if(queued&&local<queued.duration)frame=sourceFrameAt(queued,local);
      else frame=sourceFrameAt(index(data).motions.get(`StoryRecapMainWindow:${field}:${to}`),Math.max(0,local-(queued?.metadata?.compatibleLoopStart??.6)),true);
      out.push({binding:data.recap.bindings.find(b=>b.field===field),frame,compatibleQueue:true});
    }
  }
  return out;
}

export function sourceAudioCue(data,event,{id,ignoreAudioEffect=false,bgmSwitchOpen,mapExploreOverride=false}={}) {
  if(event==='dialogue-cell-ready'&&ignoreAudioEffect)return null;
  if(event==='mode-map'&&mapExploreOverride)return null;
  if(event==='mode-main') { if(bgmSwitchOpen===true)event='mode-main';else if(bgmSwitchOpen===false)event='mode-main-switch-closed';else return null; }
  const route=data.audio.routes.find(x=>x.event===event),clip=route&&index(data).clips.get(route.clip);
  return clip?{id:id||event,event,name:clip.id,clip:clip.media,sourceDuration:clip.sourceDuration,sourceRange:clip.sourceRange,isMusicExcerpt:clip.isMusicExcerpt,isSelectedExcerpt:clip.isSelectedExcerpt,sourceLoopDeclared:route.sourceLoopDeclared??clip.sourceLoopDeclared,loop:false,route,originalGameSyncVerified:false}:null;
}

/** A bounded native-UI/alpha-source stage that can be embedded in actual simulator panels. */
export function renderSourceSceneStage(data, options = {}) {
  const mode=['map','recap','cg'].includes(options.mode)?options.mode:'map', scene=options.scene||data.scenes[0]?.id, spec=index(data).scenes.get(scene);
  return `<section class="source-scene-stage" data-source-scene-stage data-mode="${escape(mode)}"><div class="source-scene-stage__heading"><h3>${mode==='map'?'원본 좌표 캐릭터 무대':mode==='recap'?'회상책 원본 레이어 합성':'인트로 원본 명령 합성'}</h3><span>${mode==='map'?'원본 TRS · 연구용 투영':'원본 UI 계층 · 연구용 캔버스'}</span></div><div class="source-scene-stage__viewport"><canvas width="540" height="960" role="img" aria-label="원본 자료로 구성한 투명 캐릭터와 UI 레이어 합성 화면"></canvas><div class="source-scene-stage__content" data-source-stage-content></div><p class="source-scene-stage__loading" role="status">원본 모션 불러오는 중…</p></div><div class="source-scene-stage__controls"><button type="button" data-stage-play>${options.playing===false?'재생':'일시정지'}</button><button type="button" data-stage-restart>동작 처음부터</button><label>동작 시간 <input type="range" data-stage-time min="0" max="12" step="0.025" value="0" aria-label="원본 동작 시간"></label><output data-stage-time-label>0.00초</output>${mode==='cg'?`<label>확인된 원본 명령 <select data-stage-phase><option value="">프리팹 초기값만</option>${data.CG.phases.filter(x=>x.scene===scene).map(p=>`<option value="${escape(p.id)}" ${p.id===options.phase?'selected':''}>${escape(p.label)}</option>`).join('')}</select></label>`:''}${mode==='map'&&spec?`<label>원본 순서 <select data-stage-order>${spec.orders.map(n=>`<option ${n===options.order?'selected':''}>${n}</option>`).join('')}</select></label>`:''}<button type="button" data-stage-mute aria-pressed="true">음소거</button></div><p class="source-scene-stage__status" data-stage-status aria-live="polite"></p><details><summary>이 화면의 확인 범위</summary><p>투명 원본 프레임을 같은 무대에 합성합니다. 캐릭터 좌표·크기·반전·계층과 UI 레이어는 APK 원본값입니다. 랜덤 분기와 캔버스 투영은 연구값이며, 원작 셰이더·3D 가림·동적 카메라·음향 동기화는 실기 검증하지 않았습니다. 원본 지연·반복과 호환 런타임 큐 계산을 구분합니다.</p></details></section>`;
}

function triangle(ctx,image,src,dst) {
  const [a,b,c]=src,[u,v,w]=dst,det=a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]);
  if(Math.abs(det)<1e-9)return;
  const solve=values=>[(values[0]*(b[1]-c[1])+values[1]*(c[1]-a[1])+values[2]*(a[1]-b[1]))/det,(values[0]*(c[0]-b[0])+values[1]*(a[0]-c[0])+values[2]*(b[0]-a[0]))/det,(values[0]*(b[0]*c[1]-c[0]*b[1])+values[1]*(c[0]*a[1]-a[0]*c[1])+values[2]*(a[0]*b[1]-b[0]*a[1]))/det];
  const x=solve([u[0],v[0],w[0]]),y=solve([u[1],v[1],w[1]]);
  ctx.save();ctx.beginPath();ctx.moveTo(...u);ctx.lineTo(...v);ctx.lineTo(...w);ctx.closePath();ctx.clip();ctx.transform(x[0],y[0],x[1],y[1],x[2],y[2]);ctx.drawImage(image,0,0);ctx.restore();
}
function paintWarp(ctx,image,frame,project,subdivisions=1) {
  const n=subdivisions,size=frame.size;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
    const tile=[[x*size/n,y*size/n],[(x+1)*size/n,y*size/n],[(x+1)*size/n,(y+1)*size/n],[x*size/n,(y+1)*size/n]],dst=tile.map(p=>project(...p));
    if(dst.some(p=>!p||p.visible===false||!Number.isFinite(p.x)||!Number.isFinite(p.y)))continue;
    const src=tile.map(p=>[p[0]+frame.x,p[1]+frame.y]),points=dst.map(p=>[p.x,p.y]);
    triangle(ctx,image,[src[0],src[1],src[2]],[points[0],points[1],points[2]]);triangle(ctx,image,[src[0],src[2],src[3]],[points[0],points[2],points[3]]);
  }
}
function rawPoint(motion,x,y) { const a=motion.pixelToSkeleton;return [a[0][0]*x+a[0][1]*y+a[0][2],a[1][0]*x+a[1][1]*y+a[1][2],0]; }
function sourceBounds(data,sceneId) {
  const scene=index(data).scenes.get(sceneId),points=[];
  for(const cue of scene?.cues||[])for(const position of cue.positions) {
    if(Math.abs(position[1])>1000)continue;
    for(const action of cue.actions) {
      const motion=index(data).motions.get(action.motionId);if(!motion)continue;
      const b=motion.bounds;
      for(const [x,y]of [[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]])points.push(sourceRolePoint(data,cue.role,{position,scale:cue.scale,flip:cue.flip},[x,y,0]));
    }
  }
  // Explicit research isometric screen basis. Never changes the preserved world values.
  const flattened=points.map(p=>[p[0],p[1]*.8+p[2]*.6]);
  const xs=flattened.map(p=>p[0]),ys=flattened.map(p=>p[1]);
  return xs.length?[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]:[-20,-20,20,20];
}
function orthoProject(bounds,w,h) {
  const cx=(bounds[0]+bounds[2])/2,cy=(bounds[1]+bounds[3])/2,scale=Math.min((w-48)/Math.max(1,bounds[2]-bounds[0]),(h-100)/Math.max(1,bounds[3]-bounds[1]));
  return p=>({x:w/2+(p[0]-cx)*scale,y:h/2-(p[1]*.8+p[2]*.6-cy)*scale,depth:p[2],visible:Math.abs(p[1])<1000});
}
function nineSlice(ctx,image,sprite,width,height,fillCenter=true) {
  const [l,b,r,t]=sprite.border,logical=sprite.sourceRect,sx=image.width/logical[0],sy=image.height/logical[1],dx=Math.min(1,width/Math.max(1,l+r)),dy=Math.min(1,height/Math.max(1,t+b));
  const xx=[0,l*sx,image.width-r*sx,image.width],yy=[0,t*sy,image.height-b*sy,image.height],tx=[0,l*dx,width-r*dx,width],ty=[0,t*dy,height-b*dy,height];
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){if(!fillCenter&&x===1&&y===1)continue;const sw=xx[x+1]-xx[x],sh=yy[y+1]-yy[y],dw=tx[x+1]-tx[x],dh=ty[y+1]-ty[y];if(sw>0&&sh>0&&dw>0&&dh>0)ctx.drawImage(image,xx[x],yy[y],sw,sh,tx[x],ty[y],dw,dh);}
}

export function createSourceSceneStage(data, injected = {}) {
  let host,canvas,ctx,options={},raf=0,running=false,disposed=false,elapsed=0,last=0,sceneKey='',orderKey=null,muted=true,painting=false,paintAgain=false,generation=0,lastPaintAt=0;
  const images=new Map(),pending=new Map(),failed=new Set(),directives=new Map(),seenAudio=new Set(),tints=new Map();
  const ImageClass=injected.Image||globalThis.Image, now=injected.now||(()=>performance.now()), request=injected.requestAnimationFrame||globalThis.requestAnimationFrame?.bind(globalThis), cancel=injected.cancelAnimationFrame||globalThis.cancelAnimationFrame?.bind(globalThis);
  const emit=(event,meta={})=>{const cue=sourceAudioCue(data,event,meta);if(!cue||seenAudio.has(cue.id))return;seenAudio.add(cue.id);if(!muted)injected.onAudio?.(cue);};
  const load=src=>{
    if(images.has(src)){const im=images.get(src);images.delete(src);images.set(src,im);return Promise.resolve(im);}
    if(failed.has(src))return Promise.resolve(null);if(pending.has(src))return pending.get(src);
    const born=generation,promise=new Promise(resolve=>{const im=new ImageClass();im.onload=()=>{pending.delete(src);if(disposed||born!==generation)return resolve(null);images.set(src,im);while(images.size>48){const key=images.keys().next().value;images.delete(key);}resolve(im);};im.onerror=()=>{pending.delete(src);if(born===generation)failed.add(src);resolve(null);};im.src=src;});pending.set(src,promise);return promise;
  };
  function tinted(image,src,color){
    if(color.slice(0,3).every(c=>c===1))return image;
    const key=src+':'+color.slice(0,3).join(',');if(tints.has(key))return tints.get(key);
    const surface=host.ownerDocument.createElement('canvas');surface.width=image.width;surface.height=image.height;const c=surface.getContext('2d');c.drawImage(image,0,0);c.globalCompositeOperation='multiply';c.fillStyle=`rgb(${color.slice(0,3).map(v=>Math.round(v*255)).join(',')})`;c.fillRect(0,0,surface.width,surface.height);c.globalCompositeOperation='destination-in';c.drawImage(image,0,0);tints.set(key,surface);while(tints.size>12)tints.delete(tints.keys().next().value);return surface;
  }
  function reconcile(next) {
    const hasTime=Object.prototype.hasOwnProperty.call(next,'time');
    next={...options,...next};
    if(next.mode==='map'||!next.mode)next.order=next.order??index(data).scenes.get(next.scene)?.orders[0];
    const mode=next.mode||'map',key=mode+':'+(next.scene||'')+':'+(mode==='recap'?(next.recapView||'main')+':'+(next.eventId||next.action||''):mode==='cg'?(next.phase||''):'');
    if(sceneKey!==key){sceneKey=key;elapsed=hasTime?Math.max(0,finite(next.time)):0;directives.clear();orderKey=null;seenAudio.clear();}
    options={...options,...next,mode};
    if(mode==='map'&&orderKey!==Number(options.order)) {
      const scene=index(data).scenes.get(options.scene),first=orderKey==null||Number(options.order)<orderKey;
      if(first)directives.clear();
      for(const cue of scene?.cues||[]) {
        if(first?cue.order>Number(options.order):cue.order!==Number(options.order))continue;
        const prior=directives.get(cue.role),actor=pickCue(cue,prior,options.seed??42,options.choices||{});
        actor.start=elapsed;actor.clockKnown=cue.order===Number(options.order);directives.set(cue.role,actor);
      }
      orderKey=Number(options.order);
    }
    if(hasTime)elapsed=Math.max(0,finite(next.time));
    if(next.muted!=null)muted=!!next.muted;
    if(next.playing!=null)running=!!next.playing;
    last=now();
  }
  function actors() {return [...directives.values()].map(a=>resolveActorMotion(data,a,Math.max(0,elapsed-a.start)));}
  async function paintMap(w,h,epoch) {
    const source=actors(),world=injected.projectWorld||options.projectWorld,project=world?(p=>world(p,{scene:options.scene,width:w,height:h})):orthoProject(sourceBounds(data,options.scene),w,h);
    const background=options.background||injected.background;
    for(const layer of [background,...(background?.layers||[])]){if(!layer?.src)continue;const im=await load(layer.src);if(epoch!==generation||disposed)return '';if(im)ctx.drawImage(im,0,0,w,h);}
    const sorted=source.map(a=>({...a,depth:project(a.position)?.depth??a.position[2]})).sort((a,b)=>b.depth-a.depth);
    for(const a of sorted) {
      if(!a.frame)continue;const im=await load(a.frame.sheet.src);if(epoch!==generation||disposed)return '';if(!im)continue;
      paintWarp(ctx,im,a.frame,(x,y)=>project(sourceRolePoint(data,a.cue.role,a,rawPoint(a.frame.motion,x,y))),world?6:1);
    }
    const visible=source.filter(a=>a.frame&&!a.waiting).map(a=>a.cue.role);
    return `${world?'선택한 원본 카메라 · 9:16 연구 화면':'연구용 정사영 · 원본 월드 좌표 유지'} / ${visible.join(' · ')||'이 순서에 노출되는 역할 없음'}${source.some(a=>!a.clockKnown)?' / 이전 순서의 시작 시각 미확인':''}${source.some(a=>a.researchRandomChoice)?' / 다중 후보: 연구 시드 '+(options.seed??42):''}${source.some(a=>a.compatible)?' / 큐·혼합: 호환 Spine 3.8 계산':''}${source.some(a=>a.missing)?' / 일부 지연 idle 또는 모션 파생 미확보':''}`;
  }
  async function paintUI(w,h,epoch) {
    const isCG=options.mode==='cg',group=isCG?data.CG:data.recap;
    const prefab=isCG?group.prefabs.find(p=>p.sceneId===options.scene):group.prefabs.find(p=>p.id===(options.recapView==='book'?'StoryRecapBookContentWindow':'StoryRecapMainWindow'));
    if(!prefab)return '이 UI의 원본 레이어가 없습니다.';
    const phase=isCG?data.CG.phases.find(p=>p.scene===options.scene&&p.id===options.phase):null;
    const overrides=Object.fromEntries((phase?.visibility||[]).map(x=>[x.path,{active:x.active}]));
    const layouts=sourceUILayout(prefab,group.referenceCanvas,overrides),[rw,rh]=group.referenceCanvas;
    const drawables=isCG?sourceCGActors(data,{...options,time:elapsed}):recapActors(data,{...options,time:elapsed});
    const byPath=new Map(drawables.filter(a=>a.frame).map(a=>[a.path||a.binding.nodePath,a]));
    const scale=Math.min(w/rw,h/rh),ox=(w-rw*scale)/2,oy=(h-rh*scale)/2;
    const toScreen=(l,x,y)=>{const p=point2(l.matrix,x,y);return {x:ox+p[0]*scale,y:oy+(rh-p[1])*scale,visible:true};};
    const byParent=new Map();for(const l of layouts.values()){const k=l.node.parent||'';if(!byParent.has(k))byParent.set(k,[]);byParent.get(k).push(l);}
    async function visit(l) {
      if(!l.active||epoch!==generation||disposed)return;ctx.save();ctx.globalAlpha=l.alpha;
      const [lw,lh]=l.size,[px,py]=l.pivot,rect=[-lw*px,-lh*py,lw,lh];
      if(l.node.masks.length){const corners=[[rect[0],rect[1]],[rect[0]+lw,rect[1]],[rect[0]+lw,rect[1]+lh],[rect[0],rect[1]+lh]].map(p=>toScreen(l,...p));ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();}
      for(const image of l.node.images){
        if(!image.enabled||image.color[3]<=0)continue;const sprite=index(data).sprites.get(image.spriteId),im=sprite&&await load(sprite.media.src);if(epoch!==generation||disposed)return;if(!im)continue;
        const m=l.matrix,draw=tinted(im,sprite.media.src,image.color);ctx.save();ctx.globalAlpha=l.alpha*image.color[3];ctx.transform(m[0]*scale,-m[1]*scale,-m[2]*scale,m[3]*scale,ox+(m[4]+m[2]*(rect[1]+lh))*scale,oy+(rh-m[5]-m[3]*(rect[1]+lh))*scale);ctx.translate(rect[0],0);
        if(image.imageType===1)nineSlice(ctx,draw,sprite,lw,lh,image.fillCenter);else if(image.imageType===2){const sx=sprite.sourceRect[0]/draw.width,sy=sprite.sourceRect[1]/draw.height;ctx.scale(sx,sy);ctx.fillStyle=ctx.createPattern(draw,'repeat');ctx.fillRect(0,0,lw/sx,lh/sy);}else if(image.imageType===0){if(image.preserveAspect){const s=Math.min(lw/draw.width,lh/draw.height);ctx.drawImage(draw,(lw-draw.width*s)/2,(lh-draw.height*s)/2,draw.width*s,draw.height*s);}else ctx.drawImage(draw,0,0,lw,lh);}ctx.restore();
      }
      const a=byPath.get(l.path);if(a?.frame){const im=await load(a.frame.sheet.src);if(epoch!==generation||disposed)return;if(im)paintWarp(ctx,im,a.frame,(x,y)=>{const raw=rawPoint(a.frame.motion,x,y),sk=a.binding?.skeletonScale??a.skeletonScale??1,flipX=!a.componentInitialFlipApplied&&a.componentSettings?.initialFlipX,flipY=!a.componentInitialFlipApplied&&a.componentSettings?.initialFlipY;return toScreen(l,raw[0]*sk*(flipX?-1:1),raw[1]*sk*(flipY?-1:1));});}
      for(const child of (byParent.get(l.path)||[]).sort((a,b)=>a.node.siblingOrder-b.node.siblingOrder))await visit(child);
      ctx.restore();
    }
    for(const root of byParent.get('')||[])await visit(root);
    if(epoch!==generation||disposed)return '';
    const contentTarget=data.recap.bindingTargets.find(x=>x.prefab===prefab.id&&x.field==='m_ContentRectTrans'),contentLayout=contentTarget&&[...layouts.values()].find(x=>x.node.transformSource.pathId===contentTarget.target.pathId);
    const content=host.querySelector('[data-source-stage-content]');if(content){content.hidden=!contentLayout;if(contentLayout){const l=contentLayout,p=toScreen(l,-l.size[0]*l.pivot[0],l.size[1]*(1-l.pivot[1]));content.style.cssText=`left:${100*p.x/w}%;top:${100*p.y/h}%;width:${100*l.size[0]*scale/w}%;height:${100*l.size[1]*scale/h}%;`;injected.onContentRect?.({x:p.x,y:p.y,width:l.size[0]*scale,height:l.size[1]*scale,referenceCanvas:group.referenceCanvas,sourceTarget:contentTarget.target});}}
    return isCG?`원본 UI ${prefab.nodes.length}개 노드 / ${options.phase?'정확 명령: '+options.phase:'직렬화 초기값만 재생'} / 빈 시작값 ${drawables.filter(x=>x.blankStartingAnimation).length}개는 임의 idle 없이 유지 / CG 전체 전환·분기 미재현`:`원본 UI 계층 · 하드 직사각 마스크 / ${options.recapView==='book'?(options.action?'실제 페이지 넘김 이벤트 '+options.action:'새 책: 페이지 넘김 없음'):'0.4초 후 Lily 몸·손 큐 합성'} / 원작 셰이더·소프트 마스크·동적 레이아웃 미검증`;
  }
  async function paint() {
    if(disposed||!ctx)return;if(painting){paintAgain=true;return;}painting=true;
    const epoch=generation;try {
      const w=canvas.width,h=canvas.height;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle='#edf1ea';ctx.fillRect(0,0,w,h);
      const status=options.mode==='map'?await paintMap(w,h,epoch):await paintUI(w,h,epoch);
      if(!disposed&&epoch===generation&&host){host.querySelector('[data-stage-status]').textContent=failed.size?status+' / 자료 일부 로드 실패: 다시 열어주세요.':status;host.querySelector('.source-scene-stage__loading').hidden=true;const output=host.querySelector('[data-stage-time-label]');if(output)output.textContent=elapsed.toFixed(2)+'초';const range=host.querySelector('[data-stage-time]');if(range&&host.ownerDocument.activeElement!==range){range.max=String(Math.max(12,Math.ceil(elapsed)));range.value=String(elapsed);}const play=host.querySelector('[data-stage-play]');if(play)play.textContent=running?'일시정지':'재생';const mute=host.querySelector('[data-stage-mute]');if(mute){mute.textContent=muted?'음소거':'음향 켜짐';mute.setAttribute('aria-pressed',String(muted));}const order=host.querySelector('[data-stage-order]');if(order)order.value=String(options.order);const phase=host.querySelector('[data-stage-phase]');if(phase)phase.value=options.phase||'';}
    } finally {painting=false;if(paintAgain&&!disposed){paintAgain=false;void paint();}}
  }
  function tick(t) {raf=0;if(disposed||!host)return;const dt=Math.max(0,Math.min(.25,(t-last)/1000));last=t;if(running&&!host.ownerDocument.hidden){elapsed+=dt;if(t-lastPaintAt>=1000/8){lastPaintAt=t;void paint();}}if(request)raf=request(tick);}
  const click=e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-stage-play')){running=!running;b.textContent=running?'일시정지':'재생';injected.onPlayingChange?.(running);injected.audioControl?.(running?'resume':'pause');}if(b.hasAttribute('data-stage-restart')){elapsed=0;for(const a of directives.values())a.start=0;seenAudio.clear();void paint();}if(b.hasAttribute('data-stage-mute')){muted=!muted;b.setAttribute('aria-pressed',String(muted));b.textContent=muted?'음소거':'음향 켜짐';injected.audioControl?.(muted?'mute':'unmute');}};
  const input=e=>{if(e.target.hasAttribute('data-stage-time')){elapsed=finite(e.target.value);for(const a of directives.values())a.start=0;void paint();}};
  const change=e=>{if(e.target.hasAttribute('data-stage-phase')){reconcile({...options,phase:e.target.value,time:0});emit('cg:'+options.scene+':'+options.phase,{id:'manual-phase:'+sceneKey+':'+now()});void paint();}if(e.target.hasAttribute('data-stage-order')){reconcile({...options,order:Number(e.target.value)});void paint();}};
  const visibility=()=>{last=now();if(host?.ownerDocument.hidden)injected.audioControl?.('pause');else if(running)injected.audioControl?.('resume');};
  function cleanup(){disposed=true;generation++;if(raf&&cancel)cancel(raf);raf=0;if(host){host.removeEventListener('click',click);host.removeEventListener('input',input);host.removeEventListener('change',change);host.ownerDocument.removeEventListener('visibilitychange',visibility);}for(const im of images.values())if(typeof im.close==='function')im.close();images.clear();tints.clear();pending.clear();failed.clear();injected.audioControl?.('pause');host=canvas=ctx=null;}
  return {
    render:props=>renderSourceSceneStage(data,props),
    mount(root,props={}){
      cleanup();disposed=false;host=root.matches?.('[data-source-scene-stage]')?root:root.querySelector('[data-source-scene-stage]');if(!host)return;canvas=host.querySelector('canvas');ctx=canvas.getContext('2d');sceneKey='';options={};reconcile({playing:true,...props});
      const saved=props.clockSnapshot;
      if(saved?.version===1&&saved.sceneKey===sceneKey&&saved.scene===options.scene&&saved.mode===options.mode){
        elapsed=Math.max(0,finite(saved.elapsed));orderKey=saved.orderKey;directives.clear();
        const scene=index(data).scenes.get(options.scene);
        for(const s of saved.directives||[]){
          const cue=scene?.cues.find(c=>c.id===s.cueId);if(!cue)continue;
          const a=pickCue(cue,{position:s.previousPosition,flip:s.flip,scale:s.scale},options.seed??42,{[cue.id]:{action:s.actionIndex,position:s.posIndex}});
          a.position=s.position;a.previousPosition=s.previousPosition;a.start=Math.min(elapsed,Math.max(0,finite(s.start)));a.clockKnown=s.clockKnown;directives.set(cue.role,a);
        }
        if(props.playing==null)running=!!saved.running;if(props.muted==null)muted=!!saved.muted;
        // Existing same-scene actors retain age. Only directives at the newly entered order start now.
        const updateProps={...props};delete updateProps.clockSnapshot;delete updateProps.time;reconcile(updateProps);
      }
      host.addEventListener('click',click);host.addEventListener('input',input);host.addEventListener('change',change);host.ownerDocument.addEventListener('visibilitychange',visibility);void paint();last=now();if(request)raf=request(tick);
    },
    update(props={}){if(!host)return;reconcile(props);void paint();},
    cue(event,meta){emit(event,meta);},
    seek(seconds){elapsed=Math.max(0,finite(seconds));for(const a of directives.values())a.start=0;void paint();},
    getState(){return {elapsed,running,muted,scene:options.scene,order:options.order,mode:options.mode,actors:actors().map(a=>({role:a.cue.role,cueId:a.cue.id,sourceTime:a.frame?.sourceTime,motionKey:a.motionKey,worldPosition:a.position,clockKnown:a.clockKnown})),cachedImages:images.size,pendingImages:pending.size,failedImages:failed.size};},
    getClockSnapshot(){return {version:1,elapsed,sceneKey,scene:options.scene,mode:options.mode,orderKey,running,muted,directives:[...directives.values()].map(a=>({cueId:a.cue.id,start:a.start,position:a.position,previousPosition:a.previousPosition,actionIndex:a.actionIndex,posIndex:a.posIndex,flip:a.flip,scale:a.scale,clockKnown:a.clockKnown})),scope:'current-tab ephemeral only; never game save or original runtime observation'};},
    cleanup,
  };
}

// Exact source delays on an explicit research button; this is not a claim to
// reproduce native world-space hit testing or drag-distance thresholds.
export function mountDecorHold(root,{isAllowed=()=>true,onComplete=()=>{},onLoop=()=>{},onStop=()=>{},now=()=>Date.now()}={}){
 const win=root?.ownerDocument?.defaultView;if(!win)return ()=>{};let hold=null,timer=null;
 const status=()=>root.querySelector('[data-decor-hold-status]');
 function cancel(message=''){if(timer!==null)win.clearInterval(timer);timer=null;if(hold){const previous=hold;hold=null;try{previous.button.releasePointerCapture?.(previous.id);}catch{}previous.button.querySelector('progress')?.remove();}onStop();if(message&&status())status().textContent=message;}
 function update(){if(!hold)return;if(!isAllowed()||root.ownerDocument.hidden){cancel('현재 장면의 편집 조건이 바뀌어 중지했습니다.');return;}const t=(now()-hold.at)/1000;
  if(t<=.2)return;if(!hold.started){hold.started=true;onLoop();const p=root.ownerDocument.createElement('progress');p.max=1.2;p.value=0;p.setAttribute('aria-label','원본 장식 편집 진행 1.2초');hold.button.append(p);}
  const p=hold.button.querySelector('progress');if(p)p.value=Math.min(1.2,t-.2);if(status())status().textContent='장식 편집 준비 '+Math.min(1.2,t-.2).toFixed(2)+' / 1.20초';
  if(t>=1.4){const slot=hold.button.dataset.decorHoldSlot;cancel('편집 패널 표시 · 진행 효과음 중단');onComplete(slot);}
 }
 function begin(button,id,x,y){if(hold||!isAllowed())return;hold={button,id,x,y,at:now(),started:false};try{if(typeof id==='number')button.setPointerCapture?.(id);}catch{}timer=win.setInterval(update,16);if(status())status().textContent='움직이지 않고 누르면 0.2초 뒤 진행을 시작합니다.';}
 const down=ev=>{const b=ev.target.closest('[data-decor-hold-slot]');if(b&&ev.button===0){ev.preventDefault();begin(b,ev.pointerId,ev.clientX,ev.clientY);}};
 const move=ev=>{if(hold&&hold.id===ev.pointerId&&Math.hypot(ev.clientX-hold.x,ev.clientY-hold.y)>7)cancel('이동하여 편집 준비를 취소했습니다. 7px 취소 거리는 웹 입력 정책입니다.');};
 const up=ev=>{if(hold?.id===ev.pointerId)cancel('누르기를 해제해 편집 준비를 취소했습니다.');};
 const keydown=ev=>{const b=ev.target.closest('[data-decor-hold-slot]');if(b&&['Enter',' '].includes(ev.key)){ev.preventDefault();if(!ev.repeat)begin(b,'keyboard',0,0);}};
 const keyup=ev=>{if(hold?.id==='keyboard'&&['Enter',' '].includes(ev.key))cancel('키를 놓아 편집 준비를 취소했습니다.');};
 const hidden=()=>{if(root.ownerDocument.hidden)cancel('화면 숨김으로 편집 준비를 중지했습니다.');};
 const blur=()=>cancel('포커스 이탈로 편집 준비를 중지했습니다.');
 root.addEventListener('pointerdown',down);root.addEventListener('pointermove',move);for(const name of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(name,up);root.addEventListener('keydown',keydown);root.addEventListener('keyup',keyup);root.ownerDocument.addEventListener('visibilitychange',hidden);win.addEventListener('blur',blur);
 return ()=>{cancel();root.removeEventListener('pointerdown',down);root.removeEventListener('pointermove',move);for(const name of ['pointerup','pointercancel','lostpointercapture'])root.removeEventListener(name,up);root.removeEventListener('keydown',keydown);root.removeEventListener('keyup',keyup);root.ownerDocument.removeEventListener('visibilitychange',hidden);win.removeEventListener('blur',blur);};
}

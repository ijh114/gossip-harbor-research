// Packaged StoryRecapModel/View semantics. This model only owns book state;
// account flags, task progress, currency, images and activity assignments are external.
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const integer=(v,max=10000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e10;
const dense=v=>Array.isArray(v)&&Object.keys(v).length===v.length;
const keys=(v,allowed)=>obj(v)&&Object.keys(v).every(k=>allowed.includes(k));
const task=v=>v===null||keys(v,['day','id'])&&integer(v.day)&&v.day>0&&integer(v.id)&&v.id>0;
const eps=(a,b)=>Math.abs(a-b)<1e-7;
const fail=(status,message,extra={})=>({ok:false,status,message,...extra});
function configValid(c){
 try{return obj(c)&&c.schemaVersion===1&&/^[a-f0-9]{64}$/.test(c.revision)&&Array.isArray(c.books)&&c.books.length===5&&c.books.every((b,i)=>b.id===i+1&&task(b.unlockTask)&&b.unlockTask!==null&&Array.isArray(b.pages)&&b.pages.length>0&&b.pages.every((p,j)=>p.id===j+1&&typeof p.title==='string'&&typeof p.subtitle==='string'&&Array.isArray(p.elements)))&&c.books.reduce((n,b)=>n+b.pages.length,0)===22&&c.shelf.minimumSlots===9&&c.shelf.columns===3&&c.timing.next.contentAfter===0.1&&c.timing.next.unlockAfter===0.25&&c.timing.previous.contentAfter===0.3&&c.timing.previous.unlockAfter===0.5&&c.swipe.minSeconds===0.01&&c.swipe.minHorizontalSpeedExclusive===1000&&c.swipe.horizontalVerticalRatioExclusive===1.5;}catch{return false;}
}
export function createStoryRecapInputs(){return {schema:1,serverEnabled:null,taskMode:'main',taskOverride:null};}
export function validStoryRecapInputs(v){return keys(v,['schema','serverEnabled','taskMode','taskOverride'])&&v.schema===1&&(v.serverEnabled===null||typeof v.serverEnabled==='boolean')&&['main','research'].includes(v.taskMode)&&task(v.taskOverride)&&(v.taskMode!=='main'||v.taskOverride===null);}
export function createStoryRecap(c){
 if(!configValid(c))throw new TypeError('Verified packaged story recap data required.');
 return {schema:1,revision:c.revision,phase:'closed',book:null,page:1,displayPage:1,seen:[],clock:0,inputs:createStoryRecapInputs(),transition:null,scrollResetNonce:0,message:''};
}
export function validStoryRecap(s,c){
 try{
  if(!configValid(c))return false;if(s===undefined)return true;
  if(!keys(s,['schema','revision','phase','book','page','displayPage','seen','clock','inputs','transition','scrollResetNonce','message'])||s.schema!==1||s.revision!==c.revision||!['closed','shelf','book'].includes(s.phase)||!number(s.clock)||!integer(s.scrollResetNonce,1e9)||typeof s.message!=='string'||s.message.length>500||!validStoryRecapInputs(s.inputs)||!dense(s.seen)||new Set(s.seen).size!==s.seen.length||!s.seen.every(id=>integer(id,5)&&id>0))return false;
  if(s.phase!=='book')return s.book===null&&s.page===1&&s.displayPage===1&&s.transition===null;
  const book=c.books.find(b=>b.id===s.book);if(!book||!s.seen.includes(s.book)||!integer(s.page,book.pages.length)||s.page<1||!integer(s.displayPage,book.pages.length)||s.displayPage<1)return false;
  if(s.transition===null)return s.page===s.displayPage;
  const t=s.transition;if(!keys(t,['direction','from','to','startedAt','contentAt','endAt','contentCommitted'])||!['next','previous'].includes(t.direction)||!integer(t.from,book.pages.length)||t.from<1||!integer(t.to,book.pages.length)||t.to<1||t.to!==t.from+(t.direction==='next'?1:-1)||t.to!==s.page||!number(t.startedAt)||!number(t.contentAt)||!number(t.endAt)||typeof t.contentCommitted!=='boolean')return false;
  const timing=c.timing[t.direction];return eps(t.contentAt,t.startedAt+timing.contentAfter)&&eps(t.endAt,t.startedAt+timing.unlockAfter)&&s.clock>=t.startedAt&&s.clock<t.endAt&&s.displayPage===(t.contentCommitted?t.to:t.from)&&t.contentCommitted===(s.clock>=t.contentAt);
 }catch{return false;}
}
function access(s,context,c){
 const flag=s.inputs.serverEnabled!==null?s.inputs.serverEnabled:context?.serverEnabled;
 const t=s.inputs.taskMode==='research'?s.inputs.taskOverride:context?.currentTask;
 const source={server:s.inputs.serverEnabled!==null?'explicit-research-input':typeof context?.serverEnabled==='boolean'?'context':'unknown',task:s.inputs.taskMode==='research'?'explicit-research-snapshot':'main-progress'};
 if(flag===false)return {state:'closed',unknown:[],unlocked:[],source,currentTask:t??null};
 const unknown=[];if(typeof flag!=='boolean')unknown.push('StoryRecap 서버 활성 플래그');if(t===undefined||!task(t))unknown.push('현재 메인 과제 또는 명시 연구 과제');
 if(unknown.length)return {state:'unknown',unknown,unlocked:[],source,currentTask:t===undefined?undefined:t};
 const unlocked=[];for(const b of c.books){if(t===null||b.unlockTask.day<t.day||b.unlockTask.day===t.day&&b.unlockTask.id<t.id)unlocked.push(b.id);else break;}
 return {state:'open',unknown:[],unlocked,source,currentTask:t};
}
export function storyRecapView(s,context,c){
 if(!validStoryRecap(s,c))return {valid:false,state:'invalid',message:'정의된 회상 책 저장을 보존했습니다. 백업 후 이 필드만 초기화하세요.'};
 const state=s===undefined?createStoryRecap(c):s,a=access(state,context,c);
 const slots=a.unlocked.map(id=>({kind:'book',id,isNew:!state.seen.includes(id),title:c.books[id-1].title,coverResourceKey:c.books[id-1].coverResourceKey}));slots.push({kind:'coming-soon',resourceKey:c.shelf.comingSoon});while(slots.length<c.shelf.minimumSlots)slots.push({kind:'empty',resourceKey:c.shelf.empty});
 const book=c.books.find(b=>b.id===state.book),canRead=a.state==='open'&&a.unlocked.includes(state.book),locked=Boolean(state.transition);
 return {valid:true,...a,phase:state.phase,slots,rows:Array.from({length:Math.ceil(slots.length/c.shelf.columns)},(_,i)=>slots.slice(i*c.shelf.columns,(i+1)*c.shelf.columns)),hasAnyNewBook:a.state==='unknown'?null:a.unlocked.some(id=>!state.seen.includes(id)),book:book&&canRead?{...book,page:book.pages[state.displayPage-1],targetPage:state.page,displayPage:state.displayPage}:null,canRead,locked,waitSeconds:state.transition?Math.max(0,state.transition.endAt-state.clock):0,transition:state.transition?{...state.transition}:null,canNext:canRead&&state.phase==='book'&&!locked&&state.page<book.pages.length,canPrevious:canRead&&state.phase==='book'&&!locked&&state.page>1,canCloseBook:state.phase==='book'&&!locked,scrollResetNonce:state.scrollResetNonce,inputs:structuredClone(state.inputs),message:state.message,boundaries:c.boundaries};
}
function resetWindow(s,phase){s.phase=phase;s.book=null;s.page=1;s.displayPage=1;s.transition=null;}
function success(s,message,extra={}){s.message=message;return {ok:true,status:'applied',message,...extra};}
function changePage(s,direction,c){
 const b=c.books[s.book-1],to=s.page+(direction==='next'?1:-1);if(to<1||to>b.pages.length)return fail('edge','이 방향에 더 넘길 페이지가 없습니다.');
 const timing=c.timing[direction],from=s.page;s.page=to;s.transition={direction,from,to,startedAt:s.clock,contentAt:s.clock+timing.contentAfter,endAt:s.clock+timing.unlockAfter,contentCommitted:false};
 return success(s,direction==='next'?'다음 페이지로 넘깁니다.':'이전 페이지로 넘깁니다.',{effect:'page-turn',direction,contentAfter:timing.contentAfter,unlockAfter:timing.unlockAfter});
}
export function storyRecapAction(s,action,context,c){
 if(s===undefined||!validStoryRecap(s,c))return fail('invalid','기존 회상 책 저장을 보존했습니다. 상태를 백업한 뒤 회상 책만 초기화하세요.');
 if(!obj(action)||typeof action.type!=='string')return fail('invalid-action','회상 책 동작을 확인하세요.');
 if(action.type==='configure'){
  if(s.phase==='book')return fail('book-open','책을 책장으로 닫은 뒤 연구 조건을 바꾸세요.');
  if(!validStoryRecapInputs(action.inputs))return fail('invalid-inputs','서버 플래그·과제 스냅샷을 확인하세요.');
  s.inputs=structuredClone(action.inputs);return success(s,'연구 조건만 변경했습니다. 메인 과제와 재화는 바꾸지 않았습니다.');
 }
 if(action.type==='leave'){resetWindow(s,'closed');return success(s,'회상 책을 종료하고 과제 목록으로 돌아갑니다.',{returnTo:'task-list',webPolicy:'route-exit-cancels-presentation-transition'});}
 if(action.type==='advance'){
  if(!number(action.seconds)||action.seconds>86400||s.clock+action.seconds>1e10)return fail('invalid-time','경과 시간은0~86400초 범위여야 합니다.');
  s.clock+=action.seconds;const t=s.transition;
  if(t&&s.clock>=t.contentAt&&!t.contentCommitted){s.displayPage=t.to;t.contentCommitted=true;s.scrollResetNonce=(s.scrollResetNonce+1)%1e9;}
  if(t&&s.clock>=t.endAt){s.displayPage=t.to;s.transition=null;}
  return {ok:true,status:'advanced',message:s.message,locked:Boolean(s.transition)};
 }
 const v=storyRecapView(s,context,c);
 if(action.type==='close-shelf'){
  if(s.phase!=='shelf')return fail('wrong-phase','책장에서 종료하세요.');resetWindow(s,'closed');return success(s,'과제 목록으로 돌아갑니다.',{returnTo:'task-list'});
 }
 if(action.type==='close-book'){
  if(s.phase!=='book')return fail('wrong-phase','열린 책이 없습니다.');if(v.locked)return fail('input-locked','페이지 전환이 끝난 뒤 책을 닫을 수 있습니다.');resetWindow(s,'shelf');return success(s,'읽음 기록을 유지하고 책장으로 돌아왔습니다.');
 }
 if(v.state!=='open')return fail(v.state,v.state==='unknown'?'서버 활성·현재 과제가 미확인입니다.': '회상 책이 비활성 상태입니다.',{unknown:v.unknown});
 if(action.type==='open-shelf'){if(s.phase==='book')return fail('book-open','열린 책을 먼저 닫으세요.');resetWindow(s,'shelf');return success(s,'해금된 회상 책 목록입니다.');}
 if(action.type==='open-book'){
  if(s.phase!=='shelf')return fail('wrong-phase','책장에서 책을 선택하세요.');
  if(!Number.isSafeInteger(action.book)||!v.unlocked.includes(action.book))return fail('locked-book','현재 과제로 해금한 책만 열 수 있습니다.');
  s.phase='book';s.book=action.book;s.page=1;s.displayPage=1;s.transition=null;s.scrollResetNonce=(s.scrollResetNonce+1)%1e9;if(!s.seen.includes(action.book)){s.seen.push(action.book);s.seen.sort((a,b)=>a-b);}
  return success(s,action.book+'권을1페이지부터 열었습니다.',{openedBook:action.book,sourceNewOpenPage:1});
 }
 if(['next','previous','swipe'].includes(action.type)){
  if(s.phase!=='book'||!v.canRead)return fail('book-unavailable','현재 해금된 책을 먼저 여세요.');
  if(v.locked)return fail('input-locked','페이지 전환 중에는 추가 입력을 받지 않습니다.');
  if(action.type!=='swipe')return changePage(s,action.type,c);
  if(!Number.isFinite(action.dx)||!Number.isFinite(action.dy)||Math.abs(action.dx)>1e6||Math.abs(action.dy)>1e6||!number(action.seconds)||action.seconds<c.swipe.minSeconds)return fail('swipe-ignored','짧거나 확인되지 않은 드래그는 페이지를 넘기지 않습니다.');
  const x=action.dx/action.seconds,y=action.dy/action.seconds;
  if(!(Math.abs(x)>Math.abs(y)*c.swipe.horizontalVerticalRatioExclusive&&Math.abs(x)>c.swipe.minHorizontalSpeedExclusive))return fail('swipe-ignored','세로 스크롤이나 느린 드래그는 페이지를 넘기지 않습니다.');
  return changePage(s,x>0?'previous':'next',c);
 }
 return fail('unsupported','지원하지 않는 회상 책 동작입니다.');
}

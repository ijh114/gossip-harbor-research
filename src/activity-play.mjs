// Bounded playable research seasons. No main-wallet, server, IAP or SDK access.
const int=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const result=(ok,message,extra={})=>({ok,message,...extra});
const allItems=c=>[...c.event.items,...(c.event.sharedItems||[])];
const def=(c,type)=>allItems(c).find(r=>r.type===type);
const types=c=>new Set([...allItems(c).flatMap(r=>[r.type,r.next,...r.pool.map(x=>x.type),...r.transforms.map(x=>x.type),...r.feeds.map(x=>x.type)]),...c.event.board.filter(Boolean).map(x=>x.type)].filter(Boolean));
const clone=v=>structuredClone(v);
const next=(a)=>{let x=a.event.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;a.event.rng=x>>>0||1;return a.event.rng/4294967296;};
function counted(rows){const out=[];for(const r of rows){const old=out.find(x=>x.type===r.type);if(old)old.count+=r.count;else out.push({...r});}return out;}
function makeCell(a,c,type,cover=null,innerCover=null){const row=def(c,type);return {uid:a.event.nextUid++,type,cover,innerCover,...(row?.pool.length?{remaining:counted(row.pool),used:0}:{})};}
function createEvent(c){const temp={event:{nextUid:1}};return {selected:null,merges:0,generated:0,goalClaimed:false,rng:1831,collected:{},queue:clone(c.scenario.event.starterQueue),board:c.event.board.map(x=>x?makeCell(temp,c,x.type,x.cover,x.innerCover):null),nextUid:temp.event.nextUid};}
export function createActivityPlay(c){return {schema:1,revision:c.revision,tab:'pass',startedAt:null,time:0,researchInputUsed:false,
 pass:{tokens:0,taskProgress:0,premiumAssumed:false,claims:[]},album:{packs:0,orderProgress:0,cards:{},setClaims:[],albumClaimed:false,lastOpened:[]},
 event:createEvent(c),ledger:{energy:0,gold:0,gem:0},lastSequences:{merge:0,customer:0,gold:0,gem:0,energy:0},message:'연구 시즌을 시작하면 메인 플레이의 성공한 주문·합성 기록을 활동 진행에 연결합니다.'};}
export function activityPhase(a,c,now=a.time){if(a.startedAt===null)return 'Idle';const t=Math.max(a.time,int(now)?now:a.time)-a.startedAt;return t<c.scenario.durationSeconds?'Started':t<c.scenario.durationSeconds+c.scenario.claimSeconds?'Ended':'Released';}
export function activityView(a,c,context={}){
 let remaining=a.pass.tokens,level=0;for(const row of c.scenario.pass.rows){if(remaining<row.require)break;remaining-=row.require;level++;}
 const sets=c.scenario.album.sets.map(s=>({...s,owned:s.cards.filter(id=>(a.album.cards[id]||0)>0).length,complete:s.cards.every(id=>(a.album.cards[id]||0)>0),claimed:a.album.setClaims.includes(s.id)}));
 return {phase:activityPhase(a,c,context.now),level,remaining,nextRequire:c.scenario.pass.rows[level]?.require||null,
 uniqueCards:Object.values(a.album.cards).filter(x=>x>0).length,duplicates:Object.values(a.album.cards).reduce((n,x)=>n+Math.max(0,x-1),0),sets,
 canClaim:['Started','Ended'].includes(activityPhase(a,c,context.now)),selected:a.event.selected===null?null:a.event.board[a.event.selected],
 remainingSeconds:a.startedAt===null?null:Math.max(0,a.startedAt+c.scenario.durationSeconds-Math.max(a.time,int(context.now)?context.now:a.time))};
}
function grant(a,rewards){for(const r of rewards){if(!['energy','gold','gem'].includes(r.type)||!int(r.count,10000))return false;if(!int(a.ledger[r.type]+r.count))return false;a.ledger[r.type]+=r.count;}return true;}
function passProgress(a,c,count){const p=c.scenario.pass;a.pass.taskProgress+=count;const completed=Math.floor(a.pass.taskProgress/p.taskCount);a.pass.tokens+=completed*p.taskTokens;a.pass.taskProgress%=p.taskCount;}
function addCards(a,c,cards){
 const known=new Set(c.scenario.album.cards.map(x=>x.id));if(!Array.isArray(cards)||cards.length!==c.scenario.album.packSize||cards.some(id=>!known.has(id)))return result(false,'연구 팩의 명시된 카드 결과를 선택하세요. 드롭 확률은 추정하지 않습니다.');
 a.album.packs--;a.album.lastOpened=[];
 for(const id of cards){a.album.lastOpened.push({id,isNew:!a.album.cards[id]});a.album.cards[id]=(a.album.cards[id]||0)+1;}
 const awarded=[];
 for(const set of c.scenario.album.sets)if(!a.album.setClaims.includes(set.id)&&set.cards.every(id=>a.album.cards[id]>0)){
  if(!grant(a,set.reward))return result(false,'세트 보상을 기록할 수 없습니다.');a.album.setClaims.push(set.id);awarded.push(set.name);
 }
 if(!a.album.albumClaimed&&c.scenario.album.cards.every(x=>a.album.cards[x.id]>0)){
  if(!grant(a,c.scenario.album.albumReward))return result(false,'앨범 보상을 기록할 수 없습니다.');a.album.albumClaimed=true;awarded.push('전체 앨범');
 }
 return result(true,`연구 팩 개봉 · ${a.album.lastOpened.filter(x=>x.isNew).length}장 신규${awarded.length?' · '+awarded.join('·')+' 보상을 별도 장부에 기록':''}`);
}
function apply(a,c,action,value,context){
 if(int(context.now))a.time=Math.max(a.time,context.now);
 if(action==='tab'){if(!['pass','album','event'].includes(value))return result(false,'지원하지 않는 활동입니다.');a.tab=value;return result(true,'활동 화면을 바꿨습니다.');}
 if(action==='start'){
  if(a.startedAt!==null)return result(false,'이 연구 시즌은 이미 시작됐습니다. 새 시즌은 초기화를 선택하세요.');a.startedAt=a.time;return result(true,'10분 연구 시즌을 시작했습니다. 원작 일정·보상표·카드 확률과 별도입니다.');
 }
 if(action==='reset'){const fresh=createActivityPlay(c);fresh.time=a.time;Object.assign(a,fresh);return result(true,'별도 연구 시즌을 초기화했습니다. 메인 저장과 지갑은 바꾸지 않았습니다.');}
 if(action==='time'){if(!int(Number(value),86400))return result(false,'0–86400초의 연구 시간만 입력하세요.');a.time+=Number(value);a.researchInputUsed=true;return result(true,'활동 연구 시각을 진행했습니다. 메인 플레이 시간은 바꾸지 않습니다.');}
 const phase=activityPhase(a,c),view=activityView(a,c);
 if(action==='premium'){const flag=value==='true'?true:value==='false'?false:value;if(typeof flag!=='boolean')return result(false,'수령권 가정은 켜짐/꺼짐을 지정하세요.');a.pass.premiumAssumed=flag;a.researchInputUsed=true;return result(true,'프리미엄 수령권 소유 가정을 바꿨습니다. 실제 결제는 없습니다.');}
 if(action==='claim-pass'){
  const parsed=typeof value==='string'?{tier:value.split(':')[0],track:value.split(':')[1]}:value,tier=Number(parsed?.tier),track=parsed?.track,key=tier+':'+track;
  if(!view.canClaim||!int(tier,c.scenario.pass.rows.length)||tier<1||tier>view.level||!['free','premium'].includes(track))return result(false,'달성한 단계와 수령 가능한 기간을 확인하세요.');
  if(a.pass.claims.includes(key))return result(false,'이미 수령한 단계입니다.');
  if(track==='premium'&&!a.pass.premiumAssumed)return result(false,'프리미엄 수령권 소유 가정이 필요합니다.');
  const rewards=c.scenario.pass.rows[tier-1][track];if(!grant(a,rewards))return result(false,'연구 보상을 기록할 수 없습니다.');a.pass.claims.push(key);return result(true,'패스 연구 보상을 별도 장부에 기록했습니다. 메인 지갑에 지급하지 않습니다.');
 }
 if(phase!=='Started')return result(false,phase==='Idle'?'먼저 연구 시즌을 시작하세요.':'활동 플레이 기간이 끝났습니다. 종료 후 패스 수령 기간만 별도입니다.');
 if(action==='record'){
  if(!obj(value)||!Object.hasOwn(a.lastSequences,value.kind)||!int(value.count,10000)||value.count<1||!int(value.sequence)||value.sequence<=a.lastSequences[value.kind])return result(false,'새로운 성공 동작의 종류·수량·증가하는 일련번호가 필요합니다.');
  a.lastSequences[value.kind]=value.sequence;if(value.kind===c.scenario.pass.taskTarget)passProgress(a,c,value.count);
  if(value.kind==='customer'){a.album.orderProgress+=value.count;const packs=Math.floor(a.album.orderProgress/c.scenario.album.ordersPerPack);a.album.packs+=packs;a.album.orderProgress%=c.scenario.album.ordersPerPack;}
  return result(true,'성공한 메인 플레이 기록을 연구 활동에 반영했습니다.');
 }
 if(action==='research-progress'){
  const count=value===undefined?1:Number(value);if(!int(count,10000)||count<1)return result(false,'연구 진행 수량은1–10000의 정수여야 합니다.');passProgress(a,c,count);a.album.packs++;a.researchInputUsed=true;return result(true,'명시적 연구 입력: 패스 과제 진행과 연구 팩1개를 추가했습니다. 원작 지급이 아닙니다.');
 }
 if(action==='open-pack'){if(a.album.packs<1)return result(false,'먼저 주문을 완료해 연구 팩을 모으세요.');return addCards(a,c,typeof value==='string'?[value]:value);}
 if(action==='event-pop'){
  const index=a.event.board.findIndex(x=>x===null),first=a.event.queue[0];if(index<0)return result(false,'이벤트 보드에 빈칸이 없습니다.');if(!first)return result(false,'보상 대기열이 비었습니다.');
  a.event.board[index]=makeCell(a,c,first.type);if(--first.count===0)a.event.queue.shift();return result(true,'이벤트 대기열 조각1개를 배치했습니다.');
 }
 if(action==='event-research-item'){
  if(!allItems(c).some(x=>x.type===value))return result(false,'동봉 이벤트/공용 타입만 연구 입력할 수 있습니다.');a.event.queue.push({type:value,count:1});a.researchInputUsed=true;return result(true,'선택한 동봉 타입을 연구 대기열에 추가했습니다.');
 }
 if(action==='event-cell'){
  const index=Number(value);if(!int(index,a.event.board.length-1))return result(false,'유효한 보드 칸을 선택하세요.');
  const cell=a.event.board[index];if(a.event.selected===null){if(!cell||cell.cover)return result(false,'덮개 없는 아이템을 먼저 선택하세요.');a.event.selected=index;return result(true,'이벤트 아이템 선택');}
  if(a.event.selected===index){a.event.selected=null;return result(true,'선택 해제');}
  return move(a,c,a.event.selected,index);
 }
 if(action==='event-move'){
  const parsed=typeof value==='string'&&/^\d{1,3},\d{1,3}$/.test(value)?{from:value.split(',')[0],to:value.split(',')[1]}:value;
  if(!obj(parsed))return result(false,'이동할 두 칸이 필요합니다.');return move(a,c,Number(parsed.from),Number(parsed.to));
 }
 if(action==='event-spawn')return spawn(a,c,a.event.selected);
 if(action==='event-collect'){
  const index=a.event.selected,cell=index===null?null:a.event.board[index],d=cell&&def(c,cell.type);
  if(!cell||cell.cover||!d?.collectRewards?.length)return result(false,'동봉 수집값이 확인된 재화 아이템을 선택하세요.');
  if(!grant(a,d.collectRewards))return result(false,'지원하지 않는 수집 보상입니다.');a.event.collected[cell.type]=(a.event.collected[cell.type]||0)+1;a.event.board[index]=null;a.event.selected=null;return result(true,'동봉 수집 보상을 별도 연구 장부에 기록하고 보드 칸을 비웠습니다.');
 }
 if(action==='event-claim'){
  if(a.event.goalClaimed)return result(false,'이 연구 목표 보상은 이미 받았습니다.');
  if(a.event.merges<c.scenario.event.goalMerges)return result(false,'연구 합성 목표를 먼저 달성하세요.');
  if(!grant(a,c.scenario.event.goalReward))return result(false,'연구 보상을 기록할 수 없습니다.');a.event.goalClaimed=true;a.album.packs++;return result(true,'대표 이벤트 연구 목표 완료 · 별도 보상 장부와 연구 팩1개에 기록했습니다.');
 }
 return result(false,'지원하지 않는 활동 조작입니다.');
}
function shock(a,c,index){const columns=c.event.columns,x=index%columns,y=Math.floor(index/columns);for(const [dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=columns||ny<0||ny>=c.event.rows)continue;const nextIndex=ny*columns+nx,cell=a.event.board[nextIndex];if(cell?.cover==='box'){
   cell.cover=cell.innerCover;cell.innerCover=null;if(!cell.cover)shock(a,c,nextIndex);
  }}}
function mergeReady(cell,c){const d=def(c,cell.type);return !d?.pool.length||!cell.used;}
function weighted(a,rows){const count=rows.reduce((n,r)=>n+r.count,0);if(count<1)return null;let value=next(a)*count;for(const r of rows){value-=r.count;if(value<0)return r;}return rows.at(-1);}
function move(a,c,from,to){
 if(!int(from,a.event.board.length-1)||!int(to,a.event.board.length-1)||from===to)return result(false,'서로 다른 유효한 두 칸이 필요합니다.');
 const source=a.event.board[from],target=a.event.board[to];if(!source||source.cover)return result(false,'이동할 아이템에 덮개가 있습니다.');
 if(!target){a.event.board[to]=source;a.event.board[from]=null;a.event.selected=to;return result(true,'이벤트 아이템 이동');}
 if(target.cover==='box')return result(false,'상자는 인접 합성으로 먼저 열어야 합니다.');
 const d=def(c,source.type),td=def(c,target.type);
 if(source.type===target.type&&d?.next){
  if(!mergeReady(source,c)||!mergeReady(target,c))return result(false,'일부 사용한 이벤트 생성기의 합성 조건은 지원하지 않습니다.');
  a.event.board[from]=null;a.event.board[to]=makeCell(a,c,d.next);a.event.selected=to;a.event.merges++;shock(a,c,to);return result(true,`이벤트 합성 · ${d.next}`);
 }
 if(!target.cover&&td?.feedCount===1&&td.feeds.some(r=>r.type===source.type)&&td.transforms.length){
  const transformed=weighted(a,td.transforms);if(!transformed)return result(false,'먹이 변환 결과가 미확인입니다.');a.event.board[from]=null;a.event.board[to]=makeCell(a,c,transformed.type);a.event.selected=to;return result(true,'동봉 먹이1개 조건으로 이벤트 아이템을 변환했습니다.');
 }
 if(target.cover)return result(false,'같은 타입을 가져와 거미줄을 해제하세요.');
 a.event.board[from]=target;a.event.board[to]=source;a.event.selected=to;return result(true,'이벤트 아이템 교환');
}
function spawn(a,c,index){
 if(!int(index,a.event.board.length-1))return result(false,'생성기를 먼저 선택하세요.');
 const cell=a.event.board[index],d=cell&&def(c,cell.type);if(!cell||cell.cover||!d?.pool.length||d.weightType!==2||d.cost!==0)return result(false,'무에너지 유한 풀 생성기만 지원합니다.');
 const slot=a.event.board.findIndex(x=>x===null);if(slot<0)return result(false,'빈칸이 없어 생성하지 않았습니다.');
 const count=cell.remaining?.reduce((n,r)=>n+r.count,0)||0;if(count<1)return result(false,'생성기 풀이 비었습니다.');
 const row=weighted(a,cell.remaining);row.count--;cell.used++;a.event.board[slot]=makeCell(a,c,row.type);a.event.generated++;
 if(d.transformAfter===cell.used&&d.transforms.length){const transformed=weighted(a,d.transforms);a.event.board[index]=makeCell(a,c,transformed.type);}
 else if(count===1)a.event.board[index]=null;
 return result(true,`${d.auto?'자동 생성의 한 단계 관측':'이벤트 생성'} · ${row.type}. 배치 위치는 웹의 첫 빈칸 정책입니다.`);
}
export function activityAction(a,action,value,c,context={}){
 if(!validActivityPlay(a,c))return result(false,'활동 저장이 호환되지 않습니다. 원본을 보존하고 별도 연구 시즌을 초기화하세요.');
 const copy=clone(a);let out;try{out=apply(copy,c,action,value,context);}catch{return result(false,'활동 입력을 처리하지 못했습니다. 기존 상태를 보존합니다.');}
 if(!out.ok)return out;copy.message=out.message;
 if(!validActivityPlay(copy,c))return result(false,'활동 입력이 허용 범위를 벗어나 변경하지 않았습니다.');Object.assign(a,copy);return out;
}
export function recordActivityProgress(a,event,c,context={}){return activityAction(a,'record',event,c,context);}
export function validActivityPlay(a,c){
 try{
  if(!obj(a)||a.schema!==1||a.revision!==c.revision||!['pass','album','event'].includes(a.tab)||!int(a.time)||!(a.startedAt===null||int(a.startedAt)&&a.startedAt<=a.time)||typeof a.researchInputUsed!=='boolean')return false;
  const p=a.pass,al=a.album,ev=a.event,cardIds=new Set(c.scenario.album.cards.map(x=>x.id)),setIds=new Set(c.scenario.album.sets.map(x=>x.id));
  if(!obj(p)||!int(p.tokens)||!int(p.taskProgress,c.scenario.pass.taskCount-1)||typeof p.premiumAssumed!=='boolean'||!Array.isArray(p.claims)||new Set(p.claims).size!==p.claims.length||p.claims.some(x=>!/^\d+:(free|premium)$/.test(x)||Number(x.split(':')[0])<1||Number(x.split(':')[0])>c.scenario.pass.rows.length))return false;
  if(!obj(al)||!int(al.packs,100000)||!int(al.orderProgress,c.scenario.album.ordersPerPack-1)||!obj(al.cards)||Object.entries(al.cards).some(([id,count])=>!cardIds.has(id)||!int(count,100000))||!Array.isArray(al.setClaims)||new Set(al.setClaims).size!==al.setClaims.length||al.setClaims.some(x=>!setIds.has(x))||typeof al.albumClaimed!=='boolean'||!Array.isArray(al.lastOpened)||al.lastOpened.length>c.scenario.album.packSize||al.lastOpened.some(x=>!cardIds.has(x.id)||typeof x.isNew!=='boolean'))return false;
  if(!obj(ev)||!int(ev.nextUid)||ev.nextUid<1||!int(ev.merges)||!int(ev.generated)||!int(ev.rng,4294967295)||ev.rng===0||typeof ev.goalClaimed!=='boolean'||!Array.isArray(ev.board)||ev.board.length!==c.event.rows*c.event.columns||!(ev.selected===null||int(ev.selected,ev.board.length-1))||!Array.isArray(ev.queue)||ev.queue.length>1000||!obj(ev.collected)||Object.entries(ev.collected).some(([type,count])=>!def(c,type)?.collectRewards?.length||!int(count,100000)))return false;
  const known=types(c),uids=new Set();for(const cell of ev.board.filter(Boolean)){
   if(!obj(cell)||!int(cell.uid)||cell.uid<1||cell.uid>=ev.nextUid||uids.has(cell.uid)||!known.has(cell.type)||![null,'box','web'].includes(cell.cover)||![null,'web'].includes(cell.innerCover)||cell.cover!=='box'&&cell.innerCover!==null)return false;uids.add(cell.uid);
   const d=def(c,cell.type);if(d?.pool.length){const pool=counted(d.pool);if(!int(cell.used,d.batch)||!Array.isArray(cell.remaining)||cell.remaining.length!==pool.length||cell.remaining.some((r,i)=>r.type!==pool[i].type||!int(r.count,pool[i].count))||cell.remaining.reduce((n,r)=>n+r.count,0)+cell.used!==pool.reduce((n,r)=>n+r.count,0))return false;}
  }
  if(ev.queue.some(r=>!obj(r)||!known.has(r.type)||!int(r.count,10000)||r.count<1))return false;
  if(!obj(a.ledger)||Object.keys(a.ledger).sort().join()!=='energy,gem,gold'||Object.values(a.ledger).some(n=>!int(n))||!obj(a.lastSequences)||Object.keys(a.lastSequences).sort().join()!=='customer,energy,gem,gold,merge'||Object.values(a.lastSequences).some(n=>!int(n)))return false;
  const view=activityView(a,c),expected={energy:0,gold:0,gem:0},sum=rewards=>{for(const r of rewards)expected[r.type]+=r.count;};
  for(const claim of p.claims){const [tier,track]=claim.split(':');if(Number(tier)>view.level)return false;sum(c.scenario.pass.rows[Number(tier)-1][track]);}
  for(const set of c.scenario.album.sets){const complete=set.cards.every(id=>(al.cards[id]||0)>0);if(complete!==al.setClaims.includes(set.id))return false;if(complete)sum(set.reward);}
  const albumComplete=c.scenario.album.cards.every(x=>(al.cards[x.id]||0)>0);if(albumComplete!==al.albumClaimed)return false;if(albumComplete)sum(c.scenario.album.albumReward);
  if(ev.goalClaimed){if(ev.merges<c.scenario.event.goalMerges)return false;sum(c.scenario.event.goalReward);}
  for(const [type,count]of Object.entries(ev.collected))sum(def(c,type).collectRewards.map(r=>({...r,count:r.count*count})));
  if(Object.keys(expected).some(k=>a.ledger[k]!==expected[k]))return false;
  if(typeof a.message!=='string'||a.message.length>1000)return false;return true;
 }catch{return false;}
}

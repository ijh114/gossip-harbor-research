// Optional source-shaped album rules. No probability sampling or account API.
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const int=(x,max=1e9)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const text=x=>typeof x==='string'&&x.length>0&&x.length<=120&&!['__proto__','constructor','prototype'].includes(x);
const list=x=>Array.isArray(x)?x:[];
const unique=x=>new Set(x).size===x.length;
const clone=x=>structuredClone(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const rewards=x=>Array.isArray(x)&&x.length<=100&&x.every(r=>obj(r)&&text(r.type)&&int(r.count,100000)&&r.count>0);
const fail=(status,message,unknown=[])=>({ok:false,status,message,unknown});
const ok=message=>({ok:true,status:'applied',message,rewards:[],costs:[]});
const kinds=['common','gold','laser','royal'];
const baseSets=a=>a.sets.map(set=>({...set,kind:'common'}));
const royalEnergy=id=>/^pack_royal_[1-5]$/.test(id)?Number(id.at(-1)):null;
const prefix=round=>round===1?'album':`album:round:${round}`;

export function albumVariantTemplate(a){return {schema:1,origin:'explicit-research-input',cardKinds:a.cards.map(card=>({id:card.id,kind:'common'})),extraCards:[],extraSets:[],extraPacks:[],laserRewards:[],joker:{consume:'oldest'},royal:null,rounds:null};}
export function albumVariantCards(a,v){return [...a.cards.map(card=>({...card,kind:v?.config.cardKinds.find(row=>row.id===card.id)?.kind||'common'})),...list(v?.config.extraCards)];}
export function albumVariantSets(a,v){return [...baseSets(a),...list(v?.config.extraSets)];}
export function albumVariantPacks(a,v){return [...a.packs,...list(v?.config.extraPacks)];}
export function validAlbumVariantConfig(x,a){try{
 if(!a||a.cards.some(card=>card.stars>5)||!obj(x)||x.schema!==1||x.origin!=='explicit-research-input'||!Array.isArray(x.cardKinds)||x.cardKinds.length!==a.cards.length||!unique(x.cardKinds.map(row=>row.id))||!x.cardKinds.every(row=>obj(row)&&a.cards.some(card=>card.id===row.id)&&['common','gold','laser'].includes(row.kind))||!Array.isArray(x.extraCards)||x.extraCards.length>500||!Array.isArray(x.extraSets)||x.extraSets.length>100||!Array.isArray(x.extraPacks)||x.extraPacks.length>40||!Array.isArray(x.laserRewards)||x.laserRewards.length>500)return false;
 const v={config:x},cards=albumVariantCards(a,v),sets=albumVariantSets(a,v),packs=albumVariantPacks(a,v);
 if(!unique(cards.map(row=>row.id))||!unique(sets.map(row=>row.id))||!unique(packs.map(row=>row.id))||!x.extraCards.every(row=>obj(row)&&text(row.id)&&text(row.setId)&&int(row.stars,5)&&row.stars>0&&kinds.includes(row.kind))||!x.extraSets.every(row=>obj(row)&&text(row.id)&&['common','royal'].includes(row.kind)&&rewards(row.reward))||cards.some(card=>!sets.some(set=>set.id===card.setId&&(set.kind==='royal')===(card.kind==='royal')))||sets.some(set=>!cards.some(card=>card.setId===set.id)))return false;
 if(!x.extraPacks.every(pack=>obj(pack)&&text(pack.id)&&int(pack.size,20)&&pack.size>0&&(pack.fixed===null||Array.isArray(pack.fixed)&&pack.fixed.length===pack.size&&pack.fixed.every(id=>cards.some(card=>card.id===id))))||!unique(x.laserRewards.map(row=>row.cardId))||!x.laserRewards.every(row=>obj(row)&&cards.some(card=>card.id===row.cardId&&card.kind==='laser')&&rewards(row.reward))||cards.some(card=>card.kind==='laser'&&!x.laserRewards.some(row=>row.cardId===card.id)))return false;
 if(!(x.joker===null||obj(x.joker)&&['oldest','newest'].includes(x.joker.consume)))return false;
 if(x.royal!==null){const r=x.royal;if(!obj(r)||!text(r.id)||!int(r.round,1000)||r.round<1||!int(r.startsAt)||!int(r.endsAt)||r.startsAt>=r.endsAt||!int(r.minLevel,10000)||!Array.isArray(r.setIds)||!r.setIds.length||!unique(r.setIds)||!r.setIds.every(id=>sets.some(set=>set.id===id&&set.kind==='royal'))||!rewards(r.reward)||!Array.isArray(r.packIds)||!unique(r.packIds)||!r.packIds.every(id=>royalEnergy(id)!==null&&packs.some(pack=>pack.id===id))||!same([...r.packIds].sort(),packs.filter(pack=>royalEnergy(pack.id)!==null).map(pack=>pack.id).sort()))return false;}
 if(x.extraSets.some(set=>set.kind==='royal'&&!x.royal?.setIds.includes(set.id)))return false;
 if(x.rounds!==null){const r=x.rounds;if(!obj(r)||!['finite','repeat-last'].includes(r.mode)||!Array.isArray(r.profiles)||r.profiles.length<2||r.profiles.length>20)return false;
  for(const profile of r.profiles){if(!obj(profile)||!Array.isArray(profile.cardIds)||!profile.cardIds.length||!unique(profile.cardIds)||!profile.cardIds.every(id=>cards.some(card=>card.id===id&&card.kind!=='royal'))||!Array.isArray(profile.setRewards)||!unique(profile.setRewards.map(set=>set.id))||!profile.setRewards.every(set=>obj(set)&&sets.some(original=>original.id===set.id&&original.kind!=='royal')&&rewards(set.reward))||!rewards(profile.reward)||!rewards(profile.upgradeBonus))return false;const usedSets=[...new Set(profile.cardIds.map(id=>cards.find(card=>card.id===id).setId))];if(!same([...usedSets].sort(),profile.setRewards.map(set=>set.id).sort()))return false;}
  const first=r.profiles[0];if(!same([...first.cardIds].sort(),a.cards.map(card=>card.id).sort())||!same(first.reward,a.reward)||a.sets.some(set=>!same(first.setRewards.find(row=>row.id===set.id)?.reward,set.reward)))return false;
 }
 return true;
}catch{return false;}}
export function createAlbumVariants(config,a){if(!validAlbumVariantConfig(config,a))throw TypeError('명시된 앨범 변형 설정을 확인하세요.');return {schema:1,config:clone(config),round:1,jokers:[],packetLog:[],jokerUses:[],roundHistory:[],upgradeClaims:[],cachedStars:0,cachedStarSpent:0,royal:{status:'inactive',startedAt:null,level:null,setClaims:[],complete:false,ended:null}};}
export function albumVariantProfile(a,v,round=v?.round||1){
 const profiles=v?.config.rounds?.profiles;if(profiles)return profiles[Math.min(round,profiles.length)-1];
 return {cardIds:a.cards.map(card=>card.id),setRewards:a.sets.map(set=>({id:set.id,reward:set.reward})),reward:a.reward,upgradeBonus:[]};
}
export function albumVariantCollections(a,v){const profile=albumVariantProfile(a,v);return {cards:albumVariantCards(a,v).filter(card=>profile.cardIds.includes(card.id)),sets:profile.setRewards,reward:profile.reward};}
const royalCards=(a,v)=>albumVariantCards(a,v).filter(card=>v.config.royal?.setIds.includes(card.setId));
const localNow=(s,c,now)=>now-(c.schedule.clock==='relative-on-start'?(s.registeredAt||0):0);
function royalActive(v){return v?.royal.status==='active';}
function eligibleCard(s,c,id){const v=s.album.variants,card=albumVariantCards(c.album,v).find(card=>card.id===id);if(!card)return false;if(card.kind==='royal')return royalActive(v)&&v.config.royal.setIds.includes(card.setId);return albumVariantProfile(c.album,v).cardIds.includes(id);}
function acquire(s,ids,c,issue){
 const a=s.album,v=a.variants,all=albumVariantCards(c.album,v);a.lastOpened=[];
 for(const id of ids){if(!eligibleCard(s,c,id))return fail('unknown','현재 round 또는 활성 Royal에 배정한 카드 결과가 아닙니다.',['album.card-round-or-royal-binding']);const card=all.find(card=>card.id===id),count=a.cards[id]||0;if(count>=100000)return fail('limit','카드 저장 한도입니다.');a.cards[id]=count+1;a.lastOpened.push({id,isNew:count===0});if(count===0&&card.kind==='laser')issue(`album:round:${v.round}:laser:${id}`,v.config.laserRewards.find(row=>row.cardId===id).reward);}
 const collection=albumVariantCollections(c.album,v);
 for(const set of collection.sets)if(!a.setClaims.includes(set.id)&&collection.cards.filter(card=>card.setId===set.id).every(card=>a.cards[card.id]>0)){a.setClaims.push(set.id);issue(prefix(v.round)+':set:'+set.id,set.reward);}
 if(!a.complete&&collection.cards.every(card=>a.cards[card.id]>0)){a.complete=true;issue(prefix(v.round)+':complete',collection.reward);}
 if(royalActive(v)){
  const r=v.config.royal,cards=royalCards(c.album,v);
  for(const setId of r.setIds)if(!v.royal.setClaims.includes(setId)&&cards.filter(card=>card.setId===setId).every(card=>a.cards[card.id]>0)){v.royal.setClaims.push(setId);issue(`album:royal:${r.id}:set:${setId}`,albumVariantSets(c.album,v).find(set=>set.id===setId).reward);}
  if(!v.royal.complete&&cards.every(card=>a.cards[card.id]>0)){v.royal.complete=true;issue(`album:royal:${r.id}:complete`,r.reward);}
 }
 return ok('입력된 카드 결과·신규/중복·세트/앨범 보상을 원자적으로 기록했습니다.');
}
function finishRoyal(s,c,now,issue){
 const a=s.album,v=a.variants;if(!royalActive(v))return;const r=v.config.royal,packCounts={},duplicates=[];let rawEnergy=0,stars=0;
 for(const id of r.packIds){const count=a.packs[id]||0;if(count){packCounts[id]=count;rawEnergy+=count*royalEnergy(id);a.packs[id]=0;}}
 for(const card of royalCards(c.album,v)){const count=Math.max(0,(a.cards[card.id]||0)-1);if(count){duplicates.push({id:card.id,count,stars:card.stars});stars+=count*card.stars;}delete a.cards[card.id];}
 if(!int(v.cachedStars+stars))throw Error('royal-star-limit');v.cachedStars+=stars;const energy=Math.min(rawEnergy,100);v.royal.status='ended';v.royal.ended={at:now,packCounts,duplicates,cachedStars:stars,energy};if(energy>0)issue(`album:royal:${r.id}:end`,[{type:'energy',count:energy}]);
}
function logPacket(v,value,kind,now,extra={}){if(!obj(value)||!text(value.packetId))return fail('invalid-input','명시 결과 패킷의 독립 ID가 필요합니다.');if(v.packetLog.some(row=>row.id===value.packetId))return fail('duplicate','이미 반영한 결과 패킷입니다.');if(v.packetLog.length>=1000)return fail('limit','결과 패킷 저장 한도입니다.');v.packetLog.push({id:value.packetId,kind,at:now,...extra});return null;}
export function applyAlbumVariantAction(s,action,value,c,{now,phase,issue}){
 const a=s.album;if(!c.album)return action.startsWith('album-')?fail('unknown','앨범 설정이 없습니다.'):null;
 if(action==='album-variants-configure'){
  if(phase!=='Started')return fail('expired','앨범 플레이 기간에만 변형 설정을 추가합니다.');if(a.variants!==undefined)return fail('already-configured','진행 중 변형 설정은 덮어쓰지 않습니다. 현재 저장을 보존합니다.');if(!validAlbumVariantConfig(value,c.album))return fail('invalid-input','명시 연구 설정의 카드 종류·세트·팩·round·Royal 입력을 확인하세요.');a.variants=createAlbumVariants(value,c.album);return ok('기존 시즌과 카드를 유지하고 명시 연구 변형 설정을 추가했습니다. 실제 서버 활성 배정은 아닙니다.');
 }
 const v=a.variants;if(!v)return action.startsWith('album-')?fail('unknown','명시된 앨범 변형 설정이 필요합니다.',['album.variants-config']):null;
 if(royalActive(v)&&localNow(s,c,now)>v.config.royal.endsAt)finishRoyal(s,c,now,issue);
 if(action==='clock'||action==='resume')return ok('조커 기한 표시·Royal 종료 변환·round 저장을 재평가했습니다.');
 if(!['grant-pack','open-pack','exchange-duplicates'].includes(action)&&!action.startsWith('album-'))return null;
 if(phase!=='Started')return fail('expired','앨범 플레이 기간이 아닙니다.');
 if(action==='album-joker-grant'){
  if(!v.config.joker||!obj(value)||!['joker_common_card','joker_golden_card'].includes(value.type)||!int(value.count,1000)||value.count<1)return fail('invalid-input','조커 종류·수량·확정 보상 패킷이 필요합니다.');
  const finalRound=!v.config.rounds||v.config.rounds.mode==='finite'&&v.round>=v.config.rounds.profiles.length;if(a.complete&&finalRound)return fail('unknown','수집 종료 후 조커의 rc_d_1/rc_e_1 팩 변환 배정이 필요합니다.',['album.completed-joker-conversion']);
  if(v.jokers.length+value.count>1000)return fail('limit','조커 보유 한도입니다.');const logged=logPacket(v,value,'joker',now,{type:value.type,count:value.count});if(logged)return logged;for(let i=0;i<value.count;i++)v.jokers.push({id:value.packetId+':'+i,type:value.type,at:now});return ok('명시된 보상 패킷의 조커를 획득 시각 순 장부에 기록했습니다.');
 }
 if(action==='album-joker-exchange'){
  if(!v.config.joker||!obj(value)||!text(value.cardId)||!v.jokers.length)return fail('not-owned','조커와 선택한 카드가 필요합니다.');const mode=value.consume??v.config.joker.consume;if(!['oldest','newest'].includes(mode))return fail('invalid-input','oldest/newest 소비 분기를 확인하세요.');const index=mode==='newest'?v.jokers.length-1:0,joker=v.jokers[index],card=albumVariantCards(c.album,v).find(row=>row.id===value.cardId);if(!card||!eligibleCard(s,c,card.id))return fail('unknown','현재 선택 가능한 카드가 아닙니다.');if(card.kind==='gold'&&joker.type!=='joker_golden_card')return fail('gold-joker-required','일반 조커로 금카드를 고를 수 없습니다.');
  v.jokers.splice(index,1);const r=acquire(s,[card.id],c,issue);if(!r.ok)return r;v.jokerUses.push({jokerId:joker.id,cardId:card.id,round:v.round,at:now,consume:mode});return ok('조커1개를 소비하고 선택한 카드·완성 보상을 기록했습니다.');
 }
 if(action==='album-royal-start'){
  const r=v.config.royal;if(!r)return fail('unknown','Royal의 기간·세트·보상·레벨 설정이 필요합니다.',['album.royal-config']);if(v.royal.status!=='inactive')return fail('duplicate','이 Royal 배정은 이미 시작하거나 종료했습니다.');const at=localNow(s,c,now);if(!(at>r.startsAt&&at<r.endsAt)||!obj(value)||!int(value.playerLevel,10000)||value.playerLevel<r.minLevel)return fail('not-earned','Royal 시작은 원본처럼 sTime<현재<eTime 및 명시 레벨 조건을 사용합니다.');v.royal.status='active';v.royal.startedAt=now;v.royal.level=value.playerLevel;return ok('명시된 기간·레벨·setGroup의 Royal 수집을 시작했습니다.');
 }
 if(action==='album-round-upgrade'){
  const rounds=v.config.rounds;if(!rounds||!a.complete)return fail('not-earned','현재 일반 앨범 완성과 다음 round/보너스 설정이 필요합니다.');if(rounds.mode==='finite'&&v.round>=rounds.profiles.length)return fail('unknown','다음 round의 확정 설정이 없습니다.',['album.next-round-config']);if(v.round>=100)return fail('limit','웹 round 저장 한도입니다.');
  const previous=v.round,profile=albumVariantProfile(c.album,v);v.roundHistory.push({round:previous,setClaims:clone(a.setClaims),complete:a.complete,exchangeCounts:clone(a.exchangeCounts),laserClaims:albumVariantCards(c.album,v).filter(card=>card.kind==='laser'&&a.cards[card.id]>0&&profile.cardIds.includes(card.id)).map(card=>card.id)});v.upgradeClaims.push(previous);issue(`album:round:${previous}:upgrade`,profile.upgradeBonus);
  for(const card of albumVariantCards(c.album,v))if(card.kind!=='royal')delete a.cards[card.id];v.round++;a.setClaims=[];a.complete=false;a.exchangeCounts={};a.exchangeReadyAt={};a.lastOpened=[];return ok('round 보너스를 기록하고 일반 카드/중복을 초기화했습니다. 조커·팩·활성 Royal·누적 변환 별은 보존합니다.');
 }
 if(action==='grant-pack'){
  if(!obj(value)||!albumVariantPacks(c.album,v).some(pack=>pack.id===value.id)||!int(value.count,10000)||value.count<1)return fail('invalid-input','확인한 팩과 명시 수량이 필요합니다.');if((a.packs[value.id]||0)+value.count>100000)return fail('limit','팩 보유 한도입니다.');a.packs[value.id]=(a.packs[value.id]||0)+value.count;return ok('명시한 모의 팩 지급을 변형 장부에 기록했습니다.');
 }
 if(action==='open-pack'){
  const pack=obj(value)&&albumVariantPacks(c.album,v).find(row=>row.id===value.id);if(!pack||!(a.packs[pack.id]>0))return fail('not-owned','보유한 팩이 필요합니다.');if(v.config.royal?.packIds.includes(pack.id)&&!royalActive(v))return fail('unknown','Royal 미진행 시 팩 변환/배정 경로는 별도 확인이 필요합니다.',['album.inactive-royal-pack']);const cards=pack.fixed||value.cards;if(!Array.isArray(cards)||cards.length!==pack.size||cards.some(id=>!eligibleCard(s,c,id)))return fail('unknown','확정 카드 결과 배열이 현재 팩 크기·round·Royal 배정과 맞지 않습니다.',['album.pack-results']);if(pack.fixed&&value.cards&&!same(pack.fixed,value.cards))return fail('invalid-input','설정된 고정 결과와 입력이 다릅니다.');if(value.packetId!==undefined){const logged=logPacket(v,value,'pack',now,{packId:pack.id,cards:clone(cards),round:v.round});if(logged)return logged;}a.packs[pack.id]--;return acquire(s,cards,c,issue);
 }
 if(action==='exchange-duplicates'){
  const row=obj(value)&&c.album.exchanges.find(row=>row.id===value.id);if(!row)return fail('unknown','교환 설정이 없습니다.');if((a.exchangeReadyAt[row.id]||0)>now)return fail('cooldown','교환 대기 시간이 남았습니다.');if((a.exchangeCounts[row.id]||0)>=row.limit)return fail('limit','교환 한도입니다.');const selected={},cache=value.cachedStars??0;if(!int(cache)||cache>v.cachedStars||!Array.isArray(value.cards)||value.cards.length>10000||!value.cards.length&&!cache)return fail('invalid-input','선택한 중복 카드와 보존된 변환 별 수량을 확인하세요.');for(const id of value.cards){if(!text(id))return fail('invalid-input','카드 ID를 확인하세요.');selected[id]=(selected[id]||0)+1;}let stars=cache;
  for(const [id,count]of Object.entries(selected)){const card=albumVariantCards(c.album,v).find(card=>card.id===id);if(!card||!eligibleCard(s,c,id)||count>Math.max(0,(a.cards[id]||0)-1))return fail('not-owned','한 장을 남기는 현재 카드의 중복만 교환합니다.');stars+=card.stars*count;}if(stars<row.stars)return fail('not-earned','선택한 별이 부족합니다.');for(const [id,count]of Object.entries(selected))a.cards[id]-=count;v.cachedStars-=cache;v.cachedStarSpent+=cache;a.exchangeCounts[row.id]=(a.exchangeCounts[row.id]||0)+1;a.exchangeReadyAt[row.id]=now+row.cooldownSeconds;issue(prefix(v.round)+':exchange:'+row.id+':'+a.exchangeCounts[row.id],row.reward);return ok('중복 카드·보존 별 소비와 설정된 교환 보상을 기록했습니다.');
 }
 return fail('unsupported','지원하는 앨범 변형 동작이 아닙니다.');
}

export function albumVariantExpected(s,c){
 const a=s.album,v=a.variants,rows=[],add=(key,reward)=>rows.push({key,rewards:reward});
 const normal=(round,claims,complete,exchanges,laserClaims)=>{const profile=albumVariantProfile(c.album,v,round);for(const id of claims)add(prefix(round)+':set:'+id,profile.setRewards.find(set=>set.id===id).reward);if(complete)add(prefix(round)+':complete',profile.reward);for(const [id,count]of Object.entries(exchanges))for(let i=1;i<=count;i++)add(prefix(round)+':exchange:'+id+':'+i,c.album.exchanges.find(row=>row.id===id).reward);for(const id of laserClaims)add(`album:round:${round}:laser:${id}`,v.config.laserRewards.find(row=>row.cardId===id).reward);};
 for(const old of v.roundHistory)normal(old.round,old.setClaims,old.complete,old.exchangeCounts,old.laserClaims);
 normal(v.round,a.setClaims,a.complete,a.exchangeCounts,albumVariantCollections(c.album,v).cards.filter(card=>card.kind==='laser'&&(a.cards[card.id]||0)>0).map(card=>card.id));
 for(const round of v.upgradeClaims)add(`album:round:${round}:upgrade`,albumVariantProfile(c.album,v,round).upgradeBonus);
 const r=v.config.royal;if(r){for(const id of v.royal.setClaims)add(`album:royal:${r.id}:set:${id}`,albumVariantSets(c.album,v).find(set=>set.id===id).reward);if(v.royal.complete)add(`album:royal:${r.id}:complete`,r.reward);if(v.royal.ended?.energy>0)add(`album:royal:${r.id}:end`,[{type:'energy',count:v.royal.ended.energy}]);}
 return rows;
}
export function validAlbumVariantState(v,a,s,seasonConfig){try{
 if(v===undefined)return true;if(!obj(v)||v.schema!==1||!validAlbumVariantConfig(v.config,a)||!int(v.round,100)||v.round<1||!Array.isArray(v.roundHistory)||v.roundHistory.length!==v.round-1||!Array.isArray(v.upgradeClaims)||!same(v.upgradeClaims,Array.from({length:v.round-1},(_,i)=>i+1))||!int(v.cachedStars)||!int(v.cachedStarSpent)||!Array.isArray(v.packetLog)||v.packetLog.length>1000||!unique(v.packetLog.map(row=>row.id))||!Array.isArray(v.jokers)||v.jokers.length>1000||!unique(v.jokers.map(row=>row.id))||!Array.isArray(v.jokerUses)||v.jokerUses.length>1000||!unique(v.jokerUses.map(row=>row.jokerId)))return false;
 if(!v.config.rounds&&v.round!==1||v.config.rounds?.mode==='finite'&&v.round>v.config.rounds.profiles.length)return false;
 const cards=albumVariantCards(a,v),packIds=albumVariantPacks(a,v).map(pack=>pack.id),grants=[];if(v.packetLog.filter(row=>row.kind==='joker').reduce((n,row)=>n+(row.count||0),0)>2000)return false;
 for(const packet of v.packetLog){if(!obj(packet)||!text(packet.id)||!int(packet.at,s.time))return false;if(packet.kind==='joker'){if(!['joker_common_card','joker_golden_card'].includes(packet.type)||!int(packet.count,1000)||packet.count<1)return false;for(let i=0;i<packet.count;i++)grants.push({id:packet.id+':'+i,type:packet.type,at:packet.at});}else if(packet.kind==='pack'){const pack=albumVariantPacks(a,v).find(row=>row.id===packet.packId);if(!pack||!Array.isArray(packet.cards)||packet.cards.length!==pack.size||packet.cards.some(id=>!cards.some(card=>card.id===id))||!int(packet.round,v.round)||packet.round<1)return false;}else return false;}
 const usedIds=v.jokerUses.map(use=>use.jokerId);if(grants.length!==v.jokers.length+v.jokerUses.length||!v.jokers.every(joker=>grants.some(g=>same(g,joker))&&!usedIds.includes(joker.id))||!v.jokerUses.every(use=>grants.some(g=>g.id===use.jokerId&&g.at<=use.at&&(cards.find(card=>card.id===use.cardId)?.kind!=='gold'||g.type==='joker_golden_card'))&&cards.some(card=>card.id===use.cardId)&&int(use.at,s.time)&&int(use.round,v.round)&&use.round>0&&['oldest','newest'].includes(use.consume)))return false;
 if(v.jokers.some((joker,i)=>i>0&&joker.at<v.jokers[i-1].at))return false;
 for(const [i,old]of v.roundHistory.entries()){const profile=albumVariantProfile(a,v,i+1);if(old.round!==i+1||old.complete!==true||!same([...old.setClaims].sort(),profile.setRewards.map(set=>set.id).sort())||!obj(old.exchangeCounts)||Object.entries(old.exchangeCounts).some(([id,n])=>!int(n,a.exchanges.find(row=>row.id===id)?.limit??-1))||!Array.isArray(old.laserClaims)||!same([...old.laserClaims].sort(),cards.filter(card=>card.kind==='laser'&&profile.cardIds.includes(card.id)).map(card=>card.id).sort()))return false;}
 const r=v.royal;if(!obj(r)||!['inactive','active','ended'].includes(r.status)||!Array.isArray(r.setClaims)||!unique(r.setClaims)||r.setClaims.some(id=>!v.config.royal?.setIds.includes(id))||typeof r.complete!=='boolean')return false;
 if(!v.config.royal&&r.status!=='inactive'||v.cachedStars+v.cachedStarSpent!==(r.ended?.cachedStars||0))return false;
 if(r.status==='inactive'){if(r.startedAt!==null||r.level!==null||r.ended!==null||r.setClaims.length||r.complete)return false;}
 else{const cfg=v.config.royal;if(!int(r.startedAt,s.time)||!int(r.level,10000)||r.level<cfg.minLevel)return false;const offset=seasonConfig?.schedule.clock==='relative-on-start'?(s.registeredAt||0):0,local=r.startedAt-offset;if(!(local>cfg.startsAt&&local<cfg.endsAt))return false;if(r.complete!==cfg.setIds.every(id=>r.setClaims.includes(id)))return false;
  if(r.status==='active'){if(r.ended!==null)return false;const royal=royalCards(a,v);if(royal.every(card=>(s.album.cards[card.id]||0)>0)!==r.complete||cfg.setIds.some(id=>royal.filter(card=>card.setId===id).every(card=>(s.album.cards[card.id]||0)>0)!==r.setClaims.includes(id)))return false;}
  else{const end=r.ended;if(!obj(end)||!int(end.at,s.time)||end.at-offset<=cfg.endsAt||!obj(end.packCounts)||Object.entries(end.packCounts).some(([id,n])=>!cfg.packIds.includes(id)||!packIds.includes(id)||!int(n,100000)||n<1)||!Array.isArray(end.duplicates)||!unique(end.duplicates.map(row=>row.id))||!end.duplicates.every(row=>cards.some(card=>card.id===row.id&&card.kind==='royal'&&card.stars===row.stars)&&int(row.count,100000)&&row.count>0)||end.cachedStars!==end.duplicates.reduce((sum,row)=>sum+row.count*row.stars,0)||end.energy!==Math.min(100,Object.entries(end.packCounts).reduce((sum,[id,n])=>sum+royalEnergy(id)*n,0))||royalCards(a,v).some(card=>(s.album.cards[card.id]||0)>0))return false;}
 }
 return true;
}catch{return false;}}

const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,value,disabled=false)=>`<button type="button" class="button" data-play="season:${e(action)}"${value!==undefined?` data-value="${e(typeof value==='object'?JSON.stringify(value):value)}"`:''}${disabled?' disabled':''}>${label}</button>`;
export function renderAlbumVariants(s,c,{phase,now=s.time,study}={}){
 if(!c.album)return '';const v=s.album.variants,playing=phase==='Started';
 if(!v)return `<section class="album-variants"><h3>조커·Royal·round · 명시 입력 실험</h3><p>현재 MVP 카드와 저장을 유지한 채 옵션을 추가합니다. 아래 예시의 common 배정은 연구 입력이며 원작 카드 종류 판정이 아닙니다. Royal 기간·세트·보상과 다음 round는 자동 채우지 않습니다.</p><details><summary>명시 연구 변형 설정 입력</summary><label>변형 설정 JSON<textarea data-season-album-variants-json rows="12">${e(JSON.stringify(albumVariantTemplate(c.album),null,2))}</textarea></label>${button('album-variants-configure','현재 카드를 보존하고 변형 설정 추가',undefined,!playing)}</details></section>`;
 const cards=albumVariantCards(c.album,v),selected=v.config.joker?.consume==='newest'?v.jokers.at(-1):v.jokers[0],r=v.config.royal,jokerDeadline=selected?Math.min(selected.at+86400,c.schedule.end+(c.schedule.clock==='relative-on-start'?(s.registeredAt||0):0)):null;
 return `<section class="album-variants"><h3>앨범 변형 · round ${v.round}</h3><p>조커 ${v.jokers.length}개 · Royal ${e(v.royal.status)} · 보존한 변환 별 ${v.cachedStars}. 일정·확률·서버 활성 배정은 확인하지 않았습니다.</p><div class="album-variant-grid"><section><h4>확정 보상 패킷의 조커</h4><label>종류<select data-season-joker-type><option value="joker_common_card">일반 조커</option><option value="joker_golden_card">금빛 조커</option></select></label><label>명시 수량<input type="number" min="1" max="1000" step="1" value="1" data-season-joker-count></label><label>독립 보상 패킷 ID<input data-season-joker-packet placeholder="이미 확인한 보상 또는 명시 연구 결과 ID"></label>${button('album-joker-grant','보상 결과를 조커 장부에 반영',undefined,!playing||!v.config.joker)}<label>선택 카드<select data-season-joker-card>${cards.filter(card=>eligibleCard(s,c,card.id)).map(card=>`<option value="${e(card.id)}">${e(card.id)} · ${e(card.kind)} · ${s.album.cards[card.id]||0}장</option>`).join('')}</select></label><label>소비 분기<select data-season-joker-consume><option value="oldest"${v.config.joker?.consume==='oldest'?' selected':''}>오래된 조커부터</option><option value="newest"${v.config.joker?.consume==='newest'?' selected':''}>새 조커부터</option></select></label>${button('album-joker-exchange','선택 카드로 조커1개 교환',undefined,!playing||!v.jokers.length)}${selected?`<p>기본 소비 조커 ${e(selected.type)} · 획득 ${selected.at}초 · 안내 기한 ${jokerDeadline}초(1일/시즌 종료 중 빠른 쪽)${now>jokerDeadline?' 경과 · 원본처럼 자동 삭제하지 않음':''}</p>`:''}<p>일반 조커는 금카드 선택을 거절합니다. 기한 경과는 원본의 사용 알림이며 자동 소멸로 바꾸지 않습니다.</p></section><section><h4>Royal 수집과 종료</h4>${r?`<p>명시 배정 ${e(r.id)} · 원본 비교 연산 ${r.startsAt}&lt;t&lt;${r.endsAt} · 레벨 ${r.minLevel} 이상 · setGroup ${e(r.setIds.join(', '))}</p><label>명시 연구 플레이어 레벨<input data-season-royal-level type="number" min="0" max="10000" step="1" placeholder="레벨 입력"></label>${button('album-royal-start','이 배정의 Royal 시작',undefined,!playing||v.royal.status!=='inactive')}<p>Royal 세트 ${v.royal.setClaims.length}/${r.setIds.length} · 전체 완성 ${v.royal.complete?'완료':'진행 중'} · 종료는 clock/재접속에서 재평가됩니다.</p>`:'<p>Royal 기간·레벨·왕관 카드·setGroup·보상·팩 배정이 없어 활성화하지 않습니다.</p>'}<h4>다음 round</h4>${button('album-round-upgrade','완성 후 다음 round로',undefined,!playing||!s.album.complete||!v.config.rounds)}<p>일반 카드와 미교환 일반 중복은 초기화됩니다. 조커·보유 팩·활성 Royal과 보존 별은 유지합니다. 보너스·다음 수집 범위가 입력되지 않으면 진행하지 않습니다.</p><label>중복 교환에 쓸 보존 별<input data-season-cached-stars type="number" min="0" max="${v.cachedStars}" step="1" value="0"></label></section></div><details><summary>설정과 실행 범위</summary><pre>${e(JSON.stringify(v.config,null,2))}</pre><p>원본 룰의 논리 투영입니다. 팩 난수·pity·레이저/무지개 전체 변형·현재 서버 일정·원작 최종 연출과 확정 출시 설계는 남아 있습니다.</p>${list(study?.sources).slice(0,6).map(source=>`<p><code>${e(source.path)}:${source.lineStart}</code><br><small>SHA-256 ${e(source.sha256)}</small></p>`).join('')}</details></section>`;
}

const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0&&x<=1e9;
const clone=x=>structuredClone(x);
const fail=message=>({ok:false,status:'unlimited-input',message,unknown:[]});
export function validUnlimitedInput(input){return object(input)&&Object.keys(input).every(k=>['origin','rows'].includes(k))&&input.origin==='explicit-research-input'&&Array.isArray(input.rows)&&input.rows.length>0&&input.rows.length<=100&&input.rows.every(row=>object(row)&&Object.keys(row).every(k=>['require','reward'].includes(k))&&integer(row.require)&&row.require>0&&row.require<=100000&&Array.isArray(row.reward)&&row.reward.length<=100&&row.reward.every(r=>object(r)&&typeof r.type==='string'&&r.type.length>0&&r.type.length<=160&&integer(r.count)&&r.count>0&&r.count<=100000));}
const total=c=>(c.pass?.levels||[]).reduce((n,r)=>n+r.require,0);
export function unlimitedPassView(s,c){
 const u=s.pass?.unlimited;if(!u)return {configured:false,earned:0,taken:0,remainder:0,next:[]};
 if(u.unlockTokens===null)return {configured:true,unlocked:false,earned:0,taken:u.taken,remainder:0,next:[]};
 let tokens=s.pass.tokens-u.unlockTokens;if(tokens<0)return {configured:true,unlocked:true,earned:0,taken:u.taken,remainder:0,next:[]};
 const cost=u.input.rows.reduce((n,r)=>n+r.require,0),cycles=Math.floor(tokens/cost);tokens-=cycles*cost;let earned=cycles*u.input.rows.length;
 for(const row of u.input.rows){if(tokens<row.require)break;tokens-=row.require;earned++;}
 const next=Array.from({length:Math.min(5,Math.max(0,earned-u.taken))},(_,i)=>{const level=u.taken+i+1;return {level,...clone(u.input.rows[(level-1)%u.input.rows.length])};});
 return {configured:true,unlocked:true,earned,taken:u.taken,remainder:tokens,unlockTokens:u.unlockTokens,next};
}
export function unlimitedPassTicket(s,value,c){
 const u=s.pass.unlimited;if(!u)return {ok:true};
 if(u.unlockTokens!==null&&value!=='super')return fail('반복 보상을 해금한 연구 시즌의 소유권을 임의 하향하지 않습니다. 새 고유 시즌에서 비교하세요.');
 if(value==='super'&&u.unlockTokens===null)u.unlockTokens=Math.max(s.pass.tokens,total(c));return {ok:true};
}
export function unlimitedPassAction(s,action,value,c,{phase,issue}){
 if(!action.startsWith('pass-unlimited-'))return null;
 if(!c.pass||phase!=='Started'&&!(action==='pass-unlimited-claim'&&phase==='Ended'))return fail('패스 플레이 또는 보상 수령 기간을 확인하세요.');
 if(action==='pass-unlimited-configure'){
  if(s.pass.unlimited!==undefined)return fail('이미 등록한 반복 보상표는 덮어쓰지 않습니다. 새 고유 시즌에서 설정하세요.');
  if(!validUnlimitedInput(value))return fail('반복 단계별 require와 reward를 명시하세요. 실제 서버 battlePassExtraReward는 자동으로 채우지 않습니다.');
  s.pass.unlimited={schema:1,input:clone(value),unlockTokens:s.ticket==='super'?Math.max(s.pass.tokens,total(c)):null,taken:0};
  return {ok:true,status:'applied',message:'명시한 반복 보상표를 추가했습니다. 실제 서버표 또는 출시 확정 밸런스가 아닙니다.',rewards:[],costs:[]};
 }
 const u=s.pass.unlimited;if(!u)return fail('명시한 반복 보상표가 필요합니다.');
 if(action==='pass-unlimited-claim'){
  const level=Number(value),v=unlimitedPassView(s,c);if(!Number.isSafeInteger(level)||level!==u.taken+1||level>v.earned||level>10000)return fail('달성한 다음 반복 단계만1회 수령합니다. 웹 영수증 한도는1만 단계입니다.');
  u.taken=level;issue('pass:unlimited:'+level,u.input.rows[(level-1)%u.input.rows.length].reward);
  return {ok:true,status:'applied',message:'반복 보상'+level+'단계의 지급 대기 영수증을 만들었습니다.',rewards:[],costs:[]};
 }
 return fail('지원하는 반복 보상 동작이 아닙니다.');
}
export function validUnlimitedPass(s,c){
 const u=s.pass?.unlimited;if(u===undefined)return true;
 if(!c.pass||!object(u)||Object.keys(u).some(k=>!['schema','input','unlockTokens','taken'].includes(k))||u.schema!==1||!validUnlimitedInput(u.input)||!integer(u.taken)||u.taken>10000)return false;
 if(u.unlockTokens===null)return u.taken===0;
 return integer(u.unlockTokens)&&u.unlockTokens>=total(c)&&u.unlockTokens<=Math.max(total(c),s.pass.tokens)&&s.ticket==='super'&&u.taken<=unlimitedPassView(s,c).earned;
}
export function unlimitedPassExpected(s){const u=s.pass?.unlimited;return !u?[]:Array.from({length:u.taken},(_,i)=>({key:'pass:unlimited:'+(i+1),rewards:clone(u.input.rows[i%u.input.rows.length].reward)}));}
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderUnlimitedPass(s,c,phase){
 if(!c.pass)return '';const v=unlimitedPassView(s,c);
 return `<section class="pass-unlimited"><h3>슈퍼 패스 · 마지막 단계 이후 반복 보상</h3><p>원본은 슈퍼 수령권 획득 시 현재 토큰과 기본 단계 총합 중 큰 값을 해금 기준으로 저장합니다. 이전에 쌓은 초과 토큰을 소급 보상하지 않으며, 명시한 단계 표를 순환합니다.</p>${!v.configured?`<details><summary>서버표 대신 명시 연구 보상표 입력</summary><label>단계 require/reward JSON<textarea rows="6" data-season-unlimited-json>${e(JSON.stringify({origin:'explicit-research-input',rows:[{require:null,reward:[]}]},null,2))}</textarea></label><button class="button" type="button" data-play="season:pass-unlimited-configure"${phase==='Started'?'':' disabled'}>현재 시즌에 반복 보상표 등록</button><p>누락한 필요 토큰·보상을 기본값으로 채우지 않습니다. 신규 게임의 확정 밸런스와 구분합니다.</p></details>`:`<p>해금 기준 ${v.unlocked?v.unlockTokens+'토큰':'슈퍼 수령권 가정 대기'} · 달성 ${v.earned}단계 · 수령 ${v.taken}단계 · 잔여 ${v.remainder}토큰</p>${v.next.length?`<ol>${v.next.map(row=>`<li>${row.level}단계 · ${row.require}토큰 · ${row.reward.map(r=>e(r.type)+' '+r.count).join(', ')||'명시 빈 보상'} <button class="button" type="button" data-play="season:pass-unlimited-claim" data-value="${row.level}"${['Started','Ended'].includes(phase)&&row.level===v.taken+1?'':' disabled'}>다음 단계 수령</button></li>`).join('')}</ol>`:'<p>해금 조건과 다음 단계 필요 토큰을 달성하면 수령할 수 있습니다.</p>'}<details><summary>등록한 연구 표</summary><pre>${e(JSON.stringify(s.pass.unlimited.input,null,2))}</pre></details>`}<p>순환 보상·해금 기준은 정적 규칙입니다. 실제 battlePassExtraReward·상품/가격·계정 배정은 미확보이며, 원작 결제·구매 복원을 연결하지 않습니다.</p></section>`;
}

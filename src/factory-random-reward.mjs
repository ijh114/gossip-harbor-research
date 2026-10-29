// RandomRewardData.lua:14-24,56-70 groups by Currency, then selects one
// weighted range and an inclusive integer per currency. Explicit draw tapes
// avoid consuming or claiming to reproduce the original/native RNG stream.
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const int=(x,max=100000)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const str=x=>typeof x==='string'&&x.length>0&&x.length<160;
const fail=(message,unknown)=>({ok:false,status:'unknown',message,unknown});
export function validFactoryRandomConfig(c){try{return obj(c)&&c.schema===1&&/^[a-f0-9]{64}$/.test(c.revision)&&['source-provided','research-example','designer-confirmed'].includes(c.origin)&&Array.isArray(c.rows)&&c.rows.length>0&&c.rows.length<=500&&new Set(c.rows.map(r=>r.name)).size===c.rows.length&&c.rows.every(r=>obj(r)&&str(r.name)&&r.name.startsWith('rdm_rwd_')&&Array.isArray(r.content_actual)&&r.content_actual.length>0&&r.content_actual.length<=100&&r.content_actual.every(x=>obj(x)&&str(x.Currency)&&!x.Currency.startsWith('rdm_rwd_')&&int(x.MinNum)&&int(x.MaxNum)&&x.MinNum<=x.MaxNum&&Number.isFinite(x.Weight)&&x.Weight>0&&x.Weight<=1e9));}catch{return false;}}
export function resolveFactoryRandomReward(c,id,draws){
 if(!validFactoryRandomConfig(c))return fail('유효한 RandomRewardContent 표가 없어 보상을 추정하지 않습니다.',['randomRewardContent']);const row=c.rows.find(x=>x.name===id);if(!row)return fail('해당 RandomRewardContent ID가 없습니다. 원작 기본 fallback을 실제 서버 보상으로 대체하지 않습니다.',['randomRewardContent.'+id]);
 const grouped=new Map();for(const r of row.content_actual){const a=grouped.get(r.Currency)||[];a.push(r);grouped.set(r.Currency,a);}const rewards=[],trace=[];
 for(const [type,rows]of grouped){const draw=draws?.[type];if(!obj(draw)||!Number.isFinite(draw.choice)||draw.choice<0||draw.choice>=1||!Number.isFinite(draw.amount)||draw.amount<0||draw.amount>=1)return fail('각 재화별 가중 선택·수량의 명시 난수가 필요합니다.',['randomDraw.'+type]);const total=rows.reduce((n,r)=>n+r.Weight,0);let p=draw.choice*total,selected=rows.at(-1),index=rows.length-1;for(let i=0;i<rows.length;i++){p-=rows[i].Weight;if(p<0){selected=rows[i];index=i;break;}}const count=selected.MinNum+Math.floor(draw.amount*(selected.MaxNum-selected.MinNum+1));if(count)rewards.push({type,count});trace.push({type,index,choice:draw.choice,amount:draw.amount,count});}
 return {ok:true,status:'resolved',rewards,trace,revision:c.revision,origin:c.origin,nativeRngObserved:false};
}

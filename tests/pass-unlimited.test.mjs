import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createActivitySeason,activitySeasonAction,validActivitySeason} from '../src/activity-season.mjs';
import {unlimitedPassView} from '../src/pass-unlimited.mjs';
import {createPlay} from '../src/play-model.mjs';
import {createActivityLinkInputs,configureActivityTransaction,commitActivityTransaction} from '../src/activity-transaction.mjs';
const load=async n=>JSON.parse(await readFile(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const [c,p]=await Promise.all(['activity-season','play-config'].map(load));
const input={origin:'explicit-research-input',rows:[{require:2,reward:[{type:'gold',count:3}]},{require:3,reward:[{type:'energy',count:2}]}]};
const act=(s,a,v,now=0)=>activitySeasonAction(s,a,v,c,{now});
function started(){const s=createActivitySeason(c);assert.equal(act(s,'start').ok,true);return s;}
const configure=s=>{const r=act(s,'pass-unlimited-configure',input);assert.equal(r.ok,true,r.message);};
function tokens(s,n){assert.equal(act(s,'record',{kind:'customer',count:n}).ok,true);assert.equal(act(s,'finish-task','orders').ok,true);}
test('optional source-shaped unlimited pass keeps older saves, refuses fabricated defaults, and preserves base-only state on rejection',()=>{
 const s=started();assert.equal(validActivitySeason(s,c),true);assert.equal(unlimitedPassView(s,c).configured,false);const before=structuredClone(s);
 for(const bad of [{origin:'server',rows:input.rows},{origin:'explicit-research-input',rows:[{require:null,reward:[]}]},{...input,rows:[{require:0,reward:[]}]},{...input,rows:[{require:1,reward:[{type:'gold',count:-1}]}]}]){assert.equal(act(s,'pass-unlimited-configure',bad).ok,false);assert.deepEqual(s,before);}
 configure(s);const configured=structuredClone(s);assert.equal(act(s,'pass-unlimited-configure',input).ok,false);assert.deepEqual(s,configured);assert.equal(unlimitedPassView(s,c).unlocked,false);
});
test('late super purchase captures current/base maximum without retroactive excess, cyclic levels and receipts survive reload',()=>{
 let s=started();configure(s);tokens(s,90);const previous=s.pass.tokens;assert.equal(act(s,'ticket','super').ok,true);assert.equal(s.pass.unlimited.unlockTokens,Math.max(previous,c.pass.levels.reduce((n,r)=>n+r.require,0)));assert.equal(unlimitedPassView(s,c).earned,0);
 tokens(s,24);const v=unlimitedPassView(s,c),delta=s.pass.tokens-s.pass.unlimited.unlockTokens;assert.equal(v.earned,Math.floor(delta/5)*2+(delta%5>=2?1:0));
 const first=act(s,'pass-unlimited-claim','1');assert.equal(first.ok,true,first.message);assert.equal(s.pending[0].key,'pass:unlimited:1');assert.deepEqual(s.pending[0].rewards,input.rows[0].reward);const before=structuredClone(s);assert.equal(act(s,'pass-unlimited-claim',1).ok,false);assert.deepEqual(s,before);s=JSON.parse(JSON.stringify(s));assert.equal(validActivitySeason(s,c),true);
 const forged=structuredClone(s);forged.pending[0].rewards[0].count++;assert.equal(validActivitySeason(forged,c),false);assert.equal(act(s,'ticket','premium').ok,false);assert.equal(s.ticket,'super');
});
test('base threshold, exact earned boundary, released expiry and corrupt unlock/taken state are enforced',()=>{
 const s=started();configure(s);assert.equal(act(s,'ticket','super').ok,true);const base=c.pass.levels.reduce((n,r)=>n+r.require,0);assert.equal(s.pass.unlimited.unlockTokens,base);
 s.pass.tokens=base+1;assert.equal(unlimitedPassView(s,c).earned,0);assert.equal(act(s,'pass-unlimited-claim',1).ok,false);s.pass.tokens=base+2;assert.equal(act(s,'pass-unlimited-claim',1,c.schedule.end).ok,true);assert.equal(act(s,'pass-unlimited-claim',2,c.schedule.release).ok,false);
 for(const [key,value]of [['unlockTokens',0],['taken',20000]]){const bad=structuredClone(s);bad.pass.unlimited[key]=value;assert.equal(validActivitySeason(bad,c),false);}
 const large=structuredClone(s);large.pass.tokens=1e9;const v=unlimitedPassView(large,c);assert.ok(v.earned>1e8);assert.ok(v.next.length<=5);
});
test('main economic bridge debits no currency for configuration and atomically rejects an unavailable reward destination',()=>{
 const configured=configureActivityTransaction(createPlay(p),{...createActivityLinkInputs(),enabled:true,acceptedConfigRevision:c.revision},c,{playConfig:p});assert.equal(configured.ok,true);let main=configured.state;
 for(const[a,v]of [['start',undefined],['pass-unlimited-configure',{origin:'explicit-research-input',rows:[{require:1,reward:[{type:'unassigned-server-only',count:1}]}]}],['ticket','super'],['record',{kind:'customer',count:120}],['finish-task','orders']]){const out=commitActivityTransaction(main,a,v,c,{playConfig:p,now:0});assert.equal(out.ok,true,out.message);main=out.state;}
 const before=structuredClone(main),out=commitActivityTransaction(main,'pass-unlimited-claim',1,c,{playConfig:p,now:0});assert.equal(out.ok,false);assert.deepEqual(main,before);assert.equal(main.activitySeason.pass.unlimited.taken,0);
});

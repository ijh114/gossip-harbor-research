// Source TutorialModel owns these temporary values. Keep the web application
// scope out of saves/config revisions and restore it even if a consumer throws.
const scopes=new WeakMap();
const cost=v=>Number.isSafeInteger(v)&&v>=0&&v<=1e9;
export function normalizeTutorialEconomy(constraints={}){
 if(!constraints||typeof constraints!=='object'||Array.isArray(constraints))return {ok:false,unknown:['tutorial-constraints']};
 const out={},unknown=[];
 for(const [from,to]of [['forceSkipCost','forcedSkipCost'],['forceBubbleCost','forcedBubbleCost']])if(constraints[from]!==null&&constraints[from]!==undefined){if(cost(constraints[from]))out[to]=constraints[from];else unknown.push(from);}
 const code=constraints.forceSpreadCode;
 if(code!==null&&code!==undefined){if((typeof code==='string'&&code.length>0&&code.length<=160)||(Number.isSafeInteger(code)&&code>=0))out.forcedSpreadType=String(code);else unknown.push('forceSpreadCode');}
 return {ok:unknown.length===0,values:out,unknown};
}
export function withTutorialEconomy(state,constraints,operation){
 const normalized=normalizeTutorialEconomy(constraints);if(!normalized.ok||!state||typeof state!=='object'||typeof operation!=='function')throw TypeError('Known tutorial economic directives and a synchronous consumer are required');
 const previous=scopes.get(state);scopes.set(state,normalized.values);
 try{return operation();}finally{if(previous)scopes.set(state,previous);else scopes.delete(state);}
}
export function tutorialEconomyFor(state,onboarding={}){return {...onboarding,...(scopes.get(state)||{})};}

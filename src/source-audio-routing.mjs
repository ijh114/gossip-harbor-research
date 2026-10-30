// Source priority: MainBoardView.GetMergeAudioSfx/_GetSpreadAudio. Component
// facts must come from the committed model; names/prefixes never imply them.
const item=(c,type)=>c?.items?.find(x=>x.type===String(type));
const own=(x,k)=>x!==null&&typeof x==='object'&&Object.hasOwn(x,k);
const isBubble=(s,cell)=>Boolean(cell&&own(s?.bubbles,cell.uid));
const freshCells=(before,after)=>before?.uids instanceof Set&&Array.isArray(after?.board)?after.board.filter(x=>x&&!before.uids.has(x.uid)):[];
const manual=random=>{const value=random();return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<1?value<.7?'manual-generate':'manual-generate-alternate':null;};
const dog=type=>{const n=Number(type);return n>=1602&&n<=1604?'dog-merge-1':n>=1605&&n<=1607?'dog-merge-2':n>=1608&&n<=1610?'dog-merge-3':null;};
export function sourceBoardCue(action,before,after,result,c,{random=Math.random}={}){
 if(typeof action!=='string'||!result?.ok||action.startsWith('aid-')||['time','save','export','scenario','new-game'].includes(action))return null;
 if(action==='deliver')return 'order-serve';
 if(action==='buy-energy')return 'shop-energy-success';
 if(action==='quest-finish')return 'reward-window';
 if(action==='buy-bubble')return 'bubble-open';
 if(action==='store')return 'store-item';
 if(action==='pop-cache')return 'manual-generate';
 if(action==='collect'){const reward=c?.specialRules?.collectibles?.find(x=>x.type===before?.selectedType)?.reward;return {gold:'collect-coins',gem:'collect-gems',energy:'collect-energy',experience:'collect-experience',energyInfiniteTime:'collect-energy'}[reward?.type]||null;}
 if(action==='sell'&&after?.wallet?.coins>before?.coins)return 'collect-coins';
 const fresh=freshCells(before,after),components=before?.audioComponents||{};
 if(result.generatedType!==undefined||action==='generate'){
  const matching=fresh.filter(x=>result.generatedType===undefined||x.type===String(result.generatedType));if(matching.length!==1)return null;const made=matching[0];
  // Exact enum names require the source event's own identity. The broad
  // lucky-external branch cannot distinguish Lucky/Super/Double/Triple.
  const kind=result.boardSpreadType??null;
  if(kind==='CardItem')return 'card-item-generate';
  if(isBubble(after,made))return 'bubble-spawn';
  if(components.newTemp===true)return 'temp-item-appear';
  const sourceType=before?.sourceType??before?.sourceCell?.type;
  if(item(c,sourceType)?.chainId==='15')return 'dog-merge-1';
  const lucky={Lucky:'lucky-generate-1',FreeLucky:'lucky-generate-1',SuperLucky:'lucky-generate-2',FreeSuperLucky:'lucky-generate-2',DoubleLucky:'lucky-generate-3',TripleLucky1:'lucky-generate-3',TripleLucky2:'lucky-generate-4'};
  if(own(lucky,kind))return lucky[kind];
  if(result.branch==='lucky-external')return null;
  if(Number.isInteger(result.boostRatio)&&result.boostRatio>0)return 'boost-generate';
  return manual(random);
 }
 if(['cell','move'].includes(action)&&before?.mergePair){
  const next=item(c,before.sourceType??before.sourceCell?.type)?.next;
  const matching=fresh.filter(x=>!isBubble(after,x)&&(next===undefined||next===null||x.type===String(next)));if(matching.length!==1)return null;const made=matching[0];
  if(components.newCardMax===true)return 'card-item-merge';
  if(components.sourceTemp===true||components.targetTemp===true)return 'temp-item-merge';
  const bark=dog(made.type);if(bark)return bark;
  const level=item(c,made.type)?.chainLevel;return Number.isInteger(level)&&level>0?'merge-level-'+Math.min(9,Math.max(2,level)):null;
 }
 return null;
}

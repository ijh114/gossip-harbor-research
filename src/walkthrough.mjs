import * as engine from './engine.mjs';

export const STAGES=['loading','title','tutorial','main','play','home'];
export const STAGE_NAMES={loading:'로딩',title:'타이틀',tutorial:'튜토리얼',main:'메인',play:'게임 플레이',home:'집 발전·변화'};
export const RENOVATIONS=[{name:'바닥 정리',cost:40},{name:'벽면 보수',cost:60},{name:'가구 배치',cost:80}];
// Original art, tutorial order, prices, drops and quests are not reconstructed here.
export function createWalkthrough(){
 return {stage:'loading',load:0,tutorial:0,visited:['loading'],game:engine.createState({board:Array(63).fill(null),seed:42}),homeLevel:0,style:'sage',message:'분석 데이터, 시연 그래픽, 실험 상태를 순서대로 준비합니다.',selected:null,modal:null};
}
const setStage=(s,stage)=>{s.stage=stage;if(!s.visited.includes(stage))s.visited.push(stage);s.selected=null;s.modal=null;};
export function walkthroughAction(s,action,value){
 const fail=message=>(s.message=message,{ok:false,message});
 const ok=message=>(s.message=message,{ok:true,message});
 if(action==='load'){
  if(s.stage!=='loading')return fail('로딩 단계에서만 준비할 수 있습니다.');
  s.load=Math.min(3,s.load+1);if(s.load===3){setStage(s,'title');return ok('준비 완료. 타이틀에서 시연을 시작하세요.');}
  return ok(['','분석 데이터 준비 완료.','시연 그래픽 준비 완료.'][s.load]);
 }
 if(action==='start'){if(s.stage!=='title')return fail('타이틀에서 시작하세요.');setStage(s,'tutorial');return ok('생성기를 눌러 같은 아이템 두 개를 만드세요.');}
 if(action==='tutorial-generate'){
  if(s.stage!=='tutorial'||s.tutorial!==0)return fail('현재 안내에 따라 진행하세요.');
  s.game.board[0]={family:'bread',level:1};s.game.board[1]={family:'bread',level:1};s.game.energy-=2;s.tutorial=1;return ok('첫 번째 아이템을 선택하세요.');
 }
 if(action==='tutorial-cell'){
  if(s.stage!=='tutorial')return fail('튜토리얼 화면에서 조작하세요.');
  if(s.tutorial===1&&Number(value)===0){s.selected=0;s.tutorial=2;return ok('두 번째 같은 아이템을 눌러 합성하세요.');}
  if(s.tutorial===2&&Number(value)===1){engine.mergeItems(s.game,0,1);s.selected=null;s.tutorial=3;return ok('합성이 완료됐습니다. 메인 화면으로 이동할 수 있습니다.');}
  return fail('강조된 칸을 순서대로 선택하세요.');
 }
 if(action==='finish-tutorial'){if(s.stage!=='tutorial'||s.tutorial!==3)return fail('생성·선택·합성 안내를 먼저 완료하세요.');setStage(s,'main');return ok('메인에서 퍼즐 플레이와 집 발전을 선택하세요.');}
 if(action==='play'||action==='home'||action==='main'){
  if(!s.visited.includes('main'))return fail('먼저 튜토리얼을 완료하세요.');setStage(s,action);return ok(action==='play'?'생성 → 합성 → 주문 제출로 골드를 모으세요.':action==='home'?'주문 골드로 집을 바꾸세요. 비용과 장면은 독립 실험값입니다.':'메인으로 돌아왔습니다.');
 }
 if(action==='generate'){
  if(s.stage!=='play')return fail('퍼즐 플레이 화면에서 생성하세요.');const r=engine.generateItem(s.game);return okOrFail(s,r);
 }
 if(action==='cell'){
  if(s.stage!=='play')return fail('퍼즐 플레이 화면에서 조작하세요.');const index=Number(value);
  if(!Number.isInteger(index)||index<0||index>=s.game.board.length)return fail('올바른 보드 칸을 선택하세요.');
  if(s.selected===null){if(!s.game.board[index])return fail('먼저 아이템이 있는 칸을 선택하세요.');s.selected=index;return ok('같은 아이템을 누르면 합성, 빈칸을 누르면 이동합니다.');}
  if(s.selected===index){s.selected=null;return ok('선택을 해제했습니다.');}
  const r=engine.mergeItems(s.game,s.selected,index);s.selected=null;return okOrFail(s,r);
 }
 if(action==='deliver'){if(s.stage!=='play')return fail('퍼즐 플레이 화면에서 주문을 제출하세요.');return okOrFail(s,engine.deliverOrder(s.game));}
 if(action==='refill'){if(s.stage!=='play')return fail('퍼즐 플레이 화면에서 충전하세요.');return okOrFail(s,engine.buyEnergy(s.game));}
 if(action==='advance'){if(s.stage!=='play')return fail('퍼즐 플레이 화면에서 시간을 진행하세요.');return okOrFail(s,engine.advanceTime(s.game,3600));}
 if(action==='renovate'){
  if(s.stage!=='home')return fail('집 발전 화면에서 진행하세요.');const step=RENOVATIONS[s.homeLevel];if(!step)return fail('시연의 세 단계 집 발전을 모두 완료했습니다.');
  if(s.game.coins<step.cost)return fail(`골드 ${step.cost}개 필요 · 보유 ${s.game.coins}개. 퍼즐 주문을 완료하세요.`);
  s.game.coins-=step.cost;s.homeLevel++;return ok(`${step.name} 완료 · 골드 −${step.cost}. 변경 전후를 비교할 수 있습니다.`);
 }
 if(action==='style'){if(!['sage','sand'].includes(value))return fail('지원하지 않는 배치입니다.');s.style=value;return ok('시연용 공간 색상을 변경했습니다.');}
 return fail('지원하지 않는 동작입니다.');
}
function okOrFail(s,result){s.message=result.message;return result;}

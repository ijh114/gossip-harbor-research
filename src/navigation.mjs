import {DOMAIN_DEFS} from './domain-model.mjs';

export const STUDIO_PAGES={research:'연구',captures:'실제 화면 · 관측 자료','bm-validation':'후속 검증 · BM 조건',puzzle:'퍼즐 도감','puzzle-interaction':'퍼즐 · 상호작용','puzzle-difficulty':'퍼즐 · 난이도',interface:'UI 도감','interface-structure':'UI · 구조','interface-motion':'UI · 연출',experience:'게임 시뮬레이션'};
export const VISUAL_ROUTES=Object.keys(STUDIO_PAGES).filter(id=>!['research','bm-validation'].includes(id));
export const RESEARCH_ROUTES=['research','bm-validation','overview',...DOMAIN_DEFS.map(d=>d.id),'wiki','catalog','triggers','simulator','evidence'];
const link=(id,label)=>`<a href="#${id}" data-route="${id}">${label}</a>`;
export function renderNavigation(){
 return `<details class="nav-tree" data-nav-group="puzzle" open><summary>퍼즐</summary><div class="nav-children">${link('puzzle','타입·연출 도감')}${link('puzzle-interaction','상호작용')}${link('puzzle-difficulty','난이도')}</div></details>
 <details class="nav-tree" data-nav-group="interface"><summary>UI</summary><div class="nav-children">${link('interface','화면 도감')}${link('interface-structure','UI 구조')}${link('interface-motion','UI 연출')}</div></details>
 ${link('experience','게임 시뮬레이션')}
 ${link('captures','실제 화면 · 관측 자료')}
 <details class="nav-tree research-tree" data-nav-group="research"><summary>연구 <small>상세 분석 문서</small></summary><div class="nav-children">${link('research','연구 홈')}${link('bm-validation','후속 검증 · BM 조건')}${link('overview','연구 개요')}<details class="nav-subtree" open><summary>시스템 분석</summary><div class="nav-children">${DOMAIN_DEFS.map(d=>link(d.id,d.title)).join('')}</div></details><details class="nav-subtree" open><summary>근거와 실험</summary><div class="nav-children">${link('wiki','전체 근거 위키')}${link('catalog','상품 카탈로그')}${link('triggers','오퍼 트리거 실험')}${link('simulator','규칙 시뮬레이션')}${link('evidence','근거 · Unity 이식')}</div></details></div></details>`;
}
let previous='';
export function syncNavigation(route){
 for(const link of document.querySelectorAll('[data-route]')){if(link.dataset.route===route){link.setAttribute('aria-current','page');if(route!==previous){let parent=link.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}}}else link.removeAttribute('aria-current');}
 if(route!==previous){const group=RESEARCH_ROUTES.includes(route)?'research':route.startsWith('interface')?'interface':route.startsWith('puzzle')?'puzzle':'';for(const tree of document.querySelectorAll('[data-nav-group]'))tree.classList.toggle('active-tree',tree.dataset.navGroup===group);}
 previous=route;
}

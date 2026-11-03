export const ATLAS_PAGE_SIZE={map:36,npc:60,motion:24};
export const ATLAS_DEFAULTS={tab:'map',scope:'prefab',area:'all',category:'all',kind:'all',role:'all',phase:'all',query:'',page:1,materialExamples:true};
export function atlasStateFromHash(hash,data){const p=new URLSearchParams(String(hash).split('?')[1]||''),state={...ATLAS_DEFAULTS};
 for(const key of ['tab','scope','area','category','kind','role','phase'])if(p.has(key))state[key]=p.get(key);
 state.query=(p.get('q')||'').slice(0,200);state.page=Number(p.get('page')||1);state.materialExamples=p.get('examples')!=='off';
 if(!['map','npc','motion'].includes(state.tab))state.tab='map';if(!['model','prefab','all'].includes(state.scope))state.scope='prefab';
 if(!data.areas.some(a=>a.id===state.area))state.area='all';if(!data.categories.some(c=>c.id===state.category))state.category='all';
 if(!['human','animal','customer','vehicle','ensemble','variant'].includes(state.kind))state.kind='all';if(!data.roles.some(r=>r.id===state.role))state.role='all';if(!['begin','loop','end','idle','other','static'].includes(state.phase))state.phase='all';return state;
}
export function atlasHash(state){const p=new URLSearchParams({tab:state.tab});for(const k of ['scope','area','category','kind','role','phase'])if(state[k]!==ATLAS_DEFAULTS[k])p.set(k,state[k]);if(state.query)p.set('q',state.query);if(state.page>1)p.set('page',state.page);if(!state.materialExamples)p.set('examples','off');return '#world-atlas?'+p.toString();}
export function selectWorldAtlas(data,state){const s={...ATLAS_DEFAULTS,...state},q=s.query.trim().normalize('NFKC').toLocaleLowerCase(),match=v=>!q||String(v).normalize('NFKC').toLocaleLowerCase().includes(q);let rows;
 if(s.tab==='map')rows=data.mapEntries.filter(r=>(s.scope==='all'||r.format===s.scope)&&(s.area==='all'||r.areaIds.includes(s.area))&&(s.category==='all'||r.category===s.category)&&match([r.name,r.path,r.slotId,r.resourceKey,r.categoryKeyword].join(' ')));
 else if(s.tab==='npc')rows=data.roles.filter(r=>(s.kind==='all'||s.kind==='variant'?s.kind==='all'||r.variant:r.kind===s.kind)&&(s.role==='all'||r.id===s.role)&&match([r.title,r.baseTitle,r.sourceId,r.canonical,r.path].join(' ')));
 else{const roles=new Map(data.roles.map(r=>[r.id,r]));rows=data.motions.filter(m=>{const r=roles.get(m.roleId);return(s.role==='all'||m.roleId===s.role)&&(s.kind==='all'||s.kind==='variant'?s.kind==='all'||r.variant:r.kind===s.kind)&&(s.phase==='all'||s.phase==='static'?s.phase==='all'||m.staticOnly:m.phase===s.phase)&&match([m.animation,r.title,r.baseTitle,r.sourceId,r.canonical].join(' '));});}
 const size=ATLAS_PAGE_SIZE[s.tab]||36,pages=Math.max(1,Math.ceil(rows.length/size)),page=Number.isInteger(s.page)&&s.page>0?Math.min(s.page,pages):1;
 return{rows:rows.slice((page-1)*size,page*size),allRows:rows,total:rows.length,pages,page,size,start:rows.length?(page-1)*size+1:0,end:Math.min(page*size,rows.length)};
}
export function atlasCSV(data,state){const selected=selectWorldAtlas(data,state),cell=value=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};let rows;
 if(state.tab==='map')rows=[['ID','자산 경로','모집단','구역','종류(분석자 분류)','표현','이미지 키'],...selected.allRows.map(r=>[r.id,r.path,r.format,r.areaIds.join(' / '),r.category,r.previewKind,r.mediaKey])];
 else if(state.tab==='npc')rows=[['ID','표시명','원본 이름','분류','변형','모션 항목','자산 경로'],...selected.allRows.map(r=>[r.id,r.title,r.sourceId,r.kind,r.variant,r.motionCount,r.path])];
 else rows=[['ID','역할','애니메이션','선언 길이(초)','접미사 분류','정적 포즈','미리보기 구간 수','골격 객체SHA256'],...selected.allRows.map(r=>[r.id,r.roleId,r.animation,r.duration,r.phase,r.staticOnly,r.segments.length,r.sourceSHA256])];
 return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
}

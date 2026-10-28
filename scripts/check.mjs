import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {mergeResearch,DOMAIN_DEFS,selectDomainFacts} from '../src/domain-model.mjs';
const base=JSON.parse(await readFile('dist/data/research.json','utf8'));
const extension=JSON.parse(await readFile('dist/data/domains.json','utf8'));
const data=mergeResearch(base,extension);
if(data.meta.version!=='4.10.5')throw new Error('Unexpected research version');
if(new Set(data.facts.map(x=>x.id)).size!==data.facts.length)throw new Error('Duplicate fact IDs');
if(data.products.length!==251)throw new Error('Expected 251 packaged global IAP declarations');
for(const fact of data.facts){if(!fact.title||!fact.summary||!Array.isArray(fact.sources))throw new Error('Invalid fact '+fact.id);if(fact.kind!=='inference'&&!fact.sources.length)throw new Error('Missing provenance '+fact.id);}
for(const p of data.products){if(!Number.isFinite(p.priceUsd)||p.priceUsd<0||!p.sources?.length)throw new Error('Invalid product '+p.id);}
for(const def of DOMAIN_DEFS){if(!extension.pages[def.id]?.sections.length||!selectDomainFacts(data.facts,def.id).length)throw new Error('Missing research chapter '+def.id);}
const html=await readFile('dist/index.html','utf8');
for(const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
 const ref=m[1];if(/^(?:#|https?:|data:|mailto:)/.test(ref))continue;
 if(ref.startsWith('/'))throw new Error('Root-relative asset breaks GitHub project Pages: '+ref);
 await stat(path.join('dist',ref.split('?')[0]));
}
async function audit(dir){for(const n of await readdir(dir)){const p=path.join(dir,n),s=await stat(p);if(s.isDirectory())await audit(p);else if(/\.(apk|xapk|luac|bundle|bin|so|dll)$/i.test(n))throw new Error('Raw app binary is not publishable: '+p);}}
await audit('dist');
console.log(`Verified ${DOMAIN_DEFS.length} research chapters, ${data.facts.length} sourced findings, ${data.products.length} product defaults, relative asset paths and publish boundary.`);

import {cp, mkdir, rm, readdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'dist');
if (path.relative(root, output) !== 'dist') throw new Error('Invalid output path');
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
await cp(path.join(root,'src'), output, {recursive:true});
let count=0, bytes=0;
async function scan(dir) {for (const name of await readdir(dir)) {const p=path.join(dir,name); const s=await stat(p); if(s.isDirectory()) await scan(p); else {count++; bytes+=s.size; if(/\.(apk|xapk|luac|bundle|bin)$/i.test(name)) throw new Error('Raw game artifact in publish output: '+name);}}}
await scan(output);
console.log(`Static build ready: ${count} files, ${(bytes/1024).toFixed(0)} KiB. GitHub Pages / Cloudflare Pages compatible.`);

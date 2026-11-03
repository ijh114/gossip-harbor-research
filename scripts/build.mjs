import {cp, mkdir, rm, readdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {syncChecklist} from './checklist-data.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'dist');
if (path.relative(root, output) !== 'dist') throw new Error('Invalid output path');
await syncChecklist();
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
if(process.platform==='win32'){
  // The native copy avoids serial per-file overhead for the curated media tree.
  // /E copies into the fresh output directory; it never mirrors or purges source.
  await new Promise((resolve,reject)=>{
    const copy=spawn('robocopy.exe',[path.join(root,'src'),output,'/E','/MT:8','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let message='';
    for(const stream of [copy.stdout,copy.stderr])stream.on('data',chunk=>{message=(message+chunk.toString()).slice(-4000);});
    copy.on('error',reject);
    copy.on('close',code=>code!==null&&code<8?resolve():reject(new Error(`Static copy failed (${code}): ${message}`)));
  });
}else await cp(path.join(root,'src'), output, {recursive:true});
let count=0, bytes=0;
async function scan(dir) {for (const name of await readdir(dir)) {const p=path.join(dir,name); const s=await stat(p); if(s.isDirectory()) await scan(p); else {count++; bytes+=s.size; if(/\.(apk|xapk|luac|bundle|bin)$/i.test(name)) throw new Error('Raw game artifact in publish output: '+name);}}}
await scan(output);
console.log(`Static build ready: ${count} files, ${(bytes/1024).toFixed(0)} KiB. GitHub Pages / Cloudflare Pages compatible.`);

import {readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else files.push(p);}}await walk('assets');await walk('worker');
const manifest=[];for(const path of files){const data=await readFile(path);manifest.push({path,size:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
const missing=[];function check(value){if(typeof value==='string'&&/^(\.\/assets\/|\/uploads\/)/.test(value)){value=value.split('?')[0];if(value==='./assets/videos/baptism-hero.mp4')return;const path=value.startsWith('/uploads/')?'assets/data'+value:value.slice(2);if(!existsSync(path))missing.push(value);}else if(value&&typeof value==='object')Object.values(value).forEach(check);}
for(const path of files.filter(p=>p.startsWith('assets/data/')&&p.endsWith('.json')&&!p.includes('/backups/')))check(JSON.parse(await readFile(path,'utf8')));
for(const file of ['index.html','assets/js/site.js','assets/css/styles.css','assets/css/modern.css']){const text=await readFile(file,'utf8');for(const match of text.matchAll(/["'](\.\/assets\/[^"'\r\n]+)["']/g)){if(!match[1].includes('${')&&!match[1].endsWith('/'))check(match[1]);}}
await writeFile('ASSET-MANIFEST.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({files:manifest.length,bytes:manifest.reduce((n,f)=>n+f.size,0),missing:[...new Set(missing)]},null,2));
if(missing.length)process.exitCode=1;

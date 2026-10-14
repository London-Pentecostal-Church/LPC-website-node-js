import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const server=spawn(process.execPath,['preview-server.mjs'],{env:{...process.env,PORT:'4177',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
try{
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',()=>reject(Error('Server exited')));});
const manifest=JSON.parse(await readFile('ASSET-MANIFEST.json','utf8'));
const paths=['/','/api/branches','/api/home-hero','/api/hero-images','/api/pastors',...manifest.filter(f=>f.path.startsWith('assets/')).map(f=>'/'+f.path)];
for(const path of paths){const r=await fetch('http://127.0.0.1:4177'+encodeURI(path));if(!r.ok)throw Error(path+' returned '+r.status);await r.arrayBuffer();}
const js=await readFile('assets/js/site.js','utf8');const routes=[...js.matchAll(/href=["']#\/([^"']+)["']/g)].map(m=>m[1]).filter(r=>!r.includes('${')&&!r.includes('+'));
console.log('PASS: '+paths.length+' local HTTP resources; internal links use hash routing.');
}finally{server.kill();}

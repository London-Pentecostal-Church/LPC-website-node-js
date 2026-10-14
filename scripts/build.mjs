import {readFile,writeFile,mkdir,cp,rm,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
const configs={}; for(const name of ['home-hero','hero-images','pastor-thought','site-settings','pastors','branches','image-framing','page-images']) configs[name]=JSON.parse(await readFile(`assets/data/${name}.json`,'utf8'));
const assets=[];
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await scan(p);else if(/\.(jpe?g|png|webp|svg|mp4|webm|mov|m4v)$/i.test(p))assets.push({name:e.name,path:'./'+p.replaceAll('\\','/'),type:/\.(mp4|webm|mov|m4v)$/i.test(p)?'video':'image',source:'asset',size:(await stat(p)).size,modified:(await stat(p)).mtimeMs});}}
await scan('assets/images');await scan('assets/videos');
let source=await readFile('assets/js/site.js','utf8');
source=source.replace(/let branchCards = \[[\s\S]*?\n\];/, '').replace(/let branchConfig = .*;\r?\n/,'');
source=source.replace(/let pastors = \[[\s\S]*?\n\];/, '').replace(/let pastorConfig = .*;\r?\n/, '');
const design=source+' '+await readFile('index.html','utf8')+' '+await readFile('assets/css/styles.css','utf8');
const bundledReferences=[...new Set(design.match(/\.\/assets\/(?:images|videos)\/[^"'\x60<>\s)]+/g)||[])];
bundledReferences.push('./assets/images/team/sam-john-hero.jpg');
const backups={};for(const f of await readdir('assets/data/backups'))if(f.endsWith('.json'))backups[f]=JSON.parse(await readFile('assets/data/backups/'+f,'utf8'));
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/client',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await cp('assets','dist/client/assets',{recursive:true});await cp('index.html','dist/client/index.html');
let worker=await readFile('worker/index.js','utf8');worker=worker.replace('/* BUNDLED_DATA */',`const defaults=${JSON.stringify(configs)};const bundledAssets=${JSON.stringify(assets)};const bundledBackups=${JSON.stringify(backups)};const bundledReferences=${JSON.stringify(bundledReferences)};`);
await writeFile('dist/server/index.js',worker);
console.log('Built website, admin server and existing configuration assets');


for (const file of ['calendar.mjs','ical.js','ICAL-LICENSE.txt']) await cp('worker/'+file,'dist/server/'+file);

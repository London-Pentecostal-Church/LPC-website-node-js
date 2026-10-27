import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

test('Built worker includes every local module import and starts without missing dependencies', async () => {
  for (const file of await readdir('dist/server')) {
    if (!/\.(m?js)$/.test(file)) continue;
    const source = await readFile(path.join('dist/server',file),'utf8');
    for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\sfrom\s*)?["'](\.{1,2}\/[^"']+)["']/g)) {
      assert((await stat(path.resolve('dist/server',match[1]))).isFile(),`${file} dependency ${match[1]} missing`);
    }
  }
  const {default:worker} = await import('../dist/server/index.js');
  assert.equal(typeof worker.fetch,'function');
  const response = await worker.fetch(new Request('https://church.test/api/volunteers/session'),{
    BUCKET:{get:async()=>null},
  });
  assert.equal(response.status,200);
  const session=await response.json();
  assert.equal(session.actor,null);
  assert.equal(session.registrationEnabled,false);
});

test('Packaged browser scripts and styles exactly match the tested source files', async () => {
  const files=['index.html','assets/js/site.js','assets/js/volunteers.js','assets/js/team-auth.js',
    'assets/css/styles.css','assets/css/modern.css','assets/css/volunteers.css'];
  for (const file of files) {
    assert.deepEqual(await readFile(path.join('dist/client',file)),await readFile(file),file);
  }
  assert((await stat('dist/server/ICAL-LICENSE.txt')).size>0);
});

test('Every bundled image and video survives packaging with its exact filename and bytes', async () => {
  async function files(directory) {
    const result=[];
    for (const entry of await readdir(directory,{withFileTypes:true})) {
      const file=directory+'/'+entry.name;
      if(entry.isDirectory())result.push(...await files(file));
      else result.push(file);
    }
    return result;
  }
  const media=[...await files('assets/images'),...await files('assets/videos'),...await files('assets/data/uploads')];
  for(const file of media)assert.deepEqual(await readFile('dist/client/'+file),await readFile(file),file);
  const exactPaths=new Set(media);
  function check(value) {
    if(typeof value==='string' && /^(\.\/assets\/|\/uploads\/)/.test(value)) {
      const file=value.startsWith('/uploads/')?'assets/data'+value:value.slice(2);
      assert(exactPaths.has(file),`Missing media or incorrect filename capitalization: ${value}`);
    } else if(value && typeof value==='object')Object.values(value).forEach(check);
  }
  for(const file of await readdir('assets/data')) {
    if(!file.endsWith('.json'))continue;
    check(JSON.parse(await readFile('assets/data/'+file,'utf8')));
  }
});

test('Media responses preserve full images, archived uploads and seekable video ranges', async () => {
  const {default:worker}=await import('../dist/server/index.js');
  const bytes=await readFile('assets/videos/LPC_30s.mp4');
  const env={BUCKET:{get:async()=>null},ASSETS:{fetch:async request=>{
    if(new URL(request.url).pathname.startsWith('/assets/data/uploads/'))return new Response('archived image',{headers:{'content-type':'image/jpeg'}});
    assert(!request.headers.has('range'));
    return new Response(bytes,{headers:{'content-type':'video/mp4','content-length':String(bytes.length)}});
  }}};
  const request=(pathname,range)=>new Request('https://church.test'+pathname,{headers:range?{range}:{}});
  for(const [range,start,end]of [['bytes=0-1023',0,1023],['bytes=-100',bytes.length-100,bytes.length-1]]){
    const response=await worker.fetch(request('/assets/videos/LPC_30s.mp4',range),env);
    assert.equal(response.status,206);
    assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${bytes.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(start,end+1));
  }
  assert.equal((await worker.fetch(request('/assets/videos/LPC_30s.mp4','bytes=99999999-'),env)).status,416);
  assert.equal((await worker.fetch(request('/uploads/images/all-pastors-mv5r3bqw.jpg'),env)).status,200);
  assert.equal((await worker.fetch(request('/uploads/images/does-not-exist.jpg'),env)).status,404);
  env.BUCKET.get=async()=>({body:'image',size:5,range:{offset:0,length:5},httpEtag:'"test"',writeHttpMetadata:headers=>headers.set('content-type','image/png')});
  const image=await worker.fetch(request('/uploads/images/test.png'),env);
  assert.equal(image.status,200);
  assert.equal(image.headers.get('content-range'),null);
  assert.equal((await worker.fetch(request('/uploads/images/test.png','bytes=0-4'),env)).status,206);
});

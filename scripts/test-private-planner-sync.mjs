import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {pbkdf2Sync} from 'node:crypto';
import {handleVolunteers,emptyVolunteers} from '../worker/volunteers.mjs';
import {importPrivatePlanner,validateBackup} from './import-private-planner.mjs';

function fixture(){
  const data=emptyVolunteers();
  const salt='test-salt',password='Test only password 2026';
  data.members=[{id:'member-test',name:'Example Tester',username:'example.tester',active:true,manage:[],skills:[],teams:[],branches:[],authVersion:'old-version',salt,passwordHash:pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')}];
  data.meetings=[{id:'meeting-test',name:'Example Meeting'}];data.services=[{id:'service-test',meetingId:'meeting-test'}];
  data.sessions=[{id:'card-test',name:'Example Meeting',slots:[{id:'slot-test',main:'member-test',backup:''}]}];
  const keys=new Map();
  const store={getState:async()=>structuredClone(data),saveState:async()=>{},getKey:async key=>keys.get(key),putKey:async(key,value)=>keys.set(key,value)};
  return {data,store,password};
}

test('Only the website admin can download a full private backup; normal views stay filtered',async()=>{
  const f=fixture();
  for(const actor of [null,{id:'scheduler',manage:['ministry']},{id:'member-test',manage:[]}]){
    const r=await handleVolunteers(new Request('https://lpc.test/api/volunteers/backup'),f.store,actor);
    assert.equal(r.status,403);
    assert(!(await r.text()).includes(f.data.members[0].passwordHash));
  }
  const cross=await handleVolunteers(new Request('https://lpc.test/api/volunteers/backup',{headers:{'sec-fetch-site':'cross-site'}}),f.store,{admin:true});assert.equal(cross.status,403);
  const r=await handleVolunteers(new Request('https://lpc.test/api/volunteers/backup'),f.store,{admin:true});
  assert.equal(r.status,200);assert(r.headers.get('content-disposition').includes('attachment'));assert.equal(r.headers.get('cache-control'),'no-store');
  const backup=await r.json();assert.deepEqual(validateBackup(backup),f.data);assert(!JSON.stringify(backup).includes(f.password));
});

test('Private restore preserves credentials and all cards, backs up local state and invalidates old cookies',async()=>{
  const f=fixture(),base=resolve('.local-test');await mkdir(base,{recursive:true});
  const directory=await mkdtemp(join(base,'planner-sync-'));
  try{
    const file=join(directory,'backup.json');await writeFile(file,JSON.stringify({format:'lpc-private-planner',version:1,data:f.data}));
    const target=join(directory,'.private-volunteers');await mkdir(target);await writeFile(join(target,'state.json'),'{"oldLocalData":true}');
    const result=await importPrivatePlanner(file,directory,'');
    const restored=JSON.parse(await readFile(result.statePath,'utf8'));
    assert.deepEqual(restored.sessions,f.data.sessions);assert.deepEqual(restored.meetings,f.data.meetings);assert.deepEqual(restored.services,f.data.services);
    assert.equal(restored.members[0].passwordHash,f.data.members[0].passwordHash);assert.equal(restored.members[0].salt,f.data.members[0].salt);
    assert.notEqual(restored.members[0].authVersion,f.data.members[0].authVersion);
    assert.deepEqual(JSON.parse(await readFile(result.previousBackup,'utf8')),{oldLocalData:true});
    const store={...f.store,getState:async()=>restored};
    const r=await handleVolunteers(new Request('https://lpc.test/api/volunteers/login',{method:'POST',headers:{origin:'https://lpc.test'},body:JSON.stringify({username:'example.tester',password:f.password})}),store);
    assert.equal(r.status,200,'The same username and password work after restore');
  }finally{if(!directory.startsWith(base+sep))throw Error('Invalid test cleanup path');await rm(directory,{recursive:true,force:true});}
});

test('Invalid private backups are rejected before any local state is changed',()=>{
  for(const backup of [{},{format:'lpc-private-planner',version:99},{format:'lpc-private-planner',version:1,data:{}}])assert.throws(()=>validateBackup(backup));
  const f=fixture();f.data.members.push({...f.data.members[0]});assert.throws(()=>validateBackup({format:'lpc-private-planner',version:1,data:f.data}),/duplicate/);
});

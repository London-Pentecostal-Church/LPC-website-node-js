import {readFile,writeFile,mkdir,rename,unlink,copyFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export function validateBackup(backup) {
  if(backup?.format!=='lpc-private-planner'||backup.version!==1)throw Error('Choose a private planner backup downloaded from Users & access.');
  const data=backup.data;
  if(!data||data.plannerVersion!==2||!Number.isInteger(data.revision)||data.revision<0)throw Error('Invalid planner state.');
  for(const key of ['members','meetings','services','sessions','swaps','notifications','history']){
    if(!Array.isArray(data[key]))throw Error('Missing planner data: '+key);
  }
  for(const key of ['members','meetings','services','sessions']){
    const ids=new Set();
    for(const item of data[key]){
      if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))throw Error('Invalid or duplicate record in '+key);
      ids.add(item.id);
    }
  }
  for(const member of data.members){
    if(member.passwordHash && (!/^[a-f0-9]{64}$/i.test(member.passwordHash)||typeof member.salt!=='string'||!member.salt))throw Error('Invalid account password record.');
  }
  return structuredClone(data);
}

export async function importPrivatePlanner(backupPath,root=resolve(fileURLToPath(new URL('..',import.meta.url))),dataDirectory=process.env.DATA_DIR) {
  const source=resolve(backupPath);
  const data=validateBackup(JSON.parse(await readFile(source,'utf8')));
  const directory=dataDirectory?resolve(dataDirectory,'volunteer-private'):join(root,'.private-volunteers');
  await mkdir(directory,{recursive:true,mode:0o700});
  const lock=join(directory,'restore.lock');
  await writeFile(lock,'Restore in progress',{flag:'wx',mode:0o600});
  const target=join(directory,'state.json'),temporary=join(directory,'state.restore-'+randomUUID()+'.tmp');
  let previous=null;
  try{
    previous=join(directory,'state.before-restore-'+randomUUID()+'.json');
    try{await copyFile(target,previous);}catch(error){if(error.code!=='ENOENT')throw error;previous=null;}
    // Existing cookies must never authenticate against a different imported snapshot.
    for(const member of data.members)member.authVersion=randomUUID();
    await writeFile(temporary,JSON.stringify(data),{flag:'wx',mode:0o600});
    await rename(temporary,target);
    return {users:data.members.length,meetings:data.meetings.length,cards:data.sessions.length,previousBackup:previous,statePath:target};
  }finally{
    await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});
    await unlink(lock);
  }
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    if(!process.argv[2])throw Error('Usage: npm run data:import -- path-to-backup.json (stop the local server first)');
    console.log(JSON.stringify(await importPrivatePlanner(process.argv[2]),null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}

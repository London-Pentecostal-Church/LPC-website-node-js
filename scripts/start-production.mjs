import {cp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
if(!process.env.LPC_ADMIN_USERNAME||!process.env.LPC_ADMIN_PASSWORD||!process.env.LPC_ADMIN_SESSION_SECRET)throw Error('Set LPC_ADMIN_USERNAME, LPC_ADMIN_PASSWORD and LPC_ADMIN_SESSION_SECRET before going live.');
const data=resolve(process.env.DATA_DIR||'assets/data');
if(data!==resolve('assets/data')){await mkdir(data,{recursive:true});await cp(resolve('assets/data'),data,{recursive:true,force:false,errorOnExist:false});}
await import('../preview-server.mjs');

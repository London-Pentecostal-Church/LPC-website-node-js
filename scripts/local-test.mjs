// Local-only demo environment. Uses separate data and synthetic volunteer accounts.
import {cp,mkdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const data=resolve(root,'.local-test/data');
const port=Number(process.env.LOCAL_TEST_PORT||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose LOCAL_TEST_PORT between 1024 and 65535.');
await mkdir(data,{recursive:true});
try{await access(resolve(data,'site-settings.json'));}catch{await cp(resolve(root,'assets/data'),data,{recursive:true});}
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['preview-server.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:base,DATA_DIR:data,LPC_ADMIN_USERNAME:'tester',LPC_ADMIN_PASSWORD:'Lpc-Test-2026!',LPC_ADMIN_SESSION_SECRET:randomBytes(32).toString('hex')},stdio:['ignore','pipe','pipe']});
server.stderr.pipe(process.stderr);
let stopping=false;
const stop=()=>{stopping=true;if(server.exitCode===null)server.kill();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.on('exit',code=>{if(!stopping&&code)process.exitCode=code;});
try{
 await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('Local server did not start.')),10000);server.stdout.once('data',()=>{clearTimeout(timer);ok();});server.once('exit',()=>{clearTimeout(timer);no(Error('Local server stopped. Check whether the port is already in use.'));});});
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({username:'tester',password:'Lpc-Test-2026!'})});
 if(!login.ok)throw Error('Unable to prepare the local administrator account.');
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const get=async()=>{const r=await fetch(base+'/api/volunteers',{headers:{cookie}});if(!r.ok)throw Error('Unable to load test data.');return r.json();};
 const action=async body=>{const state=await get();const r=await fetch(base+'/api/volunteers/action',{method:'POST',headers:{origin:base,cookie,'content-type':'application/json'},body:JSON.stringify({...body,revision:state.revision})});const value=await r.json();if(!r.ok)throw Error(value.error);return value;};
 let state=await get();
 for(const [name,username,manage]of [['Demo Service Lead','lead.test',['service']],['Demo Volunteer','volunteer.test',[]],['Demo Ministry Scheduler','pastor.test',['ministry']]])if(!state.members.some(m=>m.username===username))state=await action({action:'member',member:{name,username,password:'LocalTest-2026!',skills:['Lead singer','Sound operator','Camera operator','Screen operator','Ministry volunteer'],teams:['Malayalam','English'],branches:['Main Church'],manage,active:true}});
 const lead=state.members.find(m=>m.username==='lead.test'),volunteer=state.members.find(m=>m.username==='volunteer.test'),pastor=state.members.find(m=>m.username==='pastor.test');
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=k=>parts.find(p=>p.type===k).value;const start=`${part('year')}-${part('month')}-${part('day')}`;
 for(const [name,kind,team,time,leadId,roles]of [['DEMO - Malayalam Service','service','Malayalam','09:30',lead.id,[{role:'Sound operator',count:1},{role:'Camera operator',count:1},{role:'Screen operator',count:1}]],['DEMO - English Service','service','English','13:00',lead.id,[{role:'Lead singer',count:1},{role:'Sound operator',count:1}]],['DEMO - Ministry Allocation','ministry','Malayalam','17:00',pastor.id,[{role:'Ministry volunteer',count:1}]]]){
 if(state.services.some(s=>s.name===name))continue;
 state=await action({action:'service',service:{name,kind,branch:'Main Church',team,day:0,time,duration:120,leadId,roles},start,weeks:4});
 const template=state.services.find(s=>s.name===name),dated=state.sessions.filter(s=>s.serviceId===template.id);
 for(const [i,s]of dated.entries())state=await action({action:'allocation',sessionId:s.id,status:'draft',slots:s.slots.map((slot,index)=>({id:slot.id,main:index===0?(i%2?volunteer.id:lead.id):'',backup:''})),comment:'Synthetic demo allocation for local testing.'});
 }
 const url=`http://localhost:${port}/#/volunteers`;
 console.log(`\nLPC local test website is ready.\n\nOpen: ${url}\n\nAdministrator: tester / Lpc-Test-2026!\nService lead: lead.test / LocalTest-2026!\nVolunteer: volunteer.test / LocalTest-2026!\nMinistry scheduler: pastor.test / LocalTest-2026!\n\nDemo times and names are illustrative. Changes stay in .local-test/data.\nKeep this window open. Press Ctrl+C to stop.\n`);
 if(process.platform==='win32'&&!process.env.LOCAL_TEST_NO_BROWSER)spawn('cmd.exe',['/c','start','',url],{stdio:'ignore'}).unref();
}catch(error){console.error(error.message);stop();process.exitCode=1;}

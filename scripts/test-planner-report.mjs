import test from 'node:test';
import assert from 'node:assert/strict';
import {plannerReport,reportWorkbook} from '../worker/planner-report.mjs';
import {handleVolunteers,emptyVolunteers} from '../worker/volunteers.mjs';
const member=(id,extra={})=>({id,name:id,active:true,skills:['Lead singer'],teams:['English'],branches:['Main Church'],availability:{},passwordHash:'PRIVATE-HASH',email:'private@example.test',...extra});
const session=(id,date,extra={})=>({id,serviceId:'service',kind:'service',name:id,date,time:'10:00',branch:'Main Church',team:'English',status:'confirmed',slots:[{role:'Lead singer',main:'A',backup:'B'}],...extra});
const filters={kind:'service',start:'2032-01-01',end:'2032-03-31',branch:'Main Church',team:'English'};
function fixture(){return {...emptyVolunteers(),services:[{id:'service'}],members:[member('A'),member('B'),member('C'),member('D',{branches:['Elsewhere']}),member('Inactive',{active:false})],sessions:[session('past','2032-01-01'),session('future','2032-03-01'),session('draft','2032-03-02',{status:'draft'}),session('cancelled','2032-03-03',{cancelled:true}),session('other','2032-03-04',{branch:'Elsewhere'})]};}
const now=new Date('2032-02-01T12:00:00Z');
test('Report separates past/upcoming, drafts, reserves, zero opportunity and cancelled meetings',()=>{
 const r=plannerReport(fixture(),filters,now),a=r.participation.find(r=>r.name==='A'),b=r.participation.find(r=>r.name==='B'),c=r.participation.find(r=>r.name==='C');
 assert.equal(r.meetings,3);assert.equal(r.cancelled,1);assert.equal(a.past,1);assert.equal(a.upcoming,1);assert.equal(a.draft,1);assert.equal(a.confirmed,2);assert.equal(b.reserve,2);assert.equal(b.confirmed,0);assert.equal(c.suggestion,'No confirmed opportunities');assert.equal(a.suggestion,'In line with rotation');assert.equal(r.participation.length,3);
 assert(!JSON.stringify(r).includes('PRIVATE-HASH'));assert(!JSON.stringify(r).includes('private@example'));
});
test('Fairness uses eligible meetings, excludes known unavailability and deduplicates primary roles',()=>{
 const s=fixture();s.members[0].availability={future:'unavailable'};s.sessions[0].slots.push({role:'Lead singer',main:'A',backup:''});
 const r=plannerReport(s,filters,now),a=r.participation.find(r=>r.name==='A');assert.equal(a.eligible,2);assert.equal(a.unavailable,1);assert.equal(a.confirmed,1);assert.equal(a.rate,.5);assert.equal(a.unknown,2);
});
test('Pastoral emergency cover stays separate from pastor and reserve opportunities',()=>{
 const s=fixture();s.members=[member('Pastor',{skills:['Ministry volunteer']}),member('Prayer',{skills:['Branch prayer leader']})];s.sessions=[session('church','2032-01-10',{kind:'ministry',slots:[{role:'Ministry volunteer',main:'Pastor',backup:''}],emergencyCover:{memberId:'Prayer'}})];
 const r=plannerReport(s,{...filters,kind:'ministry'},now);assert.equal(r.participation.find(p=>p.role==='Pastor').confirmed,1);assert.equal(r.participation.find(p=>p.role==='Standby prayer leader').confirmed,1);
});
test('Report validates dates, scope, London day boundary, and empty periods',()=>{
 for(const changes of [{start:'2032-02-30'},{end:'2031-01-01'},{end:'2034-01-01'},{kind:'all'}])assert.throws(()=>plannerReport(fixture(),{...filters,...changes},now));
 assert.equal(plannerReport(fixture(),{...filters,team:'Hindi'},now).participation.length,0);
 const s=fixture();s.sessions=[session('today','2032-06-01')];const r=plannerReport(s,{...filters,start:'2032-06-01',end:'2032-06-02'},new Date('2032-05-31T23:30:00Z'));assert.equal(r.participation.find(p=>p.name==='A').upcoming,1);
});
test('Report API restricts each planner to its scheduler, is read-only and exports real XLSX',async()=>{
 let saves=0;const s=fixture(),store={getState:async()=>structuredClone(s),saveState:async()=>{saves++;},getKey:async()=>null};
 const call=(actor,query='')=>handleVolunteers(new Request('https://church.test/api/volunteers/report?'+new URLSearchParams(filters)+query),store,actor);
 assert.equal((await call(null)).status,401);assert.equal((await call(member('C'))).status,403);assert.equal((await call(member('C',{manage:['ministry']}))).status,403);
 assert.equal((await call(member('C',{manage:['service']}))).status,200);
 const response=await call({admin:true},'&format=xlsx');assert.equal(response.status,200);assert(response.headers.get('content-type').includes('spreadsheetml'));const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(bytes[0],80);assert.equal(bytes[1],75);assert.equal(saves,0);
});
test('XLSX contains filtered sheets, freeze panes and literal text instead of formulas',()=>{
 const s=fixture();s.members[0].name='=HYPERLINK("bad") <&>';const data=reportWorkbook(plannerReport(s,filters,now));const text=new TextDecoder().decode(data);
 for(const name of ['Overview','Participation','Schedule','Notes'])assert(text.includes('name="'+name+'"'));
 assert(text.includes('state="frozen"'));assert(text.includes('autoFilter'));assert(text.includes('=HYPERLINK(&quot;bad&quot;) &lt;&amp;&gt;'));assert(!text.includes('<f>'));assert(!text.includes('PRIVATE-HASH'));
});

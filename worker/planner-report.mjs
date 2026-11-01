const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const label = role => role === 'Ministry volunteer' ? 'Pastor' : role === 'Branch prayer leader' ? 'Standby prayer leader' : role;
const pastoral = role => ['Ministry volunteer','Branch prayer leader'].includes(role);
export function plannerReport(state, filters, now = new Date()) {
  const {kind,start,end,branch='',team=''} = filters;
  if (!['ministry','service'].includes(kind) || !day(start) || !day(end) || end < start || (Date.parse(end)-Date.parse(start))/86400000 > 366) throw new Error('Choose a valid date range of up to one year.');
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const sessions = state.sessions.filter(s => !s.deleted && !s.deletedAt && s.kind === kind && s.date >= start && s.date <= end && (!branch || s.branch === branch) && (!team || s.team === team)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const active = sessions.filter(s=>!s.cancelled);
  const members = new Map(state.members.map(m=>[m.id,m]));
  const schedule=[], rota=[];
  const personName=id=>id ? members.get(id)?.name || 'Former member' : '';
  const roleNames=[...new Set([...(state.roles || []),...sessions.flatMap(s=>s.slots.map(slot=>slot.role)),...(kind==='ministry'?['Ministry volunteer','Branch prayer leader']:[])])].filter(role=>pastoral(role)===(kind==='ministry'));
  for(const s of sessions) {
    const duties=Object.fromEntries(roleNames.map(role=>{
      const slots=s.slots.filter(slot=>slot.role===role);
      const primary=[...new Set(slots.map(slot=>personName(slot.main)).filter(Boolean))];
      const reserves=[...new Set(slots.map(slot=>personName(slot.backup)).filter(Boolean))];
      if(role==='Branch prayer leader' && s.emergencyCover?.memberId) primary.push('Emergency cover: '+personName(s.emergencyCover.memberId));
      return [label(role),[primary.join('\n') || (role==='Ministry volunteer'?'Not allocated — action needed':'Arrange locally'),reserves.length?'Reserve: '+reserves.join(', '):''].filter(Boolean).join('\n')];
    }));
    const pastoralMeeting=kind==='ministry'?s:state.sessions.find(other=>other.kind==='ministry' && !other.cancelled && !other.deleted && !other.deletedAt && other.date===s.date && other.time===s.time && other.branch===s.branch && other.team===s.team && ((s.occurrenceId && other.occurrenceId===s.occurrenceId) || (s.meetingId && other.meetingId===s.meetingId) || other.name===s.name));
    const pastorNames=[...new Set((pastoralMeeting?.slots || []).filter(slot=>slot.role==='Ministry volunteer').map(slot=>personName(slot.main)).filter(Boolean))];
    rota.push({date:s.date,day:new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'Europe/London'}).format(new Date(s.date+'T12:00:00Z')),time:s.time,meeting:s.name,branch:s.branch,team:s.team,status:s.cancelled?'Cancelled':s.status,pastorInCharge:pastorNames.join('\n') || 'Not allocated — action needed', duties});
    for(const slot of s.slots) for(const position of ['main','backup']) {
      const m=members.get(slot[position]);
      schedule.push({date:s.date,time:s.time,meeting:s.name,branch:s.branch,team:s.team,role:label(slot.role),position:position==='main'?'Primary':'Reserve',person:m?.name || (slot[position]?'Former member':'Unassigned'),status:s.cancelled?'Cancelled':s.status,availability:m?.availability?.[s.id] || 'unsure'});
    }
    if(s.emergencyCover?.memberId) schedule.push({date:s.date,time:s.time,meeting:s.name,branch:s.branch,team:s.team,role:'Standby prayer leader',position:'Emergency cover',person:members.get(s.emergencyCover.memberId)?.name || 'Former member',status:s.cancelled?'Cancelled':s.status,availability:members.get(s.emergencyCover.memberId)?.availability?.[s.id] || 'unsure'});
  }
  const participation=[];
  for(const m of state.members.filter(m=>m.active && (!branch || m.branches.includes(branch)) && (!team || m.teams.includes(team)))) {
    for(const role of [...new Set(m.skills)].filter(r=>pastoral(r)===(kind==='ministry'))) {
      const eligible=active.filter(s=>m.branches.includes(s.branch) && m.teams.includes(s.team) && (s.slots.some(slot=>slot.role===role) || (role==='Branch prayer leader' && s.emergencyCover)));
      const unavailable=eligible.filter(s=>m.availability?.[s.id]==='unavailable').length;
      const available=eligible.length-unavailable;
      const assigned=eligible.filter(s=>s.slots.some(slot=>slot.role===role && slot.main===m.id) || (role==='Branch prayer leader' && s.emergencyCover?.memberId===m.id));
      const confirmed=assigned.filter(s=>s.status==='confirmed' && m.availability?.[s.id]!=='unavailable');
      const past=confirmed.filter(s=>s.date<today), upcoming=confirmed.filter(s=>s.date>=today);
      participation.push({memberId:m.id,name:m.name,role:label(role),eligible:available,unavailable,unknown:eligible.filter(s=>!m.availability?.[s.id] || m.availability[s.id]==='unsure').length,past:past.length,upcoming:upcoming.length,confirmed:confirmed.length,draft:assigned.filter(s=>s.status!=='confirmed').length,reserve:eligible.filter(s=>s.status==='confirmed' && s.slots.some(slot=>slot.role===role && slot.backup===m.id) && m.availability?.[s.id]!=='unavailable').length,last:past.at(-1)?.date || '',next:upcoming[0]?.date || '',rate:available?confirmed.length/available:0});
    }
  }
  for(const row of participation) {
    const peers=participation.filter(p=>p.role===row.role && p.eligible>0);
    row.average=peers.length?peers.reduce((sum,p)=>sum+p.rate,0)/peers.length:0;
    row.suggestion=!row.eligible?'No eligible meetings':row.confirmed===0?'No confirmed opportunities':row.rate+0.0001<row.average?'Consider next':'In line with rotation';
  }
  participation.sort((a,b)=>a.role.localeCompare(b.role)||a.rate-b.rate||a.confirmed-b.confirmed||a.last.localeCompare(b.last)||a.name.localeCompare(b.name));
  return {kind,start,end,branch,team,generatedAt:now.toISOString(),revision:state.revision,meetings:active.length,cancelled:sessions.length-active.length,participation,schedule,rota,roleNames:roleNames.map(label),notes:[
    'Meeting rota shows one row per dated meeting, with names under each duty. Reserve names are explicitly labelled. By person lists only assigned people, in person/date/time order.',
    'Only saved dated meetings in the selected window are included. Future repetitions without dated records are not projected. Counts use current member roles, branches and teams. Deleted records are unavailable; this is not a lifetime history.',
    'Past means before today in London. Today and later are upcoming. Allocations are not proof of attendance.',
    'Primary counts deduplicate a person in the same role and meeting. Emergency prayer cover counts only as standby prayer leader. Reserve duties and drafts are separate.',
    'Cancelled meetings and known unavailability do not count as confirmed opportunities. Unknown availability remains eligible and must be checked before allocating.',
    'Rate = confirmed primary allocations / matching meetings where the person is eligible and not marked unavailable. Role average compares these rates within the selected branch/team filters.',
    'Consider next means a lower rate than the role average. Zero confirmed opportunities are highlighted even when the entire group has zero. This is scheduling guidance, not an automatic quota.',
    'Different roles, availability and overlapping duties need scheduler judgement. No assignments are changed by this report.'
  ]};
}

// Small standards-based XLSX writer. Text uses inline strings, never formulas.
const xml = v => String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const encoder=new TextEncoder();
const column=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function zip(files) {
  const chunks=[],central=[];let offset=0,size=0;
  const header=n=>new Uint8Array(n), u16=(a,n,v)=>new DataView(a.buffer).setUint16(n,v,true),u32=(a,n,v)=>new DataView(a.buffer).setUint32(n,v,true);
  for(const [path,text] of files) {
    const name=encoder.encode(path),data=encoder.encode(text);let crc=0xffffffff;
    for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
    const local=header(30);u32(local,0,0x04034b50);u16(local,4,20);u32(local,14,crc);u32(local,18,data.length);u32(local,22,data.length);u16(local,26,name.length);
    chunks.push(local,name,data);
    const entry=header(46);u32(entry,0,0x02014b50);u16(entry,4,20);u16(entry,6,20);u32(entry,16,crc);u32(entry,20,data.length);u32(entry,24,data.length);u16(entry,28,name.length);u32(entry,42,offset);central.push(entry,name);size+=46+name.length;offset+=30+name.length+data.length;
  }
  const end=header(22);u32(end,0,0x06054b50);u16(end,8,files.length);u16(end,10,files.length);u32(end,12,size);u32(end,16,offset);
  const result=new Uint8Array(offset+size+22);let p=0;for(const part of [...chunks,...central,end]){result.set(part,p);p+=part.length;}return result;
}
export function reportWorkbook(report) {
  const rows=report.participation;
  const title=report.kind==='ministry'?'Pastoral rota':'Choir & media rota';
  const scope=`${report.branch||'All branches'} · ${report.team||'All teams'} · London time`;
  const dayOf=date=>new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'Europe/London'}).format(new Date(date+'T12:00:00Z'));
  const personal=report.schedule.filter(r=>r.person!=='Unassigned').sort((a,b)=>a.person.localeCompare(b.person)||(a.date+a.time).localeCompare(b.date+b.time)||a.branch.localeCompare(b.branch)||a.role.localeCompare(b.role));
  const sheets=[['Meeting rota',[
    [`${title} · ${report.start} to ${report.end}`],[scope],[],
    ['Date','Day','London time','Branch / location','Meeting','Language / team','Status',...(report.kind==='service'?['Pastor in charge']:[]),...report.roleNames],
    ...report.rota.map(r=>[r.date,r.day,r.time,r.branch,r.meeting,r.team,r.status,...(report.kind==='service'?[r.pastorInCharge]:[]),...report.roleNames.map(role=>r.duties[role])])
  ]],['By person',[
    [`Who goes where · ${report.start} to ${report.end}`],[scope],[],
    ['Person','Date','Day','London time','Branch / location','Meeting','Language / team','Covering / duty','Primary or reserve','Status'],
    ...personal.map(r=>[r.person,r.date,dayOf(r.date),r.time,r.branch,r.meeting,r.team,r.role,r.position,r.status])
  ]],['Overview',[
    ['LPC participation report','Value'],['Planner',report.kind==='ministry'?'Pastoral Planner':'Choir & Media'],['Start',report.start],['End',report.end],['Branch',report.branch||'All branches'],['Team',report.team||'All teams'],['Generated',report.generatedAt],['Data revision',report.revision],['Meetings (excluding cancelled)',report.meetings],['Cancelled meetings',report.cancelled],['People in report',new Set(rows.map(r=>r.memberId)).size],['Confirmed primary role allocations',rows.reduce((s,r)=>s+r.confirmed,0)],['Person-role entries with no confirmed opportunities',rows.filter(r=>r.eligible && !r.confirmed).length]
  ]],['Participation',[
    ['Person','Role','Past confirmed','Upcoming confirmed','Total confirmed','Draft','Reserve confirmed','Eligible meetings','Unavailable meetings','Availability unknown','Last past allocation','Next allocation','Allocation rate','Role average rate','Guidance'],
    ...rows.map(r=>[r.name,r.role,r.past,r.upcoming,r.confirmed,r.draft,r.reserve,r.eligible,r.unavailable,r.unknown,r.last,r.next,r.rate,r.average,r.suggestion])
  ]],['Schedule',[
    ['Date','London time','Meeting','Branch','Team','Role','Position','Person','Status','Availability'],...report.schedule.map(r=>[r.date,r.time,r.meeting,r.branch,r.team,r.role,r.position,r.person,r.status,r.availability])
  ]],['Notes',[['Method and limitations'],...report.notes.map(n=>[n])]]];
  const main='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const files=[['[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml',`<workbook xmlns="${main}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name],i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml',`<styleSheet xmlns="${main}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17354C"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFDDDD"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="6"><xf xfId="0"/><xf fontId="1" fillId="2" xfId="0" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="10" xfId="0" applyNumberFormat="1"/><xf xfId="0"><alignment wrapText="1" vertical="top"/></xf><xf fillId="3" xfId="0" applyFill="1"><alignment wrapText="1" vertical="top"/></xf><xf fillId="4" xfId="0" applyFill="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]];
  sheets.forEach(([name,data],i)=>{
    const rota=i<2, h=rota?3:0, headers=data[h], last=column(headers.length-1);
    const widths=headers.map((heading,c)=>name==='Notes'?110:/London time/.test(heading)?12:/^Date$/.test(heading)?13:/^Day$/.test(heading)?14:/^Status$/.test(heading)?14:/Meeting/.test(heading)?30:/Person/.test(heading)?28:rota?25:c<2?26:20);
    const sheetRows=data.map((row,r)=>{
      const height=r===h?38:rota&&r<h?26:name==='Notes'?64:rota?Math.max(40,16*Math.max(1,...row.map((v,c)=>String(v??'').split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/widths[c])),0)))+8):28;
      return '<row r="'+(r+1)+'" ht="'+height+'" customHeight="1">'+row.map((value,c)=>{
        const cancelled=row.includes('Cancelled');
        const style=r===h || (rota&&r===0)?1:rota&&r<h?3:typeof value==='string'&&value.startsWith('Not allocated')&&!cancelled?5:name==='Participation'&&[12,13].includes(c)?2:rota?(r%2?4:3):3;
        return '<c r="'+column(c)+(r+1)+'" s="'+style+'"'+(typeof value==='number'?'':' t="inlineStr"')+'>'+(typeof value==='number'?'<v>'+value+'</v>':'<is><t xml:space="preserve">'+xml(value)+'</t></is>')+'</c>';
      }).join('')+'</row>';
    }).join('');
    files.push(['xl/worksheets/sheet'+(i+1)+'.xml','<worksheet xmlns="'+main+'"><sheetViews><sheetView workbookViewId="0"><pane ySplit="'+(h+1)+'" topLeftCell="A'+(h+2)+'" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'+widths.map((width,c)=>'<col min="'+(c+1)+'" max="'+(c+1)+'" width="'+width+'" customWidth="1"/>').join('')+'</cols><sheetData>'+sheetRows+'</sheetData><autoFilter ref="A'+(h+1)+':'+last+data.length+'"/>'+(rota?'<mergeCells count="2"><mergeCell ref="A1:'+last+'1"/><mergeCell ref="A2:'+last+'2"/></mergeCells>':'')+'<pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="'+(i===0?'8':'9')+'" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>']);
  });
  return zip(files);
}

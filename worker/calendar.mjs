import ICAL from './ical.js';
const cache = new Map();
const defaultCalendarUrl = 'https://outlook.office365.com/owa/calendar/d41bcf08b5d44662b90f5c2306c60b54@londonpentecostalchurch.org/e5c6f4e452864f18a952af7fbeb359799387388053960066439/calendar.ics';
export function validateCalendarUrl(value) {
  const url = new URL(value.replace(/^webcal:/, 'https:'));
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !['outlook.live.com','outlook.office365.com','outlook.office.com','outlook.com','www.outlook.com'].includes(url.hostname)) throw new Error('Use a published Outlook HTTPS calendar link');
  return url.toString();
}
function asDate(time) {
  if (time.isDate) return new Date(Date.UTC(time.year,time.month-1,time.day));
  if (time.zone !== ICAL.Timezone.localTimezone) return time.toJSDate();
  const wall = Date.UTC(time.year,time.month-1,time.day,time.hour,time.minute,time.second);
  let result = wall;
  for (let i=0;i<3;i++) {
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(result)).map(p=>[p.type,p.value]));
    result += wall-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
  }
  return new Date(result);
}
export function parseCalendar(text, now=new Date()) {
  const calendar=new ICAL.Component(ICAL.parse(text));
  if(calendar.name!=='vcalendar')throw new Error('Invalid calendar');
  for(const zone of calendar.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(new ICAL.Timezone(zone));
  const events=calendar.getAllSubcomponents('vevent').map(c=>new ICAL.Event(c));
  const output=[],until=new Date(now.getTime()+30*86400000);
  const add=(event,start,end)=>{
    if(['PRIVATE','CONFIDENTIAL'].includes(String(event.component.getFirstPropertyValue('class')).toUpperCase()) || String(event.component.getFirstPropertyValue('status')).toUpperCase()==='CANCELLED')return;
    const a=asDate(start),b=asDate(end);
    if((b<=now && a<now)||a>until)return;
    const image=event.component.getAllProperties('attach').map(property=>String(property.getFirstValue()||'')).find(value=>/^https:\/\/[^\s]+\.(png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(value))||'';
    output.push({id:event.uid+':'+start.toString(),title:event.summary||'Church event',start:a.toISOString(),end:b.toISOString(),allDay:start.isDate,location:event.location||'',image});
  };
  for(const event of events.filter(e=>!e.isRecurrenceException())){
    if(!event.startDate)continue;
    for(const exception of events.filter(e=>e.isRecurrenceException()&&e.uid===event.uid))event.relateException(exception);
    if(event.isRecurring()){
      const iterator=event.iterator();
      for(let i=0;i<20000;i++){
        const occurrence=iterator.next();if(!occurrence||asDate(occurrence)>until)break;
        const detail=event.getOccurrenceDetails(occurrence);add(detail.item,detail.startDate,detail.endDate);
      }
    }else add(event,event.startDate,event.endDate);
  }
  return output.sort((a,b)=>a.start.localeCompare(b.start)).slice(0,30);
}
export async function calendarEvents(feedUrl = defaultCalendarUrl){
  if(!feedUrl)return {configured:false,events:[]};
  const url=validateCalendarUrl(feedUrl),previous=cache.get(url);
  if(previous&&previous.expires>Date.now())return previous.result;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  let text;
  try {
    const response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{accept:'text/calendar'}});
    if(!response.ok)throw new Error('Calendar unavailable (HTTP '+response.status+')');
    text=await response.text();if(text.length>5*1024*1024)throw new Error('Calendar too large');
  } finally { clearTimeout(timeout); }
  const result={configured:true,events:parseCalendar(text)};
  cache.set(url,{result,expires:Date.now()+300000});return result;
}

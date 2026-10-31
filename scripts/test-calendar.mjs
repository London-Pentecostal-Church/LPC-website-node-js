import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ICAL from 'ical.js';
import {calendarEvents,parseCalendar} from '../worker/calendar.mjs';

const feed='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:weekly-service\r\nDTSTART:20261025T093000Z\r\nDTEND:20261025T110000Z\r\nRRULE:FREQ=WEEKLY;COUNT=8\r\nSUMMARY:Sunday service\r\nEND:VEVENT\r\nEND:VCALENDAR';

test('Downloaded event preserves UTC timing and escaped multilingual text within folded iCalendar lines',()=>{
 const site=readFileSync(new URL('../assets/js/site.js',import.meta.url),'utf8');
 const source=site.slice(site.indexOf('function calendarEventFile('),site.indexOf('function openCalendarEvent('));
 const event={id:'service-1',title:'Prayer, worship; '+ 'പ്രാർത്ഥന '.repeat(20),location:'Church, Essex\nRoom 2',start:'2026-07-05T08:30:00.000Z',end:'2026-07-05T10:00:00.000Z'};
 const file=runInNewContext(source+';calendarEventFile(event)',{event,TextEncoder});
 assert(file.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));
 const parsed=new ICAL.Component(ICAL.parse(file)).getFirstSubcomponent('vevent');
 assert.equal(parsed.getFirstPropertyValue('summary'),event.title);assert.equal(parsed.getFirstPropertyValue('location'),event.location);
 assert.equal(parsed.getFirstPropertyValue('dtstart').toJSDate().toISOString(),event.start);
 assert.equal(parsed.getFirstPropertyValue('dtend').toJSDate().toISOString(),event.end);
});

test('All-day calendar download preserves London dates and exclusive end date',()=>{
 const site=readFileSync(new URL('../assets/js/site.js',import.meta.url),'utf8');
 const source=site.slice(site.indexOf('function calendarEventFile('),site.indexOf('function openCalendarEvent('));
 const event={id:'day',title:'Church day',allDay:true,start:'2026-07-04T23:00:00.000Z',end:'2026-07-05T23:00:00.000Z'};
 const file=runInNewContext(source+';calendarEventFile(event)',{event,TextEncoder});
 assert(file.includes('DTSTART;VALUE=DATE:20260705'));assert(file.includes('DTEND;VALUE=DATE:20260706'));
});

test('Calendar branch matching retains the route slug and prefers South London over the main church',()=>{
 const site=readFileSync(new URL('../assets/js/site.js',import.meta.url),'utf8');
 const source=site.slice(site.indexOf('function matchCalendarBranch('),site.indexOf('function calendarEventFile('));
 const branchConfig={branches:{main:{name:'Main Church',churchName:'London Pentecostal Church'},south:{name:'South London',churchName:'South London Pentecostal Church'}}};
 const result=runInNewContext(source+';matchCalendarBranch("South London Pentecostal Church, Bexleyheath")',{branchConfig});assert.equal(result.slug,'south');
});
test('Upcoming calendar expands recurring events and excludes past meetings',()=>{
  const events=parseCalendar(feed,new Date('2026-10-29T12:00:00Z'));
  assert.equal(events[0].start,'2026-11-01T09:30:00.000Z');
  assert(events.every(e=>new Date(e.end)>new Date('2026-10-29T12:00:00Z')));
});
test('Calendar fetch works without AbortSignal.timeout and passes an abortable signal',async()=>{
  const originalFetch=globalThis.fetch,originalTimeout=AbortSignal.timeout;
  try {
    AbortSignal.timeout=undefined;
    globalThis.fetch=async(url,options)=>{
      assert(options.signal instanceof AbortSignal);
      assert.equal(options.redirect,'manual');
      assert.equal(options.headers.accept,'text/calendar');
      return new Response(feed);
    };
    const result=await calendarEvents('https://outlook.office365.com/calendar/test.ics');
    assert.equal(result.configured,true);
    assert(Array.isArray(result.events));
  } finally {globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout;}
});
test('Calendar rejects redirects without following them to another host',async()=>{
  const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'https://other.test/private'}});
    await assert.rejects(calendarEvents('https://outlook.office365.com/calendar/redirect.ics'),/HTTP 302/);
  } finally {globalThis.fetch=originalFetch;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarEvents,parseCalendar} from '../worker/calendar.mjs';

const feed='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:weekly-service\r\nDTSTART:20261025T093000Z\r\nDTEND:20261025T110000Z\r\nRRULE:FREQ=WEEKLY;COUNT=8\r\nSUMMARY:Sunday service\r\nEND:VEVENT\r\nEND:VCALENDAR';
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

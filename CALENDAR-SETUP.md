# Microsoft calendar events

The homepage displays upcoming calendar events above Our Branches. Visitors can swipe or use the arrows to scroll the tiles.

The published LPC Outlook calendar is connected by default. `LPC_CALENDAR_ICS_URL` overrides this default when a different calendar is needed.

In Outlook on the web, open Settings > Calendar > Shared calendars > Publish a calendar. Select the church events calendar and publish with titles/details visible. Copy the ICS link, not the HTML link.

Set the server environment variable `LPC_CALENDAR_ICS_URL` to that link, then restart the preview server. For the hosted worker, set the same environment variable before redeploying. The .env.example file documents the setting; the preview server reads process environment variables, not .env files.

Events are fetched on the server and cached for five minutes. Titles, dates, times and locations appear on the public website. Only use the calendar intended for public church events. Cancelled and private events are excluded. Recurring events, recurrence exceptions and published timezone definitions are supported. Events are displayed in Europe/London time. The row shows up to 30 upcoming events within the next 30 days.

Without a calendar link the row shows an empty state. No sample events are presented as real church events.

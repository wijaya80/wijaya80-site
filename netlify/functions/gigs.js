// GET /.netlify/functions/gigs
// Returns upcoming gigs read live from the band's Google Calendar so the
// website schedule always matches the real calendar. Falls back to an
// error the frontend catches (and shows gigs.json sample data instead)
// if Google Calendar hasn't been configured yet.
const { getCalendarClient } = require('./_googleCalendar');

exports.handler = async () => {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID belum di-set.');

    const res = await calendar.events.list({
      calendarId,
      timeMin: new Date().toISOString(),
      maxResults: 25,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const gigs = (res.data.items || []).map(ev => ({
      date: (ev.start.date || ev.start.dateTime || '').slice(0, 10),
      venue: ev.summary || 'Manggung',
      city: ev.location || '',
      // Tentative events are pending booking holds -> shown as "open" on the site.
      status: ev.status === 'tentative' ? 'open' : 'booked',
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gigs),
    };
  } catch (err) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: err.message }),
    };
  }
};

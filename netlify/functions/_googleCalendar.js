// Shared helper: authenticated Google Calendar client.
// Requires these environment variables (set in Netlify site settings):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  - service account email (from Google Cloud Console)
//   GOOGLE_PRIVATE_KEY            - service account private key (paste with \n escaped)
//   GOOGLE_CALENDAR_ID            - the calendar to read/write (share it with the service account email, "Make changes to events")
const { google } = require('googleapis');

function getCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) {
    throw new Error('Google Calendar belum dikonfigurasi (env vars kosong).');
  }
  const auth = new google.auth.JWT(email, null, key, ['https://www.googleapis.com/auth/calendar']);
  return google.calendar({ version: 'v3', auth });
}

module.exports = { getCalendarClient };

// Jadwal "Panggung Wijaya" dari Google Calendar (alamat rahasia format iCal).
// Env var: GIGS_ICS_URL  -> "Secret address in iCal format" dari pengaturan calendar.
// Cara isi event di Google Calendar:  Judul = nama acara,  Lokasi = tempat, kota (mis. "PRPP, Semarang").
const TZ = 'Asia/Jakarta';

function unfold(t) { return t.replace(/\r?\n[ \t]/g, ''); }
function unesc(s) { return (s || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim(); }

function wibDate(d) { // Date -> 'YYYY-MM-DD' di zona WIB
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function parseStart(line) { // "DTSTART;TZID=Asia/Jakarta:20260905T190000" / "DTSTART;VALUE=DATE:20260905" / "...Z"
  const i = line.indexOf(':');
  const val = line.slice(i + 1).trim();
  const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  if (m[7]) return wibDate(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])));
  return m[1] + '-' + m[2] + '-' + m[3];
}

function parseIcs(text) {
  const events = [];
  const blocks = unfold(text).split('BEGIN:VEVENT').slice(1);
  blocks.forEach((b) => {
    b = b.split('END:VEVENT')[0];
    const get = (name) => {
      const re = new RegExp('^' + name + '(?:;[^:\\n]*)?:(.*)$', 'mi');
      const m = b.match(re);
      return m ? m[0].replace(/\r/g, '') : '';
    };
    const start = get('DTSTART');
    const date = start ? parseStart(start) : null;
    if (!date) return;
    if (/^STATUS:CANCELLED/mi.test(b)) return;
    const summary = unesc(get('SUMMARY').replace(/^SUMMARY[^:]*:/i, ''));
    const location = unesc(get('LOCATION').replace(/^LOCATION[^:]*:/i, ''));
    if (!summary) return;
    events.push({ date, venue: summary, city: location });
  });
  return events;
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' };
  // 1) alamat rahasia (GIGS_ICS_URL) kalau diisi, 2) alamat publik calendar (calendar harus "Make available to public")
  const calId = process.env.GIGS_CALENDAR_ID || 'info@wijaya80.id';
  const urls = [process.env.GIGS_ICS_URL, 'https://calendar.google.com/calendar/ical/' + encodeURIComponent(calId) + '/public/basic.ics']
    .map((u) => (u || '').trim()).filter(Boolean);
  let lastErr = 'tidak ada alamat calendar';
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) { lastErr = 'Calendar HTTP ' + res.status; continue; }
      const text = await res.text();
      if (!/BEGIN:VCALENDAR/.test(text)) { lastErr = 'Balasan bukan file calendar'; continue; }
      const events = parseIcs(text);
      const now = wibDate(new Date());                    // tampilkan dari awal bulan ini bulan ini + 1 bulan berikutnya (2 bulan)
      const monthStart = now.slice(0, 8) + '01';
      const end = new Date(Date.UTC(+now.slice(0, 4), +now.slice(5, 7) - 1 + 2, 1)).toISOString().slice(0, 10);
      const gigs = events.filter((e) => e.date >= monthStart && e.date < end).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 300);
      return { statusCode: 200, headers, body: JSON.stringify({ gigs }) };
    } catch (e) { lastErr = String(e.message || e); }
  }
  return { statusCode: 502, headers, body: JSON.stringify({ error: lastErr }) };
};
exports._parseIcs = parseIcs;

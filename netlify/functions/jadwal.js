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
  const url = process.env.GIGS_ICS_URL;
  if (!url) return { statusCode: 503, headers, body: JSON.stringify({ error: 'GIGS_ICS_URL belum diisi' }) };
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Calendar HTTP ' + res.status);
    const events = parseIcs(await res.text());
    const monthStart = wibDate(new Date()).slice(0, 8) + '01';   // tampilkan mulai awal bulan ini
    const gigs = events.filter((e) => e.date >= monthStart).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 60);
    return { statusCode: 200, headers, body: JSON.stringify({ gigs }) };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
exports._parseIcs = parseIcs;

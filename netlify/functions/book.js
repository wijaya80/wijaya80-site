// POST /.netlify/functions/book
// Handles booking requests from the website form:
//  1. Checks the Google Calendar for the requested date (rejects if a
//     confirmed gig already exists that day).
//  2. Creates a "tentative" hold event with all client details in the
//     description, so the band manager sees it in Google Calendar and
//     confirms/cancels it directly there.
const { getCalendarClient } = require('./_googleCalendar');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Data tidak valid.' }) };
  }

  const required = ['name', 'eventName', 'email', 'whatsapp', 'date', 'eventType', 'location'];
  const missing = required.filter(f => !data[f]);
  if (missing.length) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: `Field wajib belum lengkap: ${missing.join(', ')}` }),
    };
  }

  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID belum di-set.');

    // 1. Check for a confirmed event already on that date.
    const dayStart = new Date(`${data.date}T00:00:00`);
    const dayEnd = new Date(`${data.date}T23:59:59`);
    const existing = await calendar.events.list({
      calendarId,
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
    });

    const alreadyBooked = (existing.data.items || []).some(ev => ev.status === 'confirmed');
    if (alreadyBooked) {
      return {
        statusCode: 409,
        body: JSON.stringify({ message: 'Maaf, tanggal tersebut sudah terisi. Coba pilih tanggal lain ya.' }),
      };
    }

    // 2. Create a tentative hold event for the manager to review.
    await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `[Pengajuan Booking] ${data.eventName} — ${data.name}`,
        location: data.location,
        description: [
          `Jenis acara: ${data.eventType}`,
          `Pemesan: ${data.name}`,
          `Email: ${data.email}`,
          `WhatsApp: ${data.whatsapp}`,
          `Budget: ${data.budget || '-'}`,
          `Pesan: ${data.message || '-'}`,
        ].join('\n'),
        start: { date: data.date },
        end: { date: data.date },
        status: 'tentative',
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Pengajuan booking terkirim! Tanggal kamu sudah kami hold sementara, tim akan konfirmasi lewat email/WhatsApp.',
      }),
    };
  } catch (err) {
    return {
      statusCode: 503,
      body: JSON.stringify({ message: `Gagal memproses booking: ${err.message}` }),
    };
  }
};

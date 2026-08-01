// WhatsApp Cloud API webhook — this is the bot that answers client
// questions and handles booking requests straight from WhatsApp.
//
// GET  /.netlify/functions/whatsapp-webhook  -> Meta's webhook verification handshake.
// POST /.netlify/functions/whatsapp-webhook  -> incoming messages from clients.
//
// Requires (see README "WhatsApp Cloud API" section for how to get these):
//   WHATSAPP_VERIFY_TOKEN     - a string you invent, must match what you type into Meta's webhook config
//   WHATSAPP_TOKEN            - permanent access token (see _whatsapp.js)
//   WHATSAPP_PHONE_NUMBER_ID  - see _whatsapp.js
//   ANTHROPIC_API_KEY         - optional but recommended, from console.anthropic.com/settings/keys
//                               (see _claude.js) — powers natural/human-feeling replies for free-text
//                               questions and price-negotiation attempts. Without it, the bot still
//                               works, just falls back to the fixed menu/FAQ text for those cases.
//   GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_CALENDAR_ID - see _googleCalendar.js (booking + jadwal)
//   AIRTABLE_API_KEY / AIRTABLE_BASE_ID / AIRTABLE_INBOX_TABLE_NAME - optional, logs every inquiry (see _airtableLog.js)
const { getCalendarClient } = require('./_googleCalendar');
const { sendText } = require('./_whatsapp');
const { logInbox } = require('./_airtableLog');
const { generateReply } = require('./_claude');

// ---- Edit this to match your band's actual pricing / repertoire info ----
const FAQ_TEXT = `*Wijaya 80 — Info & Harga*

Kami membawakan nostalgia musik Indonesia era 80an, format full band atau akustik, untuk acara korporat, pernikahan, festival, hingga acara privat.

Harga menyesuaikan lokasi, durasi, dan format penampilan — kirim detail acara kamu dan tim kami akan kasih penawaran.

Ketik *JADWAL* untuk cek tanggal kosong, atau *BOOKING* untuk mulai ajukan tanggal.`;

const MENU_TEXT = `Halo, terima kasih sudah menghubungi *Wijaya 80* 🎶

Ketik salah satu:
1️⃣ *INFO* — harga & repertoar
2️⃣ *JADWAL* — cek tanggal kosong
3️⃣ *BOOKING* — ajukan tanggal manggung

Atau langsung tulis pertanyaan kamu, nanti tim kami yang balas ya.`;

const BOOKING_TEMPLATE = `Untuk ajukan booking, balas pesan ini dengan format:

*BOOKING*
Nama: (nama kamu / perusahaan)
Acara: (nama acara)
Tanggal: (YYYY-MM-DD)
Jenis: (Korporat/Pernikahan/Festival/Privat/Lainnya)
Lokasi: (kota / venue)

Contoh:
BOOKING
Nama: Budi - Anta Wedding Organizer
Acara: Resepsi Pernikahan Budi & Sari
Tanggal: 2026-11-20
Jenis: Pernikahan
Lokasi: Bandung`;

// Keywords that suggest the client is trying to negotiate/haggle on price.
const NEGOTIATION_PATTERN = /\b(nego|negosiasi|nawar|tawar|diskon|potongan|murahin|kurangin|kemahalan|kurang\s*(dong|dikit))\b/i;

function parseBookingFields(text) {
  const grab = (label) => {
    const m = text.match(new RegExp(`${label}\\s*:\\s*(.+)`, 'i'));
    return m ? m[1].trim() : null;
  };
  const fields = {
    name: grab('Nama'),
    eventName: grab('Acara'),
    date: grab('Tanggal'),
    eventType: grab('Jenis'),
    location: grab('Lokasi'),
  };
  const complete = Object.values(fields).every(Boolean);
  return { fields, complete };
}

async function handleBooking(fields) {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID belum di-set.');

  const dayStart = new Date(`${fields.date}T00:00:00`);
  const dayEnd = new Date(`${fields.date}T23:59:59`);
  if (isNaN(dayStart.getTime())) {
    return 'Format tanggal kurang tepat, pakai format YYYY-MM-DD ya (contoh: 2026-11-20).';
  }

  const existing = await calendar.events.list({
    calendarId,
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: true,
  });
  const alreadyBooked = (existing.data.items || []).some(ev => ev.status === 'confirmed');
  if (alreadyBooked) {
    return `Maaf, tanggal ${fields.date} sudah terisi 🙏 Coba pilih tanggal lain ya, atau ketik *JADWAL* untuk lihat tanggal yang masih kosong.`;
  }

  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `[Pengajuan Booking - WA] ${fields.eventName} — ${fields.name}`,
      location: fields.location,
      description: `Jenis acara: ${fields.eventType}\nPemesan: ${fields.name}\nDiajukan lewat WhatsApp.`,
      start: { date: fields.date },
      end: { date: fields.date },
      status: 'tentative',
    },
  });

  return `Sip, pengajuan booking untuk *${fields.eventName}* di ${fields.location} pada ${fields.date} sudah kami terima dan tanggalnya sudah kami hold sementara 🎉 Tim kami akan konfirmasi lebih lanjut lewat chat ini.`;
}

// Fetches upcoming events once and returns both:
//  - a ready-to-send formatted list (used as a reliable fallback)
//  - a plain-text summary (used as context fed into Claude for a more natural phrasing)
async function fetchUpcomingGigs() {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID belum di-set.');

  const res = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = res.data.items || [];
  return items.map(ev => {
    const date = (ev.start.date || ev.start.dateTime || '').slice(0, 10);
    const status = ev.status === 'tentative' ? 'sedang diajukan (belum pasti)' : 'sudah terisi';
    return { date, summary: ev.summary || 'Manggung', status };
  });
}

async function handleSchedule() {
  const gigs = await fetchUpcomingGigs();
  if (!gigs.length) {
    return 'Belum ada jadwal terjadwal saat ini — semua tanggal terbuka! Ketik *BOOKING* untuk ajukan tanggal.';
  }
  const lines = gigs.map(g => `• ${g.date} — ${g.summary} (${g.status})`);
  return `*Jadwal Wijaya 80 terdekat:*\n\n${lines.join('\n')}\n\nTanggal lain di luar daftar ini masih kosong. Ketik *BOOKING* untuk ajukan.`;
}

async function scheduleContextText() {
  try {
    const gigs = await fetchUpcomingGigs();
    if (!gigs.length) return 'Belum ada jadwal terisi — semua tanggal masih terbuka.';
    return gigs.map(g => `- ${g.date}: ${g.summary} (${g.status})`).join('\n');
  } catch {
    return null; // Calendar not configured — Claude will just tell the client to type JADWAL.
  }
}

exports.handler = async (event) => {
  // --- Webhook verification handshake (Meta calls this once when you set up the webhook) ---
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    if (
      params['hub.mode'] === 'subscribe' &&
      params['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      return { statusCode: 200, body: params['hub.challenge'] };
    }
    return { statusCode: 403, body: 'Verification failed' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
      // Delivery receipts / status updates land here too — just acknowledge.
      return { statusCode: 200, body: 'OK' };
    }

    const from = message.from; // client's WhatsApp number
    const text = (message.text?.body || '').trim();
    const lower = text.toLowerCase();

    let intent = 'lainnya';
    let reply;

    try {
      if (lower.includes('tanggal') || /booking/i.test(text.split('\n')[0] || '')) {
        // Looks like an attempt to submit the booking template.
        const { fields, complete } = parseBookingFields(text);
        if (complete) {
          intent = 'booking_submit';
          reply = await handleBooking(fields);
        } else {
          intent = 'booking_start';
          reply = BOOKING_TEMPLATE;
        }
      } else if (lower === 'jadwal' || lower.includes('cek jadwal') || lower === '2') {
        intent = 'jadwal';
        // Try a natural, human-phrased answer first; fall back to the plain formatted list.
        const ctx = await scheduleContextText();
        const aiReply = ctx ? await generateReply({ userMessage: text, scheduleContext: ctx }) : null;
        reply = aiReply || await handleSchedule();
      } else if (lower === 'info' || lower === '1') {
        intent = 'info';
        reply = FAQ_TEXT;
      } else if (lower === 'booking' || lower === '3') {
        intent = 'booking_start';
        reply = BOOKING_TEMPLATE;
      } else if (['halo', 'hai', 'hi', 'hello', 'menu', 'p'].includes(lower)) {
        intent = 'menu';
        reply = MENU_TEXT;
      } else if (NEGOTIATION_PATTERN.test(text)) {
        // Someone's trying to haggle — let Claude handle it warmly without ever quoting a price.
        intent = 'nego';
        const ctx = await scheduleContextText();
        const aiReply = await generateReply({ userMessage: text, scheduleContext: ctx });
        reply = aiReply || `Soal harga, nanti tim kami yang konfirmasi langsung sesuai kebutuhan acara kakak ya 🙏 Boleh share dulu detail acaranya (tanggal, lokasi, jenis acara)? Atau ketik *BOOKING* buat mulai ajukan.`;
      } else {
        // Free-form question — this is where the bot should feel human, not templated.
        intent = 'lainnya';
        const ctx = await scheduleContextText();
        const aiReply = await generateReply({ userMessage: text, scheduleContext: ctx });
        reply = aiReply || `Makasih pesannya! Tim Wijaya 80 akan balas langsung ya 🙏\n\nSambil nunggu, ketik *MENU* untuk lihat info harga, jadwal, atau cara booking.`;
      }
    } catch (innerErr) {
      // Google Calendar not configured yet, or a transient error — degrade gracefully.
      reply = `Maaf, sistem jadwal kami lagi ada kendala teknis (${innerErr.message}). Tim kami akan follow up manual ya.`;
    }

    await logInbox({ phone: from, message: text, intent });
    await sendText(from, reply);

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    // Always 200 back to Meta so it doesn't keep retrying the same payload.
    return { statusCode: 200, body: 'OK' };
  }
};

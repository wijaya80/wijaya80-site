// Shared helper: best-effort logging into an Airtable "Inbox" table so
// every WhatsApp inquiry is visible to the band's team, even the ones the
// bot couldn't fully answer. Failures here never break the WhatsApp reply.
const Airtable = require('airtable');

async function logInbox({ phone, message, intent }) {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_INBOX_TABLE_NAME } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return; // logging is optional, don't throw

  try {
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const table = AIRTABLE_INBOX_TABLE_NAME || 'Inbox';
    await base(table).create([
      {
        fields: {
          Telepon: phone,
          Pesan: message,
          Intent: intent || '-',
          Waktu: new Date().toISOString(),
        },
      },
    ]);
  } catch (err) {
    console.error('Gagal mencatat ke Airtable Inbox:', err.message);
  }
}

module.exports = { logInbox };

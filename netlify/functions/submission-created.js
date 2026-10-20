// Netlify runs this function automatically after EVERY Netlify Forms submission
// (the special name "submission-created" is what triggers it). We use it to copy the data into Google Sheets:
//
//   form "fanbase"                -> tab "Gratis"          (one row per sign-up, from the homepage form or the pricing page)
//   form "fanbase-premium-order"  -> tab "Funding Member"  (row created, status PENDING)
//   form "fanbase-premium-photo"  -> tab "Funding Member"  (photo link filled in on the same order row)
//   form "fanbase-premium-paid"   -> tab "Funding Member"  (status PAID + member number + paid time)
//
// Netlify Forms keeps its own copy and e-mail notifications as before; this is only an extra copy.
// Needs GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_SHEET_ID (see _sheets.js).
// If they are not set, the function does nothing.
const { isConfigured, appendRow, upsertByKey } = require('./_sheets');

const FREE_TAB = 'Gratis';
const FREE_HEADER = ['Waktu', 'Nama', 'Email', 'WhatsApp', 'Kota', 'Instagram', 'Tipe fans'];

const PREMIUM_TAB = 'Funding Member';
// column index: 0 A ... 10 K
const PREMIUM_HEADER = [
  'Order ID', 'Status', 'Waktu order', 'Nama', 'Email', 'WhatsApp', 'Kota', 'Alamat kirim',
  'No. member', 'Waktu bayar', 'Kartu (link)', 'Foto asli (link)',
];

const wib = (iso) =>
  new Date(iso || Date.now()).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });

function fileUrl(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.url || '';
}

exports.handler = async (event) => {
  try {
    if (!isConfigured()) return { statusCode: 200, body: 'sheets not configured' };

    const payload = (JSON.parse(event.body || '{}') || {}).payload || {};
    const form = payload.form_name;
    const d = payload.data || {};
    const when = wib(payload.created_at);

    if (form === 'fanbase') {
      await appendRow(FREE_TAB, FREE_HEADER, [
        when, d.name || '', d.email || '', d.whatsapp || '', d.city || '', d.instagram || '', d.fanType || '',
      ]);
    } else if (form === 'fanbase-premium-order' && d.order_id) {
      const info = { 3: d.name || '', 4: d.email || '', 5: d.whatsapp || '', 6: d.city || '', 7: d.address || '' };
      await upsertByKey(PREMIUM_TAB, PREMIUM_HEADER, d.order_id, info, { 1: 'PENDING', 2: when });
    } else if (form === 'fanbase-premium-photo' && d.order_id) {
      await upsertByKey(PREMIUM_TAB, PREMIUM_HEADER, d.order_id, { 11: fileUrl(d.photo) }, { 1: 'PENDING', 2: when, 3: d.name || '' });
    } else if (form === 'fanbase-premium-card' && d.order_id) {
      await upsertByKey(PREMIUM_TAB, PREMIUM_HEADER, d.order_id, { 10: fileUrl(d.card) }, { 1: 'PENDING', 2: when, 3: d.name || '' });
    } else if (form === 'fanbase-premium-paid' && d.order_id) {
      await upsertByKey(
        PREMIUM_TAB, PREMIUM_HEADER, d.order_id,
        { 1: 'PAID', 8: d.member_no || '', 9: d.paid_at || when },
        { 2: when }
      );
    }
  } catch (e) {
    console.error('submission-created -> Sheets failed:', e && e.message);
  }
  return { statusCode: 200, body: 'ok' };
};

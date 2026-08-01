// Shared helper: send messages via WhatsApp Cloud API (Meta).
// Requires these environment variables (set in Netlify site settings):
//   WHATSAPP_TOKEN            - permanent access token (System User token) from Meta app
//   WHATSAPP_PHONE_NUMBER_ID  - the "Phone number ID" shown in Meta > WhatsApp > API Setup
const GRAPH_VERSION = 'v20.0';

async function sendText(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp belum dikonfigurasi (env vars kosong).');
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal kirim WhatsApp: ${res.status} ${errText}`);
  }
  return res.json();
}

module.exports = { sendText };

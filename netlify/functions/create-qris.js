// POST /.netlify/functions/create-qris
// Body (JSON): { name, email, whatsapp, city, address }
// Creates a QRIS charge at Midtrans for the Premium membership and returns the QR to show on the page.
const { PRICE, ITEM_NAME, midtrans, newOrderId, recordInForm, json } = require('./_payment');

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.MIDTRANS_SERVER_KEY) {
    return json(500, { error: 'Pembayaran belum dikonfigurasi. Hubungi Wijayawan.' });
  }

  let b;
  try {
    b = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Data tidak valid.' });
  }
  if (b.website) return json(400, { error: 'Data tidak valid.' }); // honeypot

  const name = clean(b.name, 80);
  const email = clean(b.email, 120);
  const whatsapp = clean(b.whatsapp, 20).replace(/[^\d+]/g, '');
  const city = clean(b.city, 60);
  const address = clean(b.address, 300);

  if (name.length < 2) return json(400, { error: 'Nama wajib diisi.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Email tidak valid.' });
  if (whatsapp.replace(/\D/g, '').length < 9) return json(400, { error: 'Nomor WhatsApp tidak valid.' });
  if (city.length < 2) return json(400, { error: 'Kota wajib diisi.' });
  if (address.length < 10) return json(400, { error: 'Alamat pengiriman terlalu singkat.' });

  const orderId = newOrderId();

  const charge = await midtrans('/v2/charge', {
    method: 'POST',
    body: JSON.stringify({
      payment_type: 'qris',
      transaction_details: { order_id: orderId, gross_amount: PRICE },
      item_details: [{ id: 'wjy-premium', price: PRICE, quantity: 1, name: ITEM_NAME }],
      customer_details: { first_name: name, email, phone: whatsapp },
      qris: { acquirer: 'gopay' },
      custom_expiry: { expiry_duration: 15, unit: 'minute' },
    }),
  });

  if (!['200', '201'].includes(String(charge.status_code))) {
    console.error('Midtrans charge failed', charge);
    return json(502, { error: 'Gagal membuat QRIS. Coba lagi sebentar.' });
  }

  const qr = (charge.actions || []).find((a) => a.name === 'generate-qr-code');

  await recordInForm('fanbase-premium-order', {
    order_id: orderId,
    name,
    email,
    whatsapp,
    city,
    address,
    amount: String(PRICE),
    status: 'pending',
  });

  return json(200, {
    orderId,
    amount: PRICE,
    qrUrl: qr ? qr.url : null,
    qrString: charge.qr_string || null,
  });
};

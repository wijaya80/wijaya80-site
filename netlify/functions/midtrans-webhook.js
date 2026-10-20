// POST /.netlify/functions/midtrans-webhook
// Set this URL in Midtrans dashboard -> Settings -> Payment -> Notification URL:
//   https://wijaya80.id/.netlify/functions/midtrans-webhook
//
// Midtrans calls it whenever a payment status changes. We verify the signature, double-check the status
// directly with Midtrans, and when settled we record a "paid" entry in Netlify Forms (-> email to info@wijaya80.id).
const crypto = require('crypto');
const { PRICE, ORDER_ID_RE, midtrans, simpleStatus, assignMemberNo, padNo, recordInForm, json } = require('./_payment');

function validSignature(n) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  const expected = crypto
    .createHash('sha512')
    .update(String(n.order_id) + String(n.status_code) + String(n.gross_amount) + serverKey)
    .digest('hex');
  const got = String(n.signature_key || '');
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.MIDTRANS_SERVER_KEY) return json(500, { error: 'Not configured' });

  let n;
  try {
    n = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Bad body' });
  }

  if (!ORDER_ID_RE.test(String(n.order_id || '')) || !validSignature(n)) {
    return json(403, { error: 'Invalid signature' });
  }

  // Don't trust the notification body alone: ask Midtrans for the real status.
  const real = await midtrans('/v2/' + encodeURIComponent(n.order_id) + '/status', { method: 'GET' });

  if (simpleStatus(real.transaction_status) === 'paid' && Math.round(Number(real.gross_amount)) === PRICE) {
    const { no, isNew } = await assignMemberNo(n.order_id, event);
    if (isNew) {
      await recordInForm('fanbase-premium-paid', {
        order_id: n.order_id,
        member_no: padNo(no),
        amount: String(PRICE),
        status: 'PAID',
        paid_at: String(real.settlement_time || real.transaction_time || ''),
      });
    }
  }

  return json(200, { ok: true });
};

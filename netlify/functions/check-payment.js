// GET /.netlify/functions/check-payment?orderId=WJYP-XXXX
// The website polls this while the QRIS is on screen.
// Returns { status: 'pending' | 'paid' | 'failed' | 'unknown', cardNo: '00001' | '' }.
// When the payment is settled it also assigns the sequential member number (idempotent).
const { PRICE, ORDER_ID_RE, midtrans, simpleStatus, assignMemberNo, padNo, recordInForm, json } = require('./_payment');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!process.env.MIDTRANS_SERVER_KEY) return json(500, { error: 'Pembayaran belum dikonfigurasi.' });

  const orderId = (event.queryStringParameters || {}).orderId || '';
  if (!ORDER_ID_RE.test(orderId)) return json(400, { error: 'Order tidak valid.' });

  const data = await midtrans('/v2/' + encodeURIComponent(orderId) + '/status', { method: 'GET' });

  // Only trust a "paid" result if the amount is what we charged.
  let status = simpleStatus(data.transaction_status);
  if (status === 'paid' && Math.round(Number(data.gross_amount)) !== PRICE) status = 'unknown';

  let cardNo = '';
  if (status === 'paid') {
    const { no, isNew } = await assignMemberNo(orderId, event);
    cardNo = padNo(no);
    if (isNew) {
      await recordInForm('fanbase-premium-paid', {
        order_id: orderId,
        member_no: cardNo,
        amount: String(PRICE),
        status: 'PAID',
        paid_at: String(data.settlement_time || data.transaction_time || ''),
      });
    }
  }

  return json(200, { status, cardNo });
};

// Shared helpers for the Funding Member QRIS payment (Midtrans Core API).
//
// Env vars (Netlify -> Site configuration -> Environment variables):
//   MIDTRANS_SERVER_KEY      - Server Key from Midtrans dashboard (Settings -> Access Keys).
//                              Sandbox key starts with "SB-Mid-server-", production with "Mid-server-".
//   MIDTRANS_IS_PRODUCTION   - "true" to use the live Midtrans API. Leave unset/"false" for sandbox testing.
//
// Records live in Netlify Forms (emailed to info@wijaya80.id via form notifications):
//   fanbase-premium-order  -> created when a QRIS is generated (status=pending, full member data)
//   fanbase-premium-photo  -> member photo for the card (uploaded from the browser)
//   fanbase-premium-paid   -> created once the payment is settled, includes the member number
// Sequential member numbers (No. 00001, 00002, ...) are kept in Netlify Blobs (needs the
// "@netlify/blobs" package in package.json). If Blobs is unavailable the payment still works,
// the number is simply left empty and must be assigned by hand.

const crypto = require('crypto');

let blobs = null;
try {
  blobs = require('@netlify/blobs');
} catch (e) {
  /* optional */
}

// Price of the Funding Member package in IDR. Keep in sync with the "Rp 500.000" shown on fanbase-premium.html.
const PRICE = 500000;
const ITEM_NAME = 'Funding Member Wijayanti & Wijayanto';

const ORDER_ID_RE = /^WJYP-[A-Z0-9]{6,30}$/;

function midtransBase() {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';
}

function authHeader() {
  const key = process.env.MIDTRANS_SERVER_KEY || '';
  return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

async function midtrans(path, options) {
  const res = await fetch(midtransBase() + path, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      ...((options && options.headers) || {}),
    },
  });
  return res.json();
}

function newOrderId() {
  return 'WJYP-' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
}

// Map Midtrans transaction_status to something simple for the website.
function simpleStatus(transactionStatus) {
  switch (transactionStatus) {
    case 'settlement':
    case 'capture':
      return 'paid';
    case 'pending':
      return 'pending';
    case 'expire':
    case 'cancel':
    case 'deny':
    case 'failure':
      return 'failed';
    default:
      return 'unknown';
  }
}

// ---- Sequential member numbers (Netlify Blobs) ----
function getMemberStore(event) {
  if (!blobs) return null;
  try {
    if (event && typeof blobs.connectLambda === 'function') blobs.connectLambda(event);
  } catch (e) {
    /* ignore */
  }
  try {
    return blobs.getStore({ name: 'wijaya-members', consistency: 'strong' });
  } catch (e) {
    console.error('Blobs unavailable', e && e.message);
    return null;
  }
}

// Returns { no: <number|null>, isNew: <bool> }. Idempotent per order: the same order always gets the same number.
async function assignMemberNo(orderId, event) {
  const store = getMemberStore(event);
  // No Blobs: still report the payment (at most a duplicate entry), number stays empty for manual assignment.
  if (!store) return { no: null, isNew: true };
  try {
    const existing = await store.get('order/' + orderId, { type: 'json' });
    if (existing && existing.no) return { no: existing.no, isNew: false };

    const claim = await store.setJSON('claim/' + orderId, { t: Date.now() }, { onlyIfNew: true });
    if (!claim.modified) {
      // Another request is assigning right now. If that claim looks stuck (>60s), take over; otherwise try again later.
      const c = await store.get('claim/' + orderId, { type: 'json' });
      if (!c || Date.now() - c.t < 60000) return { no: null, isNew: false };
    }

    const hint = parseInt((await store.get('counter')) || '0', 10) || 0;
    for (let i = 1; i <= 300; i++) {
      const n = hint + i;
      const r = await store.setJSON('no/' + n, { orderId }, { onlyIfNew: true });
      if (r.modified) {
        await store.setJSON('order/' + orderId, { no: n });
        await store.set('counter', String(n));
        return { no: n, isNew: true };
      }
    }
  } catch (e) {
    console.error('assignMemberNo failed', e && e.message);
  }
  return { no: null, isNew: false };
}

const padNo = (n) => (n ? String(n).padStart(5, '0') : '');

// Record something in Netlify Forms from server-side. Never throws (payment must not fail because of this).
async function recordInForm(formName, fields) {
  try {
    const base = process.env.URL || 'https://wijaya80.id';
    const body = new URLSearchParams({ 'form-name': formName, ...fields });
    await fetch(base + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (e) {
    console.error('recordInForm failed', formName, e && e.message);
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(obj),
  };
}

module.exports = {
  PRICE,
  ITEM_NAME,
  ORDER_ID_RE,
  midtrans,
  newOrderId,
  simpleStatus,
  assignMemberNo,
  padNo,
  recordInForm,
  json,
};

// Minimal Google Sheets client (no npm packages). Two ways to connect, pick ONE:
//
// (A) Google Apps Script web app attached to the sheet  <-- simplest, recommended
//     Env vars:  SHEETS_WEBHOOK_URL   - the web app URL ("Deploy" in Apps Script, see google-apps-script.gs)
//                SHEETS_WEBHOOK_SECRET - same secret word as in the script
//
// (B) Google service account (needs a Google Cloud project)

// Env vars (the first two are the same ones the booking/calendar bot already uses):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  - service account e-mail
//   GOOGLE_PRIVATE_KEY            - its private key (the "\n" escapes are fine)
//   GOOGLE_SHEET_ID               - the id in the spreadsheet URL: docs.google.com/spreadsheets/d/<ID>/edit
// The spreadsheet must be shared (Editor) with the service account e-mail, and the Google Sheets API must be
// enabled in the same Google Cloud project.

const crypto = require('crypto');

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const b64u = (b) => Buffer.from(b).toString('base64url');

let cached = { token: null, exp: 0 };

const WEBHOOK = () => process.env.SHEETS_WEBHOOK_URL;

async function callWebhook(payload) {
  const res = await fetch(WEBHOOK(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, secret: process.env.SHEETS_WEBHOOK_SECRET || '' }),
    redirect: 'follow',
  });
  const text = await res.text();
  let d = {};
  try { d = JSON.parse(text); } catch (e) { /* html error page */ }
  if (!d.ok) throw new Error('Apps Script webhook failed: ' + (d.error || text.slice(0, 200)));
}

function isConfigured() {
  if (WEBHOOK()) return true;
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEET_ID
  );
}

async function getToken() {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) +
    '.' +
    b64u(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: unsigned + '.' + sig,
    }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error('Google token error: ' + JSON.stringify(d));
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return cached.token;
}

async function api(path, options) {
  const token = await getToken();
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + process.env.GOOGLE_SHEET_ID + path, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  });
  const d = await res.json();
  if (!res.ok) throw new Error('Sheets API ' + res.status + ': ' + JSON.stringify(d.error || d));
  return d;
}

const enc = encodeURIComponent;
const colLetter = (i) => String.fromCharCode(65 + i); // supports up to column Z

// Make sure the tab exists and has its header row.
async function ensureTab(title, header) {
  const meta = await api('?fields=sheets.properties.title', { method: 'GET' });
  const exists = (meta.sheets || []).some((s) => s.properties.title === title);
  if (exists) return;
  await api(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
  await api('/values/' + enc(title + '!A1') + '?valueInputOption=RAW', {
    method: 'PUT',
    body: JSON.stringify({ values: [header] }),
  });
}

async function appendRow(title, header, row) {
  if (WEBHOOK()) return callWebhook({ action: 'append', tab: title, header, row });
  await ensureTab(title, header);
  await api('/values/' + enc(title + '!A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [row] }),
  });
}

// Update the row whose column A equals `key`. `existing` / `create` are { columnIndex: value } maps.
// If the row is not there yet a new one is appended using `create` (merged over `existing`).
async function upsertByKey(title, header, key, existing, create) {
  if (WEBHOOK()) return callWebhook({ action: 'upsert', tab: title, header, key, existing, create: create || {} });
  await ensureTab(title, header);
  const col = await api('/values/' + enc(title + '!A:A'), { method: 'GET' });
  const keys = (col.values || []).map((r) => r[0]);
  const idx = keys.indexOf(key);
  if (idx >= 0) {
    const rowNo = idx + 1;
    const data = Object.keys(existing).map((c) => ({
      range: title + '!' + colLetter(Number(c)) + rowNo,
      values: [[existing[c]]],
    }));
    if (data.length) {
      await api('/values:batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'RAW', data }),
      });
    }
    return;
  }
  const row = new Array(header.length).fill('');
  row[0] = key;
  const all = Object.assign({}, existing, create || {});
  Object.keys(all).forEach((c) => {
    row[Number(c)] = all[c];
  });
  await api('/values/' + enc(title + '!A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [row] }),
  });
}

module.exports = { isConfigured, appendRow, upsertByKey };

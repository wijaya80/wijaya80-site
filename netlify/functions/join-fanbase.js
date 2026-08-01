// POST /.netlify/functions/join-fanbase
// Saves a fan signup (Wijayanti / Wijayanto / Lainnya) into an Airtable
// base so the band has one clean, shared fan database.
//
// Requires these env vars (set in Netlify site settings):
//   AIRTABLE_API_KEY   - Personal Access Token from airtable.com/create/tokens
//                        (scopes: data.records:write, data.records:read on the base)
//   AIRTABLE_BASE_ID   - starts with "app..." (from the base's API docs / URL)
//   AIRTABLE_TABLE_NAME - e.g. "Fans" (see README for recommended columns)
const Airtable = require('airtable');

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

  const required = ['name', 'email', 'whatsapp', 'city', 'fanType'];
  const missing = required.filter(f => !data[f]);
  if (missing.length) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: `Field wajib belum lengkap: ${missing.join(', ')}` }),
    };
  }

  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    return {
      statusCode: 503,
      body: JSON.stringify({ message: 'Database fanbase belum dikonfigurasi (Airtable env vars kosong).' }),
    };
  }

  try {
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    await base(AIRTABLE_TABLE_NAME).create([
      {
        fields: {
          Nama: data.name,
          Email: data.email,
          WhatsApp: data.whatsapp,
          Kota: data.city,
          Instagram: data.instagram || '',
          'Tipe Fan': data.fanType,
          'Tanggal Gabung': new Date().toISOString().slice(0, 10),
          Sumber: 'Website',
        },
      },
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Makasih sudah gabung sebagai ${data.fanType}! Sampai jumpa di panggung.` }),
    };
  } catch (err) {
    return {
      statusCode: 503,
      body: JSON.stringify({ message: `Gagal menyimpan data: ${err.message}` }),
    };
  }
};

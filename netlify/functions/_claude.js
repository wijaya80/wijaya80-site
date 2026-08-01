// Shared helper: generate a natural, human-feeling WhatsApp reply using Claude (Anthropic API).
// This is what makes the bot answer free-form questions and handle price-negotiation attempts
// gracefully instead of falling back to a rigid keyword menu.
//
// Requires:
//   ANTHROPIC_API_KEY - from https://console.anthropic.com/settings/keys
//
// If the key isn't set (or the API call fails for any reason), generateReply() returns null
// so the caller can fall back to the static menu/FAQ text — the bot never breaks because of this.
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `Kamu adalah admin resmi band Wijaya 80 yang membalas chat WhatsApp calon klien dan fans. Wijaya 80 adalah band yang membawakan nostalgia musik Indonesia era 80an (synth hangat, gitar melodius, balada romantis), tampil dalam format full band atau akustik, untuk acara korporat, pernikahan, festival, dan acara privat.

Gaya bicara kamu:
- Bahasa Indonesia santai-profesional, seperti admin band beneran yang ramah — bukan seperti robot atau template.
- Boleh pakai sapaan "kak", kalimat pendek-pendek, dan emoji sesekali (jangan berlebihan).
- Jawaban singkat dan padat, cocok untuk chat WhatsApp (idealnya 2-5 kalimat, bukan esai panjang).
- Kalau memang ditanya langsung apakah kamu AI/bot, jawab jujur bahwa kamu asisten chat Wijaya 80 — jangan berbohong soal itu.

Aturan penting soal harga & nego (WAJIB dipatuhi):
- JANGAN PERNAH menyebutkan angka harga, persentase diskon, atau menyetujui tawaran harga spesifik apa pun, walau diminta atau didesak.
- Kalau ada yang nego/nawar/minta diskon/nanya harga pasti, jawab dengan ramah bahwa harga final disesuaikan kebutuhan acara (lokasi, durasi, format) dan akan dikonfirmasi langsung oleh tim Wijaya 80 — ajak mereka share detail acaranya (tanggal, lokasi, jenis acara, estimasi jumlah tamu) biar tim bisa kasih penawaran yang pas.
- Tetap hangat dan terbuka saat menolak kasih angka, jangan ketus atau kaku.

Kalau ditanya soal jadwal manggung, pakai info jadwal terbaru yang diberikan di bawah (kalau ada). Kalau tidak ada info jadwal yang diberikan, arahkan untuk ketik *JADWAL*.

Kalau pertanyaannya di luar topik band/booking/merchandise sama sekali, arahkan dengan sopan kembali ke topik Wijaya 80.

Tutup jawaban dengan ajakan lanjut yang relevan kalau pas (misal ketik *BOOKING* untuk ajukan tanggal), tapi tidak usah dipaksakan di setiap balasan.`;

async function generateReply({ userMessage, scheduleContext }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const system = scheduleContext
    ? `${SYSTEM_PROMPT}\n\nInfo jadwal manggung terbaru:\n${scheduleContext}`
    : SYSTEM_PROMPT;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Anthropic API error:', res.status, errText);
      return null;
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim();
    return text || null;
  } catch (err) {
    console.error('Anthropic API call failed:', err);
    return null;
  }
}

module.exports = { generateReply };

# Wijaya 80 — Website Resmi

Website satu halaman untuk band **Wijaya 80**: profil band, jadwal manggung, form booking (terhubung ke Google Calendar), dan pendaftaran fanbase **Wijayanti** & **Wijayanto** (terhubung ke Airtable).

## Isi folder

```
index.html, style.css, script.js        → website (front-end)
gigs.json                               → jadwal contoh (dipakai sebelum Google Calendar tersambung)
netlify/functions/gigs.js               → ambil jadwal live dari Google Calendar
netlify/functions/book.js               → terima pengajuan booking dari website, cek bentrok, buat hold di kalender
netlify/functions/join-fanbase.js       → simpan pendaftar fanbase ke Airtable
netlify/functions/whatsapp-webhook.js   → bot WhatsApp: menu, info/harga, cek jadwal, booking
netlify/functions/_whatsapp.js          → helper kirim pesan WhatsApp (Meta Cloud API)
netlify/functions/_googleCalendar.js    → helper koneksi Google Calendar (dipakai bareng)
netlify/functions/_airtableLog.js       → helper catat semua pertanyaan WhatsApp ke Airtable
netlify.toml, package.json              → konfigurasi deploy Netlify
```

Tanpa setup apa pun, website ini **sudah bisa dibuka dan dipresentasikan ke client** — jadwal akan tampil dari `gigs.json` (data contoh), dan form akan bilang "mode demo" kalau belum tersambung. Ikuti langkah di bawah untuk menyalakan integrasi live.

## 1. Deploy ke domain sendiri (Netlify)

1. Upload folder ini ke GitHub, atau drag-drop langsung ke [app.netlify.com/drop](https://app.netlify.com/drop).
2. Di Netlify: **Site settings → Domain management** → tambahkan domain kamu (mis. `wijaya80.id`) dan ikuti instruksi ubah DNS di registrar.
3. Setelah deploy pertama, tambahkan environment variables di **Site settings → Environment variables** (lihat langkah 2 & 3).

Gue bisa langsung bantu proses deploy-nya kalau kamu connect akun Netlify di chat ini (tombol Connect yang sudah muncul).

## 2. Sambungkan Google Calendar (jadwal manggung + booking)

1. Buka [console.cloud.google.com](https://console.cloud.google.com) → buat project baru (atau pakai yang ada).
2. Aktifkan **Google Calendar API** (APIs & Services → Enable APIs).
3. Buat **Service Account** (APIs & Services → Credentials → Create Credentials → Service Account) → buat **key** JSON, download.
4. Dari file JSON itu, ambil:
   - `client_email` → ini jadi `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → ini jadi `GOOGLE_PRIVATE_KEY` (paste apa adanya, termasuk `\n`)
5. Buka Google Calendar band kamu → **Settings and sharing** → di bagian "Share with specific people", tambahkan email service account tadi dengan akses **"Make changes to events"**.
6. Ambil **Calendar ID** dari Settings calendar tersebut → ini jadi `GOOGLE_CALENDAR_ID`.
7. Masukkan ketiga nilai itu sebagai environment variables di Netlify.

Setelah ini aktif: jadwal di website otomatis sinkron dari kalender asli, dan setiap pengajuan booking otomatis masuk sebagai event "tentative" di kalender untuk kamu konfirmasi.

## 3. Sambungkan Airtable (database fanbase)

1. Buat base baru di [airtable.com](https://airtable.com), beri nama mis. `Wijaya 80 Fanbase`.
2. Buat tabel (mis. nama `Fans`) dengan kolom:

   | Kolom | Tipe |
   |---|---|
   | Nama | Single line text |
   | Email | Email |
   | WhatsApp | Phone number |
   | Kota | Single line text |
   | Instagram | Single line text |
   | Tipe Fan | Single select: `Wijayanti`, `Wijayanto`, `Lainnya` |
   | Tanggal Gabung | Date |
   | Sumber | Single line text |

3. Buat **Personal Access Token** di [airtable.com/create/tokens](https://airtable.com/create/tokens) dengan scope `data.records:write` dan `data.records:read`, akses ke base di atas → ini jadi `AIRTABLE_API_KEY`.
4. Ambil **Base ID** (awalan `app...`) dari halaman API base kamu → ini jadi `AIRTABLE_BASE_ID`.
5. `AIRTABLE_TABLE_NAME` = nama tabel di langkah 2 (mis. `Fans`).
6. Masukkan tiga nilai itu sebagai environment variables di Netlify.

Setelah ini aktif, setiap orang yang isi form fanbase di website otomatis masuk sebagai baris baru di Airtable — satu database rapi untuk Wijayanti & Wijayanto, siap dipakai untuk broadcast info manggung atau presale tiket nantinya.

## 4. Bot WhatsApp (booking + jawab pertanyaan otomatis)

File: `netlify/functions/whatsapp-webhook.js`. Bot ini otomatis balas client yang chat ke nomor WhatsApp bisnis band — menu info/harga, cek jadwal, dan terima pengajuan booking langsung ke Google Calendar (pakai setup di Langkah 2). Setiap pesan masuk juga dicatat ke Airtable (tabel `Inbox`) supaya tim tetap lihat semua pertanyaan, termasuk yang di luar menu.

### 4.1 Setup akun & nomor di Meta

1. Buat akun di [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App** → pilih tipe **Business**.
2. Di dashboard app, tambahkan produk **WhatsApp**.
3. Di halaman **WhatsApp → API Setup**, kamu akan lihat nomor test gratis untuk uji coba, atau tambahkan nomor bisnis kamu sendiri (perlu verifikasi via Meta Business Manager, prosesnya beberapa hari).
4. Catat **Phone number ID** yang muncul di halaman itu → ini jadi `WHATSAPP_PHONE_NUMBER_ID`.

### 4.2 Buat token permanen

Token bawaan di halaman API Setup cuma berlaku 24 jam. Untuk produksi:
1. Buka **Meta Business Suite → Settings → Users → System Users** → buat System User baru dengan role Admin.
2. **Add Assets** → pilih app WhatsApp kamu → beri akses Full Control.
3. **Generate Token** untuk system user itu, centang permission `whatsapp_business_messaging` dan `whatsapp_business_management`, pilih masa berlaku **Never Expire** kalau tersedia.
4. Simpan token ini sebagai `WHATSAPP_TOKEN`.

### 4.3 Pasang webhook

1. Deploy dulu website ini ke Netlify (Langkah 1) supaya kamu punya URL, mis. `https://wijaya80.netlify.app`.
2. Tentukan sendiri sebuah string rahasia bebas, mis. `wijaya80rahasia` → ini jadi `WHATSAPP_VERIFY_TOKEN` (masukkan juga sebagai env var di Netlify).
3. Di Meta → **WhatsApp → Configuration → Webhook**, isi:
   - **Callback URL**: `https://<domain-kamu>/.netlify/functions/whatsapp-webhook`
   - **Verify token**: string yang sama seperti di atas.
4. Klik **Verify and Save**, lalu subscribe ke field **messages**.

### 4.4 Edit isi balasan bot

Buka `netlify/functions/whatsapp-webhook.js`, ubah teks di bagian atas file (`FAQ_TEXT`, `MENU_TEXT`, `BOOKING_TEMPLATE`) supaya sesuai info harga & gaya bahasa band kamu.

### 4.5 (Opsional) Tabel log pertanyaan di Airtable

Tambahkan tabel baru bernama `Inbox` di base Airtable yang sama dengan fanbase, dengan kolom: `Telepon`, `Pesan`, `Intent`, `Waktu`. Kalau nama tabelnya beda, set env var `AIRTABLE_INBOX_TABLE_NAME`. Ini opsional — kalau tidak di-set, bot tetap jalan, cuma tidak mencatat log.

### 4.6 Ganti nomor tombol "Chat WhatsApp" di website

Cari `6281234567890` di `index.html` (ada 2 tempat: tombol mengambang & bagian Kontak), ganti dengan nomor WhatsApp bisnis band kamu (format internasional tanpa `+` atau spasi, mis. `6281298765432`).

## Environment variables — ringkasan

| Variable | Dari mana |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Cloud service account |
| `GOOGLE_PRIVATE_KEY` | Google Cloud service account key |
| `GOOGLE_CALENDAR_ID` | Google Calendar settings |
| `AIRTABLE_API_KEY` | Airtable personal access token |
| `AIRTABLE_BASE_ID` | Airtable base API page |
| `AIRTABLE_TABLE_NAME` | Nama tabel Airtable (fanbase) |
| `AIRTABLE_INBOX_TABLE_NAME` | Nama tabel Airtable untuk log WhatsApp (opsional, default `Inbox`) |
| `WHATSAPP_TOKEN` | Meta System User permanent token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp API Setup page |
| `WHATSAPP_VERIFY_TOKEN` | String bebas buatan kamu sendiri |

## Kustomisasi cepat

- Ganti email/Instagram/WhatsApp di bagian **Kontak** (`index.html`, dekat akhir file).
- Tambah/hapus jadwal contoh di `gigs.json` (hanya dipakai sebelum Google Calendar tersambung).
- Warna & font ada di `style.css` bagian `:root` (`--neon-pink`, `--neon-orange`, `--neon-cyan`).

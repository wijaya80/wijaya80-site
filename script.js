document.getElementById('year').textContent = new Date().getFullYear();

// --- Mobile nav toggle ---
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav__links');
navToggle.addEventListener('click', () => {
  navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
});

// --- Gig schedule: live from Google Calendar (via Netlify function), falls back to gigs.json sample data ---
async function loadGigs() {
  const gigList = document.getElementById('gigList');
  let gigs = [];
  let source = 'sample';

  try {
    const res = await fetch('/.netlify/functions/gigs');
    if (res.ok) {
      gigs = await res.json();
      source = 'live';
    } else {
      throw new Error('function not ready');
    }
  } catch (e) {
    // Fallback to static sample data (used until Google Calendar is connected/deployed)
    const res = await fetch('gigs.json');
    gigs = await res.json();
  }

  if (!gigs.length) {
    gigList.innerHTML = '<p class="gig-loading">Belum ada jadwal tampil. Jadilah yang pertama booking!</p>';
    return;
  }

  gigList.innerHTML = gigs
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(g => {
      const d = new Date(g.date);
      const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      const isOpen = g.status !== 'booked';
      return `
        <div class="gig-item">
          <div class="gig-item__date">${dateStr}</div>
          <div class="gig-item__info">
            <div class="gig-item__venue">${g.venue}</div>
            <div class="gig-item__city">${g.city}</div>
          </div>
          <div class="gig-status ${isOpen ? 'gig-status--open' : 'gig-status--booked'}">
            ${isOpen ? 'Tanggal Terbuka' : 'Sudah Manggung'}
          </div>
        </div>`;
    })
    .join('');

  if (source === 'sample') {
    gigList.insertAdjacentHTML('beforeend', '<p class="gig-loading" style="margin-top:10px;font-size:0.78rem;">*Jadwal contoh — akan otomatis sinkron dengan Google Calendar setelah terhubung.</p>');
  }
}
loadGigs();

// --- Booking form ---
const bookingForm = document.getElementById('bookingForm');
const bookingStatus = document.getElementById('bookingStatus');

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  bookingStatus.textContent = 'Mengirim pengajuan…';
  const data = Object.fromEntries(new FormData(bookingForm).entries());

  try {
    const res = await fetch('/.netlify/functions/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (res.ok) {
      bookingStatus.textContent = result.message || 'Pengajuan terkirim! Tim kami akan menghubungi kamu segera.';
      bookingForm.reset();
    } else {
      bookingStatus.textContent = result.message || 'Tanggal tersebut sudah terisi, coba tanggal lain ya.';
    }
  } catch (err) {
    bookingStatus.textContent = 'Form booking belum tersambung ke sistem (mode demo). Setelah deploy & setup selesai, pengajuan akan otomatis masuk ke kalender.';
  }
});

// --- Fanbase form ---
const fanForm = document.getElementById('fanForm');
const fanStatus = document.getElementById('fanStatus');

fanForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  fanStatus.textContent = 'Menyimpan data…';
  const data = Object.fromEntries(new FormData(fanForm).entries());

  try {
    const res = await fetch('/.netlify/functions/join-fanbase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (res.ok) {
      fanStatus.textContent = result.message || `Makasih sudah gabung sebagai ${data.fanType}! Sampai jumpa di panggung.`;
      fanForm.reset();
    } else {
      fanStatus.textContent = result.message || 'Gagal menyimpan, coba lagi ya.';
    }
  } catch (err) {
    fanStatus.textContent = 'Form fanbase belum tersambung ke database (mode demo). Setelah deploy & setup selesai, data akan otomatis masuk ke Airtable.';
  }
});

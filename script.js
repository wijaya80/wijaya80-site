// Wijaya 80 — script utama situs.
//
// Catatan: form Booking dan Fanbase sekarang memakai Netlify Forms (submit native
// ke Netlify, lalu diteruskan sebagai email notifikasi). Karena itu file ini
// sengaja TIDAK lagi meng-intercept submit kedua form tersebut.

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// --- Mobile nav toggle ---
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav__links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
  });
}

// --- Gig schedule: live dari Google Calendar (via Netlify function), fallback ke gigs.json ---
async function loadGigs() {
  const gigList = document.getElementById('gigList');
  if (!gigList) return;

  let gigs = [];
  let source = 'sample';

  try {
    const res = await fetch('/.netlify/functions/gigs');
    if (!res.ok) throw new Error('function not ready');
    gigs = await res.json();
    source = 'live';
  } catch (e) {
    try {
      const res = await fetch('gigs.json');
      gigs = await res.json();
    } catch (err) {
      gigList.innerHTML = '<p class="gig-loading">Jadwal belum bisa dimuat. Coba muat ulang halaman ya.</p>';
      return;
    }
  }

  if (!Array.isArray(gigs) || !gigs.length) {
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
    gigList.insertAdjacentHTML(
      'beforeend',
      '<p class="gig-loading" style="margin-top:10px;font-size:0.78rem;">*Jadwal contoh — akan otomatis sinkron dengan Google Calendar setelah terhubung.</p>'
    );
  }
}
loadGigs();

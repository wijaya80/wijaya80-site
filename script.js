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
    navLinks.classList.toggle('is-open');
  });
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('is-open'));
  });
}

// --- Panggung Wijaya: otomatis dari Google Calendar (function "jadwal"); kalau gagal, tampil jadwal statis di HTML ---
async function loadGigs() {
  const gigList = document.getElementById('gigList');
  if (!gigList) return;
  let gigs;
  try {
    const res = await fetch('/.netlify/functions/jadwal');
    if (!res.ok) return;
    gigs = (await res.json()).gigs;
  } catch (e) { return; }
  if (!Array.isArray(gigs) || !gigs.length) return;

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const groups = {};
  gigs.forEach((g) => { const k = g.date.slice(0, 7); (groups[k] = groups[k] || []).push(g); });
  gigList.innerHTML = Object.keys(groups).sort().map((k) => {
    const [y, m] = k.split('-');
    const items = groups[k].map((g) => `
        <div class="gig-item">
          <div class="gig-item__date">${g.date.slice(8, 10)}</div>
          <div class="gig-item__info">
            <div class="gig-item__venue">${esc(g.venue)}</div>
            <div class="gig-item__city">${esc(g.city)}</div>
          </div>
        </div>`).join('');
    return `<div class="gig-month"><h3 class="gig-month__title">${MONTHS[+m - 1]} ${y}</h3><div class="gig-list">${items}</div></div>`;
  }).join('');
}
loadGigs();

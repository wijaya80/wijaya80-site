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

// --- Pilihan bahasa (Google Translate website translator, dimuat hanya kalau pengunjung memilih bahasa lain) ---
(function () {
  var LANGS = [['id', 'Bahasa Indonesia'], ['en', 'English'], ['zh-CN', '中文'], ['ja', '日本語'], ['ko', '한국어'],
    ['ms', 'Bahasa Melayu'], ['ar', 'العربية'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['hi', 'हिन्दी'], ['nl', 'Nederlands']];

  function currentLang() {
    var m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/);
    return m ? decodeURIComponent(m[1]) : 'id';
  }
  function setLang(code) {
    var host = location.hostname, past = 'Thu, 01 Jan 1970 00:00:00 GMT';
    var kill = function () {
      document.cookie = 'googtrans=; expires=' + past + '; path=/';
      document.cookie = 'googtrans=; expires=' + past + '; path=/; domain=' + host;
      document.cookie = 'googtrans=; expires=' + past + '; path=/; domain=.' + host.replace(/^www\./, '');
    };
    kill();
    if (code !== 'id') document.cookie = 'googtrans=/id/' + code + '; path=/';
    location.reload();
  }

  var cur = currentLang();

  // wadah & gaya
  var css = document.createElement('style');
  css.textContent =
    '.lang-pick{position:fixed;right:16px;bottom:16px;z-index:9999;font-family:Poppins,system-ui,sans-serif}' +
    '.lang-pick select{background:#2a1f16;color:#f1e7d3;border:1px solid #ad8a55;border-radius:999px;padding:9px 14px;font-size:.82rem;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.45);max-width:190px}' +
    '.goog-te-banner-frame,.skiptranslate>iframe,#goog-gt-tt,.goog-te-balloon-frame{display:none!important}' +
    'body{top:0!important}.goog-text-highlight{background:none!important;box-shadow:none!important}' +
    '#google_translate_element{display:none}';
  document.head.appendChild(css);

  var wrap = document.createElement('div');
  wrap.className = 'lang-pick notranslate';
  wrap.setAttribute('translate', 'no');
  var sel = document.createElement('select');
  sel.setAttribute('aria-label', 'Language / Bahasa');
  LANGS.forEach(function (l) {
    var o = document.createElement('option');
    o.value = l[0]; o.textContent = (l[0] === 'id' ? '🌐 ' : '') + l[1];
    if (l[0] === cur) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', function () { setLang(sel.value); });
  wrap.appendChild(sel);
  document.body.appendChild(wrap);

  // muat penerjemah hanya kalau bahasa bukan Indonesia
  if (cur !== 'id') {
    var holder = document.createElement('div');
    holder.id = 'google_translate_element';
    document.body.appendChild(holder);
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({ pageLanguage: 'id', autoDisplay: false }, 'google_translate_element');
    };
    var s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.body.appendChild(s);
  }
})();

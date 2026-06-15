// ========== LANGUAGE SELECTOR ==========
import { translations } from './langguage_data.js';

const langOptions = document.querySelectorAll('.language-option');
const currentLangText = document.getElementById('currentLang');
const sheetEl = document.getElementById('sheetBottom');

// Inisialisasi sheet hanya jika elemennya ada (mencegah error di FB Login)
let sheet = null;
if (sheetEl && typeof bootstrap !== 'undefined') {
  try {
    sheet = bootstrap.Offcanvas.getOrCreateInstance(sheetEl);
  } catch (e) {
    console.warn("Gagal inisialisasi Offcanvas:", e);
  }
}

function getBrowserLang() {
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  return translations[browserLang] ? browserLang : 'id';
}

function updateText(langId) {
  const t = translations[langId] || translations['id'];
  if (!t) return;

  const usernameInput = document.querySelector('#username');
  const passwordInput = document.querySelector('#password');
  const loginBtn = document.querySelector('#loginBtn');
  const forgotLink = document.querySelector('#forgotLink');
  const createBtn = document.querySelector('#createBtn');
  const orText = document.querySelector('.ig-divider span');
  const sheetTitle = document.querySelector('#sheetBottomLabel');

  if (usernameInput) usernameInput.placeholder = t.username;
  if (passwordInput) passwordInput.placeholder = t.password;
  if (loginBtn) loginBtn.textContent = t.login;
  if (forgotLink) forgotLink.textContent = t.forgot;
  if (createBtn) createBtn.textContent = t.create;
  if (orText) orText.textContent = t.or;
  if (sheetTitle) sheetTitle.textContent = t.selectLang;

  document.documentElement.lang = langId;
  document.documentElement.dir = langId === 'ar' ? 'rtl' : 'ltr';
  localStorage.setItem('lang', langId);

  if (currentLangText) {
    const langName = document.querySelector(`[data-lang-id="${langId}"]`)?.getAttribute('data-lang') || 'Bahasa Indonesia';
    currentLangText.innerHTML = `${langName} <small>▼</small>`;
  }
}

langOptions.forEach(option => {
  option.addEventListener('click', function() {
    langOptions.forEach(opt => opt.classList.remove('active'));
    this.classList.add('active');

    const langId = this.getAttribute('data-lang-id');
    updateText(langId);
    if (sheet) sheet.hide();
  });
});

// Load bahasa: Prioritas = localStorage > browser > id
document.addEventListener('DOMContentLoaded', () => {
  const savedLang = localStorage.getItem('lang');
  const browserLang = getBrowserLang();
  const initialLang = savedLang || browserLang;

  const initialOption = document.querySelector(`[data-lang-id="${initialLang}"]`);
  if (initialOption) {
    langOptions.forEach(opt => opt.classList.remove('active'));
    initialOption.classList.add('active');
  }

  updateText(initialLang);
});

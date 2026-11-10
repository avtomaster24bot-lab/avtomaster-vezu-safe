// Общие функции: экранирование, телефоны, WhatsApp-ссылки, код карточки, тема.
import { CONFIG, KINDS } from './config.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Телефон РК: 11 цифр, начинается с 7 (77XX… мобильные, 7XXX… городские). 8XXX → 7XXX.
export function normPhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  return d;
}
export const validPhone = (s) => /^7\d{10}$/.test(normPhone(s));
export const fmtPhone = (s) => { const d = normPhone(s); return d.length === 11 ? `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}` : s; };
export const isExample = (s) => normPhone(s) === CONFIG.EXAMPLE_PHONE;

export const waLink = (phone, text = '') => `https://wa.me/${normPhone(phone)}${text ? '?text=' + encodeURIComponent(text) : ''}`;
export const adminWa = (text) => waLink(CONFIG.ADMIN_WHATSAPP, text);

// Первое сообщение клиента исполнителю. Его отправляет сам клиент из своего WhatsApp — сайт его не видит.
export function clientText(item, service = '') {
  const k = KINDS[item.kind]?.one || '';
  return `Здравствуйте! Нашёл вас на ${CONFIG.SITE_NAME} (${k}, ${item.city}).${service ? ` Интересует: ${service}.` : ''} `;
}

// Кнопки связи. Для примерных номеров — подсказка вместо перехода.
export function contactButtons(item, { service = '' } = {}) {
  const ex = isExample(item.whatsapp);
  const wa = ex ? `<button class="btn wa" data-example>💬 Написать в WhatsApp</button>`
    : `<a class="btn wa" href="${esc(waLink(item.whatsapp, clientText(item, service)))}" target="_blank" rel="noopener noreferrer">💬 Написать в WhatsApp</a>`;
  const ph = item.call ? (ex ? `<button class="btn" data-example>📞 Позвонить</button>` : `<a class="btn" href="tel:+${esc(normPhone(item.phone || item.whatsapp))}">📞 Позвонить</a>`) : '';
  return wa + ph;
}

// Код карточки: JSON → base64url (UTF-8). Используется в личной визитке-ссылке и в заявке на размещение.
export function encodeCard(o) {
  const b = new TextEncoder().encode(JSON.stringify(o)); let s = '';
  b.forEach((x) => { s += String.fromCharCode(x); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeCard(code) {
  const s = atob(String(code).replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0))));
}

// Приводим карточку к безопасному виду: только разрешённые поля и длины.
export function cleanCard(o) {
  const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  const c = {
    kind: KINDS[o.kind] ? o.kind : 'sto',
    name: str(o.name, 60),
    city: str(o.city, 40),
    services: (Array.isArray(o.services) ? o.services : String(o.services || '').split(/[\n,;]/)).map((x) => str(x, 50)).filter(Boolean).slice(0, 12),
    whatsapp: normPhone(o.whatsapp),
    call: !!o.call,
    area: str(o.area, 100),
    hours: str(o.hours, 60),
    about: str(o.about, 240),
  };
  if (o.phone) c.phone = normPhone(o.phone);
  return c;
}

export const baseUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');

export function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3200);
}

export function initChrome() {
  const b = $('#themeBtn');
  const paint = () => { if (b) b.textContent = document.documentElement.dataset.theme === 'light' ? '🌙' : '☀️'; };
  if (b) b.onclick = () => { const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = t; try { localStorage.setItem('am24s-theme', t); } catch (e) {} paint(); };
  paint();
  document.addEventListener('click', (e) => { if (e.target.closest('[data-example]')) { e.preventDefault(); toast('Это пример карточки: номер ненастоящий. У реальных исполнителей кнопка открывает WhatsApp.'); } });
  $$('[data-admin-wa]').forEach((a) => { a.href = adminWa(a.dataset.adminWa); a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  $$('[data-op]').forEach((el) => { const v = CONFIG.OPERATOR[el.dataset.op]; el.textContent = v || '[заполняется владельцем площадки]'; if (!v) el.classList.add('todo'); });
  $$('[data-cfg]').forEach((el) => { el.textContent = String(CONFIG[el.dataset.cfg]); });
  $$('[data-admin-phone]').forEach((el) => { el.textContent = fmtPhone(CONFIG.ADMIN_WHATSAPP); });
}

export const today = () => new Date().toISOString().slice(0, 10);

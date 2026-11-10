// Визитка исполнителя.
//  card.html?id=<id>  — карточка из каталога (data/listings.json, размещена по согласию исполнителя);
//  card.html#d=<код>  — личная визитка-ссылка: все данные лежат в самой ссылке, сайт их не хранит и не видит
//                       (часть адреса после # браузер не отправляет на сервер).
import { CONFIG, KINDS } from './config.js';
import { $, esc, contactButtons, initChrome, decodeCard, cleanCard, validPhone, adminWa, today } from './common.js';
import { isTop } from './cards.js';
import { qrSvg, qrPng, download, share } from './qr.js';

initChrome();
const view = $('#card');

function noindex() { const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow'; document.head.appendChild(m); }

async function load() {
  const id = new URLSearchParams(location.search).get('id');
  const h = new URLSearchParams(location.hash.slice(1)).get('d');
  if (h) {
    noindex();
    const c = cleanCard(decodeCard(h));
    if (!c.name || !validPhone(c.whatsapp)) throw new Error('bad');
    return { item: { ...c, id: '' }, link: true };
  }
  if (id) {
    const d = await (await fetch('data/listings.json', { cache: 'no-cache' })).json();
    const x = (d.items || []).find((i) => i.id === id && (!i.expires || i.expires >= today()));
    if (x) { if (x.demo) noindex(); return { item: x, link: false }; }
  }
  return null;
}

async function render() {
  let r = null;
  try { r = await load(); } catch (e) { r = null; }
  if (!r) {
    view.innerHTML = `<div class="card center"><h1>Визитка не найдена</h1><p class="muted">Возможно, исполнитель удалил карточку или ссылка повреждена.</p><a class="btn p" href="./">Открыть каталог</a></div>`;
    return;
  }
  const x = r.item, k = KINDS[x.kind] || KINDS.sto;
  const url = location.href.split('#')[0] + (r.link ? location.hash : '');
  document.title = `${x.name} — ${k.one}, ${x.city} | ${CONFIG.SITE_NAME}`;
  const img = x.photo ? `assets/listings/${esc(x.photo)}` : k.img;
  view.innerHTML = `
    ${r.link ? `<p class="notice small">🔗 <b>Личная визитка-ссылка.</b> Все данные лежат в самой ссылке — сайт их не хранит и не проверял. Если здесь указан ваш номер без вашего ведома, <a href="${esc(adminWa('Здравствуйте! В визитке-ссылке на АвтоМастер24 указан мой номер без моего согласия: ' + url))}" target="_blank" rel="noopener noreferrer">сообщите нам</a>.</p>` : ''}
    ${x.demo ? '<p class="notice warn small">Это пример карточки — номер ненастоящий.</p>' : ''}
    <section class="vc-hero" style="background-image:url(${img})"><div class="vc-hero-in">
      <div class="vc-ava" aria-hidden="true">${esc((x.name || '?').replace(/[^0-9A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/g, '').slice(0, 1).toUpperCase() || k.icon)}</div>
      <div><div class="vc-role">${k.icon} ${esc(k.one)} · ${esc(x.city)}</div><h1>${esc(x.name)}</h1>
      <div class="row">${isTop(x) ? '<span class="badge gold">⭐ Топ</span>' : ''}${x.verified ? '<span class="badge green">✔ Проверен площадкой</span>' : ''}</div></div>
    </div></section>
    <div class="vc-main">${contactButtons(x)}</div>
    ${x.about ? `<p class="vc-slogan">${esc(x.about)}</p>` : ''}
    ${x.services?.length ? `<div class="card"><h3>Услуги</h3><ul class="svc-list">${x.services.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    ${x.area || x.hours ? `<div class="card">${x.area ? `<p>📍 ${esc(x.area)}</p>` : ''}${x.hours ? `<p>🕘 ${esc(x.hours)}</p>` : ''}</div>` : ''}
    <div class="card center"><h3>QR-код визитки</h3><div id="qr" class="qrbox"></div>
      <div class="vc-acts"><button id="share" type="button">📤 Поделиться</button><button id="png" type="button">⬇️ QR для печати</button></div></div>
    <p class="small muted center">Сообщение в WhatsApp уходит напрямую исполнителю — ${esc(CONFIG.SITE_NAME)} его не видит и не хранит. Площадка не участвует в сделке: цену и сроки вы согласуете с исполнителем.</p>
    <p class="small center">${r.link ? '' : `<a href="join.html#remove">Это ваша карточка? Изменить или удалить</a> · `}<a href="${esc(adminWa('Здравствуйте! Хочу пожаловаться на карточку: ' + url))}" target="_blank" rel="noopener noreferrer">Пожаловаться</a></p>
    <a class="vc-made" href="join.html">Сделано на ${esc(CONFIG.SITE_NAME)} — разместите свою визитку бесплатно</a>`;
  try { $('#qr').innerHTML = await qrSvg(url, { size: 200 }); } catch (e) { $('#qr').textContent = 'QR-код не загрузился'; }
  $('#share').onclick = async () => { const s = await share(x.name, url); if (s === 'copied') import('./common.js').then((m) => m.toast('Ссылка скопирована')); };
  $('#png').onclick = async () => download(`qr-${(x.id || 'vizitka')}.png`, await qrPng(url, { title: x.name, sub: `${k.one} · ${x.city}` }));
}
render();
window.addEventListener('hashchange', render);

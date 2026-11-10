// Размещение исполнителя. Ничего не отправляется на сервер: форма собирает текст и открывает WhatsApp,
// где исполнитель сам отправляет заявку площадке (это и есть подтверждение согласия, ст. 8 п. 1 Закона РК о ПД).
import { CONFIG, KINDS } from './config.js';
import { $, esc, initChrome, cleanCard, encodeCard, validPhone, fmtPhone, adminWa, baseUrl, toast } from './common.js';
import { cardHtml } from './cards.js';
import { qrSvg, qrPng, download, share } from './qr.js';

initChrome();
const f = $('#f');
$('#kind').innerHTML = Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v.icon} ${v.one}</option>`).join('');
$('#city').innerHTML = CONFIG.CITIES.map((c) => `<option ${c === CONFIG.DEFAULT_CITY ? 'selected' : ''}>${esc(c)}</option>`).join('');

const card = () => { const d = new FormData(f); return cleanCard({ ...Object.fromEntries(d), call: d.get('call') === 'on' }); };
const PLAN = { free: 'Базовый (бесплатно)', top: 'Топ', verified: 'Проверен' };

function preview() { const c = card(); $('#preview').innerHTML = cardHtml({ ...c, name: c.name || 'Ваше название', id: '' }, { link: false }); }
f.addEventListener('input', preview); preview();
$('#preview').addEventListener('click', (e) => { if (e.target.closest('a')) { e.preventDefault(); toast('Это предпросмотр'); } });

function check(full) {
  const c = card(), d = new FormData(f), errs = [];
  if (!c.name) errs.push('Укажите название или имя для карточки.');
  if (!validPhone(c.whatsapp)) errs.push('Укажите номер WhatsApp в формате +7 7XX XXX XX XX.');
  if (full) {
    if (String(d.get('fio') || '').trim().split(/\s+/).length < 2) errs.push('Укажите ФИО для согласия (на сайте не публикуется).');
    if (!d.get('c_consent') || !d.get('c_owner') || !d.get('c_terms')) errs.push('Отметьте три галочки согласия.');
  } else if (!d.get('c_owner')) errs.push('Подтвердите, что номер ваш (вторая галочка).');
  $('#err').hidden = !errs.length; $('#err').innerHTML = errs.map(esc).join('<br>');
  return errs.length ? null : c;
}

$('#send').onclick = () => {
  const c = check(true); if (!c) return;
  const d = new FormData(f), k = KINDS[c.kind];
  const text = [
    `Здравствуйте! Прошу разместить карточку на ${CONFIG.SITE_NAME}.`,
    '',
    `Кто: ${k.one}`, `Название: ${c.name}`, `Город: ${c.city}`,
    c.services.length ? `Услуги: ${c.services.join(', ')}` : '',
    `WhatsApp: ${fmtPhone(c.whatsapp)}${c.call ? ' (кнопка «Позвонить» — да)' : ''}`,
    c.area ? `Адрес/район: ${c.area}` : '', c.hours ? `Часы: ${c.hours}` : '', c.about ? `О себе: ${c.about}` : '',
    `Тариф: ${PLAN[d.get('plan')] || PLAN.free}`,
    '',
    `Я, ${String(d.get('fio')).trim()}, даю согласие на сбор, обработку и публикацию в общедоступном каталоге ${CONFIG.SITE_NAME} данных этой карточки, включая трансграничную передачу (хостинг за пределами РК), на ${CONFIG.LISTING_MONTHS} мес. или до отзыва, на условиях: ${baseUrl()}consent.html (версия ${CONFIG.CONSENT_VERSION}). Номер принадлежит мне/моему бизнесу. С соглашением и политикой ознакомлен(а).`,
    '',
    `Код карточки: AM1:${encodeCard(c)}`,
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  window.open(adminWa(text), '_blank', 'noopener');
};

$('#mk').onclick = async () => {
  const c = check(false); if (!c) return;
  const url = `${baseUrl()}card.html#d=${encodeCard(c)}`;
  $('#out').innerHTML = `<div class="card center"><div id="qr2" class="qrbox"></div>
    <input class="mono" readonly value="${esc(url)}" aria-label="Ссылка на визитку">
    <div class="vc-acts" style="margin-top:8px"><a class="btn p" href="${esc(url)}" target="_blank" rel="noopener">Открыть</a><button type="button" id="cp">📋 Копировать</button><button type="button" id="pn">⬇️ QR для печати</button></div>
    <p class="small muted">Хотите изменить — просто сделайте новую ссылку. Старую удалить нельзя (её нигде нет, кроме мест, куда вы её отправили), поэтому раздавайте её только там, где нужно.</p></div>`;
  $('#qr2').innerHTML = await qrSvg(url, { size: 220 });
  $('#cp').onclick = async () => { if ((await share(c.name, url)) === 'copied') toast('Ссылка скопирована'); };
  $('#pn').onclick = async () => download('qr-vizitka.png', await qrPng(url, { title: c.name, sub: `${KINDS[c.kind].one} · ${c.city}` }));
};

const req = (what) => {
  const id = $('#rid').value.trim();
  if (!id) { toast('Вставьте ссылку на карточку или её название'); $('#rid').focus(); return; }
  const t = what === 'del'
    ? `Здравствуйте! Прошу удалить мою карточку с ${CONFIG.SITE_NAME} и отзываю согласие на публикацию и обработку данных: ${id}`
    : `Здравствуйте! Прошу изменить мою карточку на ${CONFIG.SITE_NAME}: ${id}\nЧто изменить: `;
  window.open(adminWa(t), '_blank', 'noopener');
};
$('#del').onclick = () => req('del');
$('#edit').onclick = () => req('edit');

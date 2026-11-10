// Каталог: читает публичный файл data/listings.json, фильтрует в браузере. Ничего никуда не отправляет.
import { CONFIG, KINDS } from './config.js';
import { $, esc, initChrome, today } from './common.js';
import { cardHtml, isTop } from './cards.js';

initChrome();
const P = new URLSearchParams(location.search);
const st = { city: P.get('city') || CONFIG.DEFAULT_CITY, kind: P.get('kind') || '', q: P.get('q') || '' };
let items = [];

function render() {
  const q = st.q.trim().toLowerCase();
  const inCity = items.filter((x) => x.city === st.city);
  const real = inCity.filter((x) => !x.demo);
  const pool = real.length ? real : inCity; // примеры показываем, только пока в городе нет настоящих карточек
  const list = pool.filter((x) => (!st.kind || x.kind === st.kind) && (!q || [x.name, x.area, x.about, ...(x.services || [])].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => (+isTop(b) - +isTop(a)) || (+!!b.verified - +!!a.verified) || String(b.added).localeCompare(String(a.added)));
  $('#kinds').innerHTML = [['', 'Все'], ...Object.entries(KINDS).map(([k, v]) => [k, `${v.icon} ${v.name}`])]
    .map(([k, n]) => `<a href="?city=${encodeURIComponent(st.city)}${k ? '&kind=' + k : ''}#catalog" class="fchip${st.kind === k ? ' on' : ''}" data-kind="${k}" role="tab" aria-selected="${st.kind === k}">${n}</a>`).join('');
  const note = !real.length && inCity.length ? `<p class="notice warn small">В городе ${esc(st.city)} каталог только запускается — ниже примеры карточек с ненастоящими номерами. <a href="join.html">Разместите свою первой →</a></p>` : '';
  $('#list').innerHTML = note + (list.map((x) => cardHtml(x)).join('') || `<div class="card center"><p><b>Пока никого нет</b></p><p class="muted small">В этом городе и категории ещё нет карточек. Знаете хорошего мастера? Предложите ему разместиться — это бесплатно.</p><a class="btn p" href="join.html">Разместиться</a></div>`);
}

async function main() {
  $('#city').innerHTML = CONFIG.CITIES.map((c) => `<option ${c === st.city ? 'selected' : ''}>${esc(c)}</option>`).join('');
  $('#q').value = st.q;
  try {
    const r = await fetch('data/listings.json', { cache: 'no-cache' });
    const d = await r.json();
    items = (d.items || []).filter((x) => !x.expires || x.expires >= today());
  } catch (e) { $('#list').innerHTML = '<div class="card">Каталог не загрузился. Обновите страницу.</div>'; return; }
  render();
}
$('#city').onchange = (e) => { st.city = e.target.value; history.replaceState(null, '', `?city=${encodeURIComponent(st.city)}#catalog`); render(); };
$('#q').oninput = (e) => { st.q = e.target.value; render(); };
$('#kinds').onclick = (e) => { const a = e.target.closest('[data-kind]'); if (!a) return; e.preventDefault(); st.kind = a.dataset.kind; history.replaceState(null, '', `?city=${encodeURIComponent(st.city)}${st.kind ? '&kind=' + st.kind : ''}#catalog`); render(); };
main();

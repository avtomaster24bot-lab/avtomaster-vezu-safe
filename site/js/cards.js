// Карточка исполнителя в списке.
import { KINDS } from './config.js';
import { esc, contactButtons, today } from './common.js';

export const isTop = (x) => x.plan === 'top' && (!x.top_until || x.top_until >= today());

export function cardHtml(x, { link = true } = {}) {
  const k = KINDS[x.kind] || KINDS.sto;
  const top = isTop(x);
  const img = x.photo ? `assets/listings/${esc(x.photo)}` : k.img;
  return `<article class="card pcard${top ? ' is-top' : ''}">
    <div class="pthumb"><img src="${img}" alt="" loading="lazy"></div>
    <div class="pbody">
      <div class="row">${top ? '<span class="badge gold">⭐ Топ</span>' : ''}${x.verified ? '<span class="badge green" title="Площадка проверила, что бизнес существует">✔ Проверен</span>' : ''}${x.demo ? '<span class="badge grey">Пример</span>' : ''}<span class="small muted">${k.icon} ${esc(k.one)} · ${esc(x.city)}</span></div>
      <h3>${link ? `<a href="card.html?id=${encodeURIComponent(x.id)}">${esc(x.name)}</a>` : esc(x.name)}</h3>
      ${x.services?.length ? `<p class="small svc">${x.services.map(esc).join(' · ')}</p>` : ''}
      ${x.area || x.hours ? `<p class="small muted">${[x.area && '📍 ' + esc(x.area), x.hours && '🕘 ' + esc(x.hours)].filter(Boolean).join(' · ')}</p>` : ''}
      <div class="row acts">${contactButtons(x)}</div>
    </div></article>`;
}


#!/usr/bin/env python3
"""Реестр карточек исполнителей (site/data/listings.json) — только стандартная библиотека Python.

Публичная часть (то, что исполнитель согласился опубликовать) лежит в site/data/listings.json.
Подтверждения согласий (ФИО + полный текст заявки из WhatsApp) сюда НЕ попадают: они пишутся в папку
на компьютере оператора (по умолчанию ~/avtomaster24-soglasiya), которая должна находиться в РК (ст. 12 Закона о ПД).

Команды:
  add  "<весь текст заявки из WhatsApp>" [--photo фото.webp]   добавить карточку
  edit <id> поле=значение ...                                  изменить (name, city, services, whatsapp, area, hours, about, call)
  top  <id> --until 2026-12-31 | --off                         тариф «Топ»
  verify <id> --how "реестр БИН" | --off                       отметка «Проверен» (способ пишется в журнал согласий, не на сайт)
  extend <id> [--months 12]                                    продлить размещение (по сообщению исполнителя)
  remove <id> [--reason "отзыв согласия"]                      удалить карточку и её фото
  purge                                                        удалить карточки с истёкшим сроком
  list                                                         показать карточки
  check                                                        проверить файл (запускается при публикации)
"""
import argparse, base64, datetime as dt, json, os, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'site/data/listings.json'
PHOTOS = ROOT / 'site/assets/listings'
CONSENTS = pathlib.Path(os.environ.get('AM24_CONSENTS', '~/avtomaster24-soglasiya')).expanduser()
KINDS = {'sto', 'tow', 'wash', 'parts', 'help', 'cargo'}
FIELDS = {'id', 'demo', 'kind', 'name', 'city', 'services', 'whatsapp', 'call', 'phone', 'area', 'hours', 'about', 'photo',
          'plan', 'top_until', 'verified', 'added', 'expires', 'consent'}
MONTHS = 12
TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюяәғқңөұүһі', ['a','b','v','g','d','e','e','zh','z','i','i','k','l','m','n','o','p','r','s','t','u','f','h','c','ch','sh','sh','','y','','e','yu','ya','a','g','k','n','o','u','u','h','i']))

today = lambda: dt.date.today().isoformat()
def plus_months(d, m):
    y, mo = divmod(d.month - 1 + m, 12)
    return dt.date(d.year + y, mo + 1, min(d.day, 28)).isoformat()

def load():
    return json.loads(DATA.read_text(encoding='utf-8'))
def save(d):
    d['updated'] = today()
    DATA.write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

def norm_phone(s):
    p = re.sub(r'\D', '', str(s or ''))
    if len(p) == 11 and p[0] == '8': p = '7' + p[1:]
    if len(p) == 10: p = '7' + p
    return p

def clean(o):
    s = lambda v, n: re.sub(r'[\x00-\x1f]', ' ', str(v or '')).strip()[:n]
    svc = o.get('services') or []
    if isinstance(svc, str): svc = re.split(r'[\n,;]', svc)
    c = {'kind': o.get('kind') if o.get('kind') in KINDS else 'sto', 'name': s(o.get('name'), 60), 'city': s(o.get('city'), 40),
         'services': [s(x, 50) for x in svc if s(x, 50)][:12], 'whatsapp': norm_phone(o.get('whatsapp')), 'call': bool(o.get('call')),
         'area': s(o.get('area'), 100), 'hours': s(o.get('hours'), 60), 'about': s(o.get('about'), 240)}
    if o.get('phone'): c['phone'] = norm_phone(o['phone'])
    return c

def slug(c, items):
    base = ''.join(TR.get(ch, ch) for ch in (c['city'] + '-' + c['name']).lower())
    base = re.sub(r'[^a-z0-9]+', '-', base).strip('-')[:48] or 'kartochka'
    ids, i, x = {it['id'] for it in items}, 2, base
    while x in ids: x, i = f'{base}-{i}', i + 1
    return x

def consent_log(rec):
    CONSENTS.mkdir(parents=True, exist_ok=True)
    with open(CONSENTS / 'zhurnal.jsonl', 'a', encoding='utf-8') as f:
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')

def find(d, i):
    for it in d['items']:
        if it['id'] == i: return it
    sys.exit(f'Нет карточки с id «{i}». Посмотреть: python3 tools/listings.py list')

def cmd_add(a):
    text = a.text if a.text != '-' else sys.stdin.read()
    m = re.search(r'AM1:([A-Za-z0-9_-]+)', text)
    if not m: sys.exit('В тексте нет «Код карточки: AM1:…». Вставьте заявку целиком, как она пришла в WhatsApp.')
    code = m.group(1); code += '=' * (-len(code) % 4)
    c = clean(json.loads(base64.urlsafe_b64decode(code).decode('utf-8')))
    if not c['name'] or not re.fullmatch(r'7\d{10}', c['whatsapp']): sys.exit('В коде нет названия или корректного номера WhatsApp.')
    fio = re.search(r'Я,\s*(.+?),\s*даю согласие', text)
    ver = re.search(r'\(версия ([^)]+)\)', text)
    if not fio: sys.exit('В заявке нет фразы согласия «Я, <ФИО>, даю согласие…». Без согласия карточку размещать нельзя.')
    if a.sender and norm_phone(a.sender) != c['whatsapp']:
        sys.exit(f'Заявка пришла с {a.sender}, а в карточке {c["whatsapp"]}. Попросите отправить с номера из карточки.')
    d = load()
    if any(it['whatsapp'] == c['whatsapp'] and it['kind'] == c['kind'] and not it.get('demo') for it in d['items']):
        print('Внимание: карточка с этим номером и категорией уже есть — возможно, нужно edit, а не add.')
    c['id'] = slug(c, d['items'])
    c.update(photo='', plan='free', verified=False, added=today(), expires=plus_months(dt.date.today(), MONTHS), consent=ver.group(1) if ver else '')
    if a.photo:
        p = pathlib.Path(a.photo); ext = p.suffix.lower()
        if ext not in ('.webp', '.jpg', '.jpeg', '.png'): sys.exit('Фото: только .webp, .jpg, .png')
        PHOTOS.mkdir(parents=True, exist_ok=True); name = c['id'] + ext
        (PHOTOS / name).write_bytes(p.read_bytes()); c['photo'] = name
        print('Совет: перед публикацией убедитесь, что на фото нет людей, лиц, госномеров чужих машин.')
    d['items'].append(c); save(d)
    consent_log({'event': 'consent', 'id': c['id'], 'fio': fio.group(1).strip(), 'whatsapp': c['whatsapp'], 'version': c['consent'],
                 'at': dt.datetime.now().isoformat(timespec='seconds'), 'message': text})
    print(f'Добавлено: {c["id"]} до {c["expires"]}. Согласие записано в {CONSENTS / "zhurnal.jsonl"}')
    print('Ссылка после публикации: https://avtomaster24bot-lab.github.io/avtomaster-vezu-safe/card.html?id=' + c['id'])
    print('Опубликовать: git add -A && git commit -m "Карточка ' + c['id'] + '" && git push')

def cmd_edit(a):
    d = load(); it = find(d, a.id)
    for kv in a.pairs:
        k, _, v = kv.partition('=')
        if k not in ('name', 'city', 'services', 'whatsapp', 'area', 'hours', 'about', 'call', 'kind'): sys.exit(f'Поле {k} менять нельзя')
        it[k] = v
    it.update(clean({**it, 'call': str(it.get('call')).lower() in ('1', 'true', 'да', 'yes')}))
    save(d); print('Изменено:', a.id)

def cmd_top(a):
    d = load(); it = find(d, a.id)
    if a.off: it['plan'] = 'free'; it.pop('top_until', None)
    else: it['plan'] = 'top'; it['top_until'] = a.until or plus_months(dt.date.today(), 1)
    save(d); print(a.id, '→', it['plan'], it.get('top_until', ''))

def cmd_verify(a):
    d = load(); it = find(d, a.id); it['verified'] = not a.off; save(d)
    consent_log({'event': 'verify' if not a.off else 'unverify', 'id': a.id, 'how': a.how or '', 'at': dt.datetime.now().isoformat(timespec='seconds')})
    print(a.id, 'проверен' if it['verified'] else 'без отметки')

def cmd_extend(a):
    d = load(); it = find(d, a.id); it['expires'] = plus_months(dt.date.today(), a.months); save(d); print(a.id, 'до', it['expires'])

def remove_item(d, it, reason):
    d['items'].remove(it)
    if it.get('photo'): (PHOTOS / it['photo']).unlink(missing_ok=True)
    consent_log({'event': 'removed', 'id': it['id'], 'reason': reason, 'at': dt.datetime.now().isoformat(timespec='seconds')})

def cmd_remove(a):
    d = load(); it = find(d, a.id); remove_item(d, it, a.reason or 'по просьбе исполнителя'); save(d)
    print('Удалено:', a.id, '— сделайте git commit и git push, затем ответьте исполнителю, что карточка снята.')

def cmd_purge(a):
    d = load(); old = [it for it in d['items'] if not it.get('demo') and it.get('expires', '9999') < today()]
    for it in old: remove_item(d, it, 'истёк срок размещения')
    save(d); print('Удалено просроченных:', len(old))

def cmd_list(a):
    for it in load()['items']:
        print(f"{it['id']:40} {it['kind']:6} {it['city']:16} {it['plan']:5} {'✔' if it.get('verified') else ' '} до {it.get('expires')}{'  (пример)' if it.get('demo') else ''}")

def cmd_check(a):
    d = load(); errs = []; ids = set()
    for it in d['items']:
        i = it.get('id', '?')
        if set(it) - FIELDS: errs.append(f'{i}: лишние поля {set(it) - FIELDS} — публикуем только то, на что дано согласие')
        if i in ids: errs.append(f'{i}: повтор id')
        ids.add(i)
        if not re.fullmatch(r'[a-z0-9-]+', i): errs.append(f'{i}: id только латиница, цифры, дефис')
        if it.get('kind') not in KINDS: errs.append(f'{i}: неизвестная категория')
        if not re.fullmatch(r'7\d{10}', str(it.get('whatsapp', ''))): errs.append(f'{i}: номер WhatsApp')
        if not it.get('demo') and not it.get('consent'): errs.append(f'{i}: нет версии согласия')
        if it.get('photo') and not (PHOTOS / it['photo']).exists(): errs.append(f'{i}: нет файла фото')
        if it.get('photo') and not re.fullmatch(r'[a-z0-9-]+\.(webp|jpg|jpeg|png)', it['photo']): errs.append(f'{i}: имя фото')
    if errs: sys.exit('Ошибки в listings.json:\n' + '\n'.join(errs))
    print(f'OK: {len(d["items"])} карточек')

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
s = p.add_subparsers(dest='cmd', required=True)
x = s.add_parser('add'); x.add_argument('text', help='текст заявки целиком или «-» чтобы вставить из stdin'); x.add_argument('--photo'); x.add_argument('--sender', help='номер, с которого пришла заявка (проверка)'); x.set_defaults(f=cmd_add)
x = s.add_parser('edit'); x.add_argument('id'); x.add_argument('pairs', nargs='+'); x.set_defaults(f=cmd_edit)
x = s.add_parser('top'); x.add_argument('id'); x.add_argument('--until'); x.add_argument('--off', action='store_true'); x.set_defaults(f=cmd_top)
x = s.add_parser('verify'); x.add_argument('id'); x.add_argument('--how'); x.add_argument('--off', action='store_true'); x.set_defaults(f=cmd_verify)
x = s.add_parser('extend'); x.add_argument('id'); x.add_argument('--months', type=int, default=MONTHS); x.set_defaults(f=cmd_extend)
x = s.add_parser('remove'); x.add_argument('id'); x.add_argument('--reason'); x.set_defaults(f=cmd_remove)
for n, fn in (('purge', cmd_purge), ('list', cmd_list), ('check', cmd_check)): s.add_parser(n).set_defaults(f=fn)
a = p.parse_args(); a.f(a)

#!/usr/bin/env python3
"""Собирает site/*.html из pages/*.html: подставляет общие блоки {{HEAD}}, {{HEADER}}, {{FOOTER}} из tools/partials/.
Запуск: python3 tools/build_pages.py  (после правки страниц в pages/ или блоков в tools/partials/)."""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
parts = {k: (root / 'tools/partials' / f'{k.lower()}.html').read_text(encoding='utf-8') for k in ('HEAD', 'HEADER', 'FOOTER')}
for src in sorted((root / 'pages').glob('*.html')):
    html = src.read_text(encoding='utf-8')
    for k, v in parts.items():
        html = html.replace('{{' + k + '}}', v)
    if src.name == '404.html':  # 404 отдаётся на любом пути — фиксируем базовый адрес
        html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="/avtomaster-vezu-safe/">', 1)
    (root / 'site' / src.name).write_text(html, encoding='utf-8')
    print('site/' + src.name)

// Тема (светлая/тёмная). Хранится только в этом браузере (localStorage), на сервер не уходит.
try { var t = localStorage.getItem('am24s-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); document.documentElement.dataset.theme = t; } catch (e) {}

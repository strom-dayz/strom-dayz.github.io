// Переезд со старого адреса: принимает сохранённое (закладки, галочки, маршрут) из ссылки #import=…
// Берём только известные ключи с проверкой вида и никогда не затираем то, что уже есть.
(() => {
  'use strict';
  if (!location.hash.startsWith('#import=')) return;
  const p = new URLSearchParams(location.hash.slice(1));
  const num = (x) => typeof x === 'number' && isFinite(x);
  const str = (x, n) => typeof x === 'string' && x.length <= n;
  const pt = (x) => x && typeof x === 'object' && num(x.x) && num(x.z);
  const list = (v, n, f) => Array.isArray(v) && v.length <= n && v.every(f);
  const safePt = (x) => { const o = { x: x.x, z: x.z }; if (str(x.name, 80)) o.name = x.name.replace(/[<>"&]/g, ''); return o; };
  const RULES = [
    [/^dz_favs$/, (v) => (list(v, 500, (x) => str(x, 80) && /^[\w-]+[/:|][\w-]+$/.test(x)) ? v : null)],
    [/^dz_check_[\w-]{1,60}$/, (v) => (list(v, 100, num) ? v : null)],
    [/^dz_quiz_best$/, (v) => (num(v) && v >= 0 && v <= 100 ? v : null)],
    [/^dz_my_route$/, (v) => (list(v, 300, pt) ? v.map(safePt) : null)],
    [/^dz_me$/, (v) => (pt(v) ? safePt(v) : null)]
  ];
  try {
    const raw = p.get('import') || '';
    if (raw.length < 60000) {
      const b = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))));
      Object.keys(data).slice(0, 200).forEach((k) => {
        const rule = RULES.find((r) => r[0].test(k));
        const v = rule ? rule[1](data[k]) : null;
        if (v !== null && localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v));
      });
    }
  } catch (e) { /* битая ссылка: просто открываем сайт */ }
  const to = p.get('to') || '#';
  history.replaceState(null, '', location.pathname + location.search + (to[0] === '#' ? to : '#'));
})();

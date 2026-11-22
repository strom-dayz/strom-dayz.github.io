// Cloudflare Worker: обратная связь из DayZ Guide → Telegram.
//
// Переменные в Cloudflare (Worker → Settings → Variables and Secrets):
//   BOT_TOKEN — токен бота от @BotFather (тип Secret!)
//   CHAT_ID   — куда присылать (ID лички или группы), тоже тип Secret:
//               обычные переменные стираются, когда сохраняешь код в редакторе Cloudflare
// Токен не хранится ни на сайте, ни в репозитории.

const ALLOWED = ['https://strom-dayz.github.io', 'https://bosscc12361-collab.github.io', 'http://localhost:8765'];
const SITE = 'https://strom-dayz.github.io/';
const LIMIT = 6;            // сообщений с одного IP
const WINDOW = 60 * 60e3;   // за час
const hits = new Map();     // простой лимит в памяти воркера

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => String(s || '').trim().slice(0, n);

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405, origin);
    if (!ALLOWED.includes(origin)) return json({ ok: false, error: 'origin' }, 403, origin);

    let b;
    try { b = await req.json(); } catch { return json({ ok: false, error: 'json' }, 400, origin); }
    if (b.website) return json({ ok: true }, 200, origin); // ловушка для ботов

    const text = clip(b.text, 1000), fix = clip(b.fix, 1000);
    if (text.length < 3) return json({ ok: false, error: 'short' }, 400, origin);

    const ip = req.headers.get('CF-Connecting-IP') || 'x';
    const now = Date.now();
    const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
    if (list.length >= LIMIT) return json({ ok: false, error: 'limit' }, 429, origin);
    list.push(now); hits.set(ip, list);

    const idea = b.type === 'idea';
    const hash = /^#[^\s<>"]{1,120}$/.test(b.hash || '') ? b.hash : '';
    let msg = (idea ? '💡 <b>Идея / сообщение</b>' : '⚠️ <b>Ошибка в карточке</b>') + '\n';
    if (b.where) msg += esc(clip(b.where, 200)) + '\n';
    msg += '\n«' + esc(text) + '»\n';
    if (fix) msg += '\n✅ Как правильно: ' + esc(fix) + '\n';
    if (hash) msg += '\n🔗 <a href="' + SITE + hash + '">открыть карточку</a>';
    if (b.v) msg += '\n<i>версия ' + esc(clip(b.v, 20)) + '</i>';

    const r = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text: msg, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!r.ok) return json({ ok: false, error: 'telegram', detail: (await r.text()).slice(0, 200) }, 502, origin);
    return json({ ok: true }, 200, origin);
  },
};

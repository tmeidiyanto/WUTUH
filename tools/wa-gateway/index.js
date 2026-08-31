/**
 * Gateway WhatsApp ASLI untuk WUTUH — self-hosted, berbasis Baileys
 * (protokol WhatsApp Web multi-device; teknologi yang sama dengan gateway
 * komersial gaya Fonnte/Wablas).
 *
 * Antarmuka kompatibel dengan yang sudah dipakai WUTUH (platform/notify/wa.ts):
 *   POST /send   { target, message }   header Authorization: <token>
 *   GET  /status → { connected, me, hasQr }
 *   GET  /       → halaman status + QR untuk dipindai (auto-refresh)
 *
 * Login: buka http://localhost:5299 lalu pindai QR dari HP
 * (WhatsApp > titik tiga / Pengaturan > Perangkat Tertaut > Tautkan perangkat).
 * Sesi tersimpan di folder auth/ — sekali pindai, selanjutnya otomatis.
 * Logout dari HP → hapus folder auth/ → jalankan ulang untuk pindai lagi.
 *
 * Token dibaca dari token.txt (atau env GW_TOKEN). Port dari env PORT (default 5299).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse: parseQuery } = require('querystring');
const QR = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  jidNormalizedUser,
} = require('baileys');

const PORT = Number(process.env.PORT || 5299);
const TOKEN = (process.env.GW_TOKEN || readFile('token.txt')).trim();
if (!TOKEN) {
  console.error('Token kosong — isi tools/wa-gateway/token.txt atau env GW_TOKEN.');
  process.exit(1);
}

function readFile(name) {
  try {
    return fs.readFileSync(path.join(__dirname, name), 'utf8');
  } catch {
    return '';
  }
}

let sock = null;
let connected = false;
let meJid = null;
let lastQrPng = null; // data URL untuk halaman status
let starting = false;

async function start() {
  if (starting) return;
  starting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'));
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
    sock = makeWASocket({
      auth: state,
      version,
      logger: pino({ level: 'warn' }),
      markOnlineOnConnect: false,
      browser: ['WUTUH Gateway', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;
      if (qr) {
        lastQrPng = await QR.toDataURL(qr, { margin: 1, width: 320 }).catch(() => null);
        await QR.toFile(path.join(__dirname, 'qr.png'), qr, { margin: 1, width: 480 }).catch(() => {});
        console.log('QR siap — pindai dari WhatsApp > Perangkat Tertaut (buka http://localhost:' + PORT + ' atau file qr.png).');
      }
      if (connection === 'open') {
        connected = true;
        lastQrPng = null;
        meJid = jidNormalizedUser(sock.user?.id ?? '');
        fs.rmSync(path.join(__dirname, 'qr.png'), { force: true });
        console.log('TERHUBUNG sebagai ' + meJid);
      }
      if (connection === 'close') {
        connected = false;
        starting = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log('LOGGED OUT dari HP — hapus folder auth/ lalu jalankan ulang untuk pindai QR baru.');
        } else {
          console.log('Koneksi tertutup (kode ' + code + ') — menyambung ulang…');
          setTimeout(() => void start(), 3000);
        }
      }
    });
  } catch (e) {
    console.error('Gagal memulai socket:', e.message);
    starting = false;
    setTimeout(() => void start(), 5000);
  }
}

/** 08xx / +62 / 62xx → jid WhatsApp. */
function toJid(target) {
  const digits = String(target ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  const num = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  return num + '@s.whatsapp.net';
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => {
      b += c;
      if (b.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(b));
      } catch {
        resolve(parseQuery(b));
      }
    });
    req.on('error', () => resolve({}));
  });
}

function statusPage() {
  const body = connected
    ? '<div class="ok">✅ Terhubung sebagai <b>+' + String(meJid).replace('@s.whatsapp.net', '') + '</b></div>' +
      '<p>Gateway siap. Notifikasi WUTUH kini terkirim sebagai pesan WhatsApp sungguhan.</p>'
    : lastQrPng
      ? '<p>Pindai QR ini dari HP: <b>WhatsApp &gt; Perangkat Tertaut &gt; Tautkan perangkat</b></p>' +
        '<img src="' + lastQrPng + '" alt="QR" width="320" height="320" />'
      : '<p>⏳ Menyiapkan QR / menyambung ulang… halaman ini memuat ulang sendiri.</p>';
  return (
    '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="3">' +
    '<title>WUTUH WA Gateway</title>' +
    '<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:8vh auto;text-align:center;color:#17261c}' +
    '.ok{background:#e7f6ec;border:1px solid #15803d;border-radius:10px;padding:1rem;font-size:1.05rem}' +
    'img{border:1px solid #ddd;border-radius:10px}</style>' +
    '<h2>🌾 WUTUH — Gateway WhatsApp</h2>' + body
  );
}

const server = http.createServer(async (req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (req.method === 'GET' && req.url === '/status') {
    return json(200, { connected, me: meJid, hasQr: !!lastQrPng });
  }
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(statusPage());
  }
  if (req.method === 'POST' && req.url === '/send') {
    const auth = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
    if (auth !== TOKEN) return json(401, { status: false, reason: 'unauthorized' });
    const body = await readBody(req);
    const jid = toJid(body.target);
    const message = String(body.message ?? '').slice(0, 4096);
    if (!jid || !message) return json(400, { status: false, reason: 'target/message wajib diisi' });
    if (!connected || !sock) return json(503, { status: false, reason: 'not_connected — pindai QR dulu di http://localhost:' + PORT });
    try {
      const sent = await sock.sendMessage(jid, { text: message });
      console.log('Terkirim ke ' + jid);
      return json(200, { status: true, id: sent?.key?.id ?? null, target: jid });
    } catch (e) {
      console.error('Gagal kirim:', e.message);
      return json(502, { status: false, reason: e.message });
    }
  }
  return json(404, { status: false, reason: 'not_found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('WUTUH WA Gateway di http://localhost:' + PORT + ' (send: POST /send)');
  void start();
});

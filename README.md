# WUTUH 🌾

**The Complete Agribusiness Platform** — menghubungkan seluruh rantai agribisnis Indonesia tanpa terputus.

> Filosofi korporat: **Gemah Ripah Loh Jinawi** · Brand/platform: **WUTUH**

```
LAND → PLANNING → PLANTING/BREEDING → CULTIVATION → MONITORING → HARVEST
     → PROCESSING → QUALITY → WAREHOUSE → MARKET → LOGISTICS → EXPORT → CUSTOMER
```

Platform ini diperuntukkan bagi **produsen Indonesia** — petani, pekebun, peternak — sehingga
dibuat sederhana tapi aplikatif: bahasa Indonesia sebagai default, login cukup email + kata
sandi, registrasi mandiri langsung siap pakai, dan responsive untuk HP, tablet, maupun desktop.

## Modul

| Modul | Fungsi |
| --- | --- |
| **WUTUH Farm** | Production Management — lahan, komoditas, siklus produksi, kegiatan, panen |
| **WUTUH Ranch** | Livestock Management — ternak, produksi harian (telur/susu), kesehatan/vaksin |
| **WUTUH Garden** | Horticulture & Plantation — blok kebun & siklus tanaman keras |
| **WUTUH Market** | Marketplace — harga pasar (tren), lapak, pesanan, **Pasar WUTUH** (etalase publik `/pasar`) |
| **WUTUH Trade** | B2B Trading — mitra bisnis, kontrak dagang |
| **WUTUH Export** | International Commerce — pengiriman ekspor + ceklis dokumen |
| **WUTUH Supply** | Supply Chain — gudang, saldo & kartu stok (dengan **siklus asal** per stok masuk), logistik |
| **WUTUH Finance** | Agricultural Finance — kas masuk/keluar, arus kas bulanan, untung/rugi per siklus |
| **WUTUH AI** | Agribusiness Intelligence — wawasan lintas modul dihitung dari data nyata |
| **WUTUH IoT** | Smart Farming — sensor lahan/kandang, ambang peringatan, ingest API |

**Semuanya tersambung:** panen/produksi otomatis menambah stok gudang; pesanan yang dikirim
mengurangi stok; pesanan selesai / kontrak selesai / ongkos kirim otomatis tercatat di Finance;
sensor di luar ambang, vaksin jatuh tempo, harga bergerak ±5%, dan stok menganggur otomatis
muncul sebagai wawasan WUTUH AI. Tahap setiap **Siklus Produksi** bergerak di sepanjang 13 tahap
rantai nilai dan tampil di beranda.

## Arsitektur

Monorepo pnpm (mengikuti pola myFlexERP):

```
apps/
  api/   NestJS + Drizzle + PostgreSQL (Row-Level Security)  → backend  (port 3001)
  web/   Vue 3 + Vite + PrimeVue + vue-i18n (ID/EN)          → frontend (port 5174)
```

- **Multi-tenant**: satu `company` = satu usaha tani; isolasi data dijamin RLS
  (`app.company_id` di-set per transaksi lewat Unit-of-Work).
- **Auth**: JWT; login email+password (email unik global); registrasi mandiri dengan
  provisioning otomatis (role Admin/Anggota, komoditas awal, gudang utama, penomoran dokumen).
- **RBAC**: permission granular per modul (`farm.write`, `market.read`, `*`, `modul.*`).
- **Penomoran dokumen**: SKL- (siklus), PSN- (pesanan), KTR- (kontrak), EKS- (ekspor),
  KRM- (kirim), LPK- (lapak).
- **IoT ingest**: `POST /api/iot/ingest { apiKey, value }` — endpoint publik ber-API-key per perangkat.
- **Laporan Ketertelusuran per siklus** (tombol "Laporan Traceability" di detail siklus →
  `/farm/cycles/:id/trace`, API `GET /cycles/:id/trace`): dokumen "kertas" siap cetak
  (Cetak/Simpan PDF) berisi produsen, identitas lahan, perjalanan 13 tahap, linimasa,
  kegiatan+biaya, panen (vs prediksi, hasil/ha), mutasi gudang asal siklus, penjualan &
  pelanggan (kanal Langsung/Pasar WUTUH), ringkasan keuangan (untung/rugi, biaya per kg),
  ternak & sensor, kolom tanda tangan. Lapak bisa ditautkan ke siklus ("Dari siklus") sehingga
  pesanan Pasar WUTUH otomatis mewarisi `cycle_id`-nya — rantai tertutup sampai pelanggan.
- **Ketertelusuran stok**: setiap baris kartu stok (`stock_movements`) menyimpan `cycle_id`
  siklus produksi ASAL — penyesuaian **masuk wajib** memilih siklus (400 bila kosong),
  Catat Panen mengisinya otomatis dari siklusnya, produksi ternak menurunkannya dari
  `livestock.cycle_id` bila dicatat per ternak; stok keluar tidak diwajibkan. Tab Kartu Stok
  menampilkan kolom "Siklus asal".
- **Pasar WUTUH** (`/pasar`, tombol di topbar): etalase jual-beli publik lintas usaha — pembeli
  tanpa login bisa mencari/memfilter lapak aktif, membuka detail, dan checkout (nama + HP).
  Pesanan masuk ke menu Pesanan penjual (status Baru, catatan berawalan `[Pasar WUTUH]`),
  stok lapak otomatis tereservasi saat dipesan dan kembali bila dibatalkan; setelah checkout
  pembeli mendapat tombol WhatsApp ke penjual (nomor dari profil usaha). Endpoint:
  `GET/POST /api/bazaar/*` (publik); tabel `listings` & `commodities` ber-policy RLS longgar
  saat tanpa konteks agar bisa dibaca lintas usaha.
- **Notifikasi WhatsApp ke pembeli & penjual**: setiap aksi penjual di Pesanan
  (Konfirmasi/Kirim/Selesai/Tolak) memunculkan dialog *"Kabari pembeli via WhatsApp"* berisi
  pesan status yang sudah terkomposisi (bisa diedit) + tombol **Buka WhatsApp** (wa.me ke nomor
  pembeli); tiap baris pesanan juga punya tombol WA permanen. Untuk **otomatis penuh tanpa
  klik**, atur di **Pengaturan › Saluran Komunikasi** (per usaha, oleh admin): aktif/nonaktif,
  URL gateway + token (gaya Fonnte/Wablas — `POST` JSON `target` & `message`, header
  `Authorization`), sakelar per event (kabari pembeli saat status berubah; kabari penjual saat
  pesanan baru dari Pasar WUTUH), dan tombol **Kirim Pesan Uji**. Token tidak pernah dikirim
  balik ke UI. Env `WA_GATEWAY_URL/TOKEN` menjadi *fallback* global bila usaha belum menyetel
  sendiri. Data: tabel `comm_channels` per usaha (extensible untuk email/telegram); resolver
  `apps/api/src/platform/notify/channel.ts`; pengiriman fire-and-forget (`notify/wa.ts`)
  tidak pernah menggagalkan transaksi.
- **Gateway WhatsApp asli self-hosted** (`tools/wa-gateway/`, berbasis Baileys — protokol
  WhatsApp Web yang juga dipakai gateway komersial): `npm install` lalu `node index.js`
  (port **5299**, token di `token.txt`), buka `http://localhost:5299` dan pindai QR dari
  **WhatsApp › Perangkat Tertaut**; sesi tersimpan di `auth/` (sekali pindai). Antarmukanya
  identik dengan Fonnte (`POST /send {target, message}`, header `Authorization`) sehingga
  tinggal diisikan di Saluran Komunikasi — atau ganti kapan pun dengan gateway komersial
  (Fonnte/Wablas) cukup dengan menukar URL + token di halaman yang sama. Catatan: ini memakai
  API tidak resmi (seperti semua gateway sejenis) — pakai untuk notifikasi wajar, bukan spam,
  karena nomor bisa kena pembatasan WhatsApp.
- **Galeri foto produk (maks. 5/lapak)**: dikelola dari dialog Lapak — tambah beberapa foto
  sekaligus (dikompres di browser ke maks. 1200px JPEG sebelum diunggah), hapus, dan
  **"Jadikan sampul"**; foto pertama = sampul (`listings.photo_url`, dipakai kartu/thumbnail),
  daftar lengkap di tabel `listing_photos`. Halaman detail Pasar WUTUH menampilkan foto utama
  + strip thumbnail. File di `apps/api/uploads/listings/`, disajikan statis `/uploads/...`
  (proxy dev vite ikut meneruskan). Endpoint: `GET/POST /api/market/listings/:id/photos`,
  `DELETE .../photos/:photoId`, `PATCH .../photos/:photoId/cover` (permission `market.write`,
  validasi JPG/PNG/WebP ≤ 5 MB). Lapak tanpa foto memakai emoji komoditas.
- **QR verifikasi publik per siklus**: laporan traceability memuat **QR code** + tautan
  `/lacak/:kode` (kode acak 14 karakter di `cycles.trace_code`, dibuat idempoten lewat
  `POST /cycles/:id/share`). Halaman lacak publik (`GET /api/public/trace/:code`, tanpa login)
  menampilkan lencana "Ketertelusuran Terverifikasi", produk+produsen, 13 tahap, linimasa,
  kegiatan & panen **tanpa data uang/pembeli** (tersanitasi), dan tombol beli ke Pasar WUTUH
  bila ada lapak aktif tertaut. Konsumen tinggal memindai QR di kemasan/laporan.
- **QRIS di Pasar WUTUH**: admin mengunggah gambar QRIS usaha di **Pengaturan › Pembayaran
  (QRIS)** (`companies.qris_url`, file di `uploads/qris/`). Pembeli memilih cara bayar
  (QRIS/Tunai) saat checkout — layar sukses menampilkan gambar QRIS + nominal + kode pesanan.
  Pesanan menyimpan `payment_method` & `paid_at`; penjual menandai **"Dibayar"** di menu
  Pesanan (`POST /market/orders/:id/paid`, idempoten; status `selesai` otomatis dianggap
  dibayar) dan pembeli dikabari via WA. Memilih QRIS saat penjual belum menyetelnya ditolak 400.
- **Skor "Penjual Terverifikasi"** (`modules/trust`): dihitung MURNI dari data nyata —
  Ketertelusuran 30 (lapak aktif tertaut siklus) + Respons 25 (pesanan ditindaklanjuti;
  menggantung >48 jam = lalai) + Transaksi 25 (pesanan selesai 12 bulan, 10+ penuh) +
  Profil 20 (HP, wilayah, QRIS, saluran WA). Tier: ≥80 **Terverifikasi**, ≥55 **Tepercaya**,
  sisanya Penjual Baru. Lencana tampil di kartu & detail Pasar WUTUH dan halaman lacak publik;
  rincian + tips perbaikan di Beranda (`GET /trust/me`). Cache 5 menit per usaha.
- **Foto bukti kegiatan & panen**: dialog Catat Kegiatan / Catat Panen punya tombol
  **Ambil/Pilih Foto** (kompresi browser, kolom `photo_url`, file di `uploads/kegiatan|panen/`);
  thumbnail tampil di detail siklus, laporan traceability, dan halaman lacak publik — bukti
  visual asli untuk pembeli.
- **Kalender Musim + pengingat WA** (menu Farm › Kalender Musim, tabel `agenda_tasks`):
  agenda sekali atau **berulang tiap N hari**; grid kalender bulanan + daftar
  Terlambat/Mendatang. Menandai **selesai** pada agenda tertaut siklus otomatis mencatat
  kegiatan siklus; agenda berulang bergeser N hari dari hari ini. Scheduler in-process
  (tiap jam, jam 05.00–20.00) mengirim **maks. 1 pesan WA/hari per usaha** berisi daftar agenda
  jatuh tempo/terlambat — event `agenda_reminder` di Saluran Komunikasi. Agenda jatuh tempo juga
  muncul sebagai wawasan WUTUH AI.
- **Cuaca BMKG + saran tanam**: setel kode wilayah adm4 (kelurahan/desa) dari kartu cuaca di
  Beranda — divalidasi langsung ke BMKG (`PUT /weather/location`). `GET /weather` mengambil
  prakiraan `api.bmkg.go.id` (cache 30 menit, `companies.weather_code`) → ringkasan 3 hari +
  8 slot terdekat + **saran WUTUH AI** (hujan → tunda semprot/pupuk & kurangi siram; panas
  kering → siram pagi-sore + mulsa; angin kencang → tunda semprot). Kartu tampil di Beranda &
  Kalender Musim; saran cuaca (bila perlu tindakan) ikut masuk daftar wawasan WUTUH AI.
  BMKG mati/kode salah → melapuk anggun, aplikasi tetap jalan.

## Prasyarat

- Node ≥ 20, pnpm ≥ 10
- PostgreSQL 13+ (default: `localhost:5434`, superuser `postgres`/`postgres` — sama dengan myFlexERP)

## Setup

```bash
cp .env.example .env      # sesuaikan kredensial bila perlu
pnpm install
pnpm db:setup             # create DB → push skema → role app + RLS → seed demo
```

Atau bertahap: `pnpm db:create` · `pnpm db:push` · `pnpm db:rls` · `pnpm db:seed`.

> **Penting:** setiap kali menjalankan `pnpm db:push` (perubahan skema), **selalu lanjutkan dengan
> `pnpm db:rls`**. drizzle-kit tidak mengenal policy RLS dan akan menghapusnya sebagai "drift" —
> tanpa policy, role app tidak melihat baris apa pun (semua daftar kosong, simpan gagal).

## Menjalankan

```bash
pnpm dev:api   # http://localhost:3001/api
pnpm dev:web   # http://localhost:5174
```

## Login demo

Setelah seed (usaha **Kelompok Tani Maju Sejahtera**):

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Admin | `petani@demo.com` | `petani123` |
| Anggota | `anggota@demo.com` | `anggota123` |

Atau daftar usaha baru lewat tombol **"Daftar usaha baru"** di halaman login.

## Tampilan

- Tema **hijau** (utama) berpadu **biru** (aksen/gradien) + 5 pilihan aksen, mode terang/gelap,
  kepadatan nyaman/rapat — semua tersimpan di perangkat.
- **Dua bahasa penuh (ID default / EN)**: seluruh halaman, label tahap & status, toast, format
  angka/tanggal (`id-ID` / `en-US`), dan teks wawasan WUTUH AI yang dibuat backend (mengikuti header
  `Accept-Language` yang dikirim otomatis oleh web). Kamus: `apps/web/src/i18n/{id,en}.ts`.
- **Pesan error API dwibahasa**: service melempar exception ber-kunci (`msg('stock.insufficient', {...})`,
  katalog di `apps/api/src/shared/errors.ts`), lalu `I18nExceptionFilter` menerjemahkannya sesuai
  `Accept-Language` — termasuk pesan validasi class-validator (ID diterjemahkan per jenis constraint,
  EN memakai pesan aslinya). Format balasan seragam: `{ statusCode, message, key, error }`.
- Responsive: sidebar collapsible di desktop, drawer + hamburger di HP; tabel bisa scroll
  horizontal; form & dialog menyesuaikan lebar layar.

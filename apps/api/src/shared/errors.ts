import type { Lang } from './lang';

/**
 * Katalog pesan error dwibahasa. Service melempar exception berisi { key, params }
 * (lihat `msg()`), lalu I18nExceptionFilter menerjemahkannya sesuai Accept-Language.
 * Placeholder ditulis {nama} dan diisi dari params.
 */
export const MESSAGES = {
  'auth.badCredentials': { id: 'Email atau kata sandi salah', en: 'Invalid email or password' },
  'auth.businessInactive': { id: 'Usaha tidak aktif', en: 'This business account is inactive' },
  'auth.emailTaken': { id: 'Email sudah terdaftar', en: 'Email is already registered' },
  'auth.noToken': { id: 'Token tidak ada', en: 'Missing token' },
  'auth.invalidToken': { id: 'Token tidak valid', en: 'Invalid token' },
  'auth.needPermission': { id: 'Butuh permission: {perms}', en: 'Requires permission: {perms}' },

  'stock.cycleRequired': {
    id: 'Pilih siklus produksi asal untuk stok masuk',
    en: 'Choose the source production cycle for incoming stock',
  },
  'stock.insufficient': {
    id: 'Stok tidak cukup (tersedia {available}, diminta {requested})',
    en: 'Insufficient stock (available {available}, requested {requested})',
  },

  'land.codeTaken': { id: 'Kode lahan {code} sudah dipakai', en: 'Land code {code} is already in use' },
  'land.notFound': { id: 'Lahan tidak ditemukan', en: 'Land not found' },
  'commodity.codeTaken': { id: 'Kode komoditas {code} sudah dipakai', en: 'Commodity code {code} is already in use' },
  'commodity.notFound': { id: 'Komoditas tidak ditemukan', en: 'Commodity not found' },

  'cycle.notFound': { id: 'Siklus tidak ditemukan', en: 'Cycle not found' },
  'cycle.lastStage': { id: 'Siklus sudah di tahap terakhir (Pelanggan)', en: 'The cycle is already at the final stage (Customer)' },
  'cycle.unknownStage': { id: 'Tahap tidak dikenal: {stage}', en: 'Unknown stage: {stage}' },
  'cycle.stageMustAdvance': {
    id: 'Tahap tujuan harus lebih maju dari tahap sekarang',
    en: 'The target stage must be later than the current stage',
  },

  'warehouse.codeTaken': { id: 'Kode gudang {code} sudah dipakai', en: 'Warehouse code {code} is already in use' },
  'warehouse.notFound': { id: 'Gudang tidak ditemukan', en: 'Warehouse not found' },
  'delivery.notFound': { id: 'Pengiriman tidak ditemukan', en: 'Delivery not found' },

  'livestock.tagTaken': { id: 'Tag {tag} sudah dipakai', en: 'Tag {tag} is already in use' },
  'livestock.notFound': { id: 'Ternak tidak ditemukan', en: 'Animal not found' },

  'listing.notFound': { id: 'Lapak tidak ditemukan', en: 'Listing not found' },
  'listing.inactive': { id: 'Lapak sudah tidak aktif', en: 'This listing is no longer active' },
  'bazaar.minOrder': { id: 'Minimal pembelian {min} {unit}', en: 'Minimum order is {min} {unit}' },
  'bazaar.notEnough': { id: 'Stok lapak tinggal {available} {unit}', en: 'Only {available} {unit} left in this listing' },
  'payment.qrisNotSet': {
    id: 'Penjual belum menyetel QRIS — pilih metode pembayaran lain',
    en: 'Seller has not set up QRIS — choose another payment method',
  },
  'agenda.notFound': { id: 'Agenda tidak ditemukan', en: 'Agenda task not found' },
  'weather.badCode': {
    id: 'Kode wilayah tidak dikenal BMKG — periksa lagi (format 34.04.07.2003)',
    en: 'BMKG does not recognize this area code — check again (format 34.04.07.2003)',
  },
  'photo.invalid': { id: 'Format foto tidak dikenali (pakai JPG/PNG/WebP)', en: 'Unsupported photo format (use JPG/PNG/WebP)' },
  'photo.tooLarge': { id: 'Ukuran foto maksimal 5 MB', en: 'Photo must be 5 MB or smaller' },
  'photo.maxCount': { id: 'Maksimal {n} foto per lapak', en: 'Maximum {n} photos per listing' },
  'photo.notFound': { id: 'Foto tidak ditemukan', en: 'Photo not found' },
  'trace.notFound': { id: 'Tautan lacak tidak ditemukan', en: 'Trace link not found' },
  'channel.unsupported': { id: 'Saluran ini belum didukung', en: 'This channel is not supported yet' },
  'channel.notConfigured': { id: 'Saluran belum dikonfigurasi/diaktifkan', en: 'Channel is not configured/enabled yet' },
  'channel.noTarget': { id: 'Isi nomor tujuan uji (atau lengkapi No. HP profil usaha)', en: 'Provide a test number (or set your business phone)' },
  'order.notFound': { id: 'Pesanan tidak ditemukan', en: 'Order not found' },
  'order.alreadyDone': { id: 'Pesanan sudah selesai', en: 'Order is already completed' },
  'order.alreadyCancelled': { id: 'Pesanan sudah dibatalkan', en: 'Order is already cancelled' },
  'order.shippedNoCancel': { id: 'Pesanan yang sudah dikirim tidak bisa dibatalkan', en: 'A shipped order cannot be cancelled' },
  'status.forwardOnly': { id: 'Status hanya boleh maju', en: 'Status can only move forward' },

  'partner.codeTaken': { id: 'Kode mitra {code} sudah dipakai', en: 'Partner code {code} is already in use' },
  'partner.notFound': { id: 'Mitra tidak ditemukan', en: 'Partner not found' },
  'deal.notFound': { id: 'Kontrak tidak ditemukan', en: 'Contract not found' },

  'export.notFound': { id: 'Pengiriman ekspor tidak ditemukan', en: 'Export shipment not found' },
  'export.forwardOnly': { id: 'Status ekspor hanya boleh maju', en: 'Export status can only move forward' },

  'finance.notFound': { id: 'Transaksi tidak ditemukan', en: 'Transaction not found' },
  'finance.autoLocked': {
    id: 'Transaksi otomatis dari modul lain tidak bisa dihapus manual',
    en: 'Automatic transactions from other modules cannot be deleted manually',
  },

  'device.codeTaken': { id: 'Kode perangkat {code} sudah dipakai', en: 'Device code {code} is already in use' },
  'device.notFound': { id: 'Perangkat tidak ditemukan', en: 'Device not found' },
  'device.badApiKey': { id: 'API key perangkat tidak valid', en: 'Invalid device API key' },

  'user.notFound': { id: 'Pengguna tidak ditemukan', en: 'User not found' },

  validation: { id: 'Data tidak valid', en: 'Invalid data' },
  internal: { id: 'Terjadi kesalahan pada server', en: 'Internal server error' },
} as const satisfies Record<string, { id: string; en: string }>;

export type MsgKey = keyof typeof MESSAGES;

export interface MsgBody {
  key: MsgKey;
  params?: Record<string, string | number>;
}

/** Body exception ber-kunci: `throw new NotFoundException(msg('cycle.notFound'))`. */
export const msg = (key: MsgKey, params?: Record<string, string | number>): MsgBody => ({ key, params });

export function translate(key: string, params: Record<string, unknown> | undefined, lang: Lang): string {
  const entry = (MESSAGES as Record<string, { id: string; en: string }>)[key];
  const tpl = entry?.[lang] ?? entry?.id ?? key;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? `{${k}}`));
}

/**
 * Pesan validasi (class-validator) dalam bahasa Indonesia per jenis constraint.
 * Untuk EN dipakai pesan asli class-validator (sudah berbahasa Inggris & menyebut angkanya).
 */
export const VALIDATION_ID: Record<string, string> = {
  isEmail: '{property} harus berupa alamat email yang valid',
  isNotEmpty: '{property} wajib diisi',
  isString: '{property} harus berupa teks',
  isNumberString: '{property} harus berupa angka',
  isNumber: '{property} harus berupa angka',
  isUuid: '{property} harus berupa ID yang valid',
  isIn: '{property} berisi nilai yang tidak dikenal',
  maxLength: '{property} terlalu panjang',
  minLength: '{property} terlalu pendek',
  isDateString: '{property} harus berupa tanggal (YYYY-MM-DD)',
  isBoolean: '{property} harus berupa ya/tidak',
  isObject: '{property} harus berupa objek',
  whitelistValidation: 'properti {property} tidak dikenal',
};

export interface ValidationItem {
  property: string;
  constraints: Array<{ key: string; message: string }>;
}

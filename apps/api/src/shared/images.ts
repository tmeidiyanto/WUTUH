import { BadRequestException } from '@nestjs/common';
import { promises as fsp } from 'node:fs';
import { basename, join } from 'node:path';
import { msg } from './errors';

/**
 * Util gambar bersama — foto produk, QRIS, foto kegiatan/panen.
 * Gambar dikirim frontend sebagai data URL (sudah dikompres di browser),
 * disimpan ke uploads/<subdir>/ dan disajikan statis di /uploads/... (lihat main.ts).
 */

const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const MAX_BYTES = 5 * 1024 * 1024;

/** Validasi + decode data URL gambar (jpeg/png/webp, maks. 5MB). */
export function decodeImageDataUrl(dataUrl: string): { buf: Buffer; ext: string } {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  if (!m) throw new BadRequestException(msg('photo.invalid'));
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0) throw new BadRequestException(msg('photo.invalid'));
  if (buf.length > MAX_BYTES) throw new BadRequestException(msg('photo.tooLarge'));
  return { buf, ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
}

/** Simpan buffer ke uploads/<subdir>/<fname> → URL publik '/uploads/<subdir>/<fname>'. */
export async function saveUploadFile(subdir: string, fname: string, buf: Buffer): Promise<string> {
  const dir = join(UPLOADS_ROOT, subdir);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(join(dir, fname), buf);
  return `/uploads/${subdir}/${fname}`;
}

/** Hapus file uploads berdasarkan URL publiknya (abaikan bila sudah tidak ada). */
export function deleteUploadFile(url: string | null | undefined): void {
  if (!url?.startsWith('/uploads/')) return;
  const parts = url.split('/').filter(Boolean); // ['uploads', subdir, fname]
  if (parts.length !== 3) return;
  void fsp.unlink(join(UPLOADS_ROOT, parts[1], basename(parts[2]))).catch(() => {});
}

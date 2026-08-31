/**
 * Kompres foto di browser sebelum diunggah: perkecil ke sisi terpanjang
 * `maxDim` piksel dan encode JPEG. Foto HP 5–10 MB menjadi ± 100–300 KB —
 * hemat kuota dan cepat diunggah dari sinyal desa.
 */
export async function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error('format');
  }
  // imageOrientation: 'from-image' → EXIF rotasi foto HP ditangani browser.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Latar putih untuk PNG transparan → JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

// services/gambarSoalService.js
import { supabaseAdmin } from '../config/db.js';

export const BUCKET_GAMBAR_SOAL = 'gambar-soal';
export const UKURAN_MAKS_GAMBAR = 5 * 1024 * 1024; // 5 MB

// Menghasilkan URL publik untuk gambar soal.
// Kolom Soal.gambar menyimpan relative path (misal "soal-123.jpg")
// atau URL penuh jika gambar dari sumber eksternal.
export const urlGambarSoal = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return supabaseAdmin.storage.from(BUCKET_GAMBAR_SOAL).getPublicUrl(path).data.publicUrl;
};

// Validasi jenis file gambar dari byte magic number untuk keamanan (mencegah pemalsuan ekstensi/mimetype).
export const deteksiJenisGambar = (buffer) => {
  if (!buffer || buffer.length < 4) return null;

  // JPEG / JPG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // WEBP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  return null;
};


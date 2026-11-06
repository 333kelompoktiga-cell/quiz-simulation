// services/fotoProfilService.js
import { supabaseAdmin } from "../config/db.js";

export const BUCKET_FOTO_PROFIL = "foto-profil";
export const UKURAN_MAKS_FOTO = 2 * 1024 * 1024; // 2 MB, sama dengan batas bucket

// Kolom User.fotoProfil menyimpan path di bucket, bukan URL penuh,
// supaya tidak ikut basi kalau domain Supabase berubah.
export const urlFotoProfil = (path) => {
  if (!path) return null;
  return supabaseAdmin.storage.from(BUCKET_FOTO_PROFIL).getPublicUrl(paths).data
    .publicUrl;
};

// Mimetype dari multer berasal dari header klien dan bisa dipalsukan,
// jadi jenis file ditentukan dari byte awalnya. null = bukan gambar yang diizinkan.
export const deteksiJenisGambar = (buffer) => {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
};

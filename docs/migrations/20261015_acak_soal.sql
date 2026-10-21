-- Pengacakan soal kuis. Jalankan sekali di Supabase SQL Editor.
--
-- Aturan (lihat backend/utils/acakSoal.js):
-- - Urutan soal selalu diacak per mahasiswa dan per percobaan.
-- - "acakSoal" hanya berlaku kalau kuis punya minimal 20 soal: ditampilkan "jumlahTampil" soal
--   (minimal 10), dengan minimal 10 soal cadangan (50 soal -> paling banyak 40 ditampilkan).

ALTER TABLE public."Kuis"
  ADD COLUMN IF NOT EXISTS "acakSoal" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "jumlahTampil" integer;

ALTER TABLE public."Kuis"
  DROP CONSTRAINT IF EXISTS kuis_jumlah_tampil_min;
ALTER TABLE public."Kuis"
  ADD CONSTRAINT kuis_jumlah_tampil_min CHECK ("jumlahTampil" IS NULL OR "jumlahTampil" >= 10);

-- Daftar idSoal (berurutan) yang dikerjakan pada satu percobaan, dipilih saat percobaan dimulai.
-- NULL = percobaan lama sebelum fitur ini: memakai semua soal kuis dengan urutan aslinya.
ALTER TABLE public."PengerjaanKuis"
  ADD COLUMN IF NOT EXISTS "urutanSoal" jsonb;

-- Jalankan di Supabase SQL Editor sebelum menjalankan versi aplikasi ini.
-- Kuis lama tetap pribadi. Daftar UUID divalidasi sebagai akun dosen oleh API.
BEGIN;
ALTER TABLE public."Kuis"
  ADD COLUMN IF NOT EXISTS "aksesKelola" text NOT NULL DEFAULT 'pribadi'
    CHECK ("aksesKelola" IN ('pribadi', 'semua', 'tertentu')),
  ADD COLUMN IF NOT EXISTS "dosenPengelola" uuid[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public."Kuis"."aksesKelola" IS
  'Hak kelola dosen: pribadi, semua dosen, atau dosen tertentu. Tidak memberi akses kepada mahasiswa.';
COMMIT;

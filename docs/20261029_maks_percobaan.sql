-- Jalankan setelah migrasi pengerjaan kuis dan acak soal, sebelum deploy backend.
BEGIN;

ALTER TABLE public."Kuis"
  ADD COLUMN IF NOT EXISTS "maksPercobaan" integer NOT NULL DEFAULT 1;

ALTER TABLE public."Kuis"
  DROP CONSTRAINT IF EXISTS kuis_maks_percobaan_check;
ALTER TABLE public."Kuis"
  ADD CONSTRAINT kuis_maks_percobaan_check CHECK ("maksPercobaan" BETWEEN 1 AND 3);

-- Kunci baris kuis agar pemeriksaan jatah dan pembuatan attempt atomik.
-- Riwayat lama tetap disimpan, termasuk yang sudah melebihi batas baru.
CREATE OR REPLACE FUNCTION public.mulai_pengerjaan_kuis(
  p_id_user uuid,
  p_id_kuis uuid,
  p_urutan_soal jsonb
)
RETURNS SETOF public."PengerjaanKuis"
LANGUAGE plpgsql
AS $$
DECLARE
  batas integer;
  jumlah bigint;
  nomor integer;
BEGIN
  SELECT "maksPercobaan" INTO STRICT batas
  FROM public."Kuis" WHERE "idKuis" = p_id_kuis FOR UPDATE;

  RETURN QUERY SELECT * FROM public."PengerjaanKuis"
  WHERE "idUser" = p_id_user AND "idKuis" = p_id_kuis AND status = 'berlangsung'
  ORDER BY "waktuMulai" DESC LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  SELECT count(*), COALESCE(max(attempt), 0) INTO jumlah, nomor
  FROM public."PengerjaanKuis" WHERE "idUser" = p_id_user AND "idKuis" = p_id_kuis;
  IF jumlah >= batas THEN
    RAISE EXCEPTION 'Jatah percobaan kuis sudah habis.' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY INSERT INTO public."PengerjaanKuis"
    ("idUser", "idKuis", attempt, "urutanSoal", "waktuMulai", status,
     score, "skorFuzzy", "kategoriFuzzy", "totalSoal", "totalBenar", "totalSalah",
     akurasi, "rataRataWaktu", "durasiPengerjaan", "distribusiTingkat", "distribusiKesulitan", "hasilDetail")
  VALUES (p_id_user, p_id_kuis, nomor + 1, p_urutan_soal, now(), 'berlangsung',
          0, 0, 'Belum dievaluasi', 0, 0, 0, 0, 0, 0, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.mulai_pengerjaan_kuis(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mulai_pengerjaan_kuis(uuid, uuid, jsonb) TO service_role;

COMMIT;

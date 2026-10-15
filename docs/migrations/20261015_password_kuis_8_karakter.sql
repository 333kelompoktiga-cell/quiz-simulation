-- Ganti batasan PIN angka dari migrasi lama agar password manual dan generate
-- menerima tepat 8 karakter ASCII yang dapat dicetak, tanpa spasi.
BEGIN;
ALTER TABLE public."Kuis" DROP CONSTRAINT IF EXISTS kuis_pin_format;
ALTER TABLE public."Kuis" ADD CONSTRAINT kuis_pin_format
  CHECK (pin IS NULL OR (char_length(pin) = 8 AND pin ~ '^[!-~]{8}$')) NOT VALID;
-- NOT VALID mempertahankan PIN lama yang belum sesuai. Setiap penyimpanan baru
-- tetap wajib memenuhi format; ganti PIN lama lewat menu Password Kuis.
COMMIT;

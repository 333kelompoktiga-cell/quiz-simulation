-- ============================================================================
-- Migrasi: Auto-Logout / Sesi Kedaluwarsa Setelah 10 Menit Tidak Aktif (Idle)
-- Tanggal: 2026-11-05
-- Deskripsi:
-- Menambahkan kolom "lastActive" pada tabel "SessionLogin" dan memperbarui
-- fungsi "claim_login_session" agar akun yang ditinggal mati paksa / idle > 10 menit
-- otomatis dianggap logout dan bisa langsung login kembali tanpa terkunci (stuck).
-- ============================================================================

BEGIN;

-- 1. Tambahkan kolom "lastActive" jika belum ada
ALTER TABLE public."SessionLogin"
ADD COLUMN IF NOT EXISTS "lastActive" timestamptz DEFAULT now();

-- 2. Isi nilai awal "lastActive" untuk data yang sudah ada
UPDATE public."SessionLogin"
SET "lastActive" = COALESCE("lastLogin", now())
WHERE "lastActive" IS NULL;

-- 3. Perbarui fungsi claim_login_session
-- Syarat klaim sesi baru:
--   - Sesi lama sudah logout ("logoutTime" IS NOT NULL), ATAU
--   - Sesi lama sudah tidak ada aktivitas lebih dari 10 menit ("lastActive" < now() - interval '10 minutes')
CREATE OR REPLACE FUNCTION public.claim_login_session(p_id_akun uuid, p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claimed uuid;
BEGIN
  INSERT INTO public."SessionLogin" ("idAkun", "sessionId", "lastLogin", "lastActive", "logoutTime")
  VALUES (p_id_akun, p_session_id, now(), now(), NULL)
  ON CONFLICT ("idAkun") DO UPDATE
  SET "sessionId" = EXCLUDED."sessionId",
      "lastLogin" = EXCLUDED."lastLogin",
      "lastActive" = EXCLUDED."lastActive",
      "logoutTime" = NULL
  WHERE "SessionLogin"."logoutTime" IS NOT NULL
     OR "SessionLogin"."lastActive" < (now() - interval '10 minutes')
     OR ("SessionLogin"."lastActive" IS NULL AND "SessionLogin"."lastLogin" < (now() - interval '10 minutes'))
  RETURNING "sessionId" INTO claimed;

  RETURN claimed IS NOT NULL;
END;
$$;

-- 4. Kunci hak akses: hanya service_role backend yang boleh mengeksekusi
REVOKE ALL ON FUNCTION public.claim_login_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_login_session(uuid, uuid) TO service_role;

COMMIT;

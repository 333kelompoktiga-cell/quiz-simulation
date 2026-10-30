-- Jalankan setelah 20261029_maks_percobaan.sql, sebelum deploy backend baru.
BEGIN;
ALTER TABLE public."SessionLogin" ADD COLUMN IF NOT EXISTS "sessionId" uuid;
-- Sesi versi lama tidak mempunyai identitas sesi; pengguna perlu login ulang sekali.
UPDATE public."SessionLogin" SET "logoutTime" = now()
WHERE "sessionId" IS NULL AND "logoutTime" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS session_login_akun_unique ON public."SessionLogin" ("idAkun");
ALTER TABLE public."PengerjaanKuis" ADD COLUMN IF NOT EXISTS "soalTerakhir" uuid;

CREATE OR REPLACE FUNCTION public.claim_login_session(p_id_akun uuid, p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed uuid;
BEGIN
  INSERT INTO public."SessionLogin" ("idAkun", "sessionId", "lastLogin", "logoutTime")
  VALUES (p_id_akun, p_session_id, now(), NULL)
  ON CONFLICT ("idAkun") DO UPDATE
  SET "sessionId" = EXCLUDED."sessionId", "lastLogin" = EXCLUDED."lastLogin", "logoutTime" = NULL
  WHERE "SessionLogin"."logoutTime" IS NOT NULL
  RETURNING "sessionId" INTO claimed;
  RETURN claimed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_login_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_login_session(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.list_accounts_superadmin(
 p_search text DEFAULT '', p_role text DEFAULT NULL, p_offset integer DEFAULT 0, p_limit integer DEFAULT 10
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 WITH filtered AS (
   SELECT u."idUser" AS id, u.nama, a.email, u.role
   FROM public."User" u JOIN auth.users a ON a.id = u."idUser"
   WHERE u.role IN ('Admin', 'Mahasiswa') AND (p_role IS NULL OR u.role = p_role)
   AND (coalesce(p_search, '') = '' OR strpos(lower(concat_ws(' ', u.nama, u.username, a.email)), lower(p_search)) > 0)
 ), paged AS (
   SELECT * FROM filtered ORDER BY nama, id
   LIMIT greatest(1, least(p_limit, 10)) OFFSET greatest(p_offset, 0)
 )
 SELECT jsonb_build_object('users', coalesce((SELECT jsonb_agg(p ORDER BY p.nama, p.id) FROM paged p), '[]'::jsonb),
   'total', (SELECT count(*) FROM filtered));
$$;
REVOKE ALL ON FUNCTION public.list_accounts_superadmin(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_accounts_superadmin(text, text, integer, integer) TO service_role;
COMMIT;

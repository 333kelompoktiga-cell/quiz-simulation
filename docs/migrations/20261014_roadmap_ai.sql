-- ==============================================================================
-- SKEMA TABEL ROADMAP BELAJAR MAHASISWA BERBASIS AI (e-SIKAP)
-- Digunakan untuk menyimpan peta belajar (roadmap tahapan perbaikan) per bab
-- yang dihasilkan oleh AI LLM (OpenRouter) berdasarkan evaluasi soal-soal salah.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public."Roadmap" (
    "idRoadmap" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "idUser" UUID NOT NULL REFERENCES public."User"("idUser") ON DELETE CASCADE,
    "idBab" UUID NOT NULL REFERENCES public."Bab"("idBab") ON DELETE CASCADE,
    "urutan" INTEGER NOT NULL DEFAULT 1,
    "rekomendasi" TEXT NOT NULL,
    "tanggalDibuat" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeks unik untuk 1 roadmap aktif per bab per mahasiswa
CREATE UNIQUE INDEX IF NOT EXISTS idx_roadmap_user_bab 
    ON public."Roadmap"("idUser", "idBab");

-- Indeks untuk pencarian cepat berdasarkan user dan bab
CREATE INDEX IF NOT EXISTS idx_roadmap_user ON public."Roadmap"("idUser");
CREATE INDEX IF NOT EXISTS idx_roadmap_bab ON public."Roadmap"("idBab");

-- RLS (Row Level Security)
ALTER TABLE public."Roadmap" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mahasiswa dapat melihat roadmap miliknya sendiri"
    ON public."Roadmap"
    FOR SELECT
    USING (auth.uid() = "idUser" OR EXISTS (
        SELECT 1 FROM public."User" u WHERE u."idUser" = auth.uid() AND u."role" IN ('Admin', 'Super Admin')
    ));

CREATE POLICY "Mahasiswa dapat memperbarui roadmap miliknya sendiri"
    ON public."Roadmap"
    FOR ALL
    USING (auth.uid() = "idUser")
    WITH CHECK (auth.uid() = "idUser");


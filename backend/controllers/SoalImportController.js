import { supabaseAdmin } from '../config/db.js';
import { bisaDikelola, KOLOM_AKSES_KUIS } from '../utils/aksesKuis.js';
// controllers/SoalImportController.js
import {
  UUID_PATTERN,
  extractTextFromBuffer,
  parseSoal,
  uploadSoalToSupabase,
} from '../services/soalExtractor.js';

export async function importSoalFromPdf(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File PDF wajib diunggah (field: file).' });
    }

    const idKuis = (req.body.idKuis || '').trim();
    const startPage = parseInt(req.body.startPage, 10);
    const endPage = parseInt(req.body.endPage, 10);
    const upload = String(req.body.upload ?? 'true') !== 'false';

    if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage < startPage) {
      return res.status(400).json({ success: false, message: 'startPage dan endPage tidak valid.' });
    }

    if (upload && !UUID_PATTERN.test(idKuis)) {
      return res.status(400).json({ success: false, message: 'idKuis harus berupa UUID yang valid.' });
    }

    if (upload) {
      const { data: kuis, error } = await supabaseAdmin.from('Kuis')
        .select(KOLOM_AKSES_KUIS).eq('idKuis', idKuis).maybeSingle();
      if (error) throw error;
      if (!kuis) return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
      if (!bisaDikelola(kuis, req.currentUser)) {
        return res.status(403).json({ success: false, message: 'Kamu belum diberi hak untuk mengelola kuis ini.' });
      }
    }

    const rawText = await extractTextFromBuffer(req.file.buffer, startPage, endPage);
    const daftarSoal = parseSoal(rawText);

    if (daftarSoal.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'Tidak ada soal yang terdeteksi pada rentang halaman tersebut.',
      });
    }

    if (!upload) {
      return res.status(200).json({
        success: true,
        message: `Berhasil mengekstrak ${daftarSoal.length} soal (preview, belum disimpan).`,
        total: daftarSoal.length,
        data: daftarSoal,
      });
    }

    const laporan = await uploadSoalToSupabase(daftarSoal, idKuis);

    return res.status(laporan.gagal.length ? 207 : 201).json({
      success: laporan.berhasil.length > 0,
      message: `${laporan.berhasil.length} soal berhasil disimpan, ${laporan.gagal.length} gagal.`,
      total: daftarSoal.length,
      berhasil: laporan.berhasil,
      gagal: laporan.gagal,
    });
  } catch (error) {
    console.error('importSoalFromPdf error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
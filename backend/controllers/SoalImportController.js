import { supabaseAdmin } from '../config/db.js';
import { bisaDikelola, KOLOM_AKSES_KUIS } from '../utils/aksesKuis.js';
// controllers/SoalImportController.js
import {
  UUID_PATTERN,
  extractTextFromBuffer,
  parseSoal,
  uploadSoalToSupabase,
} from '../services/soalExtractor.js';
import { siapkanSoal, cekAksesKuis } from './SoalController.js';

// Soal hasil import diperiksa dengan aturan yang sama seperti soal yang diisi manual
// di editor (siapkanSoal), ditambah pesan yang lebih jelas untuk masalah khas PDF.
function periksaSoal(item) {
  const hurufOpsi = item.opsi_jawaban.map((o) => o.huruf);

  if (!item.kunci_jawaban) {
    return { error: 'Kunci jawaban tidak ditemukan. Isi kolom "Kunci Jawaban" dengan satu huruf (A-E).' };
  }
  if (hurufOpsi.length > 0 && !hurufOpsi.includes(item.kunci_jawaban)) {
    return { error: `Kunci jawaban ${item.kunci_jawaban} tidak ada di daftar opsi (${hurufOpsi.join(', ')}).` };
  }

  const { error, data } = siapkanSoal(
    {
      pertanyaan: item.pertanyaan,
      difficulty: item.difficulty,
      pembahasan: item.pembahasan,
      opsi: item.opsi_jawaban.map(({ opsi, isCorrect }) => ({ opsi, isCorrect })),
    },
    { wajibSemua: true },
  );
  if (error) return { error };

  // Simpan opsi dengan label hurufnya, sama seperti yang dikirim editor ("A. ...").
  data.opsi = data.opsi.map((o, i) => ({ ...o, opsi: `${hurufOpsi[i]}. ${o.opsi}` }));
  return { data };
}

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

    if (upload) {
      if (!UUID_PATTERN.test(idKuis)) {
        return res.status(400).json({ success: false, message: 'idKuis harus berupa UUID yang valid.' });
      }
      const akses = await cekAksesKuis(idKuis, req.currentUser.id);
      if (akses) {
        return res.status(akses.status).json({ success: false, message: akses.message });
      }
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
        message:
          'Tidak ada soal yang terdeteksi. Pastikan PDF mengikuti Template Upload Soal e-Kuis '
          + '(kolom Pertanyaan / Stimulus Soal, Opsi Jawaban, Kunci Jawaban, Pembahasan).',
      });
    }

    const valid = [];
    const gagal = [];
    for (const item of daftarSoal) {
      const { error, data } = periksaSoal(item);
      if (error) gagal.push({ nomor: item.nomor, alasan: error });
      else valid.push({ nomor: item.nomor, data });
    }

    if (!upload) {
      return res.status(200).json({
        success: true,
        message: `Berhasil mengekstrak ${daftarSoal.length} soal (preview, belum disimpan). ${valid.length} valid, ${gagal.length} bermasalah.`,
        total: daftarSoal.length,
        data: daftarSoal,
        gagal,
      });
    }

    const laporan = valid.length ? await uploadSoalToSupabase(valid, idKuis) : { berhasil: [], gagal: [] };
    laporan.gagal = [...gagal, ...laporan.gagal].sort((a, b) => a.nomor - b.nomor);

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

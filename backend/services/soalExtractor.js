// services/soalExtractor.js
//
// Membaca soal dari PDF yang mengikuti "Template Upload Soal e-Kuis".
// Format 1 dan 2 berupa tabel dua kolom (label di kiri, isi di kanan),
// format 3 berupa teks biasa dengan label diikuti titik dua.
//
//   Format 1                     Format 2                       Format 3
//   Pertanyaan    | ...          Stimulus Soal | ...            Soal 1
//   Opsi Jawaban  | A. ... E.    Soal          | ... A. ... E.  Stimulus: ...
//   Kunci Jawaban | D            Kunci Jawaban | D              Pertanyaan: ...
//   Pembahasan    | ...          Pembahasan    | ...            Opsi Jawaban: A. ... E. ...
//                                                               Kunci Jawaban: C
//                                                               Pembahasan: ...
//   "Tingkat Kesulitan" (Mudah/Sedang/Sulit) opsional di semua format.
//
// Format lama yang diawali "Nomor Soal N" tetap didukung.
import { supabaseAdmin } from '../config/db.js';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HURUF_OPSI = 'ABCDEF';

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n|\r/g, '\n')
    // Penanda halaman dari pdf-parse. Diganti satu baris baru (bukan baris kosong) supaya
    // kolom yang terpotong ke halaman berikutnya tetap tersambung jadi satu paragraf.
    .replace(/\n*[ \t]*-- \d+ of \d+ --[ \t]*\n*/g, '\n')
    .replace(/^[ \t]*(?:Template Upload Soal\b|Contoh Template Soal\b).*$/gim, '') // judul pada file template
    // Judul nomor soal ("Soal 2"), baik di baris sendiri maupun menempel di depan label
    // seperti "Soal 2 Stimulus:" (kolom kiri tabel terbaca satu baris dengan kolom kanan).
    .replace(/^[ \t]*(?:Soal|No\.?|Nomor)[ \t]+(?:ke-?)?\d+[ \t]*[:.]?[ \t]*(?=$|(?:Stimulus|Pertanyaan|Soal)\b)/gim, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// PDF memecah teks per baris visual. Sambung kembali baris yang terpotong, tapi
// pertahankan baris kosong, baris yang diawali penanda daftar, dan baris pendek yang
// diakhiri tanda baca (akhir kalimat yang memang dipisah, mis. "Bacalah cerita berikut!").
const PENANDA_DAFTAR = /^(?:\(?\d+[.)]|\(?[a-zA-Z][.)]|[-•*])\s/;

function sambungBaris(text) {
  if (!text) return '';
  return text
    .split(/\n\s*\n/)
    .map((paragraf) => {
      const daftarBaris = paragraf.split('\n').map((b) => b.trim()).filter(Boolean);
      const terpanjang = Math.max(0, ...daftarBaris.map((b) => b.length));
      return daftarBaris.reduce((hasil, baris, i) => {
        if (i === 0) return baris;
        const sebelum = daftarBaris[i - 1];
        const akhirKalimat = /[.!?:]$/.test(sebelum) && sebelum.length < terpanjang * 0.8;
        return PENANDA_DAFTAR.test(baris) || akhirKalimat ? `${hasil}\n${baris}` : `${hasil} ${baris}`;
      }, '');
    })
    .filter(Boolean)
    .join('\n\n');
}

// Label kolom kiri tabel. Label dua kata bisa terpecah ke dua baris ("Kunci\nJawaban"),
// dan pdf-parse kadang memecah kata ("Jaw aban").
const POLA_LABEL = new RegExp(
  [
    String.raw`^[ \t]*(?:`,
    String.raw`(?<nomor>Nomor\s+Soal\s+(?<no>\d+))`,
    String.raw`|(?<stimulus>Stimulus(?:\s+Soal)?)`,
    String.raw`|(?<pertanyaan>Pertanyaan)`,
    String.raw`|(?<opsi>(?:Opsi|Pilihan)\s+Jaw\s*aban|Opsi(?=[ \t]*:?\s*A[.)]\s))`,
    String.raw`|(?<kunci>Kunci\s+Jaw\s*aban|Jaw\s*aban\s+yang\s+Benar|(?:Kunci|Jaw\s*aban)(?=[ \t]*:?\s*[A-F][ \t]*$))`,
    String.raw`|(?<pembahasan>Pembahasan)`,
    String.raw`|(?<tingkat>Tingkat\s+Kesulitan)`,
    String.raw`|(?<soal>Soal)`,
    String.raw`)[ \t]*:?(?=\s|$)`,
  ].join(''),
  'gim',
);

const JENIS_LABEL = ['nomor', 'stimulus', 'pertanyaan', 'opsi', 'kunci', 'pembahasan', 'tingkat', 'soal'];

function cariLabel(teks) {
  return [...teks.matchAll(POLA_LABEL)].map((m) => ({
    jenis: JENIS_LABEL.find((j) => m.groups[j] !== undefined),
    nomor: m.groups.no ? parseInt(m.groups.no, 10) : null,
    awal: m.index,
    akhir: m.index + m[0].length,
  }));
}

// Kata seperti "Pertanyaan" atau "Soal" juga bisa muncul di awal baris isi pembahasan.
// Label itu baru dianggap awal soal baru kalau setelahnya benar-benar ada kolom Opsi,
// Kunci Jawaban, atau Pembahasan sebelum soal berikutnya dimulai.
function adaKolomSoalSetelah(daftarLabel, j) {
  let bolehIsiSoal = daftarLabel[j].jenis === 'stimulus';
  for (let k = j + 1; k < daftarLabel.length; k++) {
    const { jenis } = daftarLabel[k];
    if (jenis === 'opsi' || jenis === 'kunci' || jenis === 'pembahasan') return true;
    if (jenis === 'nomor' || jenis === 'stimulus') return false;
    if (jenis === 'pertanyaan' || jenis === 'soal') {
      if (!bolehIsiSoal) return false;
      bolehIsiSoal = false;
    }
  }
  return false;
}

// Menentukan label mana yang sungguhan, lalu mengelompokkannya per soal.
// Label yang ditolak tetap menjadi bagian dari isi kolom sebelumnya.
function kelompokkanSoal(teks) {
  const daftarLabel = cariLabel(teks);
  const daftarSoal = [];
  const diterima = [];
  let soal = null;

  const mulaiSoal = (label) => {
    soal = { nomor: label.nomor, kolom: {} };
    daftarSoal.push(soal);
  };
  const isiKolom = (nama, label) => {
    soal.kolom[nama] = label;
    diterima.push(label);
  };

  daftarLabel.forEach((label, j) => {
    const k = soal?.kolom ?? {};
    const bisaMulaiBaru = (!soal || k.kunci || k.pembahasan) && adaKolomSoalSetelah(daftarLabel, j);

    switch (label.jenis) {
      case 'nomor':
        mulaiSoal(label);
        diterima.push(label);
        break;
      case 'stimulus':
        if (soal && !k.stimulus && !k.pertanyaan && !k.kunci) isiKolom('stimulus', label);
        else if (bisaMulaiBaru) { mulaiSoal(label); isiKolom('stimulus', label); }
        break;
      case 'pertanyaan':
      case 'soal':
        if (soal && !k.pertanyaan && !k.kunci) isiKolom('pertanyaan', label);
        else if (bisaMulaiBaru) { mulaiSoal(label); isiKolom('pertanyaan', label); }
        break;
      case 'opsi':
        if (k.pertanyaan && !k.opsi && !k.kunci) isiKolom('opsi', label);
        break;
      default: // kunci, pembahasan, tingkat
        if (k.pertanyaan && !k[label.jenis]) isiKolom(label.jenis, label);
    }
  });

  // Isi sebuah kolom = teks dari akhir labelnya sampai label sah berikutnya.
  diterima.forEach((label, i) => {
    label.isi = teks.slice(label.akhir, diterima[i + 1]?.awal ?? teks.length).trim();
  });

  return daftarSoal;
}

// Memisahkan baris "A. ...", "B. ...", dst. Opsi harus berurutan mulai dari A sampai
// akhir teks, supaya daftar berhuruf di dalam stimulus tidak ikut terbaca sebagai opsi.
function pisahOpsi(teks) {
  const cocok = [...teks.matchAll(/^[ \t]*([A-F])[.)][ \t]+/gm)];
  const mulai = cocok.findIndex((m, i) =>
    m[1] === 'A' && cocok.slice(i).every((n, urut) => n[1] === HURUF_OPSI[urut]),
  );
  if (mulai === -1) return { sebelum: teks, opsi: [] };

  const opsi = cocok.slice(mulai).map((m, i, semua) => ({
    huruf: m[1],
    teks: sambungBaris(teks.slice(m.index + m[0].length, semua[i + 1]?.index ?? teks.length)),
  }));
  return { sebelum: teks.slice(0, cocok[mulai].index), opsi };
}

const TINGKAT = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit' };

export function parseSoal(fullText) {
  const teks = cleanText(fullText);

  return kelompokkanSoal(teks).map(({ nomor, kolom }, i) => {
    const isi = (nama) => kolom[nama]?.isi ?? '';

    // Opsi ada di kolom "Opsi Jawaban" (format 1) atau menempel di bawah soal (format 2).
    const dariSoal = pisahOpsi(isi('pertanyaan'));
    const opsi = kolom.opsi ? pisahOpsi(isi('opsi')).opsi : dariSoal.opsi;
    const pertanyaan = [isi('stimulus'), kolom.opsi ? isi('pertanyaan') : dariSoal.sebelum]
      .map(sambungBaris)
      .filter(Boolean)
      .join('\n\n');

    const kunci = isi('kunci').match(/^([A-F])(?![A-Za-z])/i)?.[1].toUpperCase() ?? '';

    // Tingkat kesulitan opsional: default Sedang, sama seperti soal baru di editor.
    const tingkatMentah = isi('tingkat').split(/\s/)[0] ?? '';
    const difficulty = kolom.tingkat ? TINGKAT[tingkatMentah.toLowerCase()] ?? tingkatMentah : 'Sedang';

    return {
      nomor: nomor ?? i + 1,
      pertanyaan,
      difficulty,
      kunci_jawaban: kunci,
      pembahasan: sambungBaris(isi('pembahasan')),
      opsi_jawaban: opsi.map((o) => ({ huruf: o.huruf, opsi: o.teks, isCorrect: o.huruf === kunci })),
    };
  });
}

export async function extractTextFromBuffer(buffer, startPage, endPage) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });

  try {
    const pages = Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage + index,
    );
    const result = await parser.getText({ partial: pages });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

// `daftarSoal` berisi soal yang sudah lolos siapkanSoal (bentuk kolom database).
// Soal baru ditaruh setelah soal yang sudah ada di kuis.
export async function uploadSoalToSupabase(daftarSoal, idKuis) {
  const laporan = { berhasil: [], gagal: [] };

  const { data: terakhir } = await supabaseAdmin
    .from('Soal')
    .select('urutan')
    .eq('idKuis', idKuis)
    .not('urutan', 'is', null)
    .order('urutan', { ascending: false })
    .limit(1)
    .maybeSingle();
  let urutan = terakhir?.urutan ?? 0;

  for (const { nomor, data } of daftarSoal) {
    const { opsi, ...kolomSoal } = data;

    const { data: soalData, error: errSoal } = await supabaseAdmin
      .from('Soal')
      .insert({ ...kolomSoal, idKuis, urutan: urutan + 1 })
      .select('idSoal')
      .single();

    if (errSoal) {
      laporan.gagal.push({ nomor, alasan: errSoal.message });
      continue;
    }

    const { error: errOpsi } = await supabaseAdmin
      .from('OpsiJawaban')
      .insert(opsi.map((o) => ({ ...o, idSoal: soalData.idSoal })));

    if (errOpsi) {
      // rollback soal agar tidak ada soal tanpa opsi
      await supabaseAdmin.from('Soal').delete().eq('idSoal', soalData.idSoal);
      laporan.gagal.push({ nomor, alasan: `Gagal menyimpan opsi: ${errOpsi.message}` });
      continue;
    }

    urutan += 1;
    laporan.berhasil.push({ nomor, idSoal: soalData.idSoal, jumlahOpsi: opsi.length });
  }

  return laporan;
}

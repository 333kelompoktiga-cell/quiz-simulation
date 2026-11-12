// services/soalImageExtractor.js
import jpeg from 'jpeg-js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { supabaseAdmin } from '../config/db.js';
import { BUCKET_GAMBAR_SOAL, urlGambarSoal } from './gambarSoalService.js';

// Ekstraksi gambar tersemat dari setiap halaman PDF menggunakan pdfjs-dist.
// Setiap gambar rumus dikonversi menjadi buffer JPEG berkualitas tinggi dan diunggah ke Supabase Storage.
export async function extractImagesFromPdf(pdfBuffer, startPage = 1, endPage = 9999) {
  try {
    const uint8 = new Uint8Array(pdfBuffer);
    const doc = await pdfjs.getDocument({ data: uint8 }).promise;

    const maxPage = Math.min(doc.numPages, endPage);
    const imagesByPage = new Map();

    for (let pageNum = startPage; pageNum <= maxPage; pageNum++) {
      const page = await doc.getPage(pageNum);
      const ops = await page.getOperatorList();
      const pageImages = [];

      for (let j = 0; j < ops.fnArray.length; j++) {
        if (ops.fnArray[j] === pdfjs.OPS.paintImageXObject) {
          const objId = ops.argsArray[j][0];
          try {
            const img = await new Promise((resolve) => {
              const timer = setTimeout(() => resolve(null), 2000);
              page.objs.get(objId, (data) => {
                clearTimeout(timer);
                resolve(data);
              });
            });

            if (img && img.width > 100 && img.height > 60 && img.data) {
              pageImages.push(img);
            }
          } catch (err) {
            console.warn(`Gagal membaca XObject ${objId} di halaman ${pageNum}:`, err.message);
          }
        }
      }

      if (pageImages.length > 0) {
        // Pilih gambar dengan ukuran byte terbesar (menghindari bayangan/shadow dekoratif kecil)
        pageImages.sort((a, b) => (b.data?.length || 0) - (a.data?.length || 0));
        const bestImg = pageImages[0];

        let jpegBuffer = null;
        if (bestImg.data.length === bestImg.width * bestImg.height * 4) {
          const res = jpeg.encode({ data: bestImg.data, width: bestImg.width, height: bestImg.height }, 90);
          jpegBuffer = Buffer.from(res.data);
        } else if (bestImg.data.length === bestImg.width * bestImg.height * 3) {
          const rgba = Buffer.alloc(bestImg.width * bestImg.height * 4);
          for (let k = 0, p = 0; k < bestImg.data.length; k += 3, p += 4) {
            rgba[p] = bestImg.data[k];
            rgba[p + 1] = bestImg.data[k + 1];
            rgba[p + 2] = bestImg.data[k + 2];
            rgba[p + 3] = 255;
          }
          const res = jpeg.encode({ data: rgba, width: bestImg.width, height: bestImg.height }, 90);
          jpegBuffer = Buffer.from(res.data);
        }

        if (jpegBuffer && jpegBuffer.length > 1000) {
          const filename = `pdf-import-${Date.now()}-hal${pageNum}-${Math.random().toString(36).slice(2, 7)}.jpg`;
          const { error: uploadErr } = await supabaseAdmin.storage
            .from(BUCKET_GAMBAR_SOAL)
            .upload(filename, jpegBuffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!uploadErr) {
            imagesByPage.set(pageNum, {
              filename,
              url: urlGambarSoal(filename),
              width: bestImg.width,
              height: bestImg.height,
            });
          } else {
            console.warn(`Upload gambar halaman ${pageNum} gagal:`, uploadErr.message);
          }
        }
      }
    }

    return imagesByPage;
  } catch (error) {
    console.error('Gagal mengekstrak gambar dari PDF:', error);
    return new Map();
  }
}

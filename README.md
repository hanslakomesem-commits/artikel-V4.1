# ZAIN.NET — Skripsi Jadi Artikel • Scrib AI Lokal V1.4

Versi GitHub Pages statis. Tidak memerlukan API token atau backend.

## Revisi V1.4
- Program Studi dan Universitas ditampilkan hanya sebagai nama (tanpa label) di bagian depan artikel, ukuran lebih besar.
- Nama penulis tetap bold.
- ABSTRAK dan ABSTRACT rata tengah.
- Isi Abstrak Indonesia dan English Abstract single spacing.
- English Abstract diterjemahkan per paragraf sehingga jumlah paragraf sama dengan Abstrak Indonesia.
- Baris `Kata Kunci` dan `Keywords` dibuat bold dan single spacing.
- Indent alinea isi diperkecil dan tab/line-break manual yang menyebabkan paragraf terlalu masuk dibersihkan.
- Pembersihan teks aman: spasi ganda, spasi sebelum tanda baca, karakter lunak/aneh, dan tab awal dibersihkan tanpa mengubah makna akademik.
- `DAFTAR PUSTAKA` rata kiri.
- Daftar Pustaka disinkronkan dengan footnote yang benar-benar ikut pada paragraf artikel. Referensi yang tidak disitasi tidak diprioritaskan; jika pasangan daftar pustaka tidak ditemukan, teks footnote dijadikan fallback referensi.
- Penamaan file menjadi `Artikel_Nama.docx` menggunakan nama depan penulis, contoh `Artikel_Anisa.docx`.
- Detektor universal V1.2 tetap dipertahankan untuk variasi BAB antar skripsi.

## Upload GitHub Pages
Upload semua file utama pada folder ini langsung ke root repository:
`index.html`, `app.js`, `article-ai.js`, `docx-engine.js`, `local-translator.js`, `styles.css`, `jszip.min.js`, `README.md`, dan `CARA_UPLOAD.txt`.

Aktifkan GitHub Pages dari branch `main` dan `/ (root)`.

## Catatan English Abstract
Model terjemahan lokal diunduh pada penggunaan pertama dan kemudian dapat tersimpan di cache browser. Tidak menggunakan API token.


## Revisi V1.4
- Setiap paragraf Abstrak Indonesia dan Abstract Inggris menggunakan first-line indent setara satu tab (sekitar 1,27 cm) dan tetap single spacing.
- Jarak antara judul artikel dan nama penulis diperbesar setara satu enter/jeda visual.
- Setelah tombol Analisis & Buat Draft diklik dan proses sukses, file Artikel_Nama.docx otomatis didownload. Tombol Download Ulang tetap tersedia.

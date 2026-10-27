# Ambatopia Web

Website Ambatopia creative/social dengan Vercel dan Supabase.

Snapshot sumber terbaru yang tersedia pada 27 Oktober 2026. Versi: **2026-10-27**.

## Dokumentasi proyek

# Ambatopia

Mode online creative/social memakai Vercel Functions dan Supabase Auth, PostgreSQL, serta Realtime. Halaman Set, World, dan Edit World asli tetap tersedia setelah login. Integrasi Discord dan tombol Cloud save telah dihapus. Data tool tersimpan otomatis ke akun; world online disimpan oleh server setiap perubahan berhasil.

## Menjalankan lokal

```powershell
npm ci
npm run acquire
npm start
```

Buka http://localhost:4175/. Backend lokal memerlukan konfigurasi privat `.env.online.local`; jangan unggah file tersebut. URL dan publishable key publik berada di `cloud/config.json`.

Grow ID bersifat permanen. Thaney adalah satu-satunya superadmin berdasarkan UUID dan role database, bukan nama yang dikirim browser. Password dan refresh token tidak disimpan di localStorage. Halaman bootstrap sudah dinonaktifkan setelah akun dibuat.

## Fitur

- Menu Play Online, Options, About dengan awan GSAP dua arah, parallax, dan preferensi gerakan; daftar/login dan loading berdasarkan permintaan backend nyata.
- Cari/buat/masuk world, gerak multiplayer, chat, pakaian asli Set Designer, simpan otomatis.
- Creative inventory dengan 14 jenis blok/lock eksplisit. World/Diamond Lock melindungi world; Small/Big/Huge memakai wilayah 10/48/200 tile. Pemilik dapat memberi atau mencabut akses.
- Ekspor PNG/GIF/video karakter melalui panel asli Set Designer dan JSON yang kompatibel dengan item Editor yang didukung. Impor menolak item/effect/entity yang belum didukung, tanpa membuangnya diam-diam.
- Tool asli menyediakan katalog lebih luas, Art, MIDI, dan ekspor media. Item tool yang belum didukung game online tidak dapat dipublikasikan ke world bersama.
- Panel Thaney: daftar dan inspeksi player/world, tanggal akun/login/last seen, online, kick/ban/unban, teleport dan god mode; tindakan developer dicatat server.

## Batas rilis beta

Batas awal dua pemain biasa per world; Thaney dapat melewatinya. Uji singkat dua pemain pernah mencapai 4,87 update/detik, p95 702 ms, tetapi pengulangan menunjukkan p95 sampai 1,86 detik. Ini belum merupakan bukti kapasitas multiplayer stabil. Physics asli Set Designer berjalan di klien dengan validasi koordinat, kecepatan, role dan rate di server; belum setara simulasi anti-cheat authoritative penuh. Password recovery belum tersedia. Volume mengatur theme.mp3 menu dan click.wav dari pengguna. Musik mulai setelah interaksi, berhenti saat masuk world, dan kembali di menu.

World disimpan persisten; chat disimpan tujuh hari. Presence berakhir setelah 60 detik. Pembersihan data sementara dijadwalkan tiap menit melalui Supabase Cron.

## Verifikasi

```powershell
npm test
npm run build:deploy
npm run verify:online
npm run verify:media
```

`verify:online` menggunakan dua akun/world QA khusus dari cache privat, bukan akun Thaney atau world pengguna. Tutup tab yang memakai akun QA tersebut selama tes agar heartbeat tab lain tidak bergabung ulang. `verify:online:load` membuat akun/world disposable dan membersihkan hanya ID yang dibuatnya; gate awal 5 update/detik, p95 <= 1 detik belum stabil pada jaringan ini. Jangan menjalankannya terhadap world pengguna.

Laporan di `verification/online/`; bukti media sebelumnya diperiksa oleh `verify:media`, bukan direkam ulang oleh skrip tersebut. Detail deployment dan rollback ada di DEPLOYMENT.md. Sumber mirror asli tetap hash-pinned; patch menolak sumber yang berubah.

## Engine dan tema Ambatopia

Mode online memakai bundle asli Set Designer, katalog 4.083 pakaian, atlas, animasi, dan renderer GW. Renderer karakter dan physics buatan sebelumnya telah dihapus. Avatar remote dirender dalam realm engine asli terpisah dengan storage in-memory; realm tersebut tidak menjalankan autosave akun. Edit world bersama tetap divalidasi RPC.

`node scripts/recover-native-strings.mjs` membaca bundle hash-pinned dan mengekstrak string untuk analisis; hanya decoder string dan rotasinya dievaluasi di VM kosong. Hasil analisis berada di cache, bukan bundle produk. Lihat `verification/ambatopia/rea-notes.md`.

Domain publik: https://ambatopia.vercel.app/. Logo, dua frame kepala, maskot dan kedua file audio di `game/assets/` merupakan salinan file yang diberikan pengguna.

Pada HP, Clothes membuka katalog asli sebagai drawer; Blocks & Locks membuka inventaris terpisah. Toolbar bawah bisa digeser, kontrol gerak tidak bertumpuk dengan katalog, dan Respawn memilih tempat kosong. Chat baru muncul sebagai bubble di atas avatar. Laporan pengujian dan batas perangkat ada di `verification/ambatopia/mobile-fixes.md`.

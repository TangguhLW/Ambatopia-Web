# Deployment online

Target: tim Vercel `thang-94e1`, proyek `growtopia-clone`, domain https://ambatopia.vercel.app. Database Supabase `pfxgouprvgvtfcnqmqsh`, region Tokyo. Fungsi Vercel memakai hnd1.

## Konfigurasi backend

Production dan Preview memerlukan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ACCOUNT_RATE_SALT, APP_ORIGIN. Service key hanya dibaca fungsi account; jangan masukkan ke frontend atau log. APP_ORIGIN production dan preview adalah https://ambatopia.vercel.app. Origin immutable Vercel juga diperiksa melalui environment sistem deployment.

THANEY_BOOTSTRAP_TOKEN telah dihapus dari kedua environment dan file lokal. ALLOW_LOCAL_BOOTSTRAP juga telah dihapus; preview lokal sudah dimulai ulang. Jangan menjalankan konfigurator bootstrap sekali pakai untuk update rutin.

File `.env*`, `.vercel-thang/`, cache, node_modules dan deploy diabaikan Git. CLI memakai login THANG yang sudah diotorisasi di konfigurasi privat terpisah; jangan membaca/menyalin isinya. Build membersihkan cloud.js lama dan menghasilkan tiga fungsi backend tanpa mengunggah konfigurasi privat.

## Database

Migrasi numbered 001-013 telah diterapkan secara aditif. `realtime-setup.sql` menambahkan publication game_events dan izin subscription privat. RLS mengecek membership/session pada setiap event; browser tidak diberi hak menulis event langsung. `cron-setup.sql` menjadwalkan game_prune tiap menit. Jangan menjalankan ulang migrasi create-table yang sudah tercatat di game_schema_versions.

Dua snapshot lama dan 219 metadata aset dipertahankan saat migrasi; backup privat sebelum migrasi berada di `.cache/pre-online/`. Jangan mengunggah backup atau menghapus tabel/bucket lama saat rollback. Aset statis hasil build sekarang lebih banyak karena jalur Editor tambahan sudah digunakan.

## Update

```powershell
npm test
npm run build:deploy
npm run verify:online
vercel deploy --yes --scope thang-94e1 --cwd deploy --global-config "C:\Users\user\Documents\ChatGPT\Github-Repo\growtopia-local\.vercel-thang"
```

Periksa preview: login, world, chat, lock, tools, autosave, CSP, dan console. Kebijakan CSP tool mengizinkan unsafe-eval khusus dokumen engine legacy yang memakai Function; halaman game utama tetap lebih ketat. Aset yang belum ada dilayani proxy origin tetap tanpa meneruskan Cookie/Authorization/Set-Cookie.

Untuk produksi, stage build production dengan `--prod --skip-domain`, verifikasi URL immutable, lalu `vercel promote <URL>` dengan scope dan global-config yang sama. Jangan mempromosikan preview sebagai pengganti pengujian environment production.

## Rollback

Deployment sebelum game: dpl_FYWNRcUBobU6cN1w9WsFMfKvZMze, URL https://growtopia-clone-l3ptrth2b-thang-94e1.vercel.app. Rollback aplikasi dengan Vercel ke deployment tersebut jika perlu; jangan drop tabel atau menghapus akun/world baru. Rollback lama akan menampilkan UI lama termasuk mekanisme cloud lamanya, sehingga hanya pemulihan darurat.

## Batas

Rilis multiplayer mendukung 32 pemain biasa per world. Uji bertahap 8/16/32 pemain dan pengulangan 32 pemain lulus; ini bukan jaminan kapasitas MMO atau latensi nol. Recovery password belum tersedia. Musik menu dan efek klik memakai file yang diberikan pengguna. Tidak ada drain/error tracker eksternal; pemeriksaan manual memakai console browser dan log Vercel. Laporan uji tidak boleh berisi password, cookie, service key atau token sesi.

## Domain Ambatopia

Ambatopia harus tercatat sebagai domain Production proyek, bukan hanya alias ke URL Preview. `vercel domains add ambatopia.vercel.app growtopia-clone` sudah dijalankan. Alias manual ke Preview membuat script/audio diarahkan ke Vercel SSO; pemeriksaan resource wajib memakai redirect manual dan memastikan tipe JavaScript/audio asli. Jangan mematikan proteksi Preview untuk memperbaiki domain Production.

Laporan byte resource publik dan gate login ada di `verification/ambatopia/deployment-report.json`; bukti REA dan native engine ada di folder yang sama. Jalankan `node scripts/verify-ambatopia-deployment.mjs` setelah deploy.

Rilis perbaikan mobile: `dpl_3QPEWbf3pstacjn5PAReiTYuswXc`, immutable https://growtopia-clone-l6stqdfvd-thang-94e1.vercel.app, target Production. Domain utama https://ambatopia.vercel.app tetap tercatat pada proyek dan proteksi Preview tetap aktif. Rilis sebelumnya `dpl_wzMgghaozbgzbxdpHjSxuyJEpycz` dapat dipakai untuk rollback aplikasi; migrasi 009 kompatibel dengan UI sebelumnya.

Rincian root cause, pengujian dan batas verifikasi mobile ada di `verification/ambatopia/mobile-fixes.md`. Mode online memisahkan preview simulator dari data akun; pakaian/warna disimpan oleh parent ke profil, world tetap disimpan lewat RPC, dan halaman tool mandiri tetap memakai autosave snapshot.

Perbaikan gameplay native: migrasi 010–011 menambahkan terrain White Door, damage punch idempoten dan respawn dengan sequence barrier. Bukti REA, batas inspeksi lokal dan hasil pengujian tercatat di verification/ambatopia/gameplay-fixes.md. Migrasi sudah diterapkan; jangan jalankan ulang.

Rilis gameplay native: dpl_uiFHtHnoWHMek76Jt6feYLmGfwnM, Production https://growtopia-clone-99xw4frm8-thang-94e1.vercel.app, domain https://ambatopia.vercel.app. Build menyertakan 251 file statis terverifikasi. Untuk cache aksi tambahan pada checkout baru, jalankan node scripts/cache-gameplay-assets.mjs sebelum build; tile_removed.wav sudah disertakan sebagai aset lokal.

Migrasi 012 sudah diterapkan: game_sync_motion menggabungkan posisi tervalidasi dan delta event berurutan melalui RPC, tanpa fan-out gerakan melalui Postgres Changes. Satu engine bersama merender avatar lain. Klien lama perlu refresh untuk transport ini. Rollback frontend saja ke rilis lama tidak memulihkan transport gerakan lama. Bukti uji dan batasnya: verification/ambatopia/multiplayer-upgrade.md.

Rilis kapasitas 32 pemain: dpl_For7Gg44PEKDkytfbQ2duAwN7oVb, Production https://growtopia-clone-j594ob9xo-thang-94e1.vercel.app, domain https://ambatopia.vercel.app. Migrasi 012 dan frontend ini dipakai bersama.

Rilis UI mobile dan lock langsung: dpl_8bFQyvG9gPQt7jjtRX2FNLSt8F5q, Production https://growtopia-clone-52mtyytd1-thang-94e1.vercel.app, domain https://ambatopia.vercel.app. Migrasi 013 sudah diterapkan: pengumuman lock berurutan dan pemeriksaan posisi pemain. Bukti dan batas pengujian: verification/ambatopia/ui-mobile-v2.md.

Rilis punch White Door dan kontrol native: dpl_Bn8fAcjRbNmYBo6u8Ad3XRYX3ccY, Production https://growtopia-clone-rmuo4shf8-thang-94e1.vercel.app, domain https://ambatopia.vercel.app. Punch di posisi pintu keluar dari world; berjalan kembali saja tidak lagi keluar. Kontrol ikon asli, hold input independen dan posisi landscape diperbaiki. Tanpa migrasi database tambahan. Bukti: verification/ambatopia/door-controls.md.

Rilis animasi multiplayer, viewport HP dan musik Choose a World: dpl_HBHYoKAKNFjNBrhWDsmRFEeL7Z7s, Production https://growtopia-clone-6mnxv459a-thang-94e1.vercel.app. Tanpa migrasi database tambahan. Renderer avatar memakai pose native deterministik dan cache frame; sinkronisasi gerakan single-flight dengan interpolasi terbatas. Iframe renderer tersembunyi tidak lagi melebarkan halaman mobile. File choir.mp3 ditambahkan. Bukti, hasil jaringan dan batas pengujian: verification/ambatopia/motion-fixes.md. Semua pemain perlu refresh untuk memuat versi baru.

Rilis percepatan masuk world: dpl_jVh3sdBgmFqDXQjRVm6p45G6SEry, Production https://growtopia-clone-ha6jd519q-thang-94e1.vercel.app, domain https://ambatopia.vercel.app. Engine disiapkan di Choose a World dan dipakai ulang per akun; animasi berhenti saat engine diparkir dan logout membuangnya. State world, input dan menu lama dibersihkan saat berganti world. Tanpa migrasi database. 78 tes lulus; hasil lokal dan batas cold-load tercatat di verification/ambatopia/world-loading.md. Refresh halaman untuk memakai versi baru.

Rilis animasi menu: dpl_3h4vNV1NMLLdbjyvrMPkLDoiFKsG, Production https://growtopia-clone-mwzzk1hmu-thang-94e1.vercel.app. Maskot Amba berjalan bolak-balik, melompat dan mengayunkan kaki; judul mengambang tipis dan kepala bergerak kecil. Mengikuti Reduce menu motion. Tanpa migrasi atau perubahan akun/world. Bukti dan pengujian: verification/ambatopia/menu-animation.md.

Tambahan bubble AMBATUCKAAM: dpl_LFr79rEEw8bcD9b61mhxYEqw9W3X, Production https://growtopia-clone-qsuj3ltnp-thang-94e1.vercel.app. Bubble mengikuti jalan/lompatan maskot dan tetap terbaca saat berbalik arah. Verifikasi browser desktop/mobile dan produksi tercatat pada laporan menu-animation.md; tanpa migrasi database.

Rilis ekspresi wajah maskot: dpl_AVZB6nx2yLqqbkG6MBocDyymavY9, Production https://growtopia-clone-335i9ongu-thang-94e1.vercel.app. Kedipan singkat dengan jeda bervariasi dan gerakan bibir mencium memakai overlay dari amba-expression.png. Bukti browser desktop/mobile dan frame produksi: verification/ambatopia/menu-animation.md. Tidak ada perubahan database.

Rilis sidebar pixel: dpl_DvT8Zv8JbQ1xRgwD7dU4DCi8QEPM, Production https://growtopia-clone-90xbhf5tn-thang-94e1.vercel.app. Kartu kelompok Clothes/Look/Name dan 20 ikon pixel baru memakai tombol kategori native. Di HP kategori tetap horizontal dan berukuran 68×48 px. 78 tes lulus; bukti dan batas verifikasi ada di verification/ambatopia/pixel-sidebar.md. Tanpa migrasi database.

Rilis inventory, bars dan Options: dpl_AN1vhiA95fXvaHc3Bti2Z3W8rJBi, Production https://growtopia-clone-i53g75291-thang-94e1.vercel.app. Panel item/dock/navbar memakai desain slate-mint, bendera menggantikan EN/ID, Copy Link disembunyikan, toolbar online menjadi empat aksi utama + More. Pengaturan perangkat ditambah dan tersimpan lokal. 79 tes lulus. Bukti, batas volume/fullscreen dan catatan pemulihan lock QA ada di verification/ambatopia/chrome-options.md. Tanpa migrasi database.

Rilis palet sky dan chat geser: dpl_4cCkoQwzFDUQJUJqF5uzL6wqeANU, Production https://growtopia-clone-ezvuium3a-thang-94e1.vercel.app, domain https://ambatopia.vercel.app. Toolbar enam ikon, panel chat tarik, punch lock pemilik langsung, About Thaney dengan flowchart dan border putih tipis. Back/Enter World memakai teks putih. 81 tes lulus; 23 aset produksi cocok dengan build. Tanpa migrasi database. Bukti dan batas uji: verification/ambatopia/sky-ui.md. Refresh untuk memuat UI baru.

Rilis dock mobile dan chat stabil: dpl_AUtDD3QuPSChuUQ5G5wgRqcESY6Q, Production https://growtopia-clone-f6tacylqq-thang-94e1.vercel.app, domain https://ambatopia.vercel.app. Slot pakaian dan aksi dipisahkan, unequip 24 px, layout landscape diperbaiki, chat tidak mengikuti tinggi status punch, dan input keyboard mengabaikan fokus menu. 82 tes lulus; tanpa migrasi database. Bukti dan batas uji: verification/ambatopia/mobile-dock-fixes.md. Refresh halaman agar engine memakai UI terbaru.

Rilis hasil audit live: dpl_6CfMACMTyTA24stFsSeAtsJiZN5V, Production https://growtopia-clone-oxqv3i5dc-thang-94e1.vercel.app, domain https://ambatopia.vercel.app. Chat landscape tidak menutupi kontrol, overlay menu tidak tertutup chat, Hide/Resize Clothes berfungsi, indikator inventory tersinkron, Emotes dapat diakses dari More, dan timer gesture sebelumnya dibersihkan. 83 tes lulus; tanpa migrasi database. Pengujian memakai akun/world QA pada produksi, mencakup gerak, lompat, punch, place/break, lock, chat, ekspor dan kontrol dock. Bukti serta batas pengujian: verification/ambatopia/live-ui-qa.md.

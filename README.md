# StudyTrack

Aplikasi manajemen tugas kuliah untuk studi kasus Software Engineer Academya Arkavidia 11.0, dengan fitur **Reminder Tugas Mendekati Deadline**.

## Stack dan arsitektur

- Frontend: React + Vite.
- API: Express + JWT, dijalankan lokal melalui `backend/server.js` atau di Vercel melalui `api/index.js`.
- Database: PostgreSQL di Neon; akses menggunakan query SQL berparameter dan connection pool.
- Frontend dan API berada dalam satu project/domain Vercel. Request frontend tetap memakai `/api`.

## Menjalankan lokal

Gunakan Node.js 24 dan jalankan perintah dari **root repository**:

```bash
npm ci
```

Salin `backend/.env.example` menjadi `backend/.env`, lalu isi:

- `DATABASE_URL`: connection string pooled dari Neon > Connect (host mengandung `-pooler`, dengan SSL).
- `JWT_SECRET`: secret acak minimal 32 karakter, hanya untuk backend.
- `PORT`: default `4000`.

Buat tabel dan cek koneksi:

```bash
npm run db:migrate
npm run db:check
```

Jalankan API dan frontend di terminal terpisah:

```bash
npm run dev:api
```

```bash
npm run dev
```

Buka `http://localhost:5173`. Proxy Vite meneruskan `/api` ke `http://localhost:4000`.

Database baru dimulai kosong. Daftar akun melalui aplikasi, kemudian tambahkan mata kuliah dan tugas. Tidak ada akun demo yang dibuat otomatis atau endpoint HTTP untuk mereset database.

## Memindahkan data JSON lama

Jika sebelumnya memakai starter kit, file `backend/db.json` dapat diimpor **sekali ke database kosong**:

```bash
npm run db:import
```

Impor menyimpan ID dan password hash lama, mengubah waktu lokal menjadi waktu WIB yang eksplisit, serta menyesuaikan sequence ID. Semua perubahan dilakukan dalam satu transaksi. Perintah menolak database yang sudah berisi data dan tidak mengubah file JSON sumber. Jalankan migrasi tabel sebelum impor.

File JSON tidak lagi dibaca/ditulis oleh aplikasi. Akun demo `demo@studytrack.test` / `demo1234` hanya tersedia jika data starter kit tersebut diimpor; ganti password atau gunakan akun sendiri sebelum membagikan aplikasi yang berisi data pribadi.

## Deploy ke Vercel

1. Push perubahan setup ini ke GitHub, lalu import repository `firmanizzani/StudyTrack` di Vercel.
2. Pilih branch yang berisi perubahan ini. **Root Directory harus root repository (`.`), bukan `frontend` atau `backend`.**
3. Gunakan Framework Preset **Vite**, Install Command `npm ci`, Build Command `npm run build`, Output Directory `frontend/dist`, dan Node.js **24.x**. Konfigurasi build dan routing tersedia di `vercel.json`.
4. Tambahkan environment variable **server-side** berikut sebelum deploy:

   | Variable | Nilai |
   | --- | --- |
   | `DATABASE_URL` | Connection string Neon pooled lengkap |
   | `JWT_SECRET` | Secret acak minimal 32 karakter |

   Jangan memakai awalan `VITE_` untuk kedua secret ini. Jangan memasukkan file `.env` ke Git. Di Vercel, pilih environment yang akan digunakan, misalnya Production; gunakan branch/database Neon terpisah untuk Preview agar percobaan tidak mengubah data produksi.

5. Jalankan `npm run db:migrate` dari komputer dengan `DATABASE_URL` menuju database deploy. Migrasi tidak dijalankan otomatis saat build agar setiap deployment tidak mengubah skema.
6. Klik Deploy. Setelah environment variable diubah, lakukan redeploy.
7. Veriksa `/api/health`: hasil sukses adalah `{"status":"ok","database":"connected"}`. Uji registrasi/login, tambah mata kuliah, tambah tugas, ubah status, dan refresh langsung pada `/tasks` serta `/courses`.

`api/index.js` mengekspor aplikasi Express tanpa membuka port sendiri. Rewrite `/api/*` menuju Function; halaman React lainnya menuju `index.html`, sehingga membuka ulang `/tasks` tidak menghasilkan 404. API mengirim `Cache-Control: no-store` agar kategori deadline dan data pengguna tidak dicache bersama.

Neon menyimpan data secara permanen di luar filesystem Vercel. Connection pool berukuran kecil digunakan kembali dan dihubungkan dengan lifecycle Vercel melalui `attachDatabasePool`. Sertifikat dan hostname TLS tetap diverifikasi.

## Skema database

`backend/schema.sql` membuat tabel berikut tanpa menghapus tabel/data yang sudah ada:

- `users`: `id`, `nama`, `email`, `password_hash`; email unik tanpa membedakan huruf besar/kecil.
- `courses`: `id`, `user_id`, `name`, `kode`, `dosen`.
- `tasks`: `id`, `user_id`, `mata_kuliah_id`, `judul`, `deskripsi`, `deadline`, `status`, `created_at`.

Foreign key memastikan tugas hanya dapat terkait dengan mata kuliah pemilik yang sama. Menghapus mata kuliah juga menghapus tugasnya. Semua query aplikasi dibatasi menggunakan pengguna dari JWT, bukan `user_id` yang dikirim browser.

`deadline` dan `created_at` disimpan sebagai `TIMESTAMPTZ`. Input deadline tanpa zona waktu diperlakukan sebagai **WIB (UTC+7)**; API mengirim ISO UTC dan frontend menampilkan WIB. `deadline_category` serta `remaining_seconds` selalu dihitung saat request dan tidak menjadi kolom database.

## Aturan reminder

| Kondisi | Kategori dan tampilan |
| --- | --- |
| Belum selesai, sisa waktu 0 hingga kurang dari 24 jam | `urgent`, badge oranye Mendekati Deadline |
| Belum selesai, deadline sudah lewat | `overdue`, badge merah Terlambat |
| Belum selesai, sisa waktu tepat 24 jam atau lebih | `normal` |
| Status selesai | `completed`, badge hijau Selesai, tanpa peringatan deadline |

Urutan: **urgent → overdue → normal → completed**. Urgent/overdue menggunakan deadline menaik; normal/completed menggunakan `created_at` terbaru. ID menjadi pembeda terakhir. Aturan tugas selesai, posisi overdue, dan perlakuan tepat pada deadline adalah asumsi rancangan.

Daftar diperbarui setelah perubahan tugas, setiap 60 detik ketika halaman terlihat, dan saat kembali ke halaman. Tombol Perbarui tersedia untuk refresh manual. Badge dapat berubah terlambat hingga satu interval; tidak ada notifikasi email/push dalam lingkup fitur ini.

## API

Semua path di bawah `/api`. Selain health, register, dan login, endpoint memerlukan `Authorization: Bearer <token>`.

| Method | Path | Kegunaan |
| --- | --- | --- |
| GET | `/health` | Memeriksa koneksi database |
| POST | `/auth/register` | Membuat akun |
| POST | `/auth/login` | Mendapatkan token JWT |
| GET | `/auth/me` | Profil pengguna dari JWT |
| GET, POST | `/courses` | Daftar/tambah mata kuliah |
| PUT, DELETE | `/courses/:id` | Ubah/hapus mata kuliah |
| GET, POST | `/tasks` | Daftar/tambah tugas |
| GET, PUT, DELETE | `/tasks/:id` | Detail/ubah/hapus tugas |

`GET /tasks` mengembalikan `{ evaluated_at, tasks }`; setiap tugas menyertakan nama mata kuliah, kategori deadline, dan sisa waktu dalam detik.

## Verifikasi

```bash
npm test
npm run build
```

Pengujian otomatis meliputi batas 24 jam, pengurutan, format WIB, autentikasi, isolasi data antar-pengguna, validasi, penambahan bersamaan, serta penghapusan berantai. Tes API menjalankan query repository dan skema yang sebenarnya melalui emulator PostgreSQL `pg-mem`; koneksi Neon tidak diperlukan.

Untuk pemeriksaan langsung ke database yang dikonfigurasi:

```bash
npm run test:neon --workspace backend
```

Perintah ini membuat akun/data uji sementara, menjalankan alur API, lalu menghapus hanya akun yang dibuat oleh pengujian tersebut. Verifikasi deployment Vercel dan UI tetap dilakukan setelah deploy.

## Referensi deployment

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Functions Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel rewrites](https://vercel.com/docs/routing/rewrites)
- [Neon serverless connection pooling](https://neon.com/docs/guides/serverless-connection-pooling)

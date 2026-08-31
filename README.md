# Cekcok Kroma

Cekcok Kroma adalah *video editor* berkinerja tinggi, berbasis Tauri, React, dan Rust, dirancang sebagai alternatif ringan namun sangat fungsional layaknya Adobe Premiere Pro. Aplikasi ini dibangun dengan prinsip *anti-slop* dan arsitektur *Rust-first* untuk interaksi media tingkat lanjut.

## Fitur Utama & Arsitektur

### 1. Hybrid Video Engine (Zero-Lag Playback)
Alih-alih memaksa CLI FFmpeg untuk melakukan ekstraksi 60fps yang membebani CPU, Cekcok Kroma menggunakan pendekatan **Hybrid**:
- **Hardware-Accelerated Playback**: `Program Monitor` menggunakan komponen native Webview (`HTML5 <video>`) yang secara mulus disinkronisasikan ke `playheadPosition` secara reaktif. Memberikan *playback* super mulus tanpa *stutter* suara.
- **FFmpeg Timeline Thumbnails**: Mesin Rust (*Custom Protocol* `kromavideo://`) digunakan untuk mengekstrak spesifik *frame* via FFmpeg guna merender gambar di *Timeline* secara *real-time*.

### 2. Premiere Pro UI & UX
Semua antarmuka dibuat secara khusus (tanpa komponen generik) menyerupai estetika profesional NLE:
- Palet warna gelap abu-abu kaku (`#181818`, `#232323`).
- Garis batas tegas (tidak ada *rounded corners* berlebihan).
- *Global Keyboard Shortcuts*: Spasi (Play/Pause), V (Selection), C (Razor), Backspace/Delete (Hapus Klip), +/- (Zoom Timeline).
- *Contextual Cursors*: Mengganti *cursor* mouse menjadi pisau silet atau tangan geser sesuai alat yang aktif.

### 3. Tauri Native Dialog & Metadata (Rust First)
- Tidak menggunakan *dummy data*. Mengimpor langsung file video asli dari sistem operasi Anda melalui plugin dialog Tauri.
- Memanggil `ffprobe` secara diam-diam di sisi Rust untuk mendapatkan durasi video secara absolut tanpa harus melakukan *rendering* tersembunyi.

## Prasyarat
- Anda wajib menginstal **FFmpeg** (`ffmpeg` dan `ffprobe`) secara global di komputer Anda karena Rust Backend akan memanggil *executable* tersebut.
  ```bash
  brew install ffmpeg
  ```
- **Node.js** (v18+) dan **pnpm** terpasang.
- **Rust** Toolchain (Cargo) terpasang.

## Cara Menjalankan

1. Clone repositori:
   ```bash
   git clone https://github.com/jati251/cekcok-kroma.git
   cd cekcok-kroma
   ```
2. Instal dependensi frontend:
   ```bash
   pnpm install
   ```
3. Jalankan aplikasi dalam mode dev:
   ```bash
   pnpm tauri dev
   ```

## Development (Catatan Arsitektur)
- `src/stores/useEditorStore.ts`: Pusat segala *state* (Tracks, Tools, Playback).
- `src/App.tsx`: Menangani pendengar *Shortcut Global*.
- `src-tauri/src/lib.rs`: Menyimpan `kromavideo://` *custom protocol handler* yang mengeksekusi ekstraksi JPEG dari FFmpeg.

## Deployment
Pipeline CI/CD disiapkan untuk mem-build aplikasi ini dan mem-push *binary release*-nya ke S3/Minio, yang kemudian dapat diakses melalui fungsi *Updater* milik Tauri.

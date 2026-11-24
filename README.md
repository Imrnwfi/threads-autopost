# 🧵 Threads Autopost

Web app untuk **jana**, **jadual** dan **auto-post** ke Threads, lengkap dengan pencari **topik viral Malaysia**: kewangan, makanan, voucher & promo, bantuan kerajaan, info viral dan info AI.

![Skrin trending](docs/screenshot.png)

## Ciri-ciri

| | |
|---|---|
| 🔥 **Trending** | Cari topik viral dari Google Trends (MY) + Google News (BM & English, 48 jam terakhir). Tajuk serupa digabung, diberi skor ikut bilangan sumber, trafik carian & kebaharuan. |
| ✨ **Jana post** | AI tulis 1–5 variasi post (< 500 aksara) dengan hook, nada pilihan (santai/informatif/lucu/formal) & persona akaun anda. AI diarah supaya tidak reka fakta. |
| 🚀 **Auto post** | Terbit terus ke Threads melalui Threads API rasmi Meta. |
| 🗓️ **Jadual post** | Pilih tarikh & masa; penjadual semak setiap minit. |
| 🤖 **Autopilot** | Pada masa ditetapkan (cth. 9:00, 13:00, 20:30), app pilih topik viral bergilir ikut kategori → jana → simpan sebagai draf **atau** terus post. Topik yang sudah digunakan tak diulang (30 hari). |
| 🔐 **Selamat** | Log masuk dengan kata laluan, token Threads auto-diperbaharui sebelum luput (60 hari). |
| 📱 **Mesra telefon** | UI Bahasa Melayu, mod gelap/cerah automatik. |

## Keperluan

- Node.js 20 atau lebih baharu (atau Docker)
- Akaun Threads + Meta Developer App (percuma)
- API key AI: [Anthropic Claude](https://console.anthropic.com) **atau** mana-mana API serasi OpenAI (OpenAI, Google Gemini, Groq, OpenRouter)

## Pasang & jalankan

```bash
git clone https://github.com/<username>/threads-autopost.git
cd threads-autopost
npm install
cp .env.example .env   # isi nilai dalam .env
npm start
```

Buka `http://localhost:3000` dan log masuk dengan `APP_PASSWORD`.

### Dengan Docker

```bash
cp .env.example .env
docker compose up -d
```

Data (SQLite) disimpan dalam folder `./data`.

## Sediakan Threads API (Meta)

1. Pergi ke [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create App** → pilih use case **"Access the Threads API"**.
2. Dalam **Use cases → Customize**, tambah kebenaran `threads_basic` dan `threads_content_publish`.
3. Dalam **Settings** use case Threads, isi:
   - **Redirect Callback URL**: `https://domain-anda.com/auth/threads/callback` (mesti HTTPS)
   - Uninstall & Delete callback URL: boleh guna URL yang sama
4. **App roles → Roles → Add People → Threads Tester**, masukkan username Threads anda. Kemudian di app Threads: **Tetapan → Akaun → Kebenaran laman web → Jemputan** → terima.
5. Salin **Threads App ID** & **Threads App Secret** ke `.env` (`THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_REDIRECT_URI`).
6. Dalam web app: **Tetapan → Sambung akaun Threads**.

> 💡 **Cara pantas tanpa HTTPS:** dalam Meta App Dashboard → Threads API → **User Token Generator**, jana token untuk akaun tester anda dan tampal di **Tetapan → Tampal access token secara manual**. Jika `THREADS_APP_SECRET` ditetapkan, app akan cuba tukar ke token 60 hari secara automatik.

Untuk kegunaan peribadi (akaun anda sendiri sebagai tester), app boleh kekal dalam mod Development — tak perlu App Review.

## Sediakan AI

**Claude (default)**
```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

**Google Gemini (ada tier percuma)**
```env
AI_PROVIDER=openai
OPENAI_API_KEY=<gemini api key>
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.5-flash
```

**OpenAI / Groq / OpenRouter**: set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_BASE_URL` dan `AI_MODEL` mengikut penyedia.

## Deploy

App ini perlu **berjalan 24 jam** (penjadual guna cron dalam proses), jadi pilih:

- **VPS** (DigitalOcean, Contabo, Hetzner, dll.) dengan Docker Compose + Caddy/Nginx untuk HTTPS
- **Railway / Render / Fly.io** — pastikan pasang **persistent volume** ke `/app/data` supaya pangkalan data tak hilang

❌ Tidak sesuai untuk hosting serverless (Vercel, Netlify) kerana penjadual tak akan berjalan.

## Struktur projek

```
server.js          # Express server, API & log masuk
src/threads.js     # Klien Threads API (OAuth, token, publish)
src/trends.js      # Pencari topik viral (Google Trends + Google News RSS)
src/ai.js          # Jana post (Claude / API serasi OpenAI)
src/scheduler.js   # Penjadual post & Autopilot
src/db.js          # SQLite (better-sqlite3)
public/            # Frontend (HTML/CSS/JS tanpa framework)
test/              # Ujian (npm test)
```

## Tips & peringatan

- Mulakan Autopilot dalam mod **"Semak dulu"**. Tukar ke **Auto post** bila anda yakin dengan kualiti post.
- Untuk **bantuan kerajaan** dan **kewangan**, sentiasa semak fakta di laman rasmi sebelum post — AI hanya guna tajuk/ringkasan berita.
- Threads hadkan **250 post API setiap 24 jam** dan teks **500 aksara** setiap post.
- Ikut [Garis Panduan Komuniti Threads](https://help.instagram.com/769983657850450) — elakkan spam.

## Lesen

MIT

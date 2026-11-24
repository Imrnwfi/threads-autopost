# 🧵 Threads Post Generator

Web app untuk **cari topik viral Malaysia** dan **jana post Threads dengan AI**: kewangan, makanan, voucher & promo, bantuan kerajaan, info viral dan info AI.

App ini **tidak post ke Threads**. Anda semak draf, tekan **Buka di Threads** (app Threads dibuka dengan teks siap diisi), dan post sendiri. Tak perlu Meta Developer App atau Threads API.

![Skrin trending](docs/screenshot.png)

## Ciri-ciri

| | |
|---|---|
| 🔥 **Trending** | Topik viral dari Google Trends (MY) + Google News (BM & English, 48 jam terakhir). Tajuk serupa digabung dan diberi skor ikut bilangan sumber, trafik carian & kebaharuan. |
| ✨ **Jana post** | AI tulis 1–5 variasi post (< 500 aksara) dengan hook, nada pilihan (santai/informatif/lucu/formal) & persona akaun anda. AI diarah supaya tidak reka fakta. |
| 📝 **Draf** | Simpan, sunting, salin, atau **Buka di Threads** sekali tekan. Tanda "Sudah post" untuk jejak apa yang dah dikongsi. |
| 🤖 **Draf automatik** | (Pilihan) Pada masa ditetapkan, app jana draf daripada topik viral bergilir ikut kategori. Topik yang sudah digunakan tak diulang (30 hari). |
| 🔐 **Log masuk** | Dilindungi kata laluan. |
| 📱 **Mesra telefon** | UI Bahasa Melayu, mod gelap/cerah automatik. |

## Keperluan

- Node.js 20 atau lebih baharu (atau Docker)
- API key AI: [Anthropic Claude](https://console.anthropic.com) **atau** mana-mana API serasi OpenAI (OpenAI, Google Gemini, Groq, OpenRouter)

## Pasang & jalankan

```bash
git clone https://github.com/Imrnwfi/threads-autopost.git
cd threads-autopost
npm install
cp .env.example .env   # isi APP_PASSWORD & API key AI
npm start
```

Buka `http://localhost:3000` dan log masuk dengan `APP_PASSWORD`.

### Dengan Docker

```bash
cp .env.example .env
docker compose up -d
```

Data (SQLite) disimpan dalam folder `./data`.

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

- **Railway / Render / Fly.io**: pasang **persistent volume** ke `/app/data` supaya draf tak hilang.
- **VPS**: Docker Compose + Caddy/Nginx untuk HTTPS.
- Jika guna **Draf automatik**, server mesti berjalan 24 jam (hosting percuma yang "tidur" bila idle tak sesuai).

## Struktur projek

```
server.js          # Express server, API & log masuk
src/trends.js      # Pencari topik viral (Google Trends + Google News RSS)
src/ai.js          # Jana post (Claude / API serasi OpenAI)
src/scheduler.js   # Draf automatik
src/db.js          # SQLite (better-sqlite3)
public/            # Frontend (HTML/CSS/JS tanpa framework)
test/              # Ujian (npm test)
```

## Tips

- Untuk **bantuan kerajaan** dan **kewangan**, sentiasa semak fakta di laman rasmi sebelum post — AI hanya guna tajuk/ringkasan berita.
- Threads hadkan teks **500 aksara** setiap post; kaunter aksara ada pada setiap draf.

## Lesen

MIT

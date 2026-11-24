# 🧵 Threads Post Generator

Laman web untuk **cari topik viral Malaysia** dan **jana post Threads dengan AI**: kewangan, makanan, voucher & promo, bantuan kerajaan, info viral dan info AI.

👉 **Buka:** https://imrnwfi.github.io/threads-autopost/

App ini **tidak post ke Threads**. Anda semak draf, tekan **Buka di Threads** (Threads dibuka dengan teks siap diisi), dan post sendiri.

![Skrin trending](docs/screenshot.png)

## Ciri-ciri

| | |
|---|---|
| 🔥 **Trending** | Topik viral dari Google Trends (MY) + Google News (BM & English, 48 jam terakhir), dikemas kini **setiap jam** oleh GitHub Actions. Tajuk serupa digabung dan diberi skor ikut bilangan sumber, trafik carian & kebaharuan. |
| ✨ **Jana post** | AI tulis 1–5 variasi post (< 500 aksara) dengan hook, nada pilihan & persona akaun anda. AI diarah supaya tidak reka fakta. |
| 📝 **Draf** | Simpan, sunting, salin, atau **Buka di Threads** sekali tekan. Tanda "Sudah post" untuk jejak apa yang dah dikongsi. Eksport/import draf (JSON). |
| 🤖 **Pilihan AI** | Google Gemini (ada tier percuma), Anthropic Claude, atau mana-mana API serasi OpenAI (OpenAI, Groq, OpenRouter). |
| 🔒 **Privasi** | Tiada pelayan. API key & draf disimpan dalam browser anda sahaja dan dihantar terus ke penyedia AI. |

## Cara guna

1. Buka laman di atas (Chrome/Safari, telefon atau komputer).
2. **Tetapan** → pilih penyedia AI → tampal API key → Simpan.
   - Gemini: dapatkan key percuma di [Google AI Studio](https://aistudio.google.com/apikey).
3. **Trending** → tekan **✨ Jana post** pada topik yang menarik.
4. Edit jika perlu → **🧵 Buka di Threads** → post → tekan **✓ Sudah post**.

## Cara ia berfungsi

```
GitHub Actions (setiap jam)
  └─ scripts/fetch-trends.mjs → ambil RSS Google Trends & Google News
       └─ site/data/trends.json
            └─ deploy ke GitHub Pages bersama site/ (HTML/CSS/JS)

Browser anda
  ├─ baca data/trends.json
  ├─ panggil API AI terus (guna key anda)
  └─ simpan draf dalam localStorage
```

## Pasang sendiri (fork)

1. Fork repo ini.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions** → aktifkan workflow → jalankan **"Kemas kini trending & deploy ke GitHub Pages"** (Run workflow).
4. Laman anda: `https://<username>.github.io/<nama-repo>/`

> Nota: GitHub mematikan workflow berjadual dalam repo awam selepas 60 hari tanpa aktiviti. Jika trending berhenti dikemas kini, buka tab **Actions** dan aktifkan semula.

### Jalankan di komputer

```bash
npm install
npm run dev      # ambil trending + buka http://localhost:3000
npm test
```

## Struktur projek

```
site/                     # Laman web (index.html, app.js, style.css)
lib/trends.js             # Logik cari & skor topik viral
scripts/fetch-trends.mjs  # Dijalankan oleh GitHub Actions
.github/workflows/pages.yml
test/
```

## Tips

- Untuk **bantuan kerajaan** dan **kewangan**, sentiasa semak fakta di laman rasmi sebelum post — AI hanya guna tajuk/ringkasan berita.
- Draf disimpan per browser. Guna **Eksport/Import** di Tetapan untuk pindah ke peranti lain.

## Lesen

MIT

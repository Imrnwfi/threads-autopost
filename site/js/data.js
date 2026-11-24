// Data statik: bank hook, musim jualan & perayaan, pelan mingguan lalai.

export const HOOK_GROUPS = {
  ingin: {
    label: '🤔 Rasa ingin tahu',
    hooks: [
      'Ramai tak tahu pasal [X] ni…',
      'Aku baru tahu [X] dan rasa menyesal tak tahu awal.',
      'Ini sebab sebenar kenapa [X].',
      'Benda kecil ni ubah cara aku [X].',
      'Tak ramai yang perasan [X], tapi…',
      'Rahsia [X] yang jarang orang kongsi:',
      'Kenapa tiada siapa beritahu pasal [X] ni?',
      'Satu benda yang aku harap aku tahu masa umur 20:',
    ],
  },
  senarai: {
    label: '📋 Senarai',
    hooks: [
      '[N] benda yang aku tak akan beli lagi lepas belajar [X]:',
      '[N] tips [X] yang betul-betul berkesan:',
      '[N] kesilapan [X] yang ramai buat (no. 3 paling biasa):',
      '[N] app/barang bawah RM[harga] yang ubah hidup aku:',
      'Simpan post ni. [N] cara [X]:',
      '[N] tanda kau perlu [X] sekarang:',
      'Senarai [X] paling berbaloi tahun ni 🧵',
    ],
  },
  amaran: {
    label: '⚠️ Amaran',
    hooks: [
      'Stop buat [X] kalau kau nak [Y].',
      'Jangan [X] sebelum baca ni.',
      'Hati-hati: [X] ni boleh buat kau rugi.',
      'Kalau kau masih [X], baca ni dulu.',
      'Kesilapan [X] yang buat ramai rugi duit:',
      'Ini sebab [X] kau tak menjadi.',
    ],
  },
  cerita: {
    label: '🎬 Cerita / POV',
    hooks: [
      'POV: kau baru sedar [X].',
      'Semalam aku [X], dan apa jadi lepas tu…',
      'Dulu aku [X]. Sekarang aku [Y]. Ini yang berubah:',
      'Kisah benar: [X].',
      'Tahun lepas aku [X]. Tahun ni lain cerita.',
      'Aku cuba [X] selama 7 hari. Ini hasilnya:',
      'Bila mak tanya "[X]?" 😅',
    ],
  },
  soalan: {
    label: '❓ Soalan',
    hooks: [
      'Korang [X] atau [Y]?',
      'Jujur, berapa ramai yang [X]?',
      'Kalau ada RM[harga], korang pilih [X] atau [Y]?',
      'Siapa lagi yang [X]? 🙋',
      'Apa satu benda yang korang menyesal [X]?',
      'Betul ke [X]? Jom bincang.',
    ],
  },
  berani: {
    label: '🔥 Pendapat berani',
    hooks: [
      'Unpopular opinion: [X].',
      'Aku akan cakap benda yang orang tak berani cakap: [X].',
      '[X] tu overrated. Ini sebabnya:',
      'Hot take: [X] lebih penting dari [Y].',
      'Aku tak setuju dengan [X], dan ini sebabnya.',
    ],
  },
  affiliate: {
    label: '🛍️ Affiliate',
    hooks: [
      'Barang paling berbaloi aku jumpa bulan ni:',
      'Bawah RM[harga] tapi rasa macam barang mahal.',
      'Kalau kau selalu [masalah], benda ni untuk kau.',
      'Rupanya ini yang orang guna untuk [X] selama ni 😮',
      'Benda ni patut ada dalam setiap rumah:',
      'Cart aku minggu ni, dan sebab aku beli:',
      'Jangan beli [X] mahal-mahal. Cuba ni dulu:',
      'Hadiah bawah RM[harga] yang confirm orang suka:',
      'Check out sebelum harga naik balik 👀',
      'Benda viral ni betul ke berbaloi? Ini pendapat aku:',
    ],
  },
  info: {
    label: '📢 Info / berita',
    hooks: [
      'Info penting untuk [X]:',
      'Baru keluar: [X]. Ini yang kau perlu tahu 🧵',
      'Ringkasan [X] dalam 1 minit:',
      'Update terkini [X] — semak sebelum terlepas.',
      'Ramai keliru pasal [X]. Aku terangkan ringkas:',
      'Tarikh penting [X] yang kau kena ingat:',
    ],
  },
};

export const ALL_HOOKS = Object.values(HOOK_GROUPS).flatMap((g) => g.hooks);

// ---------- Musim jualan & perayaan ----------
// Tarikh perayaan bertanda * tertakluk kepada pengumuman rasmi.
const FIXED_EVENTS = [
  { date: '2026-12-25', name: 'Krismas', emoji: '🎄', type: 'festival', ideas: ['Idea hadiah bawah RM50', 'Dekorasi rumah bajet', 'Resepi kek & biskut Krismas'] },
  { date: '2026-12-31', name: 'Malam Tahun Baru', emoji: '🎆', type: 'festival', ideas: ['Azam kewangan 2027', 'Rumusan barang terbaik 2026', 'Planner & alat produktiviti'] },
  { date: '2027-01-01', name: 'Tahun Baru 2027', emoji: '🎉', type: 'festival', ideas: ['Azam & matlamat', 'Bajet tahunan', 'Barang persiapan sekolah'] },
  { date: '2027-02-06', name: 'Tahun Baru Cina', emoji: '🧧', type: 'festival', ideas: ['Pakaian merah & aksesori', 'Kuih & snek CNY', 'Ang pau & kewangan'] },
  { date: '2027-02-08', name: 'Awal Ramadan*', emoji: '🌙', type: 'festival', ideas: ['Barang dapur untuk sahur', 'Bajet bazar Ramadan', 'Botol air & bekas makanan'] },
  { date: '2027-03-10', name: 'Hari Raya Aidilfitri*', emoji: '🕌', type: 'festival', ideas: ['Baju raya & kain', 'Kuih raya & bekas', 'Duit raya & sampul', 'Dekorasi rumah raya'] },
  { date: '2027-05-01', name: 'Hari Pekerja', emoji: '👷', type: 'festival', ideas: ['Barang kerja & ofis', 'Tips gaji & kewangan', 'Cuti panjang & percutian'] },
  { date: '2027-08-31', name: 'Hari Kebangsaan', emoji: '🇲🇾', type: 'festival', ideas: ['Produk tempatan Malaysia', 'Jualan Merdeka', 'Sejarah & fakta ringkas'] },
  { date: '2027-09-16', name: 'Hari Malaysia', emoji: '🇲🇾', type: 'festival', ideas: ['Produk Sabah & Sarawak', 'Makanan seluruh Malaysia'] },
  { date: '2027-10-28', name: 'Deepavali*', emoji: '🪔', type: 'festival', ideas: ['Pakaian tradisional', 'Muruku & kuih', 'Lampu & dekorasi'] },
];

const SALE_IDEAS = {
  double: ['Senarai barang dalam cart', 'Barang berbaloi bawah RM50', 'Tips beli waktu sale (voucher + coins)', 'Barang yang JANGAN beli waktu sale'],
  payday: ['Barang wajib selepas gaji', 'Tips bajet gaji 50/30/20', 'Treat diri bawah RM30'],
  mid: ['Barang rumah bawah RM20', 'Barang dapur berbaloi'],
  black: ['Gajet & elektronik paling berbaloi', 'Hadiah awal Krismas'],
};

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Senarai acara (jualan + perayaan) dalam tempoh `days` hari dari `from`. */
export function upcomingEvents(from = new Date(), days = 120) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(start.getTime() + days * 86400000);
  const ev = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const y = d.getFullYear(), m = d.getMonth();
    const mm = m + 1;
    ev.push({ date: iso(new Date(y, m, mm)), name: `${mm}.${mm} Sale`, emoji: '🛒', type: 'sale', ideas: SALE_IDEAS.double });
    ev.push({ date: iso(new Date(y, m, 15)), name: 'Mid-Month Sale', emoji: '🏷️', type: 'sale', ideas: SALE_IDEAS.mid });
    ev.push({ date: iso(new Date(y, m, 25)), name: 'Payday Sale', emoji: '💸', type: 'sale', ideas: SALE_IDEAS.payday });
    if (m === 10) { // Black Friday: Jumaat terakhir November
      const last = new Date(y, 11, 0);
      const bf = new Date(y, 10, last.getDate() - ((last.getDay() + 2) % 7));
      ev.push({ date: iso(bf), name: 'Black Friday', emoji: '🖤', type: 'sale', ideas: SALE_IDEAS.black });
    }
    if (m === 4) { // Hari Ibu: Ahad ke-2 Mei
      const first = new Date(y, 4, 1);
      ev.push({ date: iso(new Date(y, 4, 1 + ((7 - first.getDay()) % 7) + 7)), name: 'Hari Ibu', emoji: '💐', type: 'festival', ideas: ['Hadiah untuk mak', 'Barang dapur idaman mak'] });
    }
    if (m === 5) { // Hari Bapa: Ahad ke-3 Jun
      const first = new Date(y, 5, 1);
      ev.push({ date: iso(new Date(y, 5, 1 + ((7 - first.getDay()) % 7) + 14)), name: 'Hari Bapa', emoji: '👔', type: 'festival', ideas: ['Hadiah untuk ayah', 'Gajet & alatan'] });
    }
  }
  ev.push(...FIXED_EVENTS);
  const s = iso(start), e = iso(end);
  return ev.filter((x) => x.date >= s && x.date <= e).sort((a, b) => a.date.localeCompare(b.date));
}

export function daysUntil(dateStr, from = new Date()) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((new Date(y, m - 1, d) - a) / 86400000);
}

// ---------- Pelan mingguan lalai ----------
export const DAY_NAMES = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
export const SLOT_TYPES = {
  affiliate: { label: '🛍️ Affiliate', studio: { mode: 'affiliate' } },
  multi: { label: '🛍️ Senarai produk', studio: { mode: 'affiliate', multi: true } },
  viral: { label: '🔥 Topik viral', studio: { mode: 'topic' } },
  thread: { label: '🧵 Bebenang', studio: { mode: 'topic', format: 'thread' } },
  finance: { label: '💰 Kewangan', studio: { mode: 'topic', category: 'finance' } },
  food: { label: '🍜 Makanan', studio: { mode: 'topic', category: 'food' } },
  bantuan: { label: '🏛️ Bantuan', studio: { mode: 'topic', category: 'bantuan' } },
  ai: { label: '🤖 Info AI', studio: { mode: 'topic', category: 'ai' } },
  series: { label: '📚 Siri', studio: { mode: 'topic' } },
  bebas: { label: '✍️ Bebas', studio: { mode: 'topic' } },
};
export const DEFAULT_PLAN = {
  0: [{ type: 'thread', time: '20:30' }],
  1: [{ type: 'finance', time: '12:30' }, { type: 'affiliate', time: '21:00' }],
  2: [{ type: 'viral', time: '13:00' }],
  3: [{ type: 'affiliate', time: '21:00' }],
  4: [{ type: 'ai', time: '12:30' }, { type: 'viral', time: '20:30' }],
  5: [{ type: 'bantuan', time: '11:00' }],
  6: [{ type: 'multi', time: '10:00' }],
};

// ---------- Label warna draf ----------
export const LABELS = {
  merah: { name: 'Penting', color: '#ef4444' },
  kuning: { name: 'Minggu depan', color: '#f59e0b' },
  hijau: { name: 'Siap', color: '#10b981' },
  biru: { name: 'Idea', color: '#3b82f6' },
  ungu: { name: 'Affiliate kuat', color: '#8b5cf6' },
  pink: { name: 'Peribadi', color: '#ec4899' },
};

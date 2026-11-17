// Makes the Developa Facebook ad banners (PNG) with the same brand look as the site.
// Run: node marketing/make-facebook-ads.cjs   (needs the sharp package already in node_modules)
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, 'facebook-ads');
const F = 'font-family="Segoe UI, Arial, Helvetica, sans-serif"';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const D = 'M46 44 H92 C126 44 146 66 146 96 C146 126 126 148 92 148 H46 Z M74 68 V124 H90 C108 124 118 113 118 96 C118 79 108 68 90 68 Z';
const logo = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 192})"><rect width="192" height="192" rx="44" fill="#fff"/><path fill-rule="evenodd" fill="url(#brand)" d="${D}"/><circle cx="158" cy="142" r="9" fill="#f59e0b"/></g>`;
const wordmark = (x, y, size) => `<text x="${x}" y="${y}" ${F} font-size="${size}" font-weight="800" fill="#fff">developa<tspan fill="#fde68a">.me</tspan></text>`;

function phone(x, y, w) {
  const k = w / 300;
  const tiles = [['Ankara tote', '₦12,500', '#fbbf24'], ['Beaded set', '₦8,000', '#f472b6'], ['Linen shirt', '₦15,000', '#34d399'], ['Leather belt', '₦6,500', '#818cf8']];
  const tile = (i) => {
    const cx = 20 + (i % 2) * 130, cy = 196 + Math.floor(i / 2) * 118;
    const [n, p, c] = tiles[i];
    return `<rect x="${cx}" y="${cy}" width="120" height="108" rx="14" fill="#fff" stroke="#e7def7"/><rect x="${cx + 8}" y="${cy + 8}" width="104" height="60" rx="10" fill="${c}" opacity=".35"/><text x="${cx + 10}" y="${cy + 88}" ${F} font-size="13" font-weight="700" fill="#1a1030">${n}</text><text x="${cx + 10}" y="${cy + 103}" ${F} font-size="12" fill="#5f5580">${p}</text>`;
  };
  return `<g transform="translate(${x} ${y}) scale(${k})">
    <rect width="300" height="640" rx="46" fill="#1a1030"/>
    <rect x="8" y="8" width="284" height="624" rx="40" fill="#fbf8ff"/>
    <rect x="110" y="16" width="80" height="14" rx="7" fill="#1a1030"/>
    <text x="22" y="64" ${F} font-size="19" font-weight="800" fill="#1a1030">Ada's Store</text>
    <circle cx="262" cy="58" r="15" fill="#6d28d9"/><text x="262" y="63" text-anchor="middle" ${F} font-size="14" font-weight="800" fill="#fff">2</text>
    <rect x="20" y="82" width="260" height="96" rx="18" fill="url(#brand)"/>
    <text x="36" y="122" ${F} font-size="20" font-weight="800" fill="#fff">New this week</text>
    <text x="36" y="148" ${F} font-size="13" fill="#fff" opacity=".9">Order on WhatsApp or pay online</text>
    ${[0, 1, 2, 3].map(tile).join('')}
    <rect x="20" y="440" width="260" height="46" rx="23" fill="#6d28d9"/>
    <text x="150" y="469" text-anchor="middle" ${F} font-size="16" font-weight="800" fill="#fff">Pay online</text>
  </g>`;
}

const defs = (w, h) => `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c1d95"/><stop offset=".55" stop-color="#a21caf"/><stop offset="1" stop-color="#f43f5e"/></linearGradient>
  <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset=".6" stop-color="#c026d3"/><stop offset="1" stop-color="#f43f5e"/></linearGradient>
  <filter id="soft"><feGaussianBlur stdDeviation="60"/></filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#000" flood-opacity=".35"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<circle cx="${w * 0.9}" cy="${h * 0.12}" r="${Math.min(w, h) * 0.3}" fill="#fbbf24" opacity=".28" filter="url(#soft)"/>
<circle cx="${w * 0.05}" cy="${h * 0.85}" r="${Math.min(w, h) * 0.32}" fill="#38bdf8" opacity=".22" filter="url(#soft)"/>`;

const lines = (arr, x, y, size, lh) => arr.map((t, i) => `<text x="${x}" y="${y + i * lh}" ${F} font-size="${size}" font-weight="800" fill="#fff" letter-spacing="-1.5">${esc(t)}</text>`).join('');
const para = (arr, x, y, size, lh) => arr.map((t, i) => `<text x="${x}" y="${y + i * lh}" ${F} font-size="${size}" fill="#fff" fill-opacity=".92">${esc(t)}</text>`).join('');
const chip = (x, y, t, size) => { const wd = Math.round(t.length * size * 0.56 + size * 1.6); return `<g><rect x="${x}" y="${y}" width="${wd}" height="${size * 2}" rx="${size}" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-opacity=".35"/><text x="${x + size * 0.8}" y="${y + size * 1.32}" ${F} font-size="${size * 0.9}" font-weight="700" fill="#fff">${esc(t)}</text></g>`; };
const cta = (x, y, w, h, t) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#fff"/><text x="${x + w / 2}" y="${y + h * 0.64}" text-anchor="middle" ${F} font-size="${h * 0.36}" font-weight="800" fill="#6d28d9">${esc(t)}  →</text></g>`;

const COPY = {
  a: { head: ['Your online store,', 'live today.'], sub: ['No coding. No designer.', 'Pick a look, add your products', 'and share your link.'], chips: ['Free to start', '3 days of Pro free'], cta: 'Create my free site' },
  b: { head: ['Sell on WhatsApp', 'and online.'], sub: ['Build your website in minutes', 'with your own address:', 'yourname.developa.me'], chips: ['No coding', 'Pay online'], cta: 'Start free today' },
};

const LAYOUTS = {
  // 4:5 feed: the best size on phones
  feed: (c) => {
    const w = 1080, h = 1350;
    return { w, h, svg: `${defs(w, h)}${logo(80, 80, 84)}${wordmark(182, 138, 46)}
      ${lines(c.head, 80, 330, 98, 112)}
      ${para(c.sub, 80, 520, 38, 54)}
      ${chip(80, 720, c.chips[0], 24)}${chip(80, 800, c.chips[1], 24)}
      <g filter="url(#shadow)">${phone(620, 600, 400)}</g>
      ${cta(70, 1120, 520, 124, c.cta)}` };
  },
  // 1:1 square
  square: (c) => {
    const w = 1080, h = 1080;
    return { w, h, svg: `${defs(w, h)}${logo(70, 70, 76)}${wordmark(164, 123, 42)}
      ${lines(c.head, 70, 290, 80, 92)}
      ${chip(70, 480, c.chips[0], 22)}${chip(70, 550, c.chips[1], 22)}
      <g filter="url(#shadow)">${phone(660, 360, 340)}</g>
      ${cta(70, 850, 540, 112, c.cta)}` };
  },
  // 9:16 story or reel: text kept out of the top 250 and bottom 340 px
  story: (c) => {
    const w = 1080, h = 1920;
    return { w, h, svg: `${defs(w, h)}${logo(90, 280, 96)}${wordmark(206, 346, 52)}
      ${lines(c.head, 90, 560, 106, 122)}
      ${para(c.sub, 90, 810, 42, 60)}
      ${chip(90, 1010, c.chips[0], 26)}${chip(330, 1010, c.chips[1], 26)}
      <g filter="url(#shadow)">${phone(300, 1330, 480)}</g>
      ${cta(150, 1130, 780, 132, c.cta)}` };
  },
  // 1.91:1 link ad
  link: (c) => {
    const w = 1200, h = 628;
    return { w, h, svg: `${defs(w, h)}${logo(60, 50, 64)}${wordmark(136, 95, 34)}
      ${lines(c.head, 60, 220, 62, 72)}
      ${chip(60, 380, c.chips[0], 18)}${chip(240, 380, c.chips[1], 18)}
      ${cta(60, 465, 420, 92, c.cta)}
      <g filter="url(#shadow)">${phone(820, 70, 290)}</g>` };
  },
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const [vk, c] of Object.entries(COPY)) {
    for (const [lk, fn] of Object.entries(LAYOUTS)) {
      const { w, h, svg } = fn(c);
      const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${svg}</svg>`;
      const file = path.join(out, `developa-${lk}-${w}x${h}-${vk}.png`);
      await sharp(Buffer.from(doc), { density: 72 }).resize(w, h).png({ compressionLevel: 9 }).toFile(file);
      console.log(path.basename(file));
    }
  }
})();

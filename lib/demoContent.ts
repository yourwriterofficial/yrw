import type { SiteTemplate } from '@/lib/siteTemplates';
import type { ForumThread, SiteProduct } from '@/lib/forums';

/**
 * Sample content for theme previews and the template gallery. A template ships with only a few sample
 * items; a preview must look like a real, busy site, so this fills it out per kind of business and draws
 * product artwork locally (no external images, no network). Nothing here is saved anywhere.
 */

export type Archetype =
  | 'market' | 'fashion' | 'digital' | 'service' | 'creative' | 'beauty' | 'food' | 'property' | 'course' | 'events'
  | 'forum' | 'news' | 'social' | 'blog';

const ARCH: Record<string, Archetype> = {
  'jumia-mart': 'market', 'temu-deals': 'market', 'premium-marketplace': 'market', 'buy-and-sell': 'market', 'store-community': 'market',
  'retail-store': 'fashion', 'shopify-clean': 'fashion', 'shopify-fashion': 'fashion', 'premium-luxury': 'fashion',
  'digital-shop': 'digital', 'selar-creator': 'digital', 'subscription-share': 'digital',
  'services-booking': 'service', 'wp-business': 'service', 'premium-agency': 'service',
  'portfolio-creative': 'creative', 'creator-studio': 'creative', 'photographer-studio': 'creative',
  'salon-beauty': 'beauty', 'restaurant-food': 'food', 'premium-restaurant': 'food', 'real-estate': 'property',
  'online-academy': 'course', 'selar-course': 'course', 'events-tickets': 'events',
  'community-forum': 'forum', 'forum-board': 'forum', 'news-broadsheet': 'news', 'news-tabloid': 'news', 'news-portal': 'news', 'news-business': 'news',
  'social-feed': 'social', 'social-micro': 'social', 'social-reels': 'social', 'blog-magazine': 'blog', 'wp-blog': 'blog', 'wp-magazine': 'blog',
};
export const archetypeOf = (t: SiteTemplate): Archetype => ARCH[t.id] ?? (t.site_mode === 'forum' ? 'forum' : 'market');

const BRANDS: Record<Archetype, string[]> = {
  market: ['Kora Mart', 'Zuri Deals', 'Naija Basket'], fashion: ['Adire & Co', 'Lagos Loft', 'Maison Ayo'], digital: ['Pixel Pantry', 'Learnly Hub', 'Studio Vault'],
  service: ['Brightpath Consulting', 'Ndidi & Partners', 'Clearview Studio'], creative: ['Tola Creates', 'Frame & Light', 'Studio Ewa'], beauty: ['Glow Haven', 'Amara Beauty Lounge', 'Velvet Touch'],
  food: ['Mama Nkechi Kitchen', 'Crumb & Co', 'Suya Republic'], property: ['Keystone Homes', 'Prime Address', 'Haven Estates'], course: ['Skillset Academy', 'Bright Minds Online', 'Ladder Learning'],
  events: ['Pulse Tickets', 'GoLive Events', 'Afrobeat Nights'], forum: ['The Village Square', 'Naija Talk', 'Open Circle'], news: ['The Daily Ledger', 'Metro Dispatch', 'Business Pulse'],
  social: ['Vibe Feed', 'Chatterbox', 'Clip Society'], blog: ['Notes from Lagos', 'The Thoughtful Desk', 'Everyday Stories'],
};
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
export const brandFor = (t: SiteTemplate) => { const a = BRANDS[archetypeOf(t)]; return a[hash(t.id) % a.length]; };

/* ---------- product artwork ---------- */

const EMOJI: [RegExp, string][] = [
  [/phone|tablet|iphone|android/i, '📱'], [/earbud|airpod|headphone|audio|speaker/i, '🎧'], [/laptop|computer|pc/i, '💻'], [/watch/i, '⌚'], [/tv|television/i, '📺'],
  [/shoe|sneaker|footwear/i, '👟'], [/dress|gown|ankara|adire|fabric|lookbook/i, '👗'], [/shirt|tee|polo|chino|trouser|jean|hoodie|wear|fashion/i, '👕'], [/bag|handbag|tote/i, '👜'],
  [/blender|kitchen|cook|pot|pan|home/i, '🍳'], [/fan|cooler|fridge|appliance/i, '🧊'], [/jollof|rice|meal|lunch|dinner|menu|food|suya|grill|chicken/i, '🍛'], [/cake|bake|pastry|bread|cupcake/i, '🎂'],
  [/drink|juice|zobo|coffee|tea/i, '🥤'], [/hair|braid|wig|salon|barber/i, '💇'], [/nail|manicure|pedicure/i, '💅'], [/facial|spa|massage|skin|beauty|makeup/i, '🧴'],
  [/photo|camera|shoot|portrait|wedding|session/i, '📷'], [/video|film|reel|edit|production/i, '🎬'], [/logo|brand|design|graphic|canva|template|preset/i, '🎨'], [/web|app|code|software|licen[cs]e/i, '🖥️'],
  [/ebook|book|guide|read|pdf/i, '📘'], [/course|class|learn|lesson|bootcamp|academy|training|mentor/i, '🎓'], [/ticket|event|concert|festival|show|party/i, '🎟️'],
  [/flat|apartment|house|home|duplex|rent|land|estate|property|office/i, '🏠'], [/consult|strategy|audit|coaching|session|call|advice/i, '💼'], [/music|beat|song|album/i, '🎵'],
  [/plan|member|subscription|premium|pro\b/i, '⭐'],
];
const FALLBACK_EMOJI: Record<string, string> = { physical: '📦', digital: '💾', service: '🛎️' };

function emojiFor(title: string, category: string, type: string): string {
  const text = `${title} ${category}`;
  for (const [re, e] of EMOJI) if (re.test(text)) return e;
  return FALLBACK_EMOJI[type] ?? '✨';
}

/** A soft, designed-looking tile: layered gradient + shapes + a pictogram, tinted from the theme colour. */
export function artFor(title: string, category: string, type: string, accent: string, w = 640, h = 480): string {
  const n = hash(title + category);
  const rot = (n % 40) - 20;
  const e = emojiFor(title, category, type);
  const x1 = 15 + (n % 50), y1 = 20 + ((n >> 3) % 50);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".30"/><stop offset="1" stop-color="${accent}" stop-opacity=".07"/></linearGradient>
<radialGradient id="r" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="#f6f7fb"/><rect width="${w}" height="${h}" fill="url(#g)"/>
<circle cx="${x1 * 6}" cy="${y1 * 4}" r="${150 + (n % 60)}" fill="${accent}" opacity=".10"/>
<circle cx="${w - x1 * 4}" cy="${h - y1 * 3}" r="${110 + (n % 50)}" fill="${accent}" opacity=".12"/>
<g transform="rotate(${rot} ${w / 2} ${h / 2})"><rect x="${w / 2 - 120}" y="${h / 2 - 120}" width="240" height="240" rx="56" fill="#fff" opacity=".55"/></g>
<circle cx="${w / 2}" cy="${h / 2}" r="130" fill="url(#r)"/>
<text x="50%" y="52%" font-size="150" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif">${e}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ---------- product pools ---------- */

type P = [title: string, category: string, price: number, compareAt?: number, type?: SiteProduct['product_type']];
const POOLS: Record<string, P[]> = {
  market: [
    ['Oraimo FreePods 4 ANC Earbuds', 'Electronics', 28500, 38000], ['Redmi Note 13 · 128GB', 'Phones & Tablets', 189000, 215000], ['Smart Watch Series 9', 'Electronics', 34900, 49900],
    ['Men’s Slim Chinos & Polo Bundle', 'Fashion', 24500, 32000], ['Ankara Maxi Dress', 'Fashion', 18500, 25000], ['Nutri Blender 1.5L', 'Home & Kitchen', 21900, 29900],
    ['Standing Fan 18"', 'Home & Kitchen', 32500, 41000], ['Wireless Bluetooth Speaker', 'Electronics', 15900, 22000], ['Leather Crossbody Bag', 'Fashion', 16800, 23000],
    ['Non-stick Cookware Set (7pc)', 'Home & Kitchen', 38900, 52000], ['Tecno Spark 20 Pro', 'Phones & Tablets', 142000, 165000], ['Rechargeable Desk Lamp', 'Home & Kitchen', 9800, 14500],
  ],
  fashion: [
    ['Adire Wrap Dress', 'Women', 32000], ['Linen Camp Shirt', 'Men', 21500], ['Everyday Tote Bag', 'Accessories', 18900, 24000], ['Classic White Sneakers', 'Shoes', 36500],
    ['Ankara Co-ord Set', 'Women', 41000, 52000], ['Tailored Trousers', 'Men', 27500], ['Beaded Statement Necklace', 'Accessories', 12500], ['Cotton Oversized Hoodie', 'Men', 24000, 30000],
    ['Satin Slip Skirt', 'Women', 19500], ['Leather Sandals', 'Shoes', 22500], ['Silk Headwrap', 'Accessories', 8900], ['Denim Jacket', 'Women', 34500, 42000],
  ],
  digital: [
    ['Freelancer’s Notion Workspace', 'Templates', 7500, 12000, 'digital'], ['Instagram Reels Cover Pack (60)', 'Design', 5500, undefined, 'digital'], ['Lightroom Presets · Warm Lagos', 'Presets', 9000, 15000, 'digital'],
    ['Start a Business in Nigeria · Ebook', 'Ebooks', 4500, undefined, 'digital'], ['Social Media Content Planner', 'Templates', 6000, undefined, 'digital'], ['Logo Starter Kit (Canva)', 'Design', 8500, 12000, 'digital'],
    ['Budgeting Spreadsheet Pro', 'Templates', 3500, undefined, 'digital'], ['Beat Pack Vol. 2 · Afro Pop', 'Audio', 12000, 18000, 'digital'], ['CV & Cover Letter Bundle', 'Templates', 3000, undefined, 'digital'],
  ],
  service: [
    ['Business Strategy Session (90 min)', 'Consulting', 45000, undefined, 'service'], ['Brand Identity Package', 'Design', 150000, 190000, 'service'], ['Website Audit & Fix List', 'Digital', 65000, undefined, 'service'],
    ['Monthly Social Media Management', 'Marketing', 120000, undefined, 'service'], ['Company Registration Support', 'Legal & Admin', 55000, undefined, 'service'], ['1:1 Career Coaching (3 sessions)', 'Coaching', 40000, 50000, 'service'],
    ['Financial Model & Pitch Deck', 'Consulting', 180000, undefined, 'service'], ['Content Writing (4 articles)', 'Marketing', 60000, undefined, 'service'],
  ],
  creative: [
    ['Brand Film · Full Production', 'Video', 450000, undefined, 'service'], ['Wedding Photography · Full Day', 'Photography', 380000, 450000, 'service'], ['Portrait Session (2 hrs)', 'Photography', 85000, undefined, 'service'],
    ['Product Photography (20 shots)', 'Commercial', 120000, undefined, 'service'], ['Short-form Video Edit (10 reels)', 'Video', 95000, undefined, 'service'], ['Logo & Brand Kit', 'Design', 140000, 170000, 'service'],
    ['Event Coverage · Half Day', 'Events', 220000, undefined, 'service'], ['Album Cover Design', 'Design', 60000, undefined, 'service'],
  ],
  beauty: [
    ['Knotless Braids · Medium', 'Hair', 35000, undefined, 'service'], ['Gel Manicure & Pedicure', 'Nails', 18000, undefined, 'service'], ['Signature Glow Facial', 'Skin', 28000, 35000, 'service'],
    ['Full Glam Makeup', 'Makeup', 40000, undefined, 'service'], ['Relaxing Body Massage (60 min)', 'Spa', 32000, undefined, 'service'], ['Silk Press & Trim', 'Hair', 25000, undefined, 'service'],
    ['Bridal Makeup & Gele', 'Makeup', 120000, 150000, 'service'], ['Lash Extensions', 'Beauty', 22000, undefined, 'service'],
  ],
  food: [
    ['Party Jollof Rice & Chicken', 'Mains', 4500], ['Pounded Yam & Egusi', 'Mains', 5200], ['Suya Platter (Large)', 'Grill', 6500, 7500], ['Chin Chin Jar (500g)', 'Snacks', 3000],
    ['Red Velvet Cake · 8"', 'Cakes', 28000, 32000], ['Small Chops Box (30pcs)', 'Snacks', 15000], ['Zobo Drink (1L)', 'Drinks', 1800], ['Peppered Snail', 'Grill', 7800], ['Moi Moi Wraps (6)', 'Mains', 3600],
  ],
  property: [
    ['3-Bed Duplex · Lekki Phase 1', 'For sale', 185000000, undefined, 'physical'], ['2-Bed Serviced Apartment · Yaba', 'For rent', 3800000, undefined, 'physical'], ['Plot of Land · 600sqm, Ibeju-Lekki', 'Land', 24000000, 28000000, 'physical'],
    ['Studio Apartment · Ikeja GRA', 'For rent', 1900000, undefined, 'physical'], ['4-Bed Terrace · Ajah', 'For sale', 92000000, undefined, 'physical'], ['Office Space · Victoria Island', 'Commercial', 7500000, undefined, 'physical'],
    ['Mini Flat · Surulere', 'For rent', 1200000, undefined, 'physical'], ['5-Bed Detached · Maitama', 'For sale', 340000000, undefined, 'physical'],
  ],
  course: [
    ['Digital Marketing Bootcamp', 'Marketing', 45000, 60000, 'digital'], ['Excel for Business · Zero to Pro', 'Productivity', 18000, undefined, 'digital'], ['UI/UX Design Foundations', 'Design', 55000, 75000, 'digital'],
    ['Freelancing & Getting Clients', 'Career', 22000, undefined, 'digital'], ['Web Development with JavaScript', 'Tech', 85000, 110000, 'digital'], ['Professional Writing Masterclass', 'Writing', 28000, undefined, 'digital'],
    ['Personal Finance 101', 'Finance', 12000, undefined, 'digital'], ['Photography Basics', 'Creative', 25000, undefined, 'digital'],
  ],
  events: [
    ['Afrobeat Night Live · Regular', 'Concerts', 15000, undefined, 'service'], ['Afrobeat Night Live · VIP', 'Concerts', 50000, 60000, 'service'], ['Startup Founders Summit · Day Pass', 'Conferences', 25000, undefined, 'service'],
    ['Comedy Night · Table of 4', 'Comedy', 80000, undefined, 'service'], ['Food & Wine Festival', 'Festivals', 12000, 15000, 'service'], ['Creative Workshop · Weekend', 'Workshops', 20000, undefined, 'service'],
  ],
};

/** Always return a full catalogue: the template's own items first, then variations from the pool. */
export function demoProducts(t: SiteTemplate): SiteProduct[] {
  const arch = archetypeOf(t);
  const accent = t.accent_color;
  const own = (t.sample_products || []);
  const pool = POOLS[arch] || [];
  const want = arch === 'forum' || arch === 'news' || arch === 'social' || arch === 'blog' ? own.length : Math.max(8, own.length);
  const seen = new Set(own.map((p) => p.title.toLowerCase()));
  const extra = pool.filter((p) => !seen.has(p[0].toLowerCase())).slice(0, Math.max(0, want - own.length));
  const base = new Date().toISOString();
  const out: SiteProduct[] = [];
  own.forEach((p, i) => out.push({
    id: `o${i}`, site_id: 'preview', title: p.title, description: p.description, category: p.category, product_type: p.product_type, price: p.price,
    compare_at_price: p.compare_at_price ?? null, image_url: artFor(p.title, p.category, p.product_type, accent), digital_url: '', stock_qty: p.stock_qty ?? null,
    is_active: true, sort_order: i, created_at: base, rating_avg: 4.2 + ((i * 3) % 8) / 10, rating_count: 12 + ((i * 17) % 90),
  }));
  extra.forEach(([title, category, price, cmp, type], j) => {
    const i = own.length + j;
    out.push({
      id: `x${j}`, site_id: 'preview', title, description: `${title}. ${type === 'digital' ? 'Instant access after payment.' : type === 'service' ? 'Book a slot and we confirm on WhatsApp.' : 'Ready to ship, with pay on delivery in selected cities.'}`,
      category, product_type: type ?? 'physical', price, compare_at_price: cmp ?? null, image_url: artFor(title, category, type ?? 'physical', accent), digital_url: '',
      stock_qty: type ? null : 5 + ((j * 7) % 30), is_active: true, sort_order: i, created_at: base, rating_avg: 4.1 + ((i * 3) % 9) / 10, rating_count: 8 + ((i * 23) % 140),
    });
  });
  return out;
}

/* ---------- forum / blog content ---------- */

type T = [title: string, body: string, replies: number];
const THREADS: Record<string, T[]> = {
  forum: [
    ['Welcome! Introduce yourself here', 'New to the community? Tell us who you are, where you are based and what you hope to get from being here.', 142],
    ['What is the one tool you cannot run your business without?', 'Mine is a simple spreadsheet. Curious what everyone else uses day to day, and what you stopped paying for.', 64],
    ['Weekend meetup: who is in?', 'We are planning a relaxed meetup this Saturday. Drop your area and we will find a central spot.', 38],
    ['Pricing your first product: how did you decide?', 'I keep going back and forth. Cost-plus, market rate, or what feels fair to a customer?', 57],
    ['Share your best tip for staying consistent', 'Small habits beat big plans. What is one thing that actually works for you?', 29],
    ['Looking for a reliable dispatch rider in Ikeja', 'Orders are growing and I need someone dependable. Recommendations welcome.', 12],
    ['Monthly wins thread: celebrate something small', 'Big or small, post your win for the month. We cheer for everyone here.', 88],
    ['Resources every beginner should bookmark', 'A running list of free guides, templates and channels the community recommends.', 45],
  ],
  news: [
    ['Naira steadies as importers return to the market', 'Traders report improved liquidity this week as demand for dollars eases across major commercial centres.', 31],
    ['Lagos unveils new commuter rail timetable', 'The updated schedule adds off-peak trains and extends service hours on the red line starting Monday.', 54],
    ['Small businesses welcome new tax relief proposal', 'Owners say the draft measures could free up working capital, though some warn about the compliance burden.', 22],
    ['Opinion: why local brands are winning on trust', 'Customers want to know who is behind what they buy. Here is how small sellers are using that to grow.', 47],
    ['Tech hubs report record funding round', 'Investment in early-stage startups climbed this quarter, with fintech and logistics leading the pack.', 19],
    ['Weekend guide: five events worth leaving the house for', 'From live music to food fairs, here is what is happening across the city.', 36],
    ['Schools adopt hybrid learning after pilot success', 'Teachers say attendance and engagement improved when lessons were split between classroom and online.', 15],
    ['Fuel prices: what to expect this month', 'Analysts break down the factors that could move pump prices over the coming weeks.', 63],
  ],
  social: [
    ['Just launched my first online store and the first order came in within an hour 🎉', 'Thank you all for the support and the early shares. This community is everything.', 128],
    ['Sunday reset: plan the week, prep the orders, breathe.', 'What does your Sunday routine look like? Mine involves jollof and a calendar.', 54],
    ['Behind the scenes of today’s shoot 📸', 'Natural light, one reflector, and a very patient model. Swipe to see the setup.', 87],
    ['Unpopular opinion: packaging matters as much as the product', 'People remember how it felt to open the box. Change my mind.', 203],
    ['Quick tip: reply to every customer message within an hour', 'It sounds simple. It is the single biggest reason repeat customers come back.', 71],
    ['New drop on Friday. Any guesses? 👀', 'Hint: it is orange and it is not food.', 164],
    ['Thank you for 1,000 members!', 'We started with ten friends in a group chat. Look at us now.', 312],
    ['Poll: best day of the week to post?', 'Tuesday evening for me. Share what works for you.', 96],
  ],
  blog: [
    ['How I got my first 100 customers without spending on ads', 'It started with one WhatsApp status and a lot of follow-ups. Here is the exact routine I followed every day.', 42],
    ['Five lessons from three years of running a small business', 'Nobody warns you about the quiet months. These are the things I wish I had known on day one.', 58],
    ['A simple guide to pricing your work fairly', 'Underpricing is the quickest way to burn out. This is the framework I use with every new client.', 33],
    ['Photographing products at home with just a window', 'You do not need a studio. Soft daylight, a white sheet and some patience go a long way.', 21],
    ['What I wish I knew before moving my business online', 'Payment links, delivery promises and honest photos matter more than a fancy logo.', 27],
    ['Behind the brand: a conversation with a local baker', 'From a kitchen counter to a weekly waiting list, here is how the business grew.', 14],
    ['Productivity myths that quietly waste your week', 'Busy is not the same as effective. Three habits to drop and two to keep.', 19],
    ['Reading list: the books that shaped how I work', 'No hustle-culture here, just practical books with ideas you can use on Monday.', 25],
  ],
};
const NAMES = ['Adaeze', 'Tunde', 'Zainab', 'Chidi', 'Ngozi', 'Femi', 'Amaka', 'Ibrahim', 'Sade', 'Emeka'];
const REPLIES = [
  'This is so helpful, thank you for sharing.', 'Same experience here. It really does make a difference.', 'Great point. I would add that consistency matters more than perfection.',
  'Bookmarked! Following this thread for more ideas.', 'Does anyone have a recommendation for this in Abuja?', 'Love this community. Everyone is so supportive.',
];

export function demoThreads(t: SiteTemplate): ForumThread[] {
  const arch = archetypeOf(t);
  const key = (['forum', 'news', 'social', 'blog'] as const).includes(arch as never) ? arch : t.site_mode === 'store' ? '' : 'forum';
  if (!key) return [];
  // The template's own sample posts are editing instructions ("Edit it or delete it"), so a preview uses showcase content instead.
  const pool = THREADS[key] || [];
  const now = Date.now();
  const list: T[] = pool.slice(0, 8);
  return list.map(([title, body, replies], i) => ({
    id: `t${i}`, forum_id: 'preview', author_id: `a${i}`, author_name: NAMES[(i + hash(t.id)) % NAMES.length], title, body, is_pinned: i === 0, is_locked: false,
    reply_count: replies, last_activity_at: new Date(now - (i * 2 + 1) * 3_600_000).toISOString(), created_at: new Date(now - (i * 5 + 3) * 3_600_000).toISOString(),
  }));
}

export function demoReplies(threadId: string): { id: string; name: string; body: string; ago: string }[] {
  const s = hash(threadId);
  return [0, 1, 2, 3].map((i) => ({ id: `${threadId}r${i}`, name: NAMES[(s + i * 3) % NAMES.length], body: REPLIES[(s + i) % REPLIES.length], ago: ['2h ago', '5h ago', 'yesterday', '2 days ago'][i] }));
}

export const demoTestimonials = [
  { name: 'Adaeze O.', role: 'Verified buyer', text: 'Ordered on Monday, delivered Wednesday, exactly as pictured. I will be back.' },
  { name: 'Tunde A.', role: 'Verified buyer', text: 'Responsive on WhatsApp and the payment process was simple. Highly recommend.' },
  { name: 'Zainab M.', role: 'Returning customer', text: 'Third order now. Quality is consistent and the packaging is lovely.' },
];

export const heroNavFor = (t: SiteTemplate) => {
  const a = archetypeOf(t);
  const store = t.site_mode !== 'forum';
  const forum = t.site_mode !== 'store';
  const shopLabel = a === 'property' ? 'Listings' : a === 'course' ? 'Courses' : a === 'events' ? 'Events' : a === 'food' ? 'Menu' : a === 'creative' || a === 'service' || a === 'beauty' ? 'Services' : 'Shop';
  const forumLabel = a === 'news' ? 'Latest' : a === 'blog' ? 'Articles' : a === 'social' ? 'Feed' : 'Community';
  return { store, forum, shopLabel, forumLabel };
};

export type SiteMode = 'forum' | 'store' | 'both';
export type ProductType = 'physical' | 'digital' | 'service';
export type StoreLayoutStyle = 'standard' | 'jumia' | 'temu';

export interface SiteTemplateProduct {
  title: string;
  description: string;
  category: string;
  product_type: ProductType;
  price: number;
  compare_at_price?: number;
  stock_qty?: number | null;
}

export interface SiteTemplate {
  id: string;
  label: string;
  tagline: string;
  site_mode: SiteMode;
  layout_style: StoreLayoutStyle;
  accent_color: string;
  hero_headline: string;
  hero_subheadline: string;
  sample_products: SiteTemplateProduct[];
  sample_thread?: { title: string; body: string };
}

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: 'jumia-mart',
    label: 'Jumia-Style Marketplace',
    tagline: 'Orange flash-sales bar, left category sidebar, % OFF badges & Pay on Delivery.',
    site_mode: 'store',
    layout_style: 'jumia',
    accent_color: '#f68b1e',
    hero_headline: 'Flash Sales & Everyday Essentials — Up to 40% Off',
    hero_subheadline: 'Shop electronics, fashion, and home deals with Pay on Delivery or Bank Transfer.',
    sample_products: [
      {
        title: 'Oraimo FreePods 4 ANC Earbuds',
        description: 'Active noise cancellation, 35.5hr playtime, fast USB-C charging.',
        category: 'Electronics',
        product_type: 'physical',
        price: 38500,
        compare_at_price: 52000,
        stock_qty: 14,
      },
      {
        title: 'Men’s Slim Chinos & Polo Bundle',
        description: 'Breathable cotton polo paired with stretch-fit chinos.',
        category: 'Fashion',
        product_type: 'physical',
        price: 24000,
        compare_at_price: 34000,
        stock_qty: 20,
      },
      {
        title: '20,000mAh Fast Power Bank',
        description: 'Dual USB-A + 22.5W Type-C PD quick charge with LED display.',
        category: 'Phones & Tablets',
        product_type: 'physical',
        price: 19500,
        compare_at_price: 27000,
        stock_qty: 9,
      },
      {
        title: '1.8L Electric Cordless Kettle',
        description: 'Stainless steel body, auto shut-off, 1500W rapid boil.',
        category: 'Home & Kitchen',
        product_type: 'physical',
        price: 14800,
        compare_at_price: 21000,
        stock_qty: 16,
      },
    ],
  },
  {
    id: 'temu-deals',
    label: 'Temu-Style Flash Deals',
    tagline: 'High-energy deal grid, bold discount pills, low-stock urgency & buyer protection.',
    site_mode: 'store',
    layout_style: 'temu',
    accent_color: '#fb7701',
    hero_headline: 'Lightning Deals — Massive Price Drops Today',
    hero_subheadline: 'Grab trending finds before stock runs out. Protected checkout & fast dispatch.',
    sample_products: [
      {
        title: 'Magnetic MagSafe Desk Stand',
        description: '360° foldable aluminum phone & tablet holder for desk or travel.',
        category: 'Gadgets',
        product_type: 'physical',
        price: 6500,
        compare_at_price: 13500,
        stock_qty: 4,
      },
      {
        title: 'RGB LED Strip Kit (5m + Remote)',
        description: 'App & remote controlled ambient lighting for desks and rooms.',
        category: 'Home Decor',
        product_type: 'physical',
        price: 5900,
        compare_at_price: 11000,
        stock_qty: 7,
      },
      {
        title: '6-in-1 USB-C Laptop Hub',
        description: '4K HDMI, 3× USB 3.0, SD/TF card reader, 100W PD pass-through.',
        category: 'Tech',
        product_type: 'physical',
        price: 11500,
        compare_at_price: 19900,
        stock_qty: 3,
      },
      {
        title: 'Mini Portable Blender (USB)',
        description: '6-blade smoothie cup with rechargeable battery.',
        category: 'Kitchen',
        product_type: 'physical',
        price: 8900,
        compare_at_price: 16000,
        stock_qty: 6,
      },
    ],
  },
  {
    id: 'retail-store',
    label: 'Clean Retail & Boutique',
    tagline: 'Minimalist storefront for fashion, merch, electronics, or food.',
    site_mode: 'store',
    layout_style: 'standard',
    accent_color: '#10b981',
    hero_headline: 'Quality products delivered straight to your door.',
    hero_subheadline: 'Browse our catalog, pay easily via bank transfer or on delivery, and track your order.',
    sample_products: [
      {
        title: 'Essential Cotton Tee',
        description: 'Heavyweight 240gsm combed cotton t-shirt. Pre-shrunk and breathable.',
        category: 'Apparel',
        product_type: 'physical',
        price: 15000,
        compare_at_price: 18500,
        stock_qty: 25,
      },
      {
        title: 'Everyday Canvas Tote',
        description: 'Durable water-resistant carryall with inner laptop sleeve.',
        category: 'Accessories',
        product_type: 'physical',
        price: 12000,
        stock_qty: 18,
      },
      {
        title: 'Insulated Travel Tumbler',
        description: 'Keeps drinks cold for 24h or hot for 12h. Stainless steel 500ml.',
        category: 'Lifestyle',
        product_type: 'physical',
        price: 18000,
        stock_qty: 12,
      },
    ],
  },
  {
    id: 'digital-shop',
    label: 'Digital Products & Downloads',
    tagline: 'Sell ebooks, templates, presets, courses, or software licenses.',
    site_mode: 'store',
    layout_style: 'standard',
    accent_color: '#06b6d4',
    hero_headline: 'Instant digital tools built to save you hours.',
    hero_subheadline: 'Pick a resource, complete checkout, and receive instant access once confirmed.',
    sample_products: [
      {
        title: 'Founder Financial Model (Excel & Sheets)',
        description: '3-year cashflow, unit economics, and runway planner ready for startups.',
        category: 'Templates',
        product_type: 'digital',
        price: 12500,
        compare_at_price: 20000,
      },
      {
        title: 'Landing Page UI Kit',
        description: '24 responsive sections with dark and light variants.',
        category: 'Design',
        product_type: 'digital',
        price: 25000,
      },
    ],
  },
  {
    id: 'services-booking',
    label: 'Services & Consulting',
    tagline: 'Sell fixed-price packages, coaching calls, or creative/tech services.',
    site_mode: 'store',
    layout_style: 'standard',
    accent_color: '#3b82f6',
    hero_headline: 'Clear packages, transparent pricing, fast turnaround.',
    hero_subheadline: 'Book a service package below and share your brief right at checkout.',
    sample_products: [
      {
        title: '1-on-1 Strategy Session (60 mins)',
        description: 'Focused roadmap review, architecture feedback, or growth audit.',
        category: 'Consulting',
        product_type: 'service',
        price: 30000,
      },
      {
        title: 'Brand Identity Starter Pack',
        description: 'Logo suite, color palette, typography guide, and social kit.',
        category: 'Design',
        product_type: 'service',
        price: 75000,
        compare_at_price: 95000,
      },
    ],
  },
  {
    id: 'store-community',
    label: 'Store + Community Hub',
    tagline: 'Combine an online shop with a member discussion forum on one domain.',
    site_mode: 'both',
    layout_style: 'standard',
    accent_color: '#f59e0b',
    hero_headline: 'Shop our releases and join the community.',
    hero_subheadline: 'Browse products, share feedback, and connect with other members.',
    sample_products: [
      {
        title: 'Community Supporter Pass',
        description: 'Access exclusive drops, member-only threads, and early releases.',
        category: 'Membership',
        product_type: 'digital',
        price: 10000,
      },
      {
        title: 'Limited Edition Merch Drop',
        description: 'Official community apparel and sticker pack.',
        category: 'Merch',
        product_type: 'physical',
        price: 22000,
        stock_qty: 30,
      },
    ],
    sample_thread: {
      title: 'Welcome! Introduce yourself and what you are working on',
      body: 'Drop a quick intro below and let the community know what brought you here.',
    },
  },
  {
    id: 'community-forum',
    label: 'Community Forum Only',
    tagline: 'Launch a discussion-first forum for founders, students, or creators.',
    site_mode: 'forum',
    layout_style: 'standard',
    accent_color: '#06b6d4',
    hero_headline: 'A dedicated home for focused discussions.',
    hero_subheadline: 'Start threads, reply to members, and grow your community.',
    sample_products: [],
    sample_thread: {
      title: 'Welcome to the forum',
      body: 'Start a new thread or reply below to get the conversation going.',
    },
  },
];

export function getTemplateById(id?: string | null): SiteTemplate {
  return SITE_TEMPLATES.find((t) => t.id === id) || SITE_TEMPLATES[0];
}

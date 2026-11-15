/**
 * Each theme gets a visual "skin": typeface, card shape, borders, hero treatment. The layout (which blocks
 * appear where) comes from layout_style in lib/siteTemplates.ts; the skin is what makes two themes with
 * the same layout still look like different brands. The CSS lives in app/globals.css ([data-skin="…"]).
 */
export type ThemeSkin =
  | 'clean' | 'luxury' | 'studio' | 'market' | 'warm' | 'editorial' | 'bright' | 'bold' | 'mono' | 'night' | 'sleek' | 'corporate';

const SKINS: Record<string, ThemeSkin> = {
  'premium-luxury': 'luxury',
  'shopify-fashion': 'luxury',
  'premium-agency': 'studio',
  'portfolio-creative': 'studio',
  'creator-studio': 'bold',
  'photographer-studio': 'mono',
  'premium-marketplace': 'market',
  'jumia-mart': 'market',
  'temu-deals': 'market',
  'buy-and-sell': 'market',
  'premium-restaurant': 'warm',
  'restaurant-food': 'warm',
  'salon-beauty': 'warm',
  'real-estate': 'sleek',
  'retail-store': 'sleek',
  'shopify-clean': 'sleek',
  'services-booking': 'corporate',
  'wp-business': 'corporate',
  'store-community': 'warm',
  'blog-magazine': 'editorial',
  'wp-blog': 'editorial',
  'wp-magazine': 'editorial',
  'news-broadsheet': 'editorial',
  'news-tabloid': 'bold',
  'news-portal': 'editorial',
  'news-business': 'editorial',
  'digital-shop': 'bright',
  'selar-creator': 'bright',
  'selar-course': 'bright',
  'online-academy': 'bright',
  'events-tickets': 'night',
  'subscription-share': 'night',
  'social-reels': 'night',
};

export function skinFor(templateId?: string | null): ThemeSkin {
  return (templateId && SKINS[templateId]) || 'clean';
}

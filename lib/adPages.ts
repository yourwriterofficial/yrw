export const AD_POSITIONS = ['header', 'footer', 'sidebar', 'inline', 'popup'] as const;
export type AdPosition = typeof AD_POSITIONS[number];

export const AD_PAGES = [
  'all',
  'landing',
  'projects',
  'academic',
  'statistics',
  'content',
  'resume',
  'order',
  'dashboard',
] as const;

export type AdPage = typeof AD_PAGES[number];

export const AD_PAGE_LABELS: Record<AdPage, string> = {
  all: 'All In-App Pages',
  landing: 'Landing Page (SEO Home)',
  projects: 'Project Catalogue',
  academic: 'Academic Writing',
  statistics: 'Statistics & Fieldwork',
  content: 'Content Writing',
  resume: 'Resume & CV',
  order: 'Order Checkout',
  dashboard: 'Client Dashboard',
};

export function getPageFromPathname(pathname: string): AdPage {
  if (pathname === '/' || pathname === '') return 'landing';
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/academic-writing')) return 'academic';
  if (pathname.startsWith('/statistics-fieldwork')) return 'statistics';
  if (pathname.startsWith('/content-writing')) return 'content';
  if (pathname.startsWith('/resume-cv')) return 'resume';
  if (pathname.startsWith('/order')) return 'order';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  return 'all';
}

export function normalizeAdPages(position: string, pages: string[]): string[] {
  if (position === 'sidebar') return ['all'];
  if (!pages || pages.length === 0) return ['all'];
  return pages;
}

export function pageMatches(position: string, pages: string[] | unknown, currentPage?: string): boolean {
  if (position === 'sidebar') return true;
  let pList: string[] = [];
  if (Array.isArray(pages)) {
    pList = pages;
  } else if (typeof pages === 'string') {
    try { pList = JSON.parse(pages); } catch { pList = [pages]; }
  }

  if (!currentPage || currentPage === 'all') return true;
  if (pList.includes('all') && currentPage !== 'landing') return true;
  return pList.includes(currentPage);
}

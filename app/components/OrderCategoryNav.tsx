'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GraduationCap, PenTool, Terminal, Briefcase, LineChart, Library, ShoppingBag } from 'lucide-react';

interface Category {
  id: string;
  label: string;
  href: string;
  isActive: (pathname: string, tab: string | null) => boolean;
  color: string;
  inactiveColor: string;
  icon: React.ReactNode;
}

export default function OrderCategoryNav() {
  const pathname = usePathname();
  const [tab, setTab] = useState<string | null>(null);

  // Read the ?tab= query directly instead of next/navigation's useSearchParams,
  // which would force every page embedding this shared nav into a Suspense
  // boundary just to render category tabs.
  useEffect(() => {
    setTab(new URLSearchParams(window.location.search).get('tab'));
  }, [pathname]);

  const isDashboard = pathname.startsWith('/dashboard/client');
  const basePath = isDashboard ? '/dashboard/client/order/new' : '/order';

  const categories: Category[] = [
    { id: 'academic', label: 'Academic', href: `${basePath}/academic`, isActive: (p) => p === `${basePath}/academic`, color: 'text-accent border-accent/30 bg-accent/5', inactiveColor: 'hover:text-accent hover:bg-accent/5', icon: <GraduationCap className="w-4 h-4 text-accent" /> },
    { id: 'content', label: 'Content', href: `${basePath}/content`, isActive: (p) => p === `${basePath}/content`, color: 'text-accent border-accent/30 bg-accent/5', inactiveColor: 'hover:text-accent hover:bg-accent/5', icon: <PenTool className="w-4 h-4 text-accent" /> },
    { id: 'dev', label: 'Software Dev', href: `${basePath}/dev`, isActive: (p) => p === `${basePath}/dev`, color: 'text-accent border-accent/30 bg-accent/5', inactiveColor: 'hover:text-accent hover:bg-accent/5', icon: <Terminal className="w-4 h-4 text-accent" /> },
    { id: 'resume', label: 'CV & Resume', href: `${basePath}/resume`, isActive: (p) => p === `${basePath}/resume`, color: 'text-accent border-accent/30 bg-accent/5', inactiveColor: 'hover:text-accent hover:bg-accent/5', icon: <Briefcase className="w-4 h-4 text-accent" /> },
    { id: 'statistics', label: 'Statistics', href: `${basePath}/statistics`, isActive: (p) => p === `${basePath}/statistics`, color: 'text-accent border-accent/30 bg-accent/5', inactiveColor: 'hover:text-accent hover:bg-accent/5', icon: <LineChart className="w-4 h-4 text-accent" /> },
    {
      id: 'projects',
      label: 'Pre-Made Projects',
      href: isDashboard ? '/dashboard/client?tab=projects' : '/projects',
      isActive: (p, t) => (isDashboard ? p === '/dashboard/client' && t === 'projects' : p === '/projects'),
      color: 'text-accent border-accent/30 bg-accent/5',
      inactiveColor: 'hover:text-accent hover:bg-accent/5',
      icon: <Library className="w-4 h-4 text-accent" />,
    },
    {
      id: 'scripts',
      label: 'Scripts / Software',
      href: isDashboard ? '/dashboard/client?tab=scripts' : '/developer/shop',
      isActive: (p, t) => (isDashboard ? p === '/dashboard/client' && t === 'scripts' : p === '/developer/shop'),
      color: 'text-accent border-accent/30 bg-accent/5',
      inactiveColor: 'hover:text-accent hover:bg-accent/5',
      icon: <ShoppingBag className="w-4 h-4 text-accent" />,
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6 mb-2 mt-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap gap-2 glass-panel p-2 rounded-[20px] justify-center md:justify-start">
        {categories.map((cat) => {
          const isActive = cat.isActive(pathname, tab);
          return (
            <Link
              key={cat.id}
              href={cat.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-semibold   transition-all duration-200 border cursor-pointer select-none ${
                isActive
                  ? `${cat.color} font-semibold scale-[1.02] border`
                  : `border-transparent text-secondary bg-transparent ${cat.inactiveColor}`
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

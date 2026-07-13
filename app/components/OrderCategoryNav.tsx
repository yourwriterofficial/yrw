'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, PenTool, Terminal, Briefcase, Settings } from 'lucide-react';

export default function OrderCategoryNav() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith('/dashboard/client');
  const basePath = isDashboard ? '/dashboard/client/order/new' : '/order';

  const categories = [
    { id: 'academic', label: 'Academic', path: '/academic', color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5', inactiveColor: 'hover:text-emerald-400 hover:bg-emerald-500/5', icon: <GraduationCap className="w-4 h-4 text-emerald-500" /> },
    { id: 'content', label: 'Content', path: '/content', color: 'text-amber-500 border-amber-500/30 bg-amber-500/5', inactiveColor: 'hover:text-amber-400 hover:bg-amber-500/5', icon: <PenTool className="w-4 h-4 text-amber-500" /> },
    { id: 'dev', label: 'Software Dev', path: '/dev', color: 'text-cyan-500 border-cyan-500/30 bg-cyan-500/5', inactiveColor: 'hover:text-cyan-400 hover:bg-cyan-500/5', icon: <Terminal className="w-4 h-4 text-cyan-500" /> },
    { id: 'resume', label: 'CV & Resume', path: '/resume', color: 'text-blue-500 border-blue-500/30 bg-blue-500/5', inactiveColor: 'hover:text-blue-400 hover:bg-blue-500/5', icon: <Briefcase className="w-4 h-4 text-blue-500" /> },
    { id: 'custom', label: 'Custom Work', path: '/custom', color: 'text-purple-500 border-purple-500/30 bg-purple-500/5', inactiveColor: 'hover:text-purple-400 hover:bg-purple-500/5', icon: <Settings className="w-4 h-4 text-purple-500" /> },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6 mb-2 mt-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap gap-2 glass-panel p-2 rounded-[20px] justify-center md:justify-start">
        {categories.map((cat) => {
          const catUrl = `${basePath}${cat.path}`;
          const isActive = pathname === catUrl;
          return (
            <Link 
              key={cat.id} 
              href={catUrl}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 border cursor-pointer select-none ${
                isActive 
                  ? `${cat.color} font-black scale-[1.02] border` 
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

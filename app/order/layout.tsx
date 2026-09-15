'use client';

import { usePathname } from 'next/navigation';
import Header from '@/app/components/Header';
import DevelopaHeader from '@/app/components/DevelopaHeader';

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDevOrder = pathname === '/order/dev' || pathname?.startsWith('/order/dev');

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col">
      {isDevOrder ? <DevelopaHeader /> : <Header />}
      <div className="pt-16 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

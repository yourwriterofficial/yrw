'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Header from '@/app/components/Header';
import DevelopaHeader from '@/app/components/DevelopaHeader';

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-primary text-primary flex flex-col">
        <div className="h-16 border-b border-theme bg-primary" />
        <div className="pt-16 flex-1 flex flex-col">{children}</div>
      </div>
    }>
      <OrderLayoutInner>{children}</OrderLayoutInner>
    </Suspense>
  );
}

function OrderLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isDevelopa, setIsDevelopa] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const brand = searchParams.get('brand');
      const savedBrand = localStorage.getItem('developa_brand');
      const isExplicitAcademicOrOther =
        pathname === '/order/academic' ||
        pathname === '/order/content' ||
        pathname === '/order/resume' ||
        pathname === '/order/statistics';

      if (isExplicitAcademicOrOther) {
        setIsDevelopa(false);
      } else if (
        host.includes('developa.me') ||
        host.includes('developa.local') ||
        brand === 'developa' ||
        pathname === '/order/dev' ||
        pathname?.startsWith('/order/dev') ||
        pathname === '/order' ||
        (savedBrand === 'developa' && (pathname === '/order' || pathname?.includes('/dev')))
      ) {
        setIsDevelopa(true);
      } else {
        setIsDevelopa(false);
      }
    }
  }, [pathname, searchParams]);

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col">
      {isDevelopa ? <DevelopaHeader /> : <Header />}
      <div className="pt-16 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

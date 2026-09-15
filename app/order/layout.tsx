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

  // Compute synchronously so SSR and initial render immediately show DevelopaHeader
  // on /order/dev or /order without waiting for an asynchronous useEffect
  const isExplicitAcademic =
    pathname === '/order/academic' ||
    pathname === '/order/content' ||
    pathname === '/order/resume' ||
    pathname === '/order/statistics';

  const isDevPath = pathname === '/order/dev' || pathname?.startsWith('/order/dev') || pathname === '/order';
  const hasDevBrandQuery = searchParams.get('brand') === 'developa';

  const [isDevelopa, setIsDevelopa] = useState(() => {
    if (isExplicitAcademic) return false;
    return isDevPath || hasDevBrandQuery;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const brand = searchParams.get('brand');
      const savedBrand = localStorage.getItem('developa_brand');

      if (isExplicitAcademic) {
        setIsDevelopa(false);
      } else if (
        host.includes('developa.me') ||
        host.includes('developa.local') ||
        brand === 'developa' ||
        isDevPath ||
        (savedBrand === 'developa' && (pathname === '/order' || pathname?.includes('/dev')))
      ) {
        setIsDevelopa(true);
      } else {
        setIsDevelopa(false);
      }
    }
  }, [pathname, searchParams, isDevPath, hasDevBrandQuery, isExplicitAcademic]);

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col">
      {isDevelopa ? <DevelopaHeader /> : <Header />}
      <div className="pt-16 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

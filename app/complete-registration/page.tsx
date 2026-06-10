'use client';

import { Suspense } from 'react';
import CompleteRegistrationContent from './CompleteRegistrationContent';

export default function CompleteRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CompleteRegistrationContent />
    </Suspense>
  );
}
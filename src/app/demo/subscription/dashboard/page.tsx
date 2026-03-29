'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { AccountDashboard } from '@/components/demo/subscription/account-dashboard';

function DashboardContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan') ?? 'good-boy';
  return <AccountDashboard planId={planId} />;
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold text-neutral-900">Your Subscription</h1>
      <Suspense fallback={<div className="text-neutral-500">Loading...</div>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}

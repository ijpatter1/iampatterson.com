'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { TrialSignupForm } from '@/components/demo/subscription/trial-signup-form';

function SignupContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan') ?? 'good-boy';
  return <TrialSignupForm planId={planId} />;
}

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold text-neutral-900">Start Your Trial</h1>
      <Suspense fallback={<div className="text-neutral-500">Loading...</div>}>
        <SignupContent />
      </Suspense>
    </main>
  );
}

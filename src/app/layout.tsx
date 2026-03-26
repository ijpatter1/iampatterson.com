import type { Metadata } from 'next';

import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Patterson Consulting',
    template: '%s | Patterson Consulting',
  },
  description: 'Measurement infrastructure for marketing teams that need to trust their data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}

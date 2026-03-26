import type { Metadata } from 'next';

import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Patterson Consulting',
  description: 'Measurement infrastructure for marketing teams that need to trust their data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Start a conversation about your measurement stack. I work with marketing teams whose infrastructure needs work.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

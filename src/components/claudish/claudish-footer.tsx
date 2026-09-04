/**
 * Claudish translator — page footer.
 *
 * Both lines spec-verbatim. The disclaimer is the page's only sanctioned
 * occurrence of the word "Google" (the trade-dress guard test enforces
 * exactly-once globally).
 */
import Link from 'next/link';

import { FOOTER_ATTRIBUTION, FOOTER_DISCLAIMER } from '@/lib/claudish/messages';

export function ClaudishFooter() {
  // Split the attribution so the domain renders as a real link while the
  // joined text stays character-identical to the verbatim constant.
  const [before] = FOOTER_ATTRIBUTION.split('iampatterson.com');
  return (
    <footer
      role="contentinfo"
      className="mt-auto flex flex-col items-center gap-1 px-6 py-8 text-center"
    >
      <p className="text-sm text-[var(--gt-text-2,#5f6368)]">
        {before}
        <Link href="/" className="hover:underline">
          iampatterson.com
        </Link>
      </p>
      <p className="text-xs text-[var(--gt-text-3,#80868b)]">{FOOTER_DISCLAIMER}</p>
    </footer>
  );
}

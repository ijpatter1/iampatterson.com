export interface UpNextCertification {
  name: string;
  issuer: string;
}

export interface CompletedCertification {
  name: string;
  issuer: string;
  year: string;
  /** Path to the issued badge. A slot renders only when this is set. */
  badgeSrc?: string;
}

export const CERTIFICATIONS = {
  eyebrow: 'Certifications',
  upNextLabel: 'Up next',
  completedLabel: 'Completed',
  upNext: [
    { name: 'Claude Certified Architect (Foundations)', issuer: 'Anthropic · exam unlocked' },
    { name: 'Google Analytics Certification', issuer: 'Google Skillshop' },
    { name: 'Google Ads Measurement Certification', issuer: 'Google Skillshop' },
    { name: 'Meta Certified Marketing Science Professional', issuer: 'Meta Blueprint' },
    { name: 'Professional Data Engineer', issuer: 'Google Cloud' },
  ] satisfies UpNextCertification[],
  // Empty, so the Completed column does not render.
  completed: [] as CompletedCertification[],
} as const;

/**
 * Identifiers for the contact form's path to Google: none is a secret. The
 * route signs in with Vercel's OIDC token through a workload identity pool, so
 * no key is stored anywhere. The reCAPTCHA site key is public by design.
 */
const PROJECT_NUMBER = '262727068689';

export const CONTACT_CONFIG = {
  projectId: 'iampatterson',
  /** The mailbox inquiries are sent from and to. */
  mailbox: 'ian@iampatterson.com',
  serviceAccount: 'contact-form@iampatterson.iam.gserviceaccount.com',
  workloadIdentityAudience: `//iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/vercel/providers/vercel-oidc`,
  recaptchaSiteKey: '6LeUfA0uAAAAAPkqEVgdEaTVVoafiN3P0JGAYMoT',
  /** The action name the browser asks reCAPTCHA for, and the server expects back. */
  recaptchaAction: 'contact_submit',
} as const;

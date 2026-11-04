/**
 * Identifiers for the contact form's path to Google: none is a secret. The
 * route signs in with Vercel's OIDC token through a workload identity pool, so
 * no key is stored anywhere. The reCAPTCHA site key is public by design.
 */
const PROJECT_NUMBER = '262727068689';

export const CONTACT_CONFIG = {
  projectId: 'iampatterson',
  /** The address inquiries are sent from and to. */
  mailbox: 'ian@iampatterson.com',
  serviceAccount: 'contact-form@iampatterson.iam.gserviceaccount.com',
  workloadIdentityAudience: `//iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/vercel/providers/vercel-oidc`,
  recaptchaSiteKey: '6LeUfA0uAAAAAPkqEVgdEaTVVoafiN3P0JGAYMoT',
  /** The action name the browser asks reCAPTCHA for, and the server expects back. */
  recaptchaAction: 'contact_submit',
  /** Hosts a token may come from. A token minted on any other page is refused. */
  allowedHostnames: ['www.iampatterson.com', 'iampatterson.com'],
  /** Field limits, shared by the form and the route so the browser enforces what the server checks. */
  limits: { name: 200, email: 254, message: 5000 },
  /**
   * Deadline for each Google call before the send (five at most, so 20 s in
   * all). The send itself has none: cutting off a send Google has already
   * accepted would report a failure for mail that arrives, and the visitor
   * would send it again. The form waits 45 s.
   */
  googleTimeoutMs: 4_000,
} as const;

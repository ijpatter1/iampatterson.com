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
  /**
   * The Workspace user the delegation acts as. `ian@iampatterson.com` is an
   * alias of this account, and domain-wide delegation can only act as a
   * user's primary address.
   */
  delegatedUser: 'ian@tunameltsmyheart.com',
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
   * Per-call timeout for the route's Google requests. Six calls at most, so the
   * route answers well inside the form's 30-second wait: an inquiry the
   * visitor is told failed cannot arrive later.
   */
  googleTimeoutMs: 4_000,
} as const;

/**
 * claudish-proxy — deploy-script contract pins.
 *
 * setup.sh is the only path to a deployed revision, so its flag shapes
 * are contracts. Pinned here: the ^@^ env-var delimiter (ALLOWED_ORIGINS
 * and LANES are comma-valued — a comma-delimited --set-env-vars silently
 * shreds them into bogus vars), and the WIF auth story (federation ids
 * as plain env, no API-key secret anywhere).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const script = readFileSync(join(__dirname, '..', 'setup.sh'), 'utf8');

describe('setup.sh deploy contract', () => {
  it('uses the ^@^ delimiter so comma-valued env vars survive', () => {
    expect(script).toContain('--set-env-vars="^@^');
    // No @ inside any value on that line, or the delimiter splits it.
    const line = script.split('\n').find((l) => l.includes('--set-env-vars'))!;
    const vars = line.replace(/.*\^@\^/, '').replace(/".*$/, '').split('@');
    for (const v of vars) expect(v).toMatch(/^[A-Z_]+=/);
  });

  it('threads all four Anthropic WIF ids into the service env', () => {
    for (const key of [
      'ANTHROPIC_FEDERATION_RULE_ID',
      'ANTHROPIC_ORGANIZATION_ID',
      'ANTHROPIC_SERVICE_ACCOUNT_ID',
      'ANTHROPIC_WORKSPACE_ID',
    ]) {
      expect(script).toContain(`${key}=\${${key}}`);
    }
  });

  it('mounts no secrets and never references ANTHROPIC_API_KEY', () => {
    // A leftover key env would shadow federation in the SDK's credential
    // precedence — the deploy path must not be able to reintroduce one.
    expect(script).not.toContain('--set-secrets');
    expect(script).not.toContain('ANTHROPIC_API_KEY');
  });
});

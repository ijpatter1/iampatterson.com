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
    expect(script).toContain('--update-env-vars="^@^');
    // No @ inside any value on that line, or the delimiter splits it.
    const line = script.split('\n').find((l) => l.includes('--update-env-vars="^@^'))!;
    const vars = line.replace(/.*\^@\^/, '').replace(/".*$/, '').split('@');
    for (const v of vars) expect(v).toMatch(/^[A-Z0-9_]+=/);
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

  it('merges env vars and never writes KILL_SWITCH, so a deploy cannot end a spend incident', () => {
    // Review batch 1 (2026-09-03): --set-env-vars replaced the whole env and
    // hardcoded KILL_SWITCH=off; a hotfix deploy during an incident would
    // silently turn spend back on.
    expect(script).not.toContain('--set-env-vars');
    const deployLine = script.split('\n').find((l) => l.includes('--update-env-vars="^@^'))!;
    expect(deployLine).not.toContain('KILL_SWITCH');
    // The runbook echo still names the switch; only the deploy line must not.
    expect(script).toContain('--update-env-vars KILL_SWITCH=on');
  });
});

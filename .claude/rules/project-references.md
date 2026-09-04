# References and security model

> Project rule, loaded every session. Moved verbatim from the pre-guv `CLAUDE.md` on 2026-09-04 (guv adoption); the source text is Ian's.

## References

- `docs/REQUIREMENTS.md`, the full 11-phase development plan with deliverables and dependencies
- `docs/ARCHITECTURE.md`, technical architecture, infrastructure diagrams, data flow specifications
- `docs/PHASE_STATUS.md`, living tracker of phase completion
- `docs/sessions/`, session handoff artifacts with detailed state from prior work sessions
- `.claude/agents/evaluator.md`, QA/evaluator subagent for post-feature evaluation
- `docs/STYLE_GUIDE.md`, design direction, voice/tone, typography, component patterns. Note: the design is in active iteration (clean slate as of session 018), the style guide documents the design intent, not necessarily the current implementation state
- `.claude/commands/`, session workflow commands (`/start-phase`, `/evaluate`, `/handoff`, `/status`)
- `.claude/settings.json`, project-level permissions and hooks (committed to git, shared)
- `.claude/settings.local.json`, personal permission overrides (gitignored). Use this for machine-specific settings like additional Bash commands you need, extra allowed domains, or environment-specific paths. Local scope overrides project scope
- `.claude/hooks/`, deterministic enforcement scripts (bash-guard, auto-format, stop-check)
- `sandbox/`, Docker sandbox for running Claude Code with `--dangerously-skip-permissions`

### Security Model

Permissions, hooks, and the Docker sandbox form three layers of defense:

1. **Permissions** (settings.json), auto-allow safe commands, auto-deny known-bad patterns. Convenience layer, reduces permission prompts for routine work
2. **Hooks** (bash-guard.sh), deterministic enforcement of dangerous patterns. Works both inside and outside Docker. Blocks destructive commands, git push, gcloud delete operations
3. **Docker sandbox** (optional), network-level isolation via iptables firewall. Blocks all non-allowlisted outbound traffic. Only needed for `--dangerously-skip-permissions` mode

The Write and Edit permissions in settings.json are scoped to project directories (src, tests, docs, etc.) and config files. If you need to write to an unlisted path, add it to `.claude/settings.local.json`.

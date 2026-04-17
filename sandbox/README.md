# Claude Code Sandbox

Isolated Docker environment for running Claude Code with `--dangerously-skip-permissions` safely.

## Quick Start

```bash
# Set your API key (add to ~/.zshrc for persistence)
export ANTHROPIC_API_KEY=sk-ant-...

# Build and start interactive session
make sandbox
```

## Commands

| Command | Description |
|---------|-------------|
| `make build` | Build the sandbox Docker image |
| `make sandbox` | Start interactive Claude Code session |
| `make shell` | Start bash shell in sandbox (debugging) |
| `make prompt P="..."` | Run a headless prompt |
| `make resume S="name"` | Resume a named session |
| `make dev` | Run Next.js dev server on **host** (not in Docker) |
| `make stop` | Stop the running container |
| `make clean` | Remove container and image (preserves volumes) |
| `make clean-all` | Full reset — remove container, image, AND volumes |
| `make test-fw` | Verify firewall blocks non-allowlisted traffic |

## How Settings Load

Claude Code loads configuration from two `.claude/` directories that serve different purposes:

**Project settings** → `/workspace/.claude/` (your project's bind-mounted `.claude/` directory)
- `settings.json` — permissions, hooks
- `agents/` — evaluator subagent
- `commands/` — /start-phase, /evaluate, /handoff, /status
- `skills/` — session management skill
- `hooks/` — bash-guard, auto-format, stop-check

**User state** → `/home/claude/.claude/` (Docker named volume `claude-config`)
- Auth tokens (persists so you don't re-authenticate every session)
- Session history and auto-memory
- Any user-level settings you configure via Claude Code's UI

Claude Code merges both at runtime. Project-level settings take precedence for permissions and hooks. If you experience unexpected behavior, check both paths — a stale user-level setting in the volume could conflict with your project config. Use `make clean-all` for a full reset.

## Dev Server

**The sandbox does not forward port 3000.** This is intentional — the sandbox runs Claude Code, not your app.

Run the dev server on your host machine:

```bash
# Terminal 1: Claude Code in sandbox
make sandbox

# Terminal 2: Dev server on host
make dev
# or: npm run dev
```

File changes from Claude Code (inside Docker) appear instantly on your host via the bind mount. Next.js hot reload picks them up normally. Browse `http://localhost:3000` in your host browser.

## Security Model

**Filesystem isolation:** The container only sees `/workspace` (your project directory, bind-mounted). No access to host home directory, SSH keys, `.env` files, or other projects.

**Network isolation:** iptables default-deny firewall. Only allowlisted domains are reachable:
- `api.anthropic.com` — Claude API
- `registry.npmjs.org` — npm packages
- `github.com` — git operations (push blocked by bash-guard hook)
- `vercel.com` — deployment

Additional domains (GCP, Stape, Cookiebot) are available in `init-firewall.sh` but commented out until needed. Uncomment as your project reaches later phases.

**Git push is blocked.** The bash-guard hook blocks all `git push` commands. Commits happen inside the container (visible on host via bind mount). Push from your host terminal after reviewing the changes.

**Non-root execution.** The entrypoint runs as root only for iptables firewall setup, then drops to the `claude` user via `runuser` before starting Claude Code. No root process remains after startup.

## Modifying the Allowlist

Edit `sandbox/init-firewall.sh` → `ALLOWED_DOMAINS`, `GCLOUD_DOMAINS`, or `INSTRUMENTATION_DOMAINS` arrays. Rebuild with `make build`.

DNS resolution happens at container start. Each domain is resolved 3 times to capture multiple CDN edge IPs. If `npm install` fails mid-session due to IP rotation, restart the container.

## Volumes

Two named Docker volumes persist across container restarts:

| Volume | Path in container | Contains |
|--------|------------------|----------|
| `claude-config` | `/home/claude/.claude` | Auth tokens, session history, auto-memory |
| `claude-data` | `/home/claude/.local/share/claude` | Session transcripts |

These are separate from your project's `.claude/` directory (which lives in the bind-mounted workspace).

- `make clean` — removes container and image, **keeps volumes** (session continuity)
- `make clean-all` — removes everything including volumes (you'll need to re-authenticate)

## Phased Dependency Installation

The Dockerfile is configured for Phase 1-3 out of the box (Node.js, Python, Claude Code).

**Phase 4+:** Uncomment the Google Cloud CLI section in `sandbox/Dockerfile` and the `GCLOUD_DOMAINS` in `sandbox/init-firewall.sh`, then `make build`. This adds ~500MB to the image.

## Known Limitations

- **DNS resolution is static.** IPs are resolved at container start. If a service's IP changes during a long session (common with CDN-hosted services like npm), restart the container
- **No Docker-in-Docker.** If your project needs to build Docker images (e.g., for Cloud Run), run those from the host
- **Multi-arch.** The base image (`node:20-slim`) is multi-arch — works on Apple Silicon (M-series) and x86_64 with no configuration changes

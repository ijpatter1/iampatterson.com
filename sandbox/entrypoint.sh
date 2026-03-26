#!/bin/bash
# entrypoint.sh
# Container entrypoint: initializes firewall as root, drops to claude user,
# then starts Claude Code with bypass permissions.
#
# SETTINGS PATH MODEL:
# - Project settings: /workspace/.claude/settings.json (from bind mount)
#   Contains permissions, hooks, agents, commands, skills
# - User state: /home/claude/.claude/ (from named Docker volume)
#   Contains auth tokens, session history, auto-memory
# Claude Code merges both at runtime. Project settings take precedence
# over user settings for permissions and hooks.

set -e

# Step 1: Initialize firewall (requires root / NET_ADMIN)
sudo /usr/local/bin/init-firewall.sh

# Step 2: Drop to non-root user and run Claude Code
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  iampatterson.com — Claude Code Sandbox                 ║"
echo "║                                                         ║"
echo "║  Running as: $(whoami)                                       ║"
echo "║  Workspace:  /workspace                                 ║"
echo "║  Mode:       --dangerously-skip-permissions             ║"
echo "║                                                         ║"
echo "║  Network:    Allowlisted domains only (see firewall)    ║"
echo "║  Git push:   Blocked by bash-guard hook                 ║"
echo "║  Dev server: Run on host (port not forwarded)           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# All arguments are forwarded to Claude Code after --dangerously-skip-permissions.
# Examples:
#   (no args)           → interactive session
#   --resume "name"     → resume named session
#   -p "prompt"         → headless single prompt
exec claude --dangerously-skip-permissions "$@"

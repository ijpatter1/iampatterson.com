# Claude Code Sandbox for iampatterson.com
# Isolated environment for running Claude Code with --dangerously-skip-permissions
#
# Build: make build (or docker build -t iampatterson-sandbox -f sandbox/Dockerfile sandbox/)
# Run:   make sandbox (or see Makefile for full command)
#
# CONFIGURATION:
# The project's .claude/settings.json (permissions, hooks) loads from /workspace/.claude/
# via the bind mount. Claude Code's internal state (auth, session history, auto-memory)
# persists in /home/claude/.claude/ via a named Docker volume. These are separate paths
# that merge at runtime — project-level settings from the workspace, user-level state
# from the volume.

FROM node:20-slim

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    git \
    jq \
    dnsutils \
    iptables \
    iproute2 \
    ca-certificates \
    gnupg \
    python3 \
    python3-pip \
    python3-venv \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# ─────────────────────────────────────────────
# OPTIONAL: Google Cloud CLI
# Uncomment when needed (Phase 4+). Adds ~500MB to image and slows build.
# For Phase 1-3, gcloud is not required.
# ─────────────────────────────────────────────
# RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
#     gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && \
#     echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | \
#     tee /etc/apt/sources.list.d/google-cloud-sdk.list && \
#     apt-get update && apt-get install -y --no-install-recommends google-cloud-cli && \
#     rm -rf /var/lib/apt/lists/*

# Create non-root user
ARG HOST_UID=1000
ARG HOST_GID=1000
RUN groupadd -g ${HOST_GID} claude && \
    useradd -m -u ${HOST_UID} -g ${HOST_GID} -s /bin/bash claude && \
    echo "claude ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/claude

# Copy firewall initialization script
COPY init-firewall.sh /usr/local/bin/init-firewall.sh
RUN chmod +x /usr/local/bin/init-firewall.sh

# Copy entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory
WORKDIR /workspace

# Default to entrypoint — all arguments are forwarded to Claude Code
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

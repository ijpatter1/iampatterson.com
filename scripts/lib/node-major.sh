#!/usr/bin/env bash
# The expected Node major, derived rather than written down twice.
#
# Before 2026-09-12 the number 24 was live on eight lines of verify-node24.sh —
# four assertions, one evidence label, and three non-assertion surfaces (the
# Homebrew PATH export, the output filename, the report header) — and two of
# them were pinned as source text by its test. Two files, and a migration had to
# find every line. The Dockerfiles are the honest source: they are what actually
# builds the shipped artifact, so every other surface is checked *against* them
# rather than against a copy. They are not, however, the only place the number
# is written down — the two CI workflows, dockerfile.test.ts, the UAT script and
# three docs still carry it; the runbook's migration checklist names them.
#
# Sourceable with no side effects, so the test can exercise these on sample
# inputs instead of grepping the caller for a magic string.

# Major from a Dockerfile's `FROM node:NN-slim` line. Case-insensitive and
# tolerant of leading whitespace, because Docker accepts both and a matcher
# that silently skips such a line reports "no drift" when a stage has drifted.
node_major_from_dockerfile() {
  # Tolerates: lowercase `from`, leading whitespace, `--platform=` and other
  # flag args, a bare `node:24` with no suffix, and `node:24.13.3-slim`.
  # An earlier version required a `.` or `-` after the digits and no flags,
  # so `FROM node:24` and `FROM --platform=... node:24-slim` both yielded
  # empty — which the caller then compared as equal to an absent value.
  sed -nE 's/^[[:space:]]*[Ff][Rr][Oo][Mm][[:space:]]+(--[^[:space:]]+[[:space:]]+)*node:([0-9]+).*/\2/p' "$1" | head -1
}

# Major from an npm range: ^24.13.3, ~24.13.3, >=24.0.0, 24.x, 24 all give 24.
# Leading non-digits are stripped rather than matched, so a new range operator
# does not silently report "off major".
major_of_range() {
  printf '%s' "$1" | sed -E 's/^[^0-9]*//' | cut -d. -f1
}

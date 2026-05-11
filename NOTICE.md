# NOTICE

This repository is a **soft fork** of [openclaw/openclaw](https://github.com/openclaw/openclaw)
(MIT License, © OpenClaw contributors), bootstrapped on 2026-05-11 by copying the upstream tree
at its `main` branch into a fresh git history. The two repositories are not linked at the git
level; upstream changes are pulled in manually when needed.

The legal-research layer being added on top (planned location: `docs/legal/`, `rules/`,
`schemas/`, `skills/<legal-*>/`, `company-context/`, `source-profiles/`, `migrations/`,
`apps/mcp-kb/`, `apps/ingestion-worker/`, and a plugin pack under the extensions/plugins
convention OpenClaw uses) is governed by the PRD at
[`docs/legal/PRD-OPENCLAW-FORK.md`](docs/legal/PRD-OPENCLAW-FORK.md).

OpenClaw's `LICENSE` file is preserved unmodified at the repository root and continues to
apply to all upstream-derived code. New legal-layer files added by this project inherit the
same MIT License unless explicitly marked otherwise.

## Build phase tracker

- **Phase 0 — spike & verify** (current): bootstrap, OAuth, plugin SDK reconnaissance,
  trivial-tool spike, GO/NO-GO report. No legal-layer code authored.
- Phase 1+: see PRD §17.

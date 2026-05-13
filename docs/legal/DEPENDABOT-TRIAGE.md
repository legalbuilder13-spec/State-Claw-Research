# Dependabot PR Triage

**Date:** 2026-05-13
**Repo:** [legalbuilder13-spec/State-Claw-Research](https://github.com/legalbuilder13-spec/State-Claw-Research)
**Open PRs reviewed:** 7 (all dependabot)
**Open issues:** 0

All 7 open PRs are inherited dependabot noise from the upstream OpenClaw fork. None affect the legal-research code path (`apps/mcp-kb/`, `apps/ingestion-worker/`, `extensions/legal-spike/`, the rules/schemas/skills/company-context corpus). They touch GitHub Actions workflows, the macOS app, and the Android app.

## Recommendation matrix

| PR                                                                      | Title                                                                                     | Surface                                                                                     | Risk     | Recommended action                  | Why                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#1](https://github.com/legalbuilder13-spec/State-Claw-Research/pull/1) | Bump android-deps group (5 deps)                                                          | `apps/android/` (Gradle: compose-bom, webkit, kotlinx-coroutines 1.10→1.11, gradle-wrapper) | Low      | **Close**                           | The Android app is upstream OpenClaw scope, not in our fork's roadmap (PRD §17 ends at VS Code + Slack + Discord + web chat in Phase 7). Re-evaluate if we ever ship the Android channel.                                                                           |
| [#2](https://github.com/legalbuilder13-spec/State-Claw-Research/pull/2) | Bump peekaboo 3.0.0 → 3.1.2 in apps/macos                                                 | `apps/macos/` (Swift Package)                                                               | Low      | **Close**                           | Same as #1 — macOS companion app is not on the legal-research critical path.                                                                                                                                                                                        |
| [#4](https://github.com/legalbuilder13-spec/State-Claw-Research/pull/4) | Bump pnpm/action-setup 4.3.0 → 6.0.6                                                      | `.github/workflows/`                                                                        | Medium   | **Merge after CI green**            | Major bump (4 → 6) but v6 supports pnpm v11, which is what `package.json#packageManager` already pins (11.0.8). Aligns the action with the actual runtime. Let CI verify before landing.                                                                            |
| [#5](https://github.com/legalbuilder13-spec/State-Claw-Research/pull/5) | Bump docker/login-action 3.6.0 → 4.1.0                                                    | `.github/workflows/`                                                                        | Medium   | **Merge after CI green**            | Major bump but action-level only (no behavior change for `docker login`). Used by image-publish workflows. Safe if CI green.                                                                                                                                        |
| [#6](https://github.com/legalbuilder13-spec/State-Claw-Research/pull/6) | Bump actions/github-script 8 → 9                                                          | `.github/workflows/`                                                                        | **High** | **Hold** — inspect call sites first | v9 is ESM-only; `require('@actions/github')` no longer works inside scripts. If any workflow does `const { getOctokit } = require(...)` it will syntax-error. Inspect every `actions/github-script@v8` call site in `.github/workflows/**` first; rewrite or merge. |
| [#7](https://github.com/legalbuilder13-spec/State-Claw-Research/pull/7) | Bump actions/cache 4 → 5                                                                  | `.github/workflows/`                                                                        | Low      | **Merge after CI green**            | v5 requires Node.js 24 runtime + runner ≥ 2.327.1. GitHub-hosted runners are current; safe.                                                                                                                                                                         |
| [#8](https://github.com/legalbuilder13-spec/State-Claw-Research/pull/8) | Bump the actions group (create-github-app-token 3 → 3.1.1, openai/codex-action 1.7 → 1.8) | `.github/workflows/`                                                                        | Low      | **Merge after CI green**            | Both minor bumps (semver-compatible). The `openai/codex-action` bump is named "tighten what bots are allowed" — desirable security update.                                                                                                                          |

## Suggested order of operations

1. **Inspect PR #6 call sites first** before any merging:
   ```sh
   gh auth login                                # one-time, interactive
   grep -RIn "actions/github-script" .github/workflows/
   # For each match: read the inline script. If it uses `require('@actions/github')`,
   # update to use the injected `github` object instead. Then approve/merge #6.
   ```
2. **Bulk-merge the safe set** (#4, #5, #7, #8) once CI is green on each:
   ```sh
   for n in 4 5 7 8; do
     gh pr checks "$n" --repo legalbuilder13-spec/State-Claw-Research
     gh pr merge "$n"  --repo legalbuilder13-spec/State-Claw-Research --squash --delete-branch
   done
   ```
3. **Close out-of-scope PRs** (#1, #2) with a brief comment so dependabot stops re-opening them:
   ```sh
   for n in 1 2; do
     gh pr close "$n" --repo legalbuilder13-spec/State-Claw-Research \
       --comment "Closing — upstream OpenClaw surface (Android/macOS app) not in this fork's Phase 1–7 roadmap. Will revisit if/when we ship the corresponding channel. See docs/legal/DEPENDABOT-TRIAGE.md."
   done
   ```
4. **(Optional, follow-up)** add a `.github/dependabot.yml` override scoping ecosystem updates to the surfaces this fork actually owns (`apps/mcp-kb/`, `apps/ingestion-worker/`, `extensions/agentic-law-os/`, `.github/workflows/`). Cuts the per-month PR noise from dozens to a handful. Sketch:

   ```yaml
   version: 2
   updates:
     - package-ecosystem: github-actions
       directory: "/"
       schedule: { interval: "monthly" }
     - package-ecosystem: npm
       directory: "/apps/mcp-kb"
       schedule: { interval: "weekly" }
     - package-ecosystem: pip
       directory: "/apps/ingestion-worker"
       schedule: { interval: "weekly" }
     # Suppress upstream-only surfaces
     - package-ecosystem: gradle
       directory: "/apps/android"
       schedule: { interval: "monthly" }
       open-pull-requests-limit: 0
     - package-ecosystem: swift
       directory: "/apps/macos"
       schedule: { interval: "monthly" }
       open-pull-requests-limit: 0
   ```

## Why this isn't auto-merged

Read-only inspection only — `gh` was installed locally but cannot be authenticated without explicit user direction (extracting a credential from the git keychain to authenticate a different tool requires permission the build agent doesn't have). Run `gh auth login` once, then the commands above are copy-paste.

Total estimated user time to clear the backlog: ~5 minutes (one-time auth + the loops above + #6 inspection).

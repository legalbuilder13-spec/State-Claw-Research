# Phase 0 — Live OAuth + Tool-Call Spike (deferred)

**Status:** Open. Requires interactive TTY for OAuth flow; cannot be run from a non-interactive build agent. ~30 minutes of user time.

---

## Why it's still open

[`PHASE-0-REPORT.md` §3](PHASE-0-REPORT.md) noted: _"Live tool-call spike not run end-to-end. OAuth requires interactive TTY (user-side) and the spike requires `pnpm dev` followed by manual prompting. Static evidence is overwhelmingly positive; live confirmation is a smoke test, not a gate."_

The static evidence in [`PLUGIN-SDK-NOTES.md`](PLUGIN-SDK-NOTES.md) (every plugin SDK seam GREEN, sub-agent dispatch documented, OAuth `--device-code` flag confirmed) made Phase 0 → Phase 1 transition safe without the live run. But before Phase 4 implementation actually starts wiring real hooks, this 30-minute confirmation closes the last open Phase 0 question.

## Repro steps

```sh
cd "/Users/marcocrocetti/Desktop/State Claw Research"
pnpm dev   # background; serves the OpenClaw runtime from src/

# In a second terminal (or via the device-code flow if no TTY):
node openclaw.mjs onboard --auth-choice openai-codex
# OR
node openclaw.mjs models auth login --provider openai-codex --device-code
# Follow the URL, paste the code, complete OAuth.

# Then prompt the agent (CLI, or via the Slack channel if configured) with:
#   "Call the legal_spike_echo tool with message='phase-0 ping'."
# Capture the transcript.
```

## What "passing" looks like

1. OAuth completes; `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` exists.
2. The agent loop starts and identifies `legal_spike_echo` as an available tool.
3. The agent calls `legal_spike_echo({ message: "phase-0 ping" })`.
4. The response includes `{ echoed: "phase-0 ping", timestamp: "...", source: "extensions/legal-spike" }`.
5. Save the transcript (paste into this doc, replacing the placeholder section below).

## Transcript

_TODO: paste the live transcript here when the spike runs._

## What this unblocks

When this passes, `extensions/legal-spike/` can be removed — its job is done. From there, Phase 4 implementation in [`extensions/agentic-law-os/`](../../extensions/agentic-law-os/) takes over.

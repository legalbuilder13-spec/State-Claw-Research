# Source Profiles

A source profile selects the retrieval backend for a run. **Profile B (Lexis-free) is the default and the v1 build target.** Profile A (Lexis-enabled) is an opt-in configuration layer added later.

The active profile is named in `TaskSpec.source_profile` (`"A"` or `"B"`). The legal-research plugin loads the corresponding YAML at run start, computes the allowlist that R1 SourceAllowlist enforces, and binds the per-tool jurisdiction enum that R2 JurisdictionLock enforces.

## Files

| File | Purpose |
|---|---|
| [`profile-b-free.yaml`](profile-b-free.yaml) | Default. Lexis-free; ingested official corpus + free citator chain. |
| [`profile-a-lexis.yaml`](profile-a-lexis.yaml) | Opt-in. Adds live Lexis+ Brief Analysis, Shepardize, and Doc Get on top of Profile B. |

## How profiles are consumed

1. **R1 SourceAllowlist** reads `primary_*_source`, `secondary_*_sources`, and `citator_chain[*].id` from the active YAML to compute the per-run allowlist. KB tools targeting a source not in the allowlist are blocked at `before_tool_call`.
2. **R10 CurrencyTag** reads `ingestion.cadence` to compute the per-source staleness threshold (default thresholds may be overridden per profile).
3. **R14 NoLawFirmCitation** reads `agency_guidance.categorization` to decide whether agency guidance is `citation_eligible` (Profile A default) or `orientation_only` (Profile B default).
4. The Knowledge Base MCP server (`apps/mcp-kb/`) reads `DEFAULT_SOURCE_PROFILE` env var to select the backend (Profile B = local Postgres pgvector + tsvector; Profile A = also dispatches to Lexis via Chrome MCP / Playwright).
5. The ingestion worker (`apps/ingestion-worker/`) reads `ingestion.parser` and `ingestion.embedding` to select Docling vs. Reducto and the embedding model.

## Choosing a profile

- **Use Profile B** if: no Lexis seat, or want the closed-corpus deterministic behavior of local pgvector retrieval, or want the lower TCO (~$50–100/mo per PRD §16) than the Lexis seat.
- **Use Profile A** if: have a Lexis+ seat, want live citator results, want broader case-law coverage than CourtListener + CAP, or work in practice areas where Lexis's secondary materials are load-bearing.

## Per-jurisdiction overrides

A profile can carry per-jurisdiction overrides in the optional `overrides` block:

```yaml
overrides:
  US-IL:
    citator_chain:
      - id: vlex_fastcase
        enabled: true   # IL state bar membership grants Fastcase access
```

The overrides merge over the profile-level defaults at run start. The merged result is what R1's allowlist is computed from.

## Adding a new source

1. Pick a stable identifier (snake_case): `casetext_free`, `vlex_fastcase`, `agency_guidance_ccr_letters`, etc.
2. Add to one of the source-list keys in `profile-b-free.yaml` (`secondary_statute_sources`, `secondary_case_sources`, `citator_chain`, etc.) if it's part of the free baseline; or to `profile-a-lexis.yaml` if Lexis-tier.
3. Register the source in `schemas/source-categories.schema.json` under the appropriate enum (`citation_eligible` or `orientation_only`).
4. Implement the kb tool that targets the source (Phase 3 KB MCP server work).
5. Update [`docs/legal/PLUGIN-SDK-NOTES.md`](../docs/legal/PLUGIN-SDK-NOTES.md) if the new source needs a new tool registration.

## What lives in the YAML vs. elsewhere

- **YAML carries CONFIG**: which sources are allowlisted, which citators run, which embedding model the ingestion worker uses.
- **Schemas carry STRUCTURE**: `schemas/source-categories.schema.json` is the canonical list of valid source kinds; the YAML references it but doesn't redefine it.
- **Code carries BEHAVIOR**: the KB tool implementations (Phase 3, `apps/mcp-kb/src/`) and the ingestion worker (Phase 2, `apps/ingestion-worker/`) read the YAML at start; they don't hardcode source identifiers.

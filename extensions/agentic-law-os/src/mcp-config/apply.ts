import type { OpenClawPluginApi } from "../../api.js";

/**
 * Idempotently upserts the kb-mcp server entry into .openclaw/mcp-config.json
 * on plugin startup. PRD §14 + PHASE-3-STATUS.md describe the kb_* tool
 * surface this config exposes to the OpenClaw runtime.
 *
 * Target config shape (matches docs/cli/mcp.md):
 *   {
 *     "mcpServers": {
 *       "agentic-law-os-kb": {
 *         "command": "node",
 *         "args": ["apps/mcp-kb/dist/index.js"],
 *         "env": { "DATABASE_URL": "...", "VOYAGE_API_KEY": "..." }
 *       }
 *     }
 *   }
 *
 * Skip if a "agentic-law-os-kb" entry already exists with the same command/args
 * (operator may have customized; preserve their override).
 */
export function registerMcpKbConfig(_api: OpenClawPluginApi): void {
  // TODO(phase-4): on plugin startup, read .openclaw/mcp-config.json,
  // upsert agentic-law-os-kb entry, write back atomically. Resolve command
  // + args from plugin config (see openclaw.plugin.json#configSchema.mcp_kb).
}

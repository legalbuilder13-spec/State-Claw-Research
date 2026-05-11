#!/usr/bin/env node
/**
 * MCP server entry point.
 *
 * Registers the kb_* tools and runs the stdio transport (default) or HTTP
 * (when MCP_KB_TRANSPORT=http). The orchestrator's plugin connects via
 * .openclaw/mcp-config.json.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
} from "@modelcontextprotocol/sdk/types.js";

import { getConfig } from "./config.js";
import { closePool } from "./db.js";
import { TOOLS, findToolHandler } from "./tools/index.js";

async function main(): Promise<void> {
  const cfg = getConfig();

  const server = new Server(
    {
      name: "agentic-law-os-mcp-kb",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async (_req: ListToolsRequest) => {
    return { tools: TOOLS.map((t) => t.tool) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req: CallToolRequest) => {
    const { name, arguments: args } = req.params;
    const handler = findToolHandler(name);
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return handler((args ?? {}) as Record<string, unknown>);
  });

  if (cfg.transport === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Server stays alive until stdin closes.
    process.stderr.write(
      `[mcp-kb] ready (stdio); ${TOOLS.length} tools registered; profile=${cfg.defaultSourceProfile}\n`,
    );
  } else {
    throw new Error(`Transport ${cfg.transport} not yet implemented (stdio only in v1)`);
  }
}

async function shutdown(): Promise<void> {
  try {
    await closePool();
  } catch (err) {
    process.stderr.write(`[mcp-kb] shutdown error: ${String(err)}\n`);
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

main().catch((err) => {
  process.stderr.write(`[mcp-kb] fatal: ${String(err?.stack ?? err)}\n`);
  process.exit(1);
});

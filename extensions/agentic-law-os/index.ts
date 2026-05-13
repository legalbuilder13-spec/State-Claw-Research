import { definePluginEntry, type OpenClawPluginApi } from "./api.js";
import { registerTier1Intake } from "./src/intake/tier1-intake.js";
import { registerMcpKbConfig } from "./src/mcp-config/apply.js";
import { registerOrchestrator } from "./src/orchestrator/orchestrator.js";
import { registerRuleEngine } from "./src/rules/index.js";
import { registerSubagents } from "./src/subagents/index.js";

export default definePluginEntry({
  id: "agentic-law-os",
  name: "Agentic-Law-OS",
  description:
    "Tier-1 intake + orchestrator + R1-R15 rule engine + Statute/Verifier/Confidence/Renderer sub-agents. " +
    "Consumes the kb_* MCP tools from apps/mcp-kb/. Refuses rather than fabricates: every output is hash-anchored and verified.",
  register(api: OpenClawPluginApi) {
    registerMcpKbConfig(api);
    registerTier1Intake(api);
    registerOrchestrator(api);
    registerRuleEngine(api);
    registerSubagents(api);
  },
});

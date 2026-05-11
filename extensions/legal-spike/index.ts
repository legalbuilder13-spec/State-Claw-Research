import { definePluginEntry, type AnyAgentTool, type OpenClawPluginApi } from "./api.js";
import { createLegalSpikeEchoTool } from "./src/echo-tool.js";

export default definePluginEntry({
  id: "legal-spike",
  name: "Legal Spike",
  description: "Phase 0 Agentic-Law-OS verification probe.",
  register(api: OpenClawPluginApi) {
    api.registerTool(createLegalSpikeEchoTool() as unknown as AnyAgentTool);
  },
});

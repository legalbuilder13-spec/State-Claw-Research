import { Type, type Static } from "typebox";

const echoParamsSchema = Type.Object(
  {
    message: Type.String({
      description: "Message to echo back to the model with a server-side timestamp.",
      minLength: 1,
      maxLength: 4000,
    }),
  },
  { additionalProperties: false },
);

type EchoParams = Static<typeof echoParamsSchema>;

interface EchoDetails {
  echoed: string;
  timestamp: string;
  toolCallId: string;
  source: "extensions/legal-spike";
}

export function createLegalSpikeEchoTool() {
  return {
    name: "legal_spike_echo",
    label: "Legal Spike: Echo",
    description:
      "Phase 0 verification probe. Echoes the provided message back with an ISO-8601 timestamp. " +
      "Has no side effects; safe to call any number of times. " +
      "DO NOT use this in legal-research workflows — it exists only to prove OpenClaw's plugin SDK + Codex tool-calling pipeline works end-to-end before the real R1–R15 rule engine is built.",
    parameters: echoParamsSchema,
    async execute(
      toolCallId: string,
      params: EchoParams,
    ): Promise<{ content: Array<{ type: "text"; text: string }>; details: EchoDetails }> {
      const timestamp = new Date().toISOString();
      const details: EchoDetails = {
        echoed: params.message,
        timestamp,
        toolCallId,
        source: "extensions/legal-spike",
      };
      return {
        content: [{ type: "text", text: JSON.stringify(details) }],
        details,
      };
    },
  };
}

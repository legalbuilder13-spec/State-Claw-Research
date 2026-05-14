import { Type, type Static } from "typebox";

/**
 * Runtime validator for the TaskSpec contract. Mirrors
 * schemas/task-spec.schema.json — keep the two in sync.
 *
 * Tier-1 intake builds a TaskSpec from the requester message + channel
 * context, freezes it, and attaches it to the run context. Every sub-agent
 * reads from this; nothing mutates it after frozen_at.
 */
export const taskSpecSchema = Type.Object(
  {
    id: Type.String({ minLength: 26, maxLength: 26, description: "ULID" }),
    created_at: Type.String({ format: "date-time" }),
    frozen_at: Type.String({ format: "date-time" }),
    requester: Type.Object({
      channel: Type.Union([
        Type.Literal("slack"),
        Type.Literal("discord"),
        Type.Literal("vscode"),
        Type.Literal("cli"),
        Type.Literal("web"),
      ]),
      user_id: Type.String({ minLength: 1 }),
      display_name: Type.Optional(Type.String()),
      email: Type.Optional(Type.String({ format: "email" })),
      raw_message_id: Type.Optional(Type.String()),
    }),
    verbatim_question: Type.String({ minLength: 1, maxLength: 16000 }),
    jurisdictions: Type.Array(Type.String({ pattern: "^[A-Z]{2}-[A-Z]{2}$" }), {
      minItems: 1,
      uniqueItems: true,
    }),
    topic: Type.Union([
      Type.Literal("worker_classification"),
      Type.Literal("licensing_staffing_agency"),
      Type.Literal("joint_employer"),
      Type.Literal("background_check_obligations"),
      Type.Literal("credentialing_requirements"),
      Type.Literal("wage_hour_compliance"),
      Type.Literal("marketplace_contractor_law"),
      Type.Literal("hipaa_baa"),
      Type.Literal("vendor_contract_review"),
      Type.Literal("marketing_classification_risk"),
      Type.Literal("policy_compliance_obligation"),
      Type.Literal("facility_policy_transmission"),
      Type.Literal("other"),
    ]),
    source_profile: Type.Union([Type.Literal("profile-a-lexis"), Type.Literal("profile-b-free")]),
    company_context_ref: Type.Object({
      path: Type.String({ minLength: 1 }),
      version_hash: Type.Optional(Type.String({ pattern: "^[0-9a-f]{64}$" })),
    }),
    output_type: Type.Union([
      Type.Literal("slack_response"),
      Type.Literal("memo"),
      Type.Literal("chart"),
      Type.Literal("research_trail"),
      Type.Literal("incomplete_notice"),
    ]),
    requires_fresh: Type.Optional(Type.Boolean()),
    priority: Type.Optional(
      Type.Union([
        Type.Literal("low"),
        Type.Literal("medium"),
        Type.Literal("high"),
        Type.Literal("urgent"),
      ]),
    ),
    deadline: Type.Optional(Type.String({ format: "date-time" })),
    pre_flight_notes: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type TaskSpec = Static<typeof taskSpecSchema>;

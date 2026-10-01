import { generatedRegistrarNames } from "./generated-registrars.js";

export const KITCHEN_SINK_PERSONALITIES = ["full", "conformance", "adversarial"];

export const DEFAULT_KITCHEN_SINK_PERSONALITY = "full";

const registrarDiagnostics = {
  registerGatewayAccessPolicy: "Gateway access policy requires an authorize handler",
  registerDecisionProvider: "invalid version 1 decision provider contract",
};
const surfaceDiagnostics = generatedRegistrarNames.flatMap((name) =>
  registrarDiagnostics[name] ? [registrarDiagnostics[name]] : [],
);

export const KITCHEN_SINK_EXPECTED_DIAGNOSTICS = {
  full: [
    ...surfaceDiagnostics,
    "agent tool result middleware must be a function",
    "agent event subscription registration requires id and handle",
    'agent harness "kitchen-sink-agent-harness" registration missing required runtime methods',
    'channel "kitchen-sink-channel-probe" registration missing or invalid required capabilities.chatTypes',
    "cli registration missing explicit commands metadata",
    "only bundled plugins can register Codex app-server extension factories",
    'compaction provider "kitchen-sink-compaction-provider" registration missing summarize',
    "context engine registration missing id",
    "hosted media resolver registration missing resolver",
    "http route registration missing or invalid auth: /kitchen-sink/http-route",
    "invalid widget presenter registration",
    "node invoke policy registration missing commands",
    "trusted tool policy registration requires id, description, and evaluate()",
    "plugin must declare contracts.embeddingProviders for adapter: kitchen-sink-embedding-provider",
    "plugin must declare contracts.tools for: kitchen-sink-tool",
    "memory prompt supplement registration missing builder",
    "memory prompt preparation registration missing prepare function",
    "MCP server connection resolver registration missing serverName or resolve",
    "model catalog provider registration missing provider",
    "session extension registration requires namespace and description",
    "session scheduler job registration requires unique id, sessionKey, and kind",
    "tool metadata registration missing toolName",
    "worker provider registration missing method: resolveAllocation",
  ],
  conformance: [],
  adversarial: [
    ...surfaceDiagnostics,
    "agent tool result middleware must be a function",
    "agent event subscription registration requires id and handle",
    'agent harness "kitchen-sink-agent-harness" registration missing required runtime methods',
    'channel "kitchen-sink-channel-probe" registration missing or invalid required capabilities.chatTypes',
    "cli registration missing explicit commands metadata",
    "only bundled plugins can register Codex app-server extension factories",
    'compaction provider "kitchen-sink-compaction-provider" registration missing summarize',
    "context engine registration missing id",
    "hosted media resolver registration missing resolver",
    "http route registration missing or invalid auth: /kitchen-sink/http-route",
    "invalid widget presenter registration",
    "node invoke policy registration missing commands",
    "trusted tool policy registration requires id, description, and evaluate()",
    "plugin must declare contracts.embeddingProviders for adapter: kitchen-sink-embedding-provider",
    "plugin must declare contracts.tools for: kitchen-sink-tool",
    "memory prompt supplement registration missing builder",
    "memory prompt preparation registration missing prepare function",
    "MCP server connection resolver registration missing serverName or resolve",
    "model catalog provider registration missing provider",
    "session extension registration requires namespace and description",
    "session scheduler job registration requires unique id, sessionKey, and kind",
    "tool metadata registration missing toolName",
    "worker provider registration missing method: resolveAllocation",
  ],
};

export function resolveKitchenSinkPersonality(api) {
  const configured =
    api?.pluginConfig?.personality || process.env.OPENCLAW_KITCHEN_SINK_PERSONALITY;
  return KITCHEN_SINK_PERSONALITIES.includes(configured) ? configured : DEFAULT_KITCHEN_SINK_PERSONALITY;
}

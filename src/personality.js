export const KITCHEN_SINK_PERSONALITIES = ["full", "conformance", "adversarial"];

export const DEFAULT_KITCHEN_SINK_PERSONALITY = "full";

export const KITCHEN_SINK_EXPECTED_DIAGNOSTICS = {
  full: [
    "only bundled plugins can register agent tool result middleware",
    "agent event subscription registration requires id and handle",
    'agent harness "kitchen-sink-agent-harness" registration missing required runtime methods',
    'channel "kitchen-sink-channel-probe" registration missing required config helpers',
    "cli registration missing explicit commands metadata",
    "only bundled plugins can register Codex app-server extension factories",
    'compaction provider "kitchen-sink-compaction-provider" registration missing summarize',
    "context engine registration missing id",
    "control UI descriptor registration requires id, surface, label, and valid optional fields",
    "http route registration missing or invalid auth: /kitchen-sink/http-route",
    "node invoke policy registration missing commands",
    "only bundled plugins can register trusted tool policies",
    "plugin must declare contracts.tools for: kitchen-sink-tool",
    "memory prompt supplement registration missing builder",
    "session extension registration requires namespace and description",
    "session scheduler job registration requires unique id, sessionKey, and kind",
    "tool metadata registration missing toolName",
  ],
  conformance: [],
  adversarial: [
    "only bundled plugins can register agent tool result middleware",
    "agent event subscription registration requires id and handle",
    'agent harness "kitchen-sink-agent-harness" registration missing required runtime methods',
    'channel "kitchen-sink-channel-probe" registration missing required config helpers',
    "cli registration missing explicit commands metadata",
    "only bundled plugins can register Codex app-server extension factories",
    'compaction provider "kitchen-sink-compaction-provider" registration missing summarize',
    "context engine registration missing id",
    "control UI descriptor registration requires id, surface, label, and valid optional fields",
    "http route registration missing or invalid auth: /kitchen-sink/http-route",
    "node invoke policy registration missing commands",
    "only bundled plugins can register trusted tool policies",
    "plugin must declare contracts.tools for: kitchen-sink-tool",
    "memory prompt supplement registration missing builder",
    "session extension registration requires namespace and description",
    "session scheduler job registration requires unique id, sessionKey, and kind",
    "tool metadata registration missing toolName",
  ],
};

export function resolveKitchenSinkPersonality(api) {
  const configured =
    api?.pluginConfig?.personality || process.env.OPENCLAW_KITCHEN_SINK_PERSONALITY;
  return KITCHEN_SINK_PERSONALITIES.includes(configured) ? configured : DEFAULT_KITCHEN_SINK_PERSONALITY;
}

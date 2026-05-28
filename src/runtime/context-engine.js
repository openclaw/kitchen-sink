import { CONTEXT_ENGINE_ID, PLUGIN_ID } from "../constants.js";
import { kitchenPromptGuidance } from "../scenarios.js";

export function buildKitchenContextEngine() {
  return {
    info: {
      id: CONTEXT_ENGINE_ID,
      name: "Kitchen Sink Context Engine",
      ownsCompaction: false,
    },
    bootstrap: async () => ({ bootstrapped: true, importedMessages: 0 }),
    maintain: async () => ({ changed: false, bytesFreed: 0, rewrittenEntries: 0 }),
    ingest: async () => ({ ingested: true }),
    ingestBatch: async ({ messages = [] } = {}) => ({ ingestedCount: messages.length }),
    assemble: async ({ messages = [] } = {}) => ({
      messages,
      estimatedTokens: estimateKitchenContextTokens(messages),
      systemPromptAddition: [
        "Kitchen Sink context engine fixture is active.",
        ...kitchenPromptGuidance(),
      ].join("\n"),
    }),
    afterTurn: async () => {},
    compact: async () => ({
      ok: true,
      compacted: false,
      reason: `${PLUGIN_ID} preserves fixture transcript context without rewriting.`,
    }),
  };
}

function estimateKitchenContextTokens(messages) {
  const text = messages.map((message) => JSON.stringify(message)).join("\n");
  return Math.max(1, Math.ceil(text.length / 4));
}

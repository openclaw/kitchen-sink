import { delegateCompactionToRuntime } from "openclaw/plugin-sdk/core";
import { CONTEXT_ENGINE_ID } from "../constants.js";
import { createKitchenCompaction, kitchenPromptGuidance } from "../scenarios.js";

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
    compact: async (params = {}) => {
      if (params.runtimeContext) {
        return delegateCompactionToRuntime(params);
      }
      const result = createKitchenCompaction(params);
      return {
        ok: true,
        compacted: true,
        reason: "Kitchen Sink context engine compacted fixture transcript context.",
        result: {
          summary: result.summary,
          details: result,
          tokensBefore: params.currentTokenCount,
        },
      };
    },
  };
}

function estimateKitchenContextTokens(messages) {
  const text = messages.map((message) => JSON.stringify(message)).join("\n");
  return Math.max(1, Math.ceil(text.length / 4));
}

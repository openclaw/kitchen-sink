import {
  COMPACTION_PROVIDER_ID,
  EMBEDDING_PROVIDER_ID,
  MUSIC_PROVIDER_ID,
  PLUGIN_ID,
  REALTIME_TRANSCRIPTION_PROVIDER_ID,
  REALTIME_VOICE_PROVIDER_ID,
  SPEECH_PROVIDER_ID,
  VIDEO_PROVIDER_ID,
} from "../constants.js";

export function buildKitchenToolResultMiddleware() {
  return async (event = {}) => ({
    ...event,
    kitchenSink: true,
    pluginId: PLUGIN_ID,
    scenarioId: "tool-result.middleware",
    result: event.result,
    metadata: {
      ...(event.metadata || {}),
      kitchenSinkToolResultMiddleware: true,
    },
  });
}

export function buildKitchenService() {
  return {
    id: "kitchen-sink-service",
    name: "Kitchen Sink Service",
    description: "Credential-free background service fixture.",
    start: async () => ({ ok: true, service: "kitchen-sink-service", state: "started" }),
    stop: async () => ({ ok: true, service: "kitchen-sink-service", state: "stopped" }),
    probe: async () => ({ ok: true, service: "kitchen-sink-service", state: "ready" }),
  };
}

export function buildKitchenHttpRoute() {
  return {
    id: "kitchen-sink-http-status",
    path: "/kitchen-sink/status",
    auth: "gateway",
    match: "exact",
    handler: async (_req, res) => {
      const body = JSON.stringify({ ok: true, pluginId: PLUGIN_ID, scenarioId: "http.status" });
      if (res && typeof res === "object") {
        res.statusCode = 200;
        res.setHeader?.("content-type", "application/json");
        res.end?.(body);
      }
      return { ok: true, body };
    },
  };
}

export function buildKitchenGatewayMethod() {
  return async () => ({
    ok: true,
    pluginId: PLUGIN_ID,
    providerIds: [
      SPEECH_PROVIDER_ID,
      REALTIME_TRANSCRIPTION_PROVIDER_ID,
      REALTIME_VOICE_PROVIDER_ID,
      VIDEO_PROVIDER_ID,
      MUSIC_PROVIDER_ID,
      EMBEDDING_PROVIDER_ID,
      COMPACTION_PROVIDER_ID,
    ],
  });
}

export function buildKitchenCliRegistrar() {
  return async ({ program } = {}) => {
    const command = program
      ?.command?.("kitchen-sink")
      ?.description?.("Show Kitchen Sink fixture status.");
    command?.option?.("--json", "Output JSON.");
    command?.action?.((options = {}) => {
      const result = {
        ok: true,
        pluginId: PLUGIN_ID,
        scenarioId: "cli.status",
      };
      process.stdout.write(
        options.json
          ? `${JSON.stringify(result)}\n`
          : `Kitchen Sink fixture ready (${PLUGIN_ID}).\n`,
      );
      return result;
    });
    return { ok: true, command: "kitchen-sink" };
  };
}

export function buildKitchenCliMetadata() {
  return {
    descriptors: [
      {
        name: "kitchen-sink",
        description: "Show Kitchen Sink fixture status.",
        hasSubcommands: false,
      },
    ],
  };
}

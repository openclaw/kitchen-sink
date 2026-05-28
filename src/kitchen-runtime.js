import { buildKitchenChannel } from "./runtime/channel.js";
import { buildKitchenContextEngine } from "./runtime/context-engine.js";
import {
  buildKitchenCommand,
  buildKitchenImageTool,
  buildKitchenInteractiveHandler,
  buildKitchenSearchTool,
  buildKitchenSinkCommand,
  buildKitchenTextTool,
} from "./runtime/commands.js";
import {
  buildKitchenCliMetadata,
  buildKitchenCliRegistrar,
  buildKitchenGatewayMethod,
  buildKitchenHttpRoute,
  buildKitchenService,
  buildKitchenToolResultMiddleware,
} from "./runtime/platform.js";
import {
  buildKitchenCompactionProvider,
  buildKitchenImageProvider,
  buildKitchenMediaProvider,
  buildKitchenMemoryCorpusSupplement,
  buildKitchenMemoryEmbeddingProvider,
  buildKitchenMusicProvider,
  buildKitchenRealtimeTranscriptionProvider,
  buildKitchenRealtimeVoiceProvider,
  buildKitchenSpeechProvider,
  buildKitchenTextProvider,
  buildKitchenVideoProvider,
  buildKitchenWebFetchProvider,
  buildKitchenWebSearchProvider,
} from "./runtime/providers.js";
import { buildKitchenDetachedTaskRuntime } from "./runtime/tasks.js";
import {
  createKitchenScenarioRuntime,
  createKitchenSinkImageAsset,
  kitchenPromptGuidance,
  shouldHandleKitchenText,
} from "./scenarios.js";

export { createKitchenSinkImageAsset, kitchenPromptGuidance, shouldHandleKitchenText };

// Keep this file as the readable runtime table of contents. The builders live
// under src/runtime/* so plugin authors can inspect one OpenClaw surface at a
// time without losing the full registration order.
export function registerKitchenSinkRuntime(api, options = {}) {
  const runtime = createKitchenSinkRuntime(options);
  const includeAgentToolResultMiddleware = options.includeAgentToolResultMiddleware !== false;

  optionalRegister(api, "registerCommand", () => api.registerCommand(buildKitchenCommand(runtime)));
  optionalRegister(api, "registerCommand", () => api.registerCommand(buildKitchenSinkCommand(runtime)));
  optionalRegister(api, "registerInteractiveHandler", () =>
    api.registerInteractiveHandler(buildKitchenInteractiveHandler(runtime)),
  );
  optionalRegister(api, "registerChannel", () => api.registerChannel(buildKitchenChannel()));
  optionalRegister(api, "registerTool", () => api.registerTool(buildKitchenImageTool(runtime)));
  optionalRegister(api, "registerTool", () => api.registerTool(buildKitchenTextTool(runtime)));
  optionalRegister(api, "registerTool", () => api.registerTool(buildKitchenSearchTool()));
  optionalRegister(api, "registerProvider", () => api.registerProvider(buildKitchenTextProvider()));
  optionalRegister(api, "registerImageGenerationProvider", () =>
    api.registerImageGenerationProvider(buildKitchenImageProvider(runtime)),
  );
  optionalRegister(api, "registerMediaUnderstandingProvider", () =>
    api.registerMediaUnderstandingProvider(buildKitchenMediaProvider()),
  );
  optionalRegister(api, "registerSpeechProvider", () => api.registerSpeechProvider(buildKitchenSpeechProvider()));
  optionalRegister(api, "registerRealtimeTranscriptionProvider", () =>
    api.registerRealtimeTranscriptionProvider(buildKitchenRealtimeTranscriptionProvider()),
  );
  optionalRegister(api, "registerRealtimeVoiceProvider", () =>
    api.registerRealtimeVoiceProvider(buildKitchenRealtimeVoiceProvider()),
  );
  optionalRegister(api, "registerVideoGenerationProvider", () =>
    api.registerVideoGenerationProvider(buildKitchenVideoProvider()),
  );
  optionalRegister(api, "registerMusicGenerationProvider", () =>
    api.registerMusicGenerationProvider(buildKitchenMusicProvider()),
  );
  optionalRegister(api, "registerWebSearchProvider", () =>
    api.registerWebSearchProvider(buildKitchenWebSearchProvider()),
  );
  optionalRegister(api, "registerWebFetchProvider", () =>
    api.registerWebFetchProvider(buildKitchenWebFetchProvider()),
  );
  optionalRegister(api, "registerDetachedTaskRuntime", () =>
    api.registerDetachedTaskRuntime(buildKitchenDetachedTaskRuntime()),
  );
  optionalRegister(api, "registerMemoryEmbeddingProvider", () =>
    api.registerMemoryEmbeddingProvider(buildKitchenMemoryEmbeddingProvider()),
  );
  optionalRegister(api, "registerMemoryCorpusSupplement", () =>
    api.registerMemoryCorpusSupplement(buildKitchenMemoryCorpusSupplement()),
  );
  optionalRegister(api, "registerCompactionProvider", () =>
    api.registerCompactionProvider(buildKitchenCompactionProvider()),
  );
  optionalRegister(api, "registerContextEngine", () =>
    api.registerContextEngine("kitchen-sink-context-engine", () => buildKitchenContextEngine()),
  );
  if (includeAgentToolResultMiddleware) {
    optionalRegister(api, "registerAgentToolResultMiddleware", () =>
      api.registerAgentToolResultMiddleware(buildKitchenToolResultMiddleware(), {
        runtimes: ["pi", "codex", "cli"],
      }),
    );
  }
  optionalRegister(api, "registerService", () => api.registerService(buildKitchenService()));
  optionalRegister(api, "registerHttpRoute", () => api.registerHttpRoute(buildKitchenHttpRoute()));
  optionalRegister(api, "registerGatewayMethod", () =>
    api.registerGatewayMethod("kitchen.status", buildKitchenGatewayMethod()),
  );
  optionalRegister(api, "registerCli", () => api.registerCli(buildKitchenCliRegistrar(), buildKitchenCliMetadata()));
  optionalRegister(api, "registerMemoryPromptSupplement", () =>
    api.registerMemoryPromptSupplement(async () => kitchenPromptGuidance().join("\n")),
  );

  return runtime;
}

export function createKitchenSinkRuntime(options = {}) {
  return createKitchenScenarioRuntime(options);
}

function optionalRegister(api, method, register) {
  // Kitchen Sink runs against multiple SDK/inspector versions. Missing optional
  // registrar methods should quietly no-op instead of making older hosts fail.
  if (typeof api?.[method] !== "function") {
    return;
  }
  register();
}

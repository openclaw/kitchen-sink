import {
  COMPACTION_PROVIDER_ID,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MEDIA_MODEL,
  DEFAULT_TEXT_MODEL,
  EMBEDDING_PROVIDER_ID,
  IMAGE_PROVIDER_ID,
  MEDIA_PROVIDER_ID,
  MEMORY_EMBEDDING_PROVIDER_ID,
  MUSIC_PROVIDER_ID,
  PLUGIN_ID,
  REALTIME_TRANSCRIPTION_PROVIDER_ID,
  REALTIME_VOICE_PROVIDER_ID,
  SPEECH_PROVIDER_ID,
  TEXT_PROVIDER_ID,
  VIDEO_PROVIDER_ID,
  WEB_FETCH_PROVIDER_ID,
  WEB_SEARCH_PROVIDER_ID,
} from "../constants.js";
import {
  createKitchenCompaction,
  createKitchenEmbedding,
  createKitchenMemorySearch,
  createKitchenMusicResult,
  createKitchenSpeechAsset,
  createKitchenTextStream,
  createKitchenTranscription,
  createKitchenVideoResult,
  kitchenImageDescription,
  kitchenPromptGuidance,
  kitchenSearchSchema,
  kitchenTextModelDefinition,
  kitchenTextProviderConfig,
  readQuery,
  readUrl,
  runKitchenFetch,
  runKitchenSearch,
  stripDataUrl,
} from "../scenarios.js";

// Provider builders intentionally stay thin: map OpenClaw provider contracts to
// deterministic scenarios/fixtures, and keep the mock behavior outside runtime wiring.
export function buildKitchenImageProvider(runtime) {
  return {
    id: IMAGE_PROVIDER_ID,
    aliases: ["kitchen", "kitchen-sink", "openclaw-kitchen-sink"],
    label: "Kitchen Sink Image",
    defaultModel: DEFAULT_IMAGE_MODEL,
    models: [DEFAULT_IMAGE_MODEL],
    capabilities: {
      generate: {
        maxCount: 1,
        supportsSize: true,
        supportsAspectRatio: true,
        supportsResolution: true,
      },
      edit: {
        enabled: true,
        maxInputImages: 1,
        maxCount: 1,
      },
      geometry: {
        sizes: ["1024x1024"],
        aspectRatios: ["1:1"],
        resolutions: ["1K"],
      },
    },
    isConfigured: () => true,
    generateImage: async (req) => {
      const result = await runtime.runScenario({
        scenario: "image.generate",
        prompt: req?.prompt,
        route: "provider:image",
        model: req?.model,
      });
      if (result.error) {
        throw kitchenProviderError(result);
      }
      return {
        images: [stripDataUrl(result.image)],
        model: req?.model || DEFAULT_IMAGE_MODEL,
        metadata: {
          kitchenSink: true,
          job: result.job,
          asset: result.image.metadata,
          provider: IMAGE_PROVIDER_ID,
          pluginId: PLUGIN_ID,
          scenarioId: result.scenarioId,
          route: result.route,
          request: {
            prompt: req?.prompt,
            size: req?.size,
            aspectRatio: req?.aspectRatio,
            count: req?.count || 1,
          },
        },
      };
    },
  };
}

export function buildKitchenMediaProvider() {
  return {
    id: MEDIA_PROVIDER_ID,
    capabilities: ["image", "audio", "video"],
    defaultModels: { image: DEFAULT_MEDIA_MODEL },
    autoPriority: { image: 5 },
    describeImage: async (req) => ({
      text: kitchenImageDescription(req?.prompt, 1),
      model: req?.model || DEFAULT_MEDIA_MODEL,
    }),
    describeImages: async (req) => ({
      text: kitchenImageDescription(req?.prompt, Array.isArray(req?.images) ? req.images.length : 0),
      model: req?.model || DEFAULT_MEDIA_MODEL,
    }),
    transcribeAudio: async (req) => createKitchenTranscription({ audio: req?.audio, prompt: req?.prompt }),
    describeVideo: async (req) => ({
      text: "Kitchen Sink video fixture: three deterministic frames show the office sink asset, a close-up, and a fixture badge.",
      model: req?.model || DEFAULT_MEDIA_MODEL,
      metadata: { kitchenSink: true, provider: MEDIA_PROVIDER_ID, scenarioId: "media.video-describe" },
    }),
  };
}

export function buildKitchenSpeechProvider() {
  return {
    id: SPEECH_PROVIDER_ID,
    label: "Kitchen Sink Speech",
    voices: ["kitchen-neutral", "kitchen-robot"],
    defaultVoice: "kitchen-neutral",
    isConfigured: () => true,
    synthesize: async (req) => createKitchenSpeechAsset({
      text: req?.text,
      voice: req?.voice,
      model: req?.model,
    }),
    speak: async (req) => createKitchenSpeechAsset({
      text: req?.text,
      voice: req?.voice,
      model: req?.model,
    }),
  };
}

export function buildKitchenRealtimeTranscriptionProvider() {
  return {
    id: REALTIME_TRANSCRIPTION_PROVIDER_ID,
    label: "Kitchen Sink Realtime Transcription",
    isConfigured: () => true,
    createSession: (req = {}) => {
      const chunks = [];
      return {
        provider: REALTIME_TRANSCRIPTION_PROVIDER_ID,
        async connect() {
          req.onReady?.({ provider: REALTIME_TRANSCRIPTION_PROVIDER_ID });
          return { ok: true, provider: REALTIME_TRANSCRIPTION_PROVIDER_ID };
        },
        sendAudio(audio) {
          chunks.push(audio);
          req.onTranscript?.(`Kitchen Sink partial transcript ${chunks.length}.`);
        },
        async close() {
          const result = createKitchenTranscription({ audio: Buffer.concat(chunks.map(toBuffer)) });
          req.onTranscript?.(result.text);
          req.onClose?.({ code: 1000, reason: "kitchen sink complete" });
          return result;
        },
      };
    },
  };
}

export function buildKitchenRealtimeVoiceProvider() {
  return {
    id: REALTIME_VOICE_PROVIDER_ID,
    label: "Kitchen Sink Realtime Voice",
    isConfigured: () => true,
    createBridge: (req = {}) => {
      let connected = false;
      const audio = [];
      return {
        supportsToolResultContinuation: true,
        async connect() {
          connected = true;
          req.onEvent?.({ type: "connected", provider: REALTIME_VOICE_PROVIDER_ID });
        },
        sendAudio(chunk) {
          audio.push(chunk);
          req.onTranscript?.("Kitchen Sink realtime voice heard audio.");
        },
        setMediaTimestamp(timestampMs) {
          req.onEvent?.({ type: "media_timestamp", timestampMs });
        },
        submitToolResult(result) {
          req.onEvent?.({ type: "tool_result", result });
        },
        acknowledgeMark(mark) {
          req.onEvent?.({ type: "mark", mark });
        },
        close() {
          connected = false;
          req.onEvent?.({ type: "closed", audioChunks: audio.length });
        },
        isConnected: () => connected,
      };
    },
  };
}

export function buildKitchenVideoProvider() {
  return {
    id: VIDEO_PROVIDER_ID,
    label: "Kitchen Sink Video",
    defaultModel: "kitchen-sink-video-v1",
    capabilities: {
      generate: { maxVideos: 1, maxDurationSeconds: 3, supportsResolution: true },
      imageToVideo: { enabled: true, maxVideos: 1, maxInputImages: 1, maxDurationSeconds: 3 },
      videoToVideo: { enabled: false },
    },
    isConfigured: () => true,
    generateVideo: async (req) => createKitchenVideoResult({ prompt: req?.prompt, model: req?.model }),
  };
}

export function buildKitchenMusicProvider() {
  return {
    id: MUSIC_PROVIDER_ID,
    label: "Kitchen Sink Music",
    defaultModel: "kitchen-sink-music-v1",
    capabilities: {
      generate: { maxTracks: 1, maxDurationSeconds: 1 },
      edit: { enabled: true, maxInputAudio: 1, maxTracks: 1 },
    },
    isConfigured: () => true,
    generateMusic: async (req) => createKitchenMusicResult({ prompt: req?.prompt, model: req?.model }),
    generate: async (req) => createKitchenMusicResult({ prompt: req?.prompt, model: req?.model }),
  };
}

export function buildKitchenTextProvider() {
  return {
    id: TEXT_PROVIDER_ID,
    label: "Kitchen Sink LLM",
    docsPath: "/providers/models",
    aliases: ["kitchen-sink-text", "kitchen"],
    envVars: [],
    auth: [
      {
        id: "none",
        label: "No credentials",
        hint: "Deterministic local fixture provider.",
        kind: "custom",
        run: async () => ({
          profiles: [
            {
              id: "kitchen-sink-local",
              label: "Kitchen Sink Local",
              configured: true,
              source: "fixture",
            },
          ],
          defaultModel: `${TEXT_PROVIDER_ID}/${DEFAULT_TEXT_MODEL}`,
          notes: ["Kitchen Sink LLM is deterministic and does not call a network service."],
        }),
      },
    ],
    staticCatalog: {
      order: "simple",
      run: async () => ({
        provider: kitchenTextProviderConfig(),
      }),
    },
    catalog: {
      order: "simple",
      run: async () => ({
        provider: kitchenTextProviderConfig(),
      }),
    },
    resolveDynamicModel: ({ modelId }) =>
      modelId === DEFAULT_TEXT_MODEL ? kitchenTextModelDefinition() : undefined,
    resolveSyntheticAuth: () => ({
      apiKey: "kitchen-sink-local-fixture",
      source: "kitchen-sink fixture",
      mode: "token",
    }),
    createStreamFn: () => createKitchenTextStream,
    resolveSystemPromptContribution: () => ({
      stablePrefix: kitchenPromptGuidance().join("\n"),
    }),
  };
}

export function buildKitchenWebSearchProvider() {
  return {
    id: WEB_SEARCH_PROVIDER_ID,
    label: "Kitchen Sink Search",
    hint: "Credential-free deterministic search fixture.",
    requiresCredential: false,
    envVars: [],
    placeholder: "no key required",
    signupUrl: "https://github.com/openclaw/kitchen-sink",
    docsUrl: "https://github.com/openclaw/kitchen-sink#readme",
    credentialPath: `${pluginConfigPath()}.search`,
    getCredentialValue: () => "fixture",
    setCredentialValue: (target, value) => {
      target.fixture = value;
    },
    applySelectionConfig: (config) => config,
    resolveRuntimeMetadata: async () => ({ provider: WEB_SEARCH_PROVIDER_ID, pluginId: PLUGIN_ID }),
    createTool: () => ({
      description: "Search the deterministic Kitchen Sink fixture corpus.",
      parameters: kitchenSearchSchema(),
      execute: async (args) => runKitchenSearch(readQuery(args)),
    }),
  };
}

export function buildKitchenWebFetchProvider() {
  return {
    id: WEB_FETCH_PROVIDER_ID,
    label: "Kitchen Sink Fetch",
    hint: "Credential-free deterministic fetch fixture.",
    requiresCredential: false,
    envVars: [],
    placeholder: "no key required",
    signupUrl: "https://github.com/openclaw/kitchen-sink",
    docsUrl: "https://github.com/openclaw/kitchen-sink#readme",
    credentialPath: `${pluginConfigPath()}.fetch`,
    getCredentialValue: () => "fixture",
    setCredentialValue: (target, value) => {
      target.fixture = value;
    },
    applySelectionConfig: (config) => config,
    resolveRuntimeMetadata: async () => ({ provider: WEB_FETCH_PROVIDER_ID, pluginId: PLUGIN_ID }),
    createTool: () => ({
      description: "Fetch deterministic Kitchen Sink fixture documents.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string", description: "Fixture URL or topic." },
        },
      },
      execute: async (args) => runKitchenFetch(readUrl(args)),
    }),
  };
}

export function buildKitchenMemoryEmbeddingProvider() {
  return {
    id: MEMORY_EMBEDDING_PROVIDER_ID,
    label: "Kitchen Sink Memory Embeddings",
    model: DEFAULT_EMBEDDING_MODEL,
    dimensions: 8,
    isConfigured: () => true,
    embed: async (input) => ({
      provider: MEMORY_EMBEDDING_PROVIDER_ID,
      model: DEFAULT_EMBEDDING_MODEL,
      embedding: createKitchenEmbedding(typeof input === "string" ? input : input?.text),
    }),
    embedMany: async (input) => {
      const texts = Array.isArray(input) ? input : Array.isArray(input?.texts) ? input.texts : [input?.text ?? ""];
      return {
        provider: MEMORY_EMBEDDING_PROVIDER_ID,
        model: DEFAULT_EMBEDDING_MODEL,
        embeddings: texts.map((text) => createKitchenEmbedding(text)),
      };
    },
  };
}

export function buildKitchenEmbeddingProvider() {
  return {
    id: EMBEDDING_PROVIDER_ID,
    defaultModel: DEFAULT_EMBEDDING_MODEL,
    transport: "local",
    resolveIndexIdentity: ({ model = DEFAULT_EMBEDDING_MODEL } = {}) => ({
      model,
      cacheKeyData: { provider: EMBEDDING_PROVIDER_ID, model },
    }),
    create: async ({ model = DEFAULT_EMBEDDING_MODEL } = {}) => ({
      provider: {
        id: EMBEDDING_PROVIDER_ID,
        model,
        dimensions: 8,
        embed: async (input) => createKitchenEmbedding(typeof input === "string" ? input : input?.text),
        embedBatch: async (inputs) =>
          inputs.map((input) => createKitchenEmbedding(typeof input === "string" ? input : input?.text)),
      },
      runtime: { id: EMBEDDING_PROVIDER_ID },
    }),
  };
}

export function buildKitchenMemoryCorpusSupplement() {
  return {
    id: "kitchen-sink-memory-corpus",
    label: "Kitchen Sink Memory Corpus",
    search: async (query) => createKitchenMemorySearch(typeof query === "string" ? query : query?.query),
    read: async (id = "ks-memory-runtime-surfaces") => ({
      id,
      title: "Kitchen Sink runtime surfaces",
      text: "Kitchen Sink memory corpus fixture covering providers, channels, hooks, compaction, and tasks.",
      metadata: { kitchenSink: true, pluginId: PLUGIN_ID, scenarioId: "memory.read" },
    }),
    list: async () => ({
      items: [{ id: "ks-memory-runtime-surfaces", title: "Kitchen Sink runtime surfaces" }],
    }),
  };
}

export function buildKitchenCompactionProvider() {
  return {
    id: COMPACTION_PROVIDER_ID,
    label: "Kitchen Sink Compaction",
    compact: async (input) => createKitchenCompaction(input),
    summarize: async (input) => createKitchenCompaction(input),
  };
}

function pluginConfigPath() {
  return `plugins.${PLUGIN_ID}`;
}

function kitchenProviderError(result) {
  const error = new Error(result.error.message);
  error.name = "KitchenSinkProviderError";
  error.code = result.error.code;
  error.statusCode = result.error.statusCode;
  error.retryable = result.error.retryable;
  error.retryAfterMs = result.error.retryAfterMs;
  error.metadata = {
    kitchenSink: true,
    job: result.job,
    pluginId: PLUGIN_ID,
    provider: IMAGE_PROVIDER_ID,
    scenarioId: result.scenarioId,
    route: result.route,
  };
  return error;
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (typeof value === "string") {
    return Buffer.from(value);
  }
  return Buffer.alloc(0);
}

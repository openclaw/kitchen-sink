import { createHash } from "node:crypto";
import {
  CHANNEL_ACCOUNT_ID,
  CHANNEL_ID,
  COMPACTION_PROVIDER_ID,
  DEFAULT_IMAGE_DELAY_MS,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MEDIA_MODEL,
  DEFAULT_MUSIC_MODEL,
  DEFAULT_SPEECH_MODEL,
  DEFAULT_VIDEO_MODEL,
  EMBEDDING_PROVIDER_ID,
  IMAGE_PROVIDER_ID,
  MEDIA_PROVIDER_ID,
  MUSIC_PROVIDER_ID,
  PLUGIN_ID,
  REALTIME_TRANSCRIPTION_PROVIDER_ID,
  SPEECH_PROVIDER_ID,
  TEXT_PROVIDER_ID,
  VIDEO_PROVIDER_ID,
  WEB_FETCH_PROVIDER_ID,
  WEB_SEARCH_PROVIDER_ID,
} from "./constants.js";
import { createKitchenSinkImageAsset } from "./fixtures/images.js";
import {
  createKitchenTextStream,
  estimateUsage,
  kitchenImageDescription,
  kitchenTextModelDefinition,
  kitchenTextProviderConfig,
  kitchenTextResponse,
  kitchenTextRuntimeModelDefinition,
} from "./fixtures/text.js";

export {
  CHANNEL_ACCOUNT_ID,
  CHANNEL_ID,
  COMPACTION_PROVIDER_ID,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_IMAGE_DELAY_MS,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MEDIA_MODEL,
  DEFAULT_MUSIC_MODEL,
  DEFAULT_SPEECH_MODEL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_VIDEO_MODEL,
  EMBEDDING_PROVIDER_ID,
  IMAGE_PROVIDER_ID,
  MEDIA_PROVIDER_ID,
  MUSIC_PROVIDER_ID,
  PLUGIN_ID,
  REALTIME_TRANSCRIPTION_PROVIDER_ID,
  REALTIME_VOICE_PROVIDER_ID,
  SPEECH_PROVIDER_ID,
  TEXT_PROVIDER_ID,
  VIDEO_PROVIDER_ID,
  WEB_FETCH_PROVIDER_ID,
  WEB_SEARCH_PROVIDER_ID,
} from "./constants.js";
export { createKitchenSinkImageAsset } from "./fixtures/images.js";
export {
  createKitchenTextStream,
  kitchenImageDescription,
  kitchenTextModelDefinition,
  kitchenTextProviderConfig,
  kitchenTextResponse,
  kitchenTextRuntimeModelDefinition,
} from "./fixtures/text.js";

// Human scenarios are the end-to-end smoke matrix: dry prefix routing, live LLM
// plus Kitchen Sink provider routing, hooks, channels, search/fetch, and memory.
export const KITCHEN_HUMAN_SCENARIOS = Object.freeze([
  {
    id: "dry.prefix-image",
    prompt: "kitchen generate an image of the office sink fixture",
    mode: "dry",
    route: "prefix:kitchen",
    surfaces: ["command", "image-provider", "asset"],
  },
  {
    id: "live.openai-text-kitchen-image",
    prompt: "Generate an image with Kitchen Sink while OpenAI handles the text turn.",
    mode: "live-llm-compatible",
    route: "human:live-llm-image-provider",
    surfaces: ["text-provider-guidance", "image-provider", "tool-routing"],
  },
  {
    id: "search.fetch.summarize",
    prompt: "Search for Kitchen Sink provider routing and fetch the fixture README.",
    mode: "dry",
    route: "human:search-fetch-summary",
    surfaces: ["web-search", "web-fetch", "text-provider"],
  },
  {
    id: "channel.prefix-image",
    prompt: "kitchen generate an image in this channel",
    mode: "dry",
    route: "human:channel-prefix",
    surfaces: ["channel", "interactive-handler", "image-provider"],
  },
  {
    id: "hook.block-tool",
    prompt: "kitchen block image generation until the operator reviews it",
    mode: "dry",
    route: "human:hook-block",
    surfaces: ["before_tool_call", "terminal-block"],
  },
  {
    id: "memory.compact-fixture",
    prompt: "Remember the Kitchen Sink image job and compact this session.",
    mode: "dry",
    route: "human:memory-compaction",
    surfaces: ["memory-embedding", "memory-corpus", "compaction"],
  },
]);

export function createKitchenScenarioRuntime(options = {}) {
  // Clock and sleep are injectable so tests can prove the 10s job lifecycle
  // without actually waiting, while real runtime execution still behaves async.
  const runtime = {
    delayMs: normalizeDelayMs(options.delayMs),
    sleep: typeof options.sleep === "function" ? options.sleep : defaultSleep,
    now: typeof options.now === "function" ? options.now : () => new Date(),
    async runScenario(request = {}) {
      return runKitchenScenario(runtime, request);
    },
    async runImageJob(input = {}) {
      return runKitchenScenario(runtime, {
        scenario: "image.generate",
        prompt: input.prompt,
        route: input.route,
      });
    },
    async runTextJob(input = {}) {
      return runKitchenScenario(runtime, {
        scenario: "text.reply",
        prompt: input.prompt,
        route: input.route,
      });
    },
  };

  return runtime;
}

export function listKitchenHumanScenarios() {
  return KITCHEN_HUMAN_SCENARIOS.map((scenario) => ({ ...scenario, surfaces: [...scenario.surfaces] }));
}

export async function runKitchenHumanScenario(runtime, idOrPrompt) {
  const scenario = resolveKitchenHumanScenario(idOrPrompt);
  if (scenario.id === "dry.prefix-image") {
    return {
      ...scenario,
      result: await runKitchenCommand(runtime, scenario.prompt.replace(/^kitchen\s+/i, "")),
    };
  }
  if (scenario.id === "live.openai-text-kitchen-image") {
    return {
      ...scenario,
      guidance: kitchenPromptGuidance(),
      result: await runtime.runScenario({
        scenario: "image.generate",
        prompt: scenario.prompt,
        route: scenario.route,
      }),
    };
  }
  if (scenario.id === "search.fetch.summarize") {
    const search = await runtime.runScenario({
      scenario: "web.search",
      prompt: scenario.prompt,
      route: scenario.route,
    });
    const fetch = await runtime.runScenario({
      scenario: "web.fetch",
      url: "kitchen://fixture/readme",
      route: scenario.route,
    });
    return {
      ...scenario,
      result: {
        search,
        fetch,
        summary: kitchenTextResponse(`${search.answer} ${fetch.title}`),
      },
    };
  }
  if (scenario.id === "channel.prefix-image") {
    const command = await runKitchenCommand(runtime, scenario.prompt.replace(/^kitchen\s+/i, ""));
    return {
      ...scenario,
      result: {
        command,
        delivery: createKitchenChannelDelivery({
          kind: "media",
          text: scenario.prompt,
          to: "kitchen demo",
        }),
      },
    };
  }
  if (scenario.id === "hook.block-tool") {
    return {
      ...scenario,
      result: runKitchenHook(
        "before_tool_call",
        { toolId: "kitchen_sink_image_job", args: { prompt: scenario.prompt } },
        { providerId: IMAGE_PROVIDER_ID },
      ),
    };
  }
  if (scenario.id === "memory.compact-fixture") {
    const memory = createKitchenMemorySearch(scenario.prompt);
    const compaction = createKitchenCompaction({
      messages: [
        { role: "user", content: scenario.prompt },
        { role: "assistant", content: "Kitchen Sink image job ks_image_1f8a5a98 completed." },
      ],
    });
    return {
      ...scenario,
      result: {
        embedding: createKitchenEmbedding(scenario.prompt),
        memory,
        compaction,
      },
    };
  }
  return {
    ...scenario,
    result: await runtime.runScenario({
      scenario: "text.reply",
      prompt: scenario.prompt,
      route: scenario.route,
    }),
  };
}

export async function runKitchenScenario(runtime, request = {}) {
  // Central dispatcher for deterministic provider behavior. Runtime builders
  // adapt OpenClaw APIs into this small scenario vocabulary.
  const scenario = normalizeScenario(request.scenario);
  if (scenario === "image.generate" || scenario === "image.edit") {
    const prompt = normalizePrompt(request.prompt, "a kitchen sink fixture image");
    const queuedJob = createKitchenJob("image", prompt, runtime.now(), runtime.delayMs, scenario, request.route);
    const runningJob = transitionKitchenJob(queuedJob, "running", runtime.now(), {
      progressPercent: 50,
      progressSummary: "Kitchen Sink image provider accepted the request.",
    });
    await runtime.sleep(runtime.delayMs);
    const failure = classifyKitchenFailure(prompt);
    if (failure) {
      return {
        scenarioId: scenario,
        route: request.route || "provider:image",
        job: transitionKitchenJob(runningJob, "failed", runtime.now(), {
          error: failure,
          progressPercent: 100,
          progressSummary: failure.message,
        }),
        error: failure,
      };
    }
    const image = createKitchenSinkImageAsset({
      prompt,
      jobId: queuedJob.id,
      scenario,
      model: request.model || DEFAULT_IMAGE_MODEL,
    });
    const completedAt = runtime.now();
    const completedJob = transitionKitchenJob(runningJob, "completed", completedAt, {
      completedAt: completedAt.toISOString(),
      progressPercent: 100,
      progressSummary: `Returned bundled ${image.metadata.assetName}.`,
      output: {
        fileName: image.fileName,
        mimeType: image.mimeType,
        sizeBytes: image.metadata.sizeBytes,
        contentHash: image.metadata.contentHash,
      },
    });
    return {
      scenarioId: scenario,
      route: request.route || "provider:image",
      job: completedJob,
      image,
    };
  }

  if (scenario === "web.search") {
    return {
      scenarioId: scenario,
      route: request.route || "provider:web-search",
      ...(await runKitchenSearch(request.query ?? request.prompt)),
    };
  }

  if (scenario === "web.fetch") {
    return {
      scenarioId: scenario,
      route: request.route || "provider:web-fetch",
      ...(await runKitchenFetch(request.url ?? request.query ?? request.prompt)),
    };
  }

  if (scenario === "image.describe") {
    const count = typeof request.count === "number" ? request.count : 1;
    return {
      scenarioId: scenario,
      route: request.route || "provider:media-understanding",
      text: kitchenImageDescription(request.prompt, count),
      model: request.model || DEFAULT_MEDIA_MODEL,
    };
  }

  const prompt = normalizePrompt(request.prompt, "explain the kitchen sink fixture");
  const job = createKitchenJob("text", prompt, runtime.now(), 0, scenario, request.route);
  const text = kitchenTextResponse(prompt);
  const completedAt = runtime.now();
  return {
    scenarioId: "text.reply",
    route: request.route || "provider:text",
    job: transitionKitchenJob(job, "completed", completedAt, {
      completedAt: completedAt.toISOString(),
      progressPercent: 100,
      progressSummary: "Kitchen Sink text provider produced a deterministic reply.",
    }),
    text,
    usage: estimateUsage(prompt, text),
  };
}

export function shouldHandleKitchenText(text) {
  return /^kitchen(?:\s|$)/i.test(String(text ?? "").trim());
}

export function kitchenPromptGuidance() {
  return [
    "Kitchen Sink fixture plugin:",
    "- Use the kitchen_sink_image_job tool when the user asks for a kitchen sink image without selecting an image provider.",
    "- Use provider kitchen-sink-image for image generation when the configured image provider is Kitchen Sink.",
    "- Image prompts containing rate limit, timeout, or fail trigger deterministic failure paths for retry/error handling.",
    "- Use kitchen_sink_search for deterministic search fixture queries.",
    "- Use kitchen_sink_text for deterministic text fixture responses.",
  ];
}

export function createKitchenChannelDelivery({ kind = "text", text = "", to = "kitchen" }) {
  const normalizedTo = normalizeKitchenTarget(to);
  const id = `ks_channel_${stableHash(`${kind}:${normalizedTo}:${text}`).slice(0, 10)}`;
  return {
    channel: CHANNEL_ID,
    messageId: id,
    conversationId: normalizedTo,
    channelId: normalizedTo,
    timestamp: Date.UTC(2026, 3, 28, 0, 0, 0),
    deliveryStatus: "sent",
    transport: "kitchen-sink-local",
    meta: {
      kitchenSink: true,
      pluginId: PLUGIN_ID,
      scenarioId: inferKitchenScenario({ text }),
      kind,
    },
  };
}

export function kitchenChannelAccount(accountId = CHANNEL_ACCOUNT_ID, config = {}) {
  const normalizedAccountId = accountId || CHANNEL_ACCOUNT_ID;
  const enabled = normalizedAccountId !== "disabled" && config?.disabled !== true;
  const configured = normalizedAccountId !== "missing" && config?.configured !== false;
  const ok = enabled && configured;
  return {
    accountId: normalizedAccountId,
    name: normalizedAccountId === CHANNEL_ACCOUNT_ID ? "Kitchen Sink Local" : `Kitchen Sink ${normalizedAccountId}`,
    enabled,
    configured,
    statusState: ok ? "ready" : enabled ? "needs_setup" : "disabled",
    linked: configured,
    running: ok,
    connected: ok,
    mode: "local",
    health: {
      ok,
      checkedAt: "2026-04-28T00:00:00.000Z",
      message: ok
        ? "Kitchen Sink local fixture account is ready."
        : "Kitchen Sink local fixture account is intentionally unavailable.",
    },
    capabilities: ["text", "media", "threads", "dry-run"],
  };
}

export function normalizeKitchenTarget(raw) {
  return String(raw ?? "").replace(/^kitchen:/i, "").replace(/\s+/g, "-").trim() || "kitchen";
}

export async function runKitchenCommand(runtime, args) {
  const phrase = String(args ?? "").trim();
  if (/\b(image|picture|draw|generate)\b/i.test(phrase)) {
    const result = await runtime.runScenario({
      scenario: "image.generate",
      prompt: phrase || "kitchen sink image",
      route: "prefix:kitchen",
    });
    return kitchenImageReply(result);
  }
  if (/\b(search|find|lookup|web)\b/i.test(phrase)) {
    const result = await runtime.runScenario({
      scenario: "web.search",
      query: phrase,
      route: "prefix:kitchen",
    });
    return { text: renderSearchText(result), channelData: { kitchenSink: result } };
  }
  const result = await runtime.runScenario({
    scenario: "text.reply",
    prompt: phrase || "kitchen status",
    route: "prefix:kitchen",
  });
  return {
    text: result.text,
    channelData: { kitchenSink: result },
  };
}

export async function runKitchenImageTool(runtime, input) {
  const result = await runtime.runScenario({
    scenario: "image.generate",
    prompt: readPrompt(input),
    route: "tool:kitchen_sink_image_job",
  });
  if (result.error) {
    return {
      ...result,
      ok: false,
    };
  }
  return {
    ...result,
    ok: true,
    mediaUrl: result.image.dataUrl,
  };
}

export async function runKitchenSearch(query) {
  const normalized = normalizePrompt(query, "kitchen sink");
  const requestId = `ks_search_${stableHash(normalized).slice(0, 10)}`;
  const failure = classifyKitchenFailure(normalized);
  if (failure) {
    return {
      provider: WEB_SEARCH_PROVIDER_ID,
      requestId,
      query: normalized,
      ok: false,
      statusCode: failure.statusCode,
      latencyMs: 12,
      error: failure,
      results: [],
    };
  }
  if (/\b(empty|no results|zero)\b/i.test(normalized)) {
    return {
      provider: WEB_SEARCH_PROVIDER_ID,
      requestId,
      query: normalized,
      ok: true,
      statusCode: 200,
      latencyMs: 18,
      results: [],
      answer: "No Kitchen Sink fixture results matched the deterministic empty-result query.",
    };
  }
  return {
    provider: WEB_SEARCH_PROVIDER_ID,
    requestId,
    query: normalized,
    ok: true,
    statusCode: 200,
    latencyMs: 24,
    answer: `Kitchen Sink found fixture routes for "${normalized}".`,
    results: [
      {
        id: "ks-result-image-provider",
        title: "Kitchen Sink image fixture",
        url: "https://github.com/openclaw/kitchen-sink#image-fixture",
        displayUrl: "github.com/openclaw/kitchen-sink#image-fixture",
        snippet: `Deterministic image job route for "${normalized}".`,
        source: "kitchen-sink-docs",
        score: 0.98,
        faviconUrl: "https://github.githubassets.com/favicons/favicon.svg",
        metadata: { route: "provider:image", provider: IMAGE_PROVIDER_ID },
      },
      {
        id: "ks-result-dry-command",
        title: "Kitchen Sink dry command route",
        url: "https://github.com/openclaw/kitchen-sink#dry-command-route",
        displayUrl: "github.com/openclaw/kitchen-sink#dry-command-route",
        snippet: "The kitchen prefix works without live LLM credentials.",
        source: "kitchen-sink-docs",
        score: 0.91,
        faviconUrl: "https://github.githubassets.com/favicons/favicon.svg",
        metadata: { route: "prefix:kitchen", provider: "command" },
      },
      {
        id: "ks-result-provider-route",
        title: "Kitchen Sink provider route",
        url: "https://github.com/openclaw/kitchen-sink#provider-route",
        displayUrl: "github.com/openclaw/kitchen-sink#provider-route",
        snippet: "The image, media, text, fetch, and search providers are registered by the plugin.",
        source: "kitchen-sink-docs",
        score: 0.87,
        faviconUrl: "https://github.githubassets.com/favicons/favicon.svg",
        metadata: { route: "provider:*", provider: PLUGIN_ID },
      },
    ],
  };
}

export async function runKitchenFetch(url) {
  const target = normalizePrompt(url, "kitchen://fixture/readme");
  const failure = classifyKitchenFailure(target);
  const finalUrl = /\bredirect\b/i.test(target) ? "kitchen://fixture/readme" : target;
  const missing = /\b(404|missing|not found)\b/i.test(target);
  const statusCode = failure?.statusCode || (missing ? 404 : 200);
  const ok = statusCode >= 200 && statusCode < 400;
  const title = failure
    ? "Kitchen Sink fixture error"
    : missing
      ? "Kitchen Sink fixture not found"
      : "Kitchen Sink fixture document";
  const content = ok
    ? `Kitchen Sink fetched "${finalUrl}". This deterministic document proves plugin web-fetch routing without network access.`
    : `Kitchen Sink could not fetch "${target}" in the deterministic fixture corpus.`;
  return {
    provider: WEB_FETCH_PROVIDER_ID,
    requestId: `ks_fetch_${stableHash(target).slice(0, 10)}`,
    ok,
    statusCode,
    url: target,
    finalUrl,
    title,
    contentType: "text/markdown; charset=utf-8",
    headers: {
      "cache-control": "max-age=3600",
      "content-type": "text/markdown; charset=utf-8",
      "x-kitchen-sink-fixture": "true",
    },
    redirects: finalUrl === target ? [] : [{ statusCode: 302, from: target, to: finalUrl }],
    cache: { status: "HIT", maxAgeSeconds: 3600 },
    links: [
      { href: "kitchen://fixture/image-provider", text: "Image provider fixture" },
      { href: "kitchen://fixture/search", text: "Search fixture" },
    ],
    markdown: `# ${title}\n\n${content}\n`,
    content,
    ...(ok ? {} : { error: failure || { code: "not_found", message: "Fixture document was not found.", retryable: false } }),
  };
}

export function createKitchenSpeechAsset({ text, voice = "kitchen-neutral", model = DEFAULT_SPEECH_MODEL } = {}) {
  const normalized = normalizePrompt(text, "Kitchen Sink speech fixture.");
  const audioBuffer = createKitchenWavBuffer(normalized);
  return {
    audioBuffer,
    buffer: audioBuffer,
    mimeType: "audio/wav",
    outputFormat: "wav",
    fileExtension: ".wav",
    voice,
    voiceCompatible: true,
    model,
    durationMs: 480,
    sampleRateHz: 16_000,
    text: normalized,
    metadata: fixtureMetadata("speech.synthesize", SPEECH_PROVIDER_ID, {
      model,
      voice,
      sizeBytes: audioBuffer.byteLength,
      sha256: sha256Hex(audioBuffer),
    }),
  };
}

export function createKitchenTranscription({ audio, prompt } = {}) {
  const byteLength = inferByteLength(audio);
  return {
    provider: REALTIME_TRANSCRIPTION_PROVIDER_ID,
    scenarioId: "media.audio-transcribe",
    text: `Kitchen Sink transcript for ${byteLength} bytes of audio. ${normalizePrompt(prompt, "No prompt supplied.")}`,
    language: "en",
    segments: [
      { startMs: 0, endMs: 240, text: "Kitchen Sink transcript." },
      { startMs: 240, endMs: 480, text: "Deterministic audio fixture complete." },
    ],
    confidence: 0.99,
    metadata: fixtureMetadata("media.audio-transcribe", REALTIME_TRANSCRIPTION_PROVIDER_ID, { byteLength }),
  };
}

export function createKitchenVideoResult({ prompt, model = DEFAULT_VIDEO_MODEL } = {}) {
  const normalized = normalizePrompt(prompt, "kitchen sink video fixture");
  const id = `ks_video_${stableHash(normalized).slice(0, 10)}`;
  const payload = {
    id,
    prompt: normalized,
    frames: ["office-lobby-sink", "sink-closeup", "fixture-badge"],
  };
  const buffer = Buffer.from(JSON.stringify(payload), "utf8");
  return {
    provider: VIDEO_PROVIDER_ID,
    model,
    job: mediaJob("video", id, normalized, "video.generate"),
    videos: [
      {
        id,
        mimeType: "application/vnd.openclaw.kitchen-video+json",
        fileName: `${id}.kitchen-video.json`,
        durationMs: 3_000,
        width: 1024,
        height: 1024,
        buffer,
        dataUrl: dataUrlForJson("application/vnd.openclaw.kitchen-video+json", payload),
        metadata: fixtureMetadata("video.generate", VIDEO_PROVIDER_ID, { model, prompt: normalized }),
      },
    ],
    metadata: fixtureMetadata("video.generate", VIDEO_PROVIDER_ID, { model, jobId: id }),
  };
}

export function createKitchenMusicResult({ prompt, model = DEFAULT_MUSIC_MODEL } = {}) {
  const normalized = normalizePrompt(prompt, "kitchen sink music fixture");
  const id = `ks_music_${stableHash(normalized).slice(0, 10)}`;
  const audioBuffer = createKitchenWavBuffer(normalized);
  return {
    provider: MUSIC_PROVIDER_ID,
    model,
    job: mediaJob("music", id, normalized, "music.generate"),
    tracks: [
      {
        id,
        title: "Kitchen Sink Fixture Loop",
        mimeType: "audio/wav",
        fileName: `${id}.wav`,
        durationMs: 480,
        audioBuffer,
        dataUrl: `data:audio/wav;base64,${audioBuffer.toString("base64")}`,
        metadata: fixtureMetadata("music.generate", MUSIC_PROVIDER_ID, {
          model,
          sizeBytes: audioBuffer.byteLength,
          sha256: sha256Hex(audioBuffer),
        }),
      },
    ],
    metadata: fixtureMetadata("music.generate", MUSIC_PROVIDER_ID, { model, jobId: id }),
  };
}

export function createKitchenEmbedding(input, dimensions = 8) {
  const text = Array.isArray(input) ? input.join("\n") : normalizePrompt(input, "kitchen sink memory");
  const hash = createHash("sha256").update(text).digest();
  return Array.from({ length: dimensions }, (_, index) => Number(((hash[index] / 255) * 2 - 1).toFixed(6)));
}

export function createKitchenMemorySearch(query) {
  const normalized = normalizePrompt(query, "kitchen sink memory");
  return [
    {
      corpus: "wiki",
      path: "kitchen-sink/runtime-surfaces",
      id: "ks-memory-runtime-surfaces",
      score: 0.97,
      title: "Kitchen Sink runtime surfaces",
      snippet: `Kitchen Sink exercises providers, tools, hooks, channels, memory, compaction, and task lifecycles. Query: ${normalized}.`,
      provenanceLabel: "Kitchen Sink fixture",
      source: EMBEDDING_PROVIDER_ID,
      sourceType: "plugin",
      sourcePath: "openclaw-kitchen-sink-fixture",
    },
  ];
}

export function createKitchenCompaction(input = {}) {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const text = messages
    .map((message) => (typeof message?.content === "string" ? message.content : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  const summary = normalizePrompt(text, normalizePrompt(input.text, "Kitchen Sink compacted deterministic transcript."));
  return {
    provider: COMPACTION_PROVIDER_ID,
    scenarioId: "compaction.summary",
    summary: `Kitchen Sink compacted ${messages.length || 1} turn${messages.length === 1 ? "" : "s"}: ${summary.slice(0, 180)}`,
    preservedIdentifiers: [...new Set(summary.match(/\bks_[a-z]+_[a-f0-9]+\b/g) || [])],
    metadata: fixtureMetadata("compaction.summary", COMPACTION_PROVIDER_ID, { messageCount: messages.length }),
  };
}

export function kitchenImageReply(result) {
  if (result.error) {
    return {
      text: `kitchen image job ${result.job.id} failed: ${result.error.message}`,
      presentation: {
        title: "Kitchen Sink Image Failed",
        tone: "danger",
        blocks: [
          { type: "text", text: `job: ${result.job.id}` },
          { type: "context", text: `code=${result.error.code} retryable=${String(result.error.retryable)}` },
        ],
      },
      channelData: {
        kitchenSink: result,
      },
    };
  }
  return {
    text:
      `kitchen image job ${result.job.id} completed after ${Math.round(result.job.delayMs / 1000)}s. ` +
      `provider=${IMAGE_PROVIDER_ID} model=${result.image.metadata.model} asset=${result.image.metadata.assetName}`,
    mediaUrl: result.image.dataUrl,
    presentation: {
      title: "Kitchen Sink Image",
      tone: "success",
      blocks: [
        { type: "text", text: `job: ${result.job.id}` },
        { type: "text", text: `asset: ${result.image.metadata.assetName}` },
        { type: "context", text: result.image.revisedPrompt },
      ],
    },
    channelData: {
      kitchenSink: result,
    },
  };
}

export function kitchenToolSchema(promptDescription) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      prompt: { type: "string", description: promptDescription },
    },
  };
}

export function kitchenSearchSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string", description: "Kitchen Sink fixture search query." },
    },
  };
}

export function stripDataUrl(image) {
  const { dataUrl, ...asset } = image;
  return asset;
}

export function renderSearchText(result) {
  if (result.error) {
    return `Kitchen Sink search failed: ${result.error.message}`;
  }
  if (result.results.length === 0) {
    return result.answer || "Kitchen Sink search returned no results.";
  }
  return result.results.map((entry, index) => `${index + 1}. ${entry.title} - ${entry.snippet}`).join("\n");
}

export function readPrompt(input) {
  return normalizePrompt(readString(input, "prompt") || readString(input, "input"), "kitchen sink fixture");
}

export function readQuery(input) {
  return normalizePrompt(readString(input, "query") || readPrompt(input), "kitchen sink");
}

export function readUrl(input) {
  return normalizePrompt(readString(input, "url") || readString(input, "query"), "kitchen://fixture/readme");
}

export function extractInteractiveText(ctx) {
  if (typeof ctx === "string") {
    return ctx;
  }
  if (!ctx || typeof ctx !== "object") {
    return "";
  }
  for (const key of ["text", "message", "body", "input", "content", "commandBody"]) {
    if (typeof ctx[key] === "string") {
      return ctx[key];
    }
  }
  if (ctx.message && typeof ctx.message === "object") {
    return extractInteractiveText(ctx.message);
  }
  return "";
}

export function observeKitchenHook(name, event, context) {
  // Hooks receive different shapes across tool, provider, and agent surfaces.
  // Normalize them into scenario ids so reports stay comparable.
  const toolId = firstHookString(event, ["toolId", "toolName", "name", "id"]) ||
    firstHookString(event?.tool, ["id", "name"]);
  const providerId = firstHookString(event, ["providerId", "provider", "selectedProvider"]) ||
    firstHookString(context, ["providerId", "provider", "selectedProvider"]);
  const url = firstHookString(event, ["url"]) || firstHookString(event?.args, ["url"]);
  const text = extractHookText(event) || extractHookText(context);
  const scenarioId = inferKitchenScenario({ providerId, text, toolId, url });
  const observation = {
    kitchenSink: true,
    pluginId: PLUGIN_ID,
    hook: name,
    route: `hook:${name}`,
    matchedKitchen: scenarioId !== "observe",
    scenarioId,
    observedEventKeys: Object.keys(event ?? {}),
    observedContextKeys: Object.keys(context ?? {}),
  };

  if (name === "llm_input" || name === "llm_output" || name === "agent_end") {
    return {
      ...observation,
      privacy: createConversationPrivacyProbe({ event, context, text }),
    };
  }

  return observation;
}

export function runKitchenHook(name, event, context) {
  const observation = observeKitchenHook(name, event, context);

  if (name === "before_tool_call") {
    const toolId =
      firstHookString(event, ["toolId", "toolName", "name", "id"]) ||
      firstHookString(event?.tool, ["id", "name"]);
    const text = extractHookText(event) || extractHookText(context);
    return {
      ...observation,
      ...createBeforeToolCallDecision({
        event,
        scenarioId: observation.scenarioId,
        text,
        toolId,
      }),
    };
  }

  if (name === "reply_payload_sending") {
    return createReplyPayloadSendingResult(event);
  }

  if (name === "resolve_exec_env") {
    return {
      KITCHEN_SINK_HOOK: "resolve_exec_env",
      KITCHEN_SINK_PLUGIN_ID: PLUGIN_ID,
      KITCHEN_SINK_SCENARIO: observation.scenarioId,
    };
  }

  return undefined;
}

function createKitchenJob(kind, prompt, date, delayMs, scenarioId, route) {
  const id = `ks_${kind}_${stableHash(`${kind}:${prompt}`).slice(0, 10)}`;
  const createdAt = date.toISOString();
  return {
    id,
    kind,
    status: "queued",
    prompt,
    delayMs,
    createdAt,
    queuedAt: createdAt,
    lastEventAt: createdAt,
    progressPercent: 0,
    progressSummary: "Kitchen Sink job queued.",
    pluginId: PLUGIN_ID,
    scenarioId,
    route: route || defaultRouteForScenario(scenarioId),
    statusUrl: `kitchen://jobs/${id}`,
    timeline: [{ status: "queued", at: createdAt, summary: "Kitchen Sink job queued." }],
  };
}

function transitionKitchenJob(job, status, date, patch = {}) {
  const at = date.toISOString();
  const summary = patch.progressSummary || `Kitchen Sink job ${status}.`;
  return {
    ...job,
    ...patch,
    status,
    startedAt: status === "running" ? at : job.startedAt,
    completedAt: status === "completed" ? patch.completedAt || at : job.completedAt,
    failedAt: status === "failed" ? at : job.failedAt,
    lastEventAt: at,
    timeline: [...(job.timeline || []), { status, at, summary }],
  };
}

function classifyKitchenFailure(prompt) {
  const text = String(prompt ?? "").toLowerCase();
  if (/\brate[ -]?limit|429|too many requests\b/.test(text)) {
    return {
      code: "rate_limited",
      statusCode: 429,
      message: "Kitchen Sink fixture simulated a provider rate limit.",
      retryable: true,
      retryAfterMs: 30_000,
    };
  }
  if (/\btimeout|timed out|504\b/.test(text)) {
    return {
      code: "timeout",
      statusCode: 504,
      message: "Kitchen Sink fixture simulated an upstream timeout.",
      retryable: true,
      retryAfterMs: 5_000,
    };
  }
  if (/\bfail|error|500\b/.test(text)) {
    return {
      code: "fixture_failed",
      statusCode: 500,
      message: "Kitchen Sink fixture simulated a provider failure.",
      retryable: false,
    };
  }
  return undefined;
}

function mediaJob(kind, id, prompt, scenarioId) {
  const createdAt = "2026-04-28T00:00:00.000Z";
  return {
    id,
    kind,
    status: "completed",
    prompt,
    createdAt,
    completedAt: createdAt,
    pluginId: PLUGIN_ID,
    scenarioId,
    progressPercent: 100,
    timeline: [
      { status: "queued", at: createdAt, summary: `Kitchen Sink ${kind} job queued.` },
      { status: "running", at: createdAt, summary: `Kitchen Sink ${kind} job running.` },
      { status: "completed", at: createdAt, summary: `Kitchen Sink ${kind} job completed.` },
    ],
  };
}

function fixtureMetadata(scenarioId, providerId, extra = {}) {
  return {
    kitchenSink: true,
    pluginId: PLUGIN_ID,
    providerId,
    scenarioId,
    ...extra,
  };
}

function createKitchenWavBuffer(seedText) {
  const sampleRate = 16_000;
  const durationSeconds = 0.48;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  const frequency = 360 + (Number.parseInt(stableHash(seedText).slice(0, 2), 16) % 160);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const envelope = Math.sin((Math.PI * index) / sampleCount);
    const sample = Math.round(Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 12000 * envelope);
    buffer.writeInt16LE(sample, 44 + index * 2);
  }
  return buffer;
}

function dataUrlForJson(mimeType, value) {
  return `data:${mimeType};base64,${Buffer.from(JSON.stringify(value), "utf8").toString("base64")}`;
}

function inferByteLength(value) {
  if (!value) {
    return 0;
  }
  if (typeof value.byteLength === "number") {
    return value.byteLength;
  }
  if (typeof value.length === "number") {
    return value.length;
  }
  return Buffer.byteLength(String(value));
}

function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function readString(input, key) {
  if (input && typeof input === "object" && typeof input[key] === "string") {
    return input[key];
  }
  if (typeof input === "string" && key === "prompt") {
    return input;
  }
  return "";
}

function resolveKitchenHumanScenario(idOrPrompt) {
  const text = String(idOrPrompt ?? "").trim();
  const exact = KITCHEN_HUMAN_SCENARIOS.find((scenario) => scenario.id === text);
  if (exact) {
    return exact;
  }
  const normalized = text.toLowerCase();
  if (/\bopenai\b/.test(normalized) && /\bimage\b/.test(normalized)) {
    return KITCHEN_HUMAN_SCENARIOS.find((scenario) => scenario.id === "live.openai-text-kitchen-image");
  }
  if (/\b(search|fetch|lookup|web)\b/.test(normalized)) {
    return KITCHEN_HUMAN_SCENARIOS.find((scenario) => scenario.id === "search.fetch.summarize");
  }
  if (/\bchannel|chat\b/.test(normalized)) {
    return KITCHEN_HUMAN_SCENARIOS.find((scenario) => scenario.id === "channel.prefix-image");
  }
  if (/\bblock|deny|approval\b/.test(normalized)) {
    return KITCHEN_HUMAN_SCENARIOS.find((scenario) => scenario.id === "hook.block-tool");
  }
  if (/\b(memory|compact|remember)\b/.test(normalized)) {
    return KITCHEN_HUMAN_SCENARIOS.find((scenario) => scenario.id === "memory.compact-fixture");
  }
  return KITCHEN_HUMAN_SCENARIOS.find((scenario) => scenario.id === "dry.prefix-image");
}

function inferKitchenScenario({ providerId, text, toolId, url }) {
  const haystack = [providerId, text, toolId, url].filter(Boolean).join(" ").toLowerCase();
  if (toolId === "kitchen_sink_image_job" || providerId === IMAGE_PROVIDER_ID) {
    return "image.generate";
  }
  if (toolId === "kitchen_sink_search" || providerId === WEB_SEARCH_PROVIDER_ID) {
    return "web.search";
  }
  if (providerId === WEB_FETCH_PROVIDER_ID || url) {
    return "web.fetch";
  }
  if (providerId === MEDIA_PROVIDER_ID) {
    return "image.describe";
  }
  if (toolId === "kitchen_sink_text" || providerId === TEXT_PROVIDER_ID) {
    return "text.reply";
  }
  if (/\bkitchen\b/.test(haystack) && /\b(image|picture|draw|generate)\b/.test(haystack)) {
    return "image.generate";
  }
  if (/\bkitchen\b/.test(haystack) && /\b(search|find|lookup|web)\b/.test(haystack)) {
    return "web.search";
  }
  if (/\bkitchen\b/.test(haystack)) {
    return "text.reply";
  }
  return "observe";
}

function extractHookText(value) {
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? value : "";
  }
  return (
    firstHookString(value, ["prompt", "query", "text", "input", "content", "commandBody"]) ||
    firstHookString(value.args, ["prompt", "query", "text", "input", "content", "commandBody"]) ||
    extractInteractiveText(value)
  );
}

function createBeforeToolCallDecision({ event, scenarioId, text, toolId }) {
  const params = createToolCallParams(event, scenarioId);
  const lowerText = String(text ?? "").toLowerCase();
  if (/\b(block|deny|forbid)\b/.test(lowerText)) {
    return {
      params,
      block: true,
      blockReason: `Kitchen Sink fixture blocked ${toolId || "tool"} for ${scenarioId}.`,
      terminal: true,
      decision: "block",
    };
  }
  if (/\b(approval|approve|permission)\b/.test(lowerText)) {
    const approvalId = `ks_approval_${stableHash(`${toolId}:${text}:${scenarioId}`).slice(0, 10)}`;
    return {
      params,
      requireApproval: {
        id: approvalId,
        title: "Kitchen Sink tool approval",
        reason: `Kitchen Sink fixture requires approval before ${toolId || "tool"} runs.`,
        summary: `Approve deterministic ${scenarioId} fixture execution.`,
        scenarioId,
        pluginId: PLUGIN_ID,
      },
      decision: "approval",
    };
  }
  return {
    params,
    decision: scenarioId === "observe" ? "observe" : "allow",
  };
}

function createReplyPayloadSendingResult(event) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const text = firstHookString(payload, ["text", "content"]) || extractHookText(event);
  if (/\b(cancel|suppress)\b/i.test(text)) {
    return {
      cancel: true,
      reason: "kitchen_sink_reply_payload_cancelled",
    };
  }
  return {
    payload: {
      ...payload,
      text: `${text || "Kitchen Sink reply payload."}\n\nKitchen Sink reply payload hook observed.`,
    },
  };
}

function createToolCallParams(event, scenarioId) {
  const rawParams = event?.params && typeof event.params === "object" ? event.params : {};
  const rawArgs = event?.args && typeof event.args === "object" ? event.args : {};
  return {
    ...rawParams,
    args: {
      ...rawArgs,
      kitchenSinkScenario: scenarioId,
      kitchenSinkPluginId: PLUGIN_ID,
    },
  };
}

function createConversationPrivacyProbe({ event, context, text }) {
  const eventText = extractHookText(event);
  const contextText = extractHookText(context);
  const combined = [text, eventText, contextText].filter(Boolean).join("\n");
  const redactedFields = [];
  for (const [label, value] of [
    ["event.apiKey", event?.apiKey],
    ["event.authorization", event?.authorization],
    ["event.token", event?.token],
    ["context.apiKey", context?.apiKey],
    ["context.authorization", context?.authorization],
    ["context.token", context?.token],
  ]) {
    if (typeof value === "string" && value.trim()) {
      redactedFields.push(label);
    }
  }
  const secretText = [
    combined,
    event?.apiKey,
    event?.authorization,
    event?.token,
    context?.apiKey,
    context?.authorization,
    context?.token,
  ].filter(Boolean).join("\n");
  const secretPatternHits = secretText.match(/\b(?:sk-[a-z0-9_-]+|api[_-]?key|authorization|bearer\s+[a-z0-9._-]+|fixture-token-[a-z0-9_-]+)\b/gi) ?? [];
  return {
    boundary: "conversation-observer",
    promptHash: stableHash(combined || "empty"),
    promptLength: combined.length,
    redactedFields,
    secretPatternCount: secretPatternHits.length,
    storesRawPayload: false,
    exposesRawPayload: false,
  };
}

function firstHookString(source, keys) {
  if (!source || typeof source !== "object") {
    return "";
  }
  for (const key of keys) {
    if (typeof source[key] === "string" && source[key].trim()) {
      return source[key].trim();
    }
  }
  return "";
}

function normalizePrompt(value, fallback) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function normalizeDelayMs(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return DEFAULT_IMAGE_DELAY_MS;
  }
  return Math.trunc(value);
}

function normalizeScenario(value) {
  switch (value) {
    case "image.generate":
    case "image.edit":
    case "image.describe":
    case "text.reply":
    case "web.fetch":
    case "web.search":
      return value;
    default:
      return "text.reply";
  }
}

function defaultRouteForScenario(scenarioId) {
  switch (scenarioId) {
    case "image.generate":
      return "provider:image";
    case "image.edit":
      return "provider:image-edit";
    case "image.describe":
      return "provider:media-understanding";
    case "web.fetch":
      return "provider:web-fetch";
    case "web.search":
      return "provider:web-search";
    default:
      return "provider:text";
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableHash(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

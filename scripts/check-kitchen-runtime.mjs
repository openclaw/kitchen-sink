#!/usr/bin/env node

import assert from "node:assert/strict";
import { plugin } from "../src/index.js";
import {
  capturePluginRegistration,
  createHookFinder,
  createRegistrationFinder,
  fixedNow,
} from "./lib/plugin-registration-harness.mjs";

const registrations = capturePluginRegistration(plugin);
const findRegistration = createRegistrationFinder(registrations);
const findHook = createHookFinder(registrations);
const { PLUGIN_ID } = await import("../src/scenarios.js");

const commands = registrations.registerCommand?.map(([command]) => command) ?? [];
assert.ok(commands.some((command) => command.name === "kitchen"), "registers kitchen command");
assert.ok(commands.some((command) => command.name === "kitchen-sink"), "registers kitchen-sink command");

const beforeToolHook = findHook("before_tool_call");
const hookResult = await beforeToolHook(
  { toolId: "kitchen_sink_image_job", args: { prompt: "generate an image with kitchen sink" } },
  { providerId: "kitchen-sink-image" },
);
assert.equal(hookResult.pluginId, "openclaw-kitchen-sink-fixture");
assert.equal(hookResult.route, "hook:before_tool_call");
assert.equal(hookResult.scenarioId, "image.generate");
assert.equal(hookResult.matchedKitchen, true);
assert.equal(hookResult.decision, "allow");
assert.equal(hookResult.params.args.kitchenSinkScenario, "image.generate");

const blockedToolHookResult = await beforeToolHook(
  { toolId: "kitchen_sink_image_job", args: { prompt: "kitchen block this image" } },
  { providerId: "kitchen-sink-image" },
);
assert.equal(blockedToolHookResult.block, true);
assert.equal(blockedToolHookResult.terminal, true);
assert.equal(blockedToolHookResult.decision, "block");
assert.match(blockedToolHookResult.blockReason, /blocked kitchen_sink_image_job/);

const approvalToolHookResult = await beforeToolHook(
  { toolId: "kitchen_sink_image_job", args: { prompt: "kitchen image needs approval" } },
  { providerId: "kitchen-sink-image" },
);
assert.equal(approvalToolHookResult.decision, "approval");
assert.equal(approvalToolHookResult.requireApproval.pluginId, "openclaw-kitchen-sink-fixture");
assert.equal(approvalToolHookResult.requireApproval.scenarioId, "image.generate");

const llmInputHook = findHook("llm_input");
const llmInputResult = await llmInputHook(
  {
    prompt: "kitchen explain image routing with api_key sk-test-redacted",
    apiKey: "sk-real-secret-not-stored",
  },
  { providerId: "kitchen-sink-llm", authorization: "Bearer local-secret" },
);
assert.equal(llmInputResult.scenarioId, "text.reply");
assert.equal(llmInputResult.privacy.boundary, "conversation-observer");
assert.equal(llmInputResult.privacy.storesRawPayload, false);
assert.equal(llmInputResult.privacy.exposesRawPayload, false);
assert.deepEqual(llmInputResult.privacy.redactedFields, ["event.apiKey", "context.authorization"]);
assert.ok(llmInputResult.privacy.secretPatternCount >= 2);

const channel = findRegistration("registerChannel", "kitchen-sink-channel");
const channelAccount = channel.config.resolveAccount({}, "local");
assert.equal(channelAccount.configured, true);
assert.equal(channelAccount.enabled, true);
assert.equal(channelAccount.statusState, "ready");
assert.equal(channelAccount.health.ok, true);
assert.equal(channel.config.resolveAccount({ disabled: true }, "disabled").statusState, "disabled");
const channelDelivery = await channel.outbound.sendText({
  cfg: {},
  to: "kitchen demo",
  text: "kitchen generate an image",
});
assert.equal(channelDelivery.channel, "kitchen-sink-channel");
assert.equal(channelDelivery.conversationId, "kitchen-demo");
assert.equal(channelDelivery.deliveryStatus, "sent");
assert.equal(channelDelivery.transport, "kitchen-sink-local");
assert.equal(channelDelivery.meta.scenarioId, "image.generate");
const channelRoute = await channel.messaging.resolveOutboundSessionRoute({
  cfg: {},
  agentId: "fixture-agent",
  target: "kitchen demo",
});
assert.equal(channelRoute.sessionKey, "kitchen:fixture-agent:kitchen-demo");
assert.equal(channelRoute.peer.kind, "direct");

const taskRuntime = registrations.registerDetachedTaskRuntime?.at(-1)?.[0];
assert.equal(typeof taskRuntime?.createRunningTaskRun, "function");
const task = taskRuntime.createRunningTaskRun({
  runtime: "cli",
  runId: "ks_image_runtime_test",
  taskKind: "image.generate",
  task: "generate an image with kitchen sink",
});
assert.equal(task.status, "running");
assert.equal(task.sourceId, "openclaw-kitchen-sink-fixture");
const completedTasks = taskRuntime.completeTaskRunByRunId({
  runId: "ks_image_runtime_test",
  runtime: "cli",
  endedAt: 1_776_600_000_000,
  terminalSummary: "Kitchen Sink image completed.",
});
assert.equal(completedTasks[0].status, "succeeded");
assert.equal(completedTasks[0].terminalSummary, "Kitchen Sink image completed.");

const contextEngineFactory = registrations.registerContextEngine?.at(-1)?.[1];
assert.equal(typeof contextEngineFactory, "function");
assert.equal(registrations.registerContextEngine.at(-1)[0], PLUGIN_ID);
const contextEngine = contextEngineFactory({});
assert.equal(contextEngine.info.id, PLUGIN_ID);
assert.equal(contextEngine.info.ownsCompaction, false);
assert.deepEqual(await contextEngine.ingest({ sessionId: "ks-session", message: { role: "user", content: "kitchen" } }), {
  ingested: true,
});
const assembledContext = await contextEngine.assemble({
  sessionId: "ks-session",
  messages: [{ role: "user", content: "kitchen context" }],
});
assert.equal(assembledContext.messages.length, 1);
assert.match(assembledContext.systemPromptAddition, /Kitchen Sink context engine fixture is active/);
const contextCompaction = await contextEngine.compact({
  sessionId: "ks-session",
  sessionFile: "session.json",
  messages: [{ role: "user", content: "kitchen context compact" }],
});
assert.equal(contextCompaction.compacted, true);
assert.match(contextCompaction.result.summary, /Kitchen Sink compacted/);

const imageProvider = findRegistration("registerImageGenerationProvider", "kitchen-sink-image");
assert.equal(imageProvider.defaultModel, "kitchen-sink-image-v1");

const sleeps = [];
const {
  listKitchenHumanScenarios,
  runKitchenHumanScenario,
  runKitchenImageTool,
  runKitchenScenario,
} = await import("../src/scenarios.js");
const { createKitchenSinkRuntime } = await import("../src/kitchen-runtime.js");
const fastRuntime = createKitchenSinkRuntime({
  delayMs: 10_000,
  sleep: async (ms) => {
    sleeps.push(ms);
  },
  now: fixedNow(),
});
const imageResult = await fastRuntime.runImageJob({ prompt: "generate an image with kitchen sink" });
assert.deepEqual(sleeps, [10_000]);
assert.equal(imageResult.scenarioId, "image.generate");
assert.equal(imageResult.route, "provider:image");
assert.equal(imageResult.job.status, "completed");
assert.equal(imageResult.job.pluginId, "openclaw-kitchen-sink-fixture");
assert.equal(imageResult.job.progressPercent, 100);
assert.equal(imageResult.job.statusUrl, `kitchen://jobs/${imageResult.job.id}`);
assert.deepEqual(
  imageResult.job.timeline.map((entry) => entry.status),
  ["queued", "running", "completed"],
);
assert.equal(imageResult.job.output.contentHash, "e126064123bb13d8");
assert.equal(imageResult.image.metadata.pluginId, "openclaw-kitchen-sink-fixture");
assert.equal(imageResult.image.metadata.assetId, "office-lobby-sink");
assert.equal(imageResult.image.metadata.assetName, "kitchen_sink_office.png");
assert.equal(imageResult.image.metadata.source, "bundled-real-image");
assert.equal(imageResult.image.metadata.model, "kitchen-sink-image-v1");
assert.equal(imageResult.image.metadata.width, 1024);
assert.equal(imageResult.image.metadata.height, 1024);
assert.equal(imageResult.image.metadata.sizeBytes, 948291);
assert.equal(imageResult.image.metadata.sha256, "e126064123bb13d8ee01a22c204e079bc22397c103ed1c3a191c60d5ae3319aa");
assert.equal(imageResult.image.metadata.contentHash, "e126064123bb13d8");
assert.equal(imageResult.image.metadata.finishReason, "success");
assert.equal(imageResult.image.mimeType, "image/png");
assert.equal(imageResult.image.fileName, `${imageResult.job.id}.png`);
assert.deepEqual(
  [...imageResult.image.buffer.subarray(0, 8)],
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
);
assert.ok(imageResult.image.dataUrl.startsWith("data:image/png;base64,"));

const humanScenarios = listKitchenHumanScenarios();
assert.deepEqual(
  humanScenarios.map((scenario) => scenario.id),
  [
    "dry.prefix-image",
    "live.openai-text-kitchen-image",
    "search.fetch.summarize",
    "channel.prefix-image",
    "hook.block-tool",
    "memory.compact-fixture",
  ],
);
const liveImageScenario = await runKitchenHumanScenario(fastRuntime, "live.openai-text-kitchen-image");
assert.equal(liveImageScenario.mode, "live-llm-compatible");
assert.equal(liveImageScenario.result.route, "human:live-llm-image-provider");
assert.equal(liveImageScenario.result.image.metadata.assetName, "kitchen_sink_office.png");
const searchFetchScenario = await runKitchenHumanScenario(fastRuntime, "search.fetch.summarize");
assert.equal(searchFetchScenario.result.search.results[0].id, "ks-result-image-provider");
assert.equal(searchFetchScenario.result.fetch.finalUrl, "kitchen://fixture/readme");
assert.match(searchFetchScenario.result.summary, /Kitchen Sink text fixture/);
const channelScenario = await runKitchenHumanScenario(fastRuntime, "channel.prefix-image");
assert.equal(channelScenario.result.delivery.channel, "kitchen-sink-channel");
assert.equal(channelScenario.result.delivery.meta.scenarioId, "image.generate");
const hookBlockScenario = await runKitchenHumanScenario(fastRuntime, "hook.block-tool");
assert.equal(hookBlockScenario.result.block, true);
assert.equal(hookBlockScenario.result.decision, "block");
const memoryScenario = await runKitchenHumanScenario(fastRuntime, "memory.compact-fixture");
assert.equal(memoryScenario.result.embedding.length, 8);
assert.equal(memoryScenario.result.memory.results[0].id, "ks-memory-runtime-surfaces");
assert.deepEqual(memoryScenario.result.compaction.preservedIdentifiers, ["ks_image_1f8a5a98"]);

sleeps.length = 0;
const failedImageResult = await fastRuntime.runImageJob({ prompt: "kitchen rate limit image" });
assert.deepEqual(sleeps, [10_000]);
assert.equal(failedImageResult.job.status, "failed");
assert.deepEqual(
  failedImageResult.job.timeline.map((entry) => entry.status),
  ["queued", "running", "failed"],
);
assert.equal(failedImageResult.error.code, "rate_limited");
assert.equal(failedImageResult.error.statusCode, 429);
assert.equal(failedImageResult.error.retryAfterMs, 30_000);

const failedToolResult = await runKitchenImageTool(fastRuntime, { prompt: "kitchen timeout image" });
assert.deepEqual(sleeps, [10_000, 10_000]);
assert.equal(failedToolResult.ok, false);
assert.equal(failedToolResult.error.code, "timeout");
assert.equal(failedToolResult.mediaUrl, undefined);

const scenarioResult = await runKitchenScenario(fastRuntime, {
  scenario: "web.fetch",
  url: "kitchen://fixture/redirect",
  route: "test:scenario-engine",
});
assert.equal(PLUGIN_ID, "openclaw-kitchen-sink-fixture");
assert.equal(scenarioResult.scenarioId, "web.fetch");
assert.equal(scenarioResult.route, "test:scenario-engine");
assert.equal(scenarioResult.ok, true);
assert.equal(scenarioResult.statusCode, 200);
assert.equal(scenarioResult.finalUrl, "kitchen://fixture/readme");
assert.equal(scenarioResult.redirects.length, 1);
assert.equal(scenarioResult.headers["x-kitchen-sink-fixture"], "true");
assert.match(scenarioResult.content, /deterministic document/);

const mediaProvider = findRegistration("registerMediaUnderstandingProvider", "kitchen-sink-media");
const mediaResult = await mediaProvider.describeImage({
  prompt: "what is in this image",
  model: "kitchen-sink-vision-v1",
});
assert.match(mediaResult.text, /Kitchen Sink media fixture/);
const audioDescription = await mediaProvider.transcribeAudio({
  audio: Buffer.from("audio fixture"),
  prompt: "transcribe this kitchen audio",
});
assert.match(audioDescription.text, /Kitchen Sink transcript/);
assert.equal(audioDescription.segments.length, 2);
const videoDescription = await mediaProvider.describeVideo({ prompt: "describe kitchen video" });
assert.match(videoDescription.text, /three deterministic frames/);

const speechProvider = findRegistration("registerSpeechProvider", "kitchen-sink-speech");
const speechResult = await speechProvider.synthesize({ text: "say kitchen sink" });
assert.equal(speechResult.mimeType, "audio/wav");
assert.equal(speechResult.audioBuffer.subarray(0, 4).toString("ascii"), "RIFF");
assert.equal(speechResult.metadata.providerId, "kitchen-sink-speech");

const realtimeTranscriptionProvider = findRegistration(
  "registerRealtimeTranscriptionProvider",
  "kitchen-sink-realtime-transcription",
);
const realtimeTranscripts = [];
const realtimeSession = realtimeTranscriptionProvider.createSession({
  onTranscript: (text) => realtimeTranscripts.push(text),
});
await realtimeSession.connect();
realtimeSession.sendAudio(Buffer.from("abc"));
const realtimeFinal = await realtimeSession.close();
assert.match(realtimeFinal.text, /Kitchen Sink transcript/);
assert.ok(realtimeTranscripts.some((text) => /partial transcript/.test(text)));

const realtimeVoiceProvider = findRegistration("registerRealtimeVoiceProvider", "kitchen-sink-realtime-voice");
const realtimeVoiceEvents = [];
const realtimeBridge = realtimeVoiceProvider.createBridge({
  onEvent: (event) => realtimeVoiceEvents.push(event.type),
});
await realtimeBridge.connect();
assert.equal(realtimeBridge.isConnected(), true);
realtimeBridge.setMediaTimestamp(123);
realtimeBridge.submitToolResult({ ok: true });
realtimeBridge.close();
assert.equal(realtimeBridge.isConnected(), false);
assert.deepEqual(realtimeVoiceEvents, ["connected", "media_timestamp", "tool_result", "closed"]);

const videoProvider = findRegistration("registerVideoGenerationProvider", "kitchen-sink-video");
const videoResult = await videoProvider.generateVideo({ prompt: "kitchen video" });
assert.equal(videoResult.videos[0].mimeType, "application/vnd.openclaw.kitchen-video+json");
assert.equal(videoResult.job.status, "completed");

const musicProvider = findRegistration("registerMusicGenerationProvider", "kitchen-sink-music");
const musicResult = await musicProvider.generateMusic({ prompt: "kitchen song" });
assert.equal(musicResult.tracks[0].mimeType, "audio/wav");
assert.equal(musicResult.tracks[0].audioBuffer.subarray(0, 4).toString("ascii"), "RIFF");

const searchProvider = findRegistration("registerWebSearchProvider", "kitchen-sink-search");
const searchTool = searchProvider.createTool({});
const searchResult = await searchTool.execute({ query: "kitchen sink image provider" });
assert.equal(searchResult.results.length, 3);
assert.equal(searchResult.provider, "kitchen-sink-search");
assert.equal(searchResult.ok, true);
assert.equal(searchResult.statusCode, 200);
assert.equal(searchResult.results[0].id, "ks-result-image-provider");
assert.equal(searchResult.results[0].metadata.provider, "kitchen-sink-image");
const emptySearchResult = await searchTool.execute({ query: "kitchen empty results" });
assert.equal(emptySearchResult.ok, true);
assert.equal(emptySearchResult.results.length, 0);

const textProvider = findRegistration("registerProvider", "kitchen-sink-llm");
const catalog = await textProvider.staticCatalog.run({ config: {}, env: {} });
assert.equal(catalog.provider.models[0].id, "kitchen-sink-text-v1");
assert.equal(catalog.provider.models[0].api, "kitchen-sink");
const authResult = await textProvider.auth[0].run();
assert.equal(authResult.profiles[0].id, "kitchen-sink-local");
const streamFn = textProvider.createStreamFn({});
const stream = streamFn(catalog.provider.models[0], {
  messages: [{ role: "user", content: "kitchen explain text inference", timestamp: 0 }],
});
const streamEvents = [];
for await (const event of stream) {
  streamEvents.push(event.type);
}
const streamMessage = await stream.result();
assert.deepEqual(streamEvents, ["start", "text_start", "text_delta", "text_end", "done"]);
assert.match(streamMessage.content[0].text, /kitchen explain text inference/);
assert.ok(streamMessage.usage.totalTokens > 0);

const embeddingProvider = findRegistration("registerMemoryEmbeddingProvider", "kitchen-sink-memory-embedding");
const embeddingResult = await embeddingProvider.embed({ text: "kitchen memory" });
assert.equal(embeddingResult.embedding.length, 8);
assert.equal(embeddingResult.model, "kitchen-sink-embed-v1");
const embeddingBatch = await embeddingProvider.embedMany({ texts: ["one", "two"] });
assert.equal(embeddingBatch.embeddings.length, 2);

const memoryCorpus = findRegistration("registerMemoryCorpusSupplement", "kitchen-sink-memory-corpus");
const memorySearch = await memoryCorpus.search({ query: "runtime surfaces" });
assert.equal(memorySearch.results[0].id, "ks-memory-runtime-surfaces");
const memoryRead = await memoryCorpus.read("ks-memory-runtime-surfaces");
assert.match(memoryRead.text, /providers, channels, hooks/);

const compactionProvider = findRegistration("registerCompactionProvider", "kitchen-sink-compaction");
const compacted = await compactionProvider.compact({
  messages: [{ role: "user", content: "remember job ks_image_1f8a5a98 and the image fixture" }],
});
assert.match(compacted.summary, /Kitchen Sink compacted/);
assert.deepEqual(compacted.preservedIdentifiers, ["ks_image_1f8a5a98"]);

const middleware = registrations.registerAgentToolResultMiddleware.at(-1);
assert.equal(typeof middleware?.[0], "function");
assert.deepEqual(middleware[1].runtimes, ["pi", "codex", "cli"]);
const middlewareResult = await middleware[0]({ result: { content: "tool output" } });
assert.equal(middlewareResult.metadata.kitchenSinkToolResultMiddleware, true);

const service = registrations.registerService.map(([value]) => value).at(-1);
assert.equal(service.id, "kitchen-sink-service");
assert.equal((await service.probe()).state, "ready");
assert.equal((await service.start()).state, "started");

const httpRoute = findRegistration("registerHttpRoute", "kitchen-sink-http-status");
let httpBody = "";
const httpResult = await httpRoute.handler({}, {
  setHeader: () => {},
  end: (body) => {
    httpBody = body;
  },
});
assert.equal(httpRoute.path, "/kitchen-sink/status");
assert.equal(httpResult.ok, true);
assert.match(httpBody, /openclaw-kitchen-sink-fixture/);

const gatewayMethod = registrations.registerGatewayMethod.find(([name]) => name === "kitchen.status");
assert.ok(gatewayMethod, "registers kitchen.status gateway method");
const gatewayResult = await gatewayMethod[1]({});
assert.ok(gatewayResult.providerIds.includes("kitchen-sink-video"));

const cliRegistration = registrations.registerCli.at(-1);
assert.equal(typeof cliRegistration?.[0], "function");
assert.equal(cliRegistration[1].descriptors[0].name, "kitchen-sink");

const nodeCliRegistration = registrations.registerNodeCliFeature.at(-1);
assert.equal(typeof nodeCliRegistration?.[0], "function");
assert.equal(nodeCliRegistration[1].descriptors[0].name, "kitchen-sink-node-cli-feature");
const nodeCommands = [];
await nodeCliRegistration[0]({
  program: {
    command(name) {
      const command = {
        name,
        descriptionText: "",
        actionHandler: null,
        description(text) {
          this.descriptionText = text;
          return this;
        },
        action(handler) {
          this.actionHandler = handler;
          return this;
        },
      };
      nodeCommands.push(command);
      return command;
    },
  },
  parentPath: ["nodes"],
  config: {},
  logger: console,
});
assert.equal(nodeCommands[0]?.name, "kitchen-sink-node-cli-feature");
assert.equal(nodeCommands[0]?.descriptionText, "Kitchen Sink node CLI feature fixture.");
assert.equal(typeof nodeCommands[0]?.actionHandler, "function");

const transcriptSourceProvider = findRegistration(
  "registerTranscriptSourceProvider",
  "kitchen-sink-transcript-source-provider",
);
assert.deepEqual(transcriptSourceProvider.sourceKinds, ["posthoc-transcript"]);
const meetingTranscript = await transcriptSourceProvider.importTranscript({
  session: {
    sessionId: "kitchen-sink-transcript-session",
    source: { providerId: "kitchen-sink-transcript-source-provider", kind: "posthoc-transcript" },
  },
  text: "Kitchen Sink meeting notes fixture",
});
assert.match(meetingTranscript[0].text, /Kitchen Sink meeting notes fixture/);

const imageTool = findRegistration("registerTool", "kitchen_sink_image_job");
assert.equal(typeof imageTool.execute, "function");

const { KITCHEN_SINK_EXPECTED_DIAGNOSTICS } = await import("../src/personality.js");
assert.deepEqual(KITCHEN_SINK_EXPECTED_DIAGNOSTICS.conformance, []);
assert.ok(
  KITCHEN_SINK_EXPECTED_DIAGNOSTICS.adversarial.includes(
    'channel "kitchen-sink-channel-probe" registration missing required config helpers',
  ),
);
assert.ok(
  KITCHEN_SINK_EXPECTED_DIAGNOSTICS.full.includes(
    "only bundled plugins can register agent tool result middleware",
  ),
);

const conformance = capturePluginRegistration(plugin, { personality: "conformance" });
assert.ok(
  conformance.registerCommand?.some(([command]) => command.name === "kitchen"),
  "conformance registers usable commands",
);
assert.ok(
  conformance.registerChannel?.some(([channel]) => channel.id === "kitchen-sink-channel"),
  "conformance registers the usable channel",
);
assert.equal(conformance.registerAgentToolResultMiddleware, undefined);
assert.equal(
  conformance.registerChannel?.some(([channel]) => channel.id === "kitchen-sink-channel-probe"),
  false,
);

const adversarial = capturePluginRegistration(plugin, { personality: "adversarial" });
assert.equal(
  adversarial.registerCommand?.some(([command]) => command.name === "kitchen"),
  false,
);
assert.equal(
  adversarial.registerChannel?.some(([channel]) => channel.id === "kitchen-sink-channel"),
  false,
);
assert.ok(
  adversarial.registerChannel?.some(([channel]) => channel.id === "kitchen-sink-channel-probe"),
  "adversarial registers generated invalid channel probe",
);
assert.ok(
  adversarial.registerCompactionProvider?.some(([provider]) => provider.id === "kitchen-sink-compaction-provider"),
  "adversarial registers generated invalid compaction probe",
);

console.log("Kitchen runtime OK");

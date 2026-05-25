# Kitchen Sink Contract Probes

Generated: deterministic
Status: PASS

## Covered Inspector Gaps

- before_tool_call allow/block/approval semantics
- llm_input, llm_output, and agent_end privacy-boundary probes
- runtime registrar capture for service, route, gateway, command, interactive handler, and channel surfaces
- channel account, envelope, and outbound route probes

## Runtime Registrations

| Method | Count | IDs |
| ------ | ----- | --- |
| registerAgentEventSubscription | 1 | kitchen-sink-agent-event-subscription |
| registerAgentHarness | 1 | kitchen-sink-agent-harness |
| registerAgentToolResultMiddleware | 2 | kitchen-sink-agent-tool-result-middleware, kitchen-sink-agent-tool-result-middleware |
| registerAutoEnableProbe | 1 | kitchen-sink-auto-enable-probe |
| registerChannel | 2 | kitchen-sink-channel, kitchen-sink-channel-probe |
| registerCli | 2 | kitchen-sink, kitchen-sink-cli |
| registerCliBackend | 1 | kitchen-sink-cli-backend |
| registerCodexAppServerExtensionFactory | 1 | kitchen-sink-codex-app-server-extension-factory |
| registerCommand | 3 | kitchen, kitchen-sink, kitchen-sink-command |
| registerCompactionProvider | 2 | kitchen-sink-compaction, kitchen-sink-compaction-provider |
| registerConfigMigration | 1 | kitchen-sink-config-migration |
| registerContextEngine | 1 | kitchen-sink-context-engine |
| registerControlUiDescriptor | 1 | kitchen-sink-control-ui-descriptor |
| registerDetachedTaskRuntime | 1 | kitchen-sink-detached-task-runtime |
| registerEmbeddingProvider | 1 | kitchen-sink-embedding-provider |
| registerGatewayDiscoveryService | 1 | kitchen-sink-gateway-discovery-service |
| registerGatewayMethod | 2 | kitchen-sink-gateway-method, kitchen.status |
| registerHook | 1 | kitchen-sink-hook |
| registerHostedMediaResolver | 1 | kitchen-sink-hosted-media-resolver |
| registerHttpRoute | 2 | kitchen-sink-http-route, kitchen-sink-http-status |
| registerImageGenerationProvider | 2 | kitchen-sink-image, kitchen-sink-image-generation-provider |
| registerInteractiveHandler | 2 | kitchen-sink-interactive-handler, kitchen-sink-interactive-handler |
| registerMediaUnderstandingProvider | 2 | kitchen-sink-media, kitchen-sink-media-understanding-provider |
| registerMeetingNotesSourceProvider | 1 | kitchen-sink-meeting-notes-source-provider |
| registerMemoryCapability | 1 | kitchen-sink-memory-capability |
| registerMemoryCorpusSupplement | 2 | kitchen-sink-memory-corpus, kitchen-sink-memory-corpus-supplement |
| registerMemoryEmbeddingProvider | 2 | kitchen-sink-memory-embedding, kitchen-sink-memory-embedding-provider |
| registerMemoryFlushPlan | 1 | kitchen-sink-memory-flush-plan |
| registerMemoryPromptSection | 1 | kitchen-sink-memory-prompt-section |
| registerMemoryPromptSupplement | 2 | kitchen-sink-memory-prompt-supplement, kitchen-sink-memory-prompt-supplement |
| registerMemoryRuntime | 1 | kitchen-sink-memory-runtime |
| registerMigrationProvider | 1 | kitchen-sink-migration-provider |
| registerModelCatalogProvider | 1 | kitchen-sink-model-catalog-provider |
| registerMusicGenerationProvider | 2 | kitchen-sink-music, kitchen-sink-music-generation-provider |
| registerNodeCliFeature | 1 | kitchen-sink-node-cli-feature |
| registerNodeHostCommand | 1 | kitchen-sink-node-host-command |
| registerNodeInvokePolicy | 1 | kitchen-sink-node-invoke-policy |
| registerProvider | 2 | kitchen-sink-llm, kitchen-sink-provider |
| registerRealtimeTranscriptionProvider | 2 | kitchen-sink-realtime-transcription, kitchen-sink-realtime-transcription-provider |
| registerRealtimeVoiceProvider | 2 | kitchen-sink-realtime-voice, kitchen-sink-realtime-voice-provider |
| registerReload | 1 | kitchen-sink-reload |
| registerRuntimeLifecycle | 1 | kitchen-sink-runtime-lifecycle |
| registerSecurityAuditCollector | 1 | kitchen-sink-security-audit-collector |
| registerService | 2 | kitchen-sink-service, kitchen-sink-service |
| registerSessionAction | 1 | kitchen-sink-session-action |
| registerSessionExtension | 1 | kitchen-sink-session-extension |
| registerSessionSchedulerJob | 1 | kitchen-sink-session-scheduler-job |
| registerSpeechProvider | 2 | kitchen-sink-speech, kitchen-sink-speech-provider |
| registerTextTransforms | 1 | kitchen-sink-text-transforms |
| registerTool | 4 | kitchen-sink-tool, kitchen_sink_image_job, kitchen_sink_search, kitchen_sink_text |
| registerToolMetadata | 1 | kitchen-sink-tool-metadata |
| registerTrustedToolPolicy | 1 | kitchen-sink-trusted-tool-policy |
| registerVideoGenerationProvider | 2 | kitchen-sink-video, kitchen-sink-video-generation-provider |
| registerWebFetchProvider | 2 | kitchen-sink-fetch, kitchen-sink-web-fetch-provider |
| registerWebSearchProvider | 2 | kitchen-sink-search, kitchen-sink-web-search-provider |

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readOpenClawSurface } from "./openclaw-surface.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
const surface = readOpenClawSurface();
const minHostVersion = "2026.5.23";

const generated = new Map([
  ["package.json", renderPackageJson(surface)],
  ["src/generated-hooks.js", renderHooks(surface)],
  ["src/generated-registrars.js", renderRegistrars(surface)],
  ["src/generated-sdk-imports.ts", renderSdkImports(surface)],
  ["src/index.js", renderRuntimeIndex(surface)],
  ["openclaw.plugin.json", renderManifest(surface)],
]);

const changed = [];
for (const [relativePath, content] of generated) {
  const filePath = path.join(rootDir, relativePath);
  const current = readIfExists(filePath);
  if (current !== content) {
    changed.push(relativePath);
    if (!check) {
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf8");
    }
  }
}

if (changed.length > 0 && check) {
  throw new Error(`generated OpenClaw surface files are stale:\n${changed.join("\n")}\nRun npm run sync:surface.`);
}

console.log(
  `surface ${check ? "checked" : "synced"} for openclaw ${surface.packageVersion}: ${surface.registrars.length} registrars, ${surface.hooks.length} hooks, ${surface.manifestContracts.length} manifest contracts, ${surface.pluginSdkExports.length} SDK exports`,
);

function renderHooks({ hooks, packageVersion }) {
  return `${header(packageVersion)}import { observeKitchenHook } from "./scenarios.js";

export function registerAllHooks(api) {
${hooks.map((hook) => `  api.on(${JSON.stringify(hook)}, kitchenSinkHook(${JSON.stringify(hook)}));`).join("\n")}
}

function kitchenSinkHook(name) {
  return async (event, context) => observeKitchenHook(name, event, context);
}
`;
}

function renderRegistrars({ registrars, packageVersion }) {
  return `${header(packageVersion)}
export function registerAllRegistrars(api) {
${registrars.map(renderRegistrarCoverage).join("\n")}
}

function safeRegister(name, register) {
  try {
    register();
  } catch (error) {
    apiSurfaceProbeFailures.push({ name, message: String(error?.message ?? error) });
  }
}

export const apiSurfaceProbeFailures = [];

function payloadFor(name) {
  const id = name.replace(/^register/, "").replace(/[A-Z]/g, (letter, index) => (index === 0 ? "" : "-") + letter.toLowerCase()) || "probe";
  const probeId = name === "registerChannel" ? "kitchen-sink-channel-probe" : "kitchen-sink-" + id;
  return {
    id: probeId,
    name: probeId,
    description: "Kitchen-sink no-op probe for " + name + ".",
    command: probeId,
    path: "/kitchen-sink/" + id,
    method: "POST",
    inputSchema: objectSchema(),
    schema: objectSchema(),
    configSchema: objectSchema(),
    handler: async () => ({ ok: true, registrar: name }),
    run: async () => ({ ok: true, registrar: name }),
    execute: async () => ({ ok: true, registrar: name }),
    start: async () => ({ ok: true, registrar: name }),
    stop: async () => ({ ok: true, registrar: name }),
    setup: async () => ({ ok: true, registrar: name }),
    migrate: async (value) => value,
    transform: async (value) => value,
    render: async () => "kitchen-sink memory prompt section",
    create: async () => ({ ok: true, registrar: name }),
    speak: async () => ({ audio: new Uint8Array(), mimeType: "audio/wav" }),
    synthesize: async () => ({ audio: new Uint8Array(), mimeType: "audio/wav" }),
    send: async () => ({ ok: true }),
    receive: async () => ({ ok: true }),
    probe: async () => ({ enabled: false, reason: "kitchen-sink no-op" }),
  };
}

function meetingNotesSourceProviderPayload() {
  return {
    id: "kitchen-sink-meeting-notes-source-provider",
    name: "Kitchen Sink Meeting Notes Source",
    sourceKinds: ["posthoc-transcript"],
    status: async () => [],
    importTranscript: async () => [
      {
        speaker: { label: "Kitchen Sink" },
        text: "Kitchen Sink meeting notes fixture transcript.",
        final: true,
      },
    ],
  };
}

function nodeCliFeatureRegistrar({ program }) {
  program
    .command("kitchen-sink-node-cli-feature")
    .description("Kitchen Sink node CLI feature fixture.")
    .action(() => {
      console.log("Kitchen Sink node CLI feature OK");
    });
}

function nodeCliFeatureOptions() {
  return {
    descriptors: [
      {
        name: "kitchen-sink-node-cli-feature",
        description: "Kitchen Sink node CLI feature fixture.",
        hasSubcommands: false,
      },
    ],
  };
}

function objectSchema() {
  return {
    type: "object",
    additionalProperties: true,
    properties: {
      input: { type: "string" },
    },
  };
}
`;
}

function renderRegistrarCoverage(registrar) {
  if (registrar === "registerDetachedTaskRuntime") {
    return `  void "api.registerDetachedTaskRuntime("; // Covered by the hand-owned Kitchen Sink task runtime.`;
  }
  if (registrar === "registerMeetingNotesSourceProvider") {
    return `  safeRegister("${registrar}", () => api.registerMeetingNotesSourceProvider(meetingNotesSourceProviderPayload()));`;
  }
  if (registrar === "registerNodeCliFeature") {
    return `  safeRegister("${registrar}", () => api.registerNodeCliFeature(nodeCliFeatureRegistrar, nodeCliFeatureOptions()));`;
  }
  return `  safeRegister("${registrar}", () => api.${registrar}(payloadFor("${registrar}")));`;
}

function renderSdkImports({ pluginSdkExports, packageVersion }) {
  return `${header(packageVersion)}${pluginSdkExports
    .map((specifier, index) => `import type * as sdk${index} from "${specifier}";`)
    .join("\n")}

export type KitchenSinkSdkImportSurface =
${pluginSdkExports.map((_, index) => `  | typeof sdk${index}`).join("\n")};
`;
}

function renderRuntimeIndex() {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  return `import { PLUGIN_ID } from "./constants.js";
import { registerAllHooks } from "./generated-hooks.js";
import { registerAllRegistrars } from "./generated-registrars.js";
import { registerKitchenSinkRuntime } from "./kitchen-runtime.js";
import {
  KITCHEN_SINK_EXPECTED_DIAGNOSTICS,
  resolveKitchenSinkPersonality,
} from "./personality.js";

export const plugin = {
  id: PLUGIN_ID,
  name: "OpenClaw Kitchen Sink",
  version: "${packageJson.version}",
  description: "Credential-free fixture covering OpenClaw plugin API seams.",
  expectedDiagnostics: KITCHEN_SINK_EXPECTED_DIAGNOSTICS,
  register(api) {
    const personality = resolveKitchenSinkPersonality(api);
    registerAllHooks(api);
    if (personality !== "conformance") {
      registerAllRegistrars(api);
    }
    if (personality !== "adversarial") {
      registerKitchenSinkRuntime(api, {
        includeAgentToolResultMiddleware: personality !== "conformance",
      });
    }
  },
};

export function register(api) {
  plugin.register(api);
}

export default plugin;
`;
}

function renderManifest({ manifestContracts, packageVersion }) {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const contracts = Object.fromEntries(manifestContracts.map((field) => [field, [`kitchen-sink-${kebab(field)}`]]));
  appendContract(contracts, "imageGenerationProviders", "kitchen-sink-image");
  appendContract(contracts, "mediaUnderstandingProviders", "kitchen-sink-media");
  contracts.meetingNotesSourceProviders = ["kitchen-sink-meeting-notes-source-provider"];
  appendContract(contracts, "speechProviders", "kitchen-sink-speech");
  appendContract(contracts, "realtimeTranscriptionProviders", "kitchen-sink-realtime-transcription");
  appendContract(contracts, "realtimeVoiceProviders", "kitchen-sink-realtime-voice");
  appendContract(contracts, "videoGenerationProviders", "kitchen-sink-video");
  appendContract(contracts, "musicGenerationProviders", "kitchen-sink-music");
  appendContract(contracts, "memoryEmbeddingProviders", "kitchen-sink-memory-embedding");
  appendContract(contracts, "agentToolResultMiddleware", "kitchen-sink-agent-tool-result-middleware");
  appendContract(contracts, "webSearchProviders", "kitchen-sink-search");
  appendContract(contracts, "webFetchProviders", "kitchen-sink-fetch");
  appendContract(contracts, "tools", "kitchen_sink_image_job");
  appendContract(contracts, "tools", "kitchen_sink_text");
  appendContract(contracts, "tools", "kitchen_sink_search");
  const manifest = {
    id: "openclaw-kitchen-sink-fixture",
    name: "OpenClaw Kitchen Sink",
    version: packageJson.version,
    description: `Generated kitchen-sink fixture for OpenClaw plugin API surface ${packageVersion}.`,
    enabledByDefault: false,
    kind: ["tool", "hook", "channel", "provider"],
    channels: ["kitchen-sink-channel"],
    providers: [
      "kitchen-sink-provider",
      "kitchen-sink-llm",
      "kitchen-sink-image",
      "kitchen-sink-speech",
      "kitchen-sink-video",
      "kitchen-sink-music",
    ],
    cliBackends: ["kitchen-sink-cli-backend"],
    commandAliases: [
      { command: "kitchen", pluginId: "openclaw-kitchen-sink-fixture" },
      { command: "kitchen-sink", pluginId: "openclaw-kitchen-sink-fixture" },
    ],
    activation: {
      onProviders: [
        "kitchen-sink-provider",
        "kitchen-sink-llm",
        "kitchen-sink-image",
        "kitchen-sink-speech",
        "kitchen-sink-video",
        "kitchen-sink-music",
      ],
      onChannels: ["kitchen-sink-channel"],
      onCommands: ["kitchen", "kitchen-sink"],
      onCapabilities: ["provider", "channel", "tool", "hook"],
    },
    channelConfigs: {
      "kitchen-sink-channel": {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            configured: { type: "boolean", default: true },
            disabled: { type: "boolean", default: false },
            enabled: { type: "boolean", default: true },
            token: { type: "string" },
          },
        },
        uiHints: {
          token: { sensitive: true },
        },
        label: "Kitchen Sink",
        description: "Credential-free channel fixture for deterministic Kitchen Sink conversations.",
        commands: {
          nativeCommandsAutoEnabled: true,
          nativeSkillsAutoEnabled: true,
        },
      },
    },
    setup: {
      providers: [
        { id: "kitchen-sink-provider", authMethods: ["none"], envVars: [] },
        { id: "kitchen-sink-llm", authMethods: ["none"], envVars: [] },
        { id: "kitchen-sink-image", authMethods: ["none"], envVars: [] },
        { id: "kitchen-sink-speech", authMethods: ["none"], envVars: [] },
        { id: "kitchen-sink-realtime-transcription", authMethods: ["none"], envVars: [] },
        { id: "kitchen-sink-realtime-voice", authMethods: ["none"], envVars: [] },
        { id: "kitchen-sink-video", authMethods: ["none"], envVars: [] },
        { id: "kitchen-sink-music", authMethods: ["none"], envVars: [] },
      ],
      cliBackends: ["kitchen-sink-cli-backend"],
      configMigrations: ["kitchen-sink-config-migration"],
      requiresRuntime: false,
    },
    contracts,
    configSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean", default: false },
        personality: { type: "string", enum: ["full", "conformance", "adversarial"], default: "full" },
      },
    },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function renderPackageJson({ packageVersion }) {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  packageJson.openclaw ??= {};
  packageJson.openclaw.build = {
    ...(packageJson.openclaw.build ?? {}),
    openclawVersion: packageVersion,
    pluginSdkVersion: packageVersion,
  };
  packageJson.openclaw.install = {
    ...(packageJson.openclaw.install ?? {}),
    clawhubSpec: "clawhub:@openclaw/kitchen-sink",
    npmSpec: "@openclaw/kitchen-sink",
    defaultChoice: "clawhub",
    minHostVersion: `>=${minHostVersion}`,
  };
  packageJson.openclaw.release = {
    ...(packageJson.openclaw.release ?? {}),
    publishToClawHub: true,
    publishToNpm: true,
  };
  if (packageJson.dependencies?.openclaw) {
    packageJson.dependencies.openclaw = packageVersion;
  }
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function header(packageVersion) {
  return `// Generated by scripts/sync-surface.mjs from openclaw ${packageVersion}. Do not edit by hand.\n`;
}

function kebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, "");
}

function appendContract(contracts, field, id) {
  if (!Array.isArray(contracts[field])) {
    contracts[field] = [];
  }
  if (!contracts[field].includes(id)) {
    contracts[field].push(id);
  }
}

function readIfExists(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

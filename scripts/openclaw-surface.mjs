import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// These bundled-plugin convenience barrels existed in published OpenClaw builds
// but were retired from the public package export contract on current main.
const retiredPluginSdkExports = new Set([
  "openclaw/plugin-sdk/bluebubbles",
  "openclaw/plugin-sdk/bluebubbles-policy",
  "openclaw/plugin-sdk/browser-cdp",
  "openclaw/plugin-sdk/browser-config-runtime",
  "openclaw/plugin-sdk/browser-config-support",
  "openclaw/plugin-sdk/browser-control-auth",
  "openclaw/plugin-sdk/browser-node-runtime",
  "openclaw/plugin-sdk/browser-profiles",
  "openclaw/plugin-sdk/browser-security-runtime",
  "openclaw/plugin-sdk/browser-setup-tools",
  "openclaw/plugin-sdk/browser-support",
  "openclaw/plugin-sdk/diagnostics-otel",
  "openclaw/plugin-sdk/diagnostics-prometheus",
  "openclaw/plugin-sdk/diffs",
  "openclaw/plugin-sdk/feishu",
  "openclaw/plugin-sdk/feishu-conversation",
  "openclaw/plugin-sdk/feishu-setup",
  "openclaw/plugin-sdk/github-copilot-login",
  "openclaw/plugin-sdk/github-copilot-token",
  "openclaw/plugin-sdk/googlechat",
  "openclaw/plugin-sdk/googlechat-runtime-shared",
  "openclaw/plugin-sdk/irc",
  "openclaw/plugin-sdk/irc-surface",
  "openclaw/plugin-sdk/line",
  "openclaw/plugin-sdk/line-core",
  "openclaw/plugin-sdk/line-runtime",
  "openclaw/plugin-sdk/line-surface",
  "openclaw/plugin-sdk/llm-task",
  "openclaw/plugin-sdk/matrix",
  "openclaw/plugin-sdk/matrix-helper",
  "openclaw/plugin-sdk/matrix-runtime-heavy",
  "openclaw/plugin-sdk/matrix-runtime-shared",
  "openclaw/plugin-sdk/matrix-runtime-surface",
  "openclaw/plugin-sdk/matrix-surface",
  "openclaw/plugin-sdk/matrix-thread-bindings",
  "openclaw/plugin-sdk/mattermost",
  "openclaw/plugin-sdk/mattermost-policy",
  "openclaw/plugin-sdk/memory-core",
  "openclaw/plugin-sdk/memory-lancedb",
  "openclaw/plugin-sdk/msteams",
  "openclaw/plugin-sdk/nextcloud-talk",
  "openclaw/plugin-sdk/nostr",
  "openclaw/plugin-sdk/opencode",
  "openclaw/plugin-sdk/telegram-command-ui",
  "openclaw/plugin-sdk/thread-ownership",
  "openclaw/plugin-sdk/tlon",
  "openclaw/plugin-sdk/twitch",
  "openclaw/plugin-sdk/voice-call",
  "openclaw/plugin-sdk/volc-model-catalog-shared",
  "openclaw/plugin-sdk/zalo",
  "openclaw/plugin-sdk/zalo-setup",
  "openclaw/plugin-sdk/zalouser",
]);

export function readOpenClawSurface() {
  const packageEntryPath = resolveOpenClawPackageEntry();
  const packageRoot = findPackageRoot(packageEntryPath);
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const pluginSdkExports = Object.keys(packageJson.exports ?? {})
    .filter((specifier) => specifier === "./plugin-sdk" || specifier.startsWith("./plugin-sdk/"))
    .map((specifier) => `openclaw/${specifier.slice(2)}`)
    .filter((specifier) => !retiredPluginSdkExports.has(specifier))
    .sort();

  const pluginTypesPath = firstExistingPath([
    path.join(packageRoot, "src/plugins/types.ts"),
    path.join(packageRoot, "dist/plugin-sdk/src/plugins/types.d.ts"),
  ]);
  const hookTypesPath = firstExistingPath([
    path.join(packageRoot, "src/plugins/hook-types.ts"),
    path.join(packageRoot, "dist/plugin-sdk/src/plugins/hook-types.d.ts"),
  ]);
  const manifestPath = firstExistingPath([
    path.join(packageRoot, "src/plugins/manifest.ts"),
    path.join(packageRoot, "dist/plugin-sdk/src/plugins/manifest.d.ts"),
  ]);

  const pluginTypesSource = readOptional(pluginTypesPath);
  const hookTypesSource = readOptional(hookTypesPath);
  const manifestSource = readOptional(manifestPath);
  const registrars = parseApiRegistrarFields(pluginTypesSource);

  return {
    packageJsonPath,
    packageVersion: packageJson.version,
    pluginSdkExports,
    registrars,
    hooks: parseHookNames(hookTypesSource),
    manifestContracts: parseTypeFields(manifestSource, "PluginManifestContracts"),
  };
}

function resolveOpenClawPackageEntry() {
  const packageRoot = process.env.OPENCLAW_PACKAGE_ROOT;
  if (packageRoot) {
    return path.join(path.resolve(packageRoot), "package.json");
  }
  return require.resolve("openclaw");
}

function findPackageRoot(entryPath) {
  let current = path.dirname(entryPath);
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, "package.json");
    if (existsSync(candidate)) {
      return current;
    }
    current = path.dirname(current);
  }
  throw new Error(`Could not find openclaw package root from ${entryPath}`);
}

function firstExistingPath(paths) {
  return paths.find((item) => existsSync(item)) ?? null;
}

function readOptional(filePath) {
  return filePath ? readFileSync(filePath, "utf8") : "";
}

function parseHookNames(source) {
  const arrayMatch = source.match(/PLUGIN_HOOK_NAMES[^=]*=\s*\[([\s\S]*?)\]/);
  if (arrayMatch) {
    return unique([...arrayMatch[1].matchAll(/["'`]([a-z0-9_:-]+)["'`]/g)].map((match) => match[1])).sort();
  }
  const unionMatch = source.match(/type\s+PluginHookName\s*=\s*([\s\S]*?);/);
  if (unionMatch) {
    return unique([...unionMatch[1].matchAll(/["'`]([a-z0-9_:-]+)["'`]/g)].map((match) => match[1])).sort();
  }
  return [];
}

function parseApiRegistrarFields(source) {
  return parseTypeFields(source, "OpenClawPluginApi")
    .filter((field) => field.startsWith("register"))
    .sort();
}

function parseTypeFields(source, typeName) {
  const match = source.match(new RegExp(`(?:export\\s+)?(?:declare\\s+)?type\\s+${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!match) {
    return [];
  }
  return unique([...match[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\??\s*:/gm)].map((field) => field[1])).sort();
}

function unique(values) {
  return [...new Set(values)];
}

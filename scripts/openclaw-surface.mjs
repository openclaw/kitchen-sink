import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  const pluginTypesSource = readSurfaceSource(packageRoot, {
    stablePaths: ["src/plugins/types.ts", "dist/plugin-sdk/src/plugins/types.d.ts"],
    fallbackDirs: ["dist/plugin-sdk", "dist"],
    parse: parseApiRegistrarFields,
  });
  const hookTypesSource = readSurfaceSource(packageRoot, {
    stablePaths: ["src/plugins/hook-types.ts", "dist/plugin-sdk/src/plugins/hook-types.d.ts"],
    fallbackDirs: ["dist/plugin-sdk", "dist"],
    parse: parseHookNames,
  });
  const manifestSource = readSurfaceSource(packageRoot, {
    stablePaths: ["src/plugins/manifest.ts", "dist/plugin-sdk/src/plugins/manifest.d.ts"],
    fallbackDirs: ["dist/plugin-sdk", "dist"],
    parse: (source) => parseTypeFields(source, "PluginManifestContracts"),
  });
  const registrars = parseApiRegistrarFields(pluginTypesSource);
  const hooks = parseHookNames(hookTypesSource);
  const manifestContracts = parseTypeFields(manifestSource, "PluginManifestContracts");

  assertNonEmptySurface(packageJson.version, "registrars", registrars);
  assertNonEmptySurface(packageJson.version, "hooks", hooks);
  assertNonEmptySurface(packageJson.version, "manifest contracts", manifestContracts);

  return {
    packageJsonPath,
    packageVersion: packageJson.version,
    pluginSdkExports,
    registrars,
    hooks,
    manifestContracts,
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

function readSurfaceSource(packageRoot, { stablePaths, fallbackDirs, parse }) {
  for (const relativePath of stablePaths) {
    const filePath = path.join(packageRoot, relativePath);
    if (!existsSync(filePath)) {
      continue;
    }
    const source = readFileSync(filePath, "utf8");
    if (parse(source).length > 0) {
      return source;
    }
  }

  for (const filePath of listDeclarationFiles(packageRoot, fallbackDirs)) {
    const source = readFileSync(filePath, "utf8");
    if (parse(source).length > 0) {
      return source;
    }
  }

  return "";
}

function listDeclarationFiles(packageRoot, relativeDirs) {
  const files = [];
  const seen = new Set();
  for (const relativeDir of relativeDirs) {
    const dir = path.join(packageRoot, relativeDir);
    if (!existsSync(dir)) {
      continue;
    }
    for (const filePath of walkDeclarationFiles(dir)) {
      if (seen.has(filePath)) {
        continue;
      }
      seen.add(filePath);
      files.push(filePath);
    }
  }
  return files.sort();
}

function walkDeclarationFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDeclarationFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".d.ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

function parseHookNames(source) {
  const arrayMatch = source.match(/PLUGIN_HOOK_NAMES[^=]*=\s*\[([\s\S]*?)\]/);
  if (arrayMatch) {
    return unique([...arrayMatch[1].matchAll(/["'`]([a-z0-9_:-]+)["'`]/g)].map((match) => match[1])).sort();
  }
  const declareArrayMatch = source.match(/PLUGIN_HOOK_NAMES[^:]*:\s*readonly\s*\[([\s\S]*?)\]/);
  if (declareArrayMatch) {
    return unique([...declareArrayMatch[1].matchAll(/["'`]([a-z0-9_:-]+)["'`]/g)].map((match) => match[1])).sort();
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

function assertNonEmptySurface(packageVersion, label, values) {
  if (values.length > 0) {
    return;
  }
  throw new Error(
    `Could not read OpenClaw ${packageVersion} ${label} from package declarations. ` +
      "The package layout may have changed; refusing to generate an empty kitchen-sink surface.",
  );
}

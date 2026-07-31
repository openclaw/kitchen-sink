#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readOpenClawSurface } from "./openclaw-surface.mjs";

const previousPackageRoot = process.env.OPENCLAW_PACKAGE_ROOT;

try {
  withTempOpenClawPackage((writeFile) => {
    writeBasePackage(writeFile, "0.0.0-source", {
      "./plugin-sdk/source-only": "./dist/plugin-sdk/source-only.d.ts",
      "./plugin-sdk/codex-mcp-projection": "./dist/plugin-sdk/codex-mcp-projection.d.ts",
    });
    writeFile(
      "dist/plugin-sdk/src/plugins/plugin-api.types.d.ts",
      "export type OpenClawPluginApi = {\n  registerStaleSurface: () => void;\n};\n",
    );
    writeFile(
      "src/plugins/types.ts",
      "export type OpenClawPluginApi = {\n  registerLegacySurface: () => void;\n};\n",
    );
    writeFile(
      "src/plugins/plugin-api.types.ts",
      [
        "export type OpenClawPluginApi = {",
        "  registerSourceSurface: () => void;",
        "  registerEmbeddingProvider: () => void;",
        "  registerMemoryEmbeddingProvider: () => void;",
        "};",
        "",
      ].join("\n"),
    );
    writeFile(
      "dist/plugin-sdk/src/plugins/hook-types.d.ts",
      'export const PLUGIN_HOOK_NAMES = ["stale_hook", "before_agent_start"];\n',
    );
    writeFile(
      "src/plugins/hook-types.ts",
      [
        'export const PLUGIN_HOOK_NAMES = ["source_hook", "source_deprecated_hook", "before_agent_start", "before_message_write", "tool_result_persist"];',
        "export const DEPRECATED_PLUGIN_HOOKS = {",
        "  source_deprecated_hook: {",
        '    replacement: "`source_hook`",',
        '    reason: "fixture",',
        "  },",
        "} as const;",
        "export type PluginHookHandlerMap = {",
        "  source_hook: () => Promise<void> | void;",
        "  source_deprecated_hook: () => Promise<void> | void;",
        "  before_agent_start: () => Promise<void> | void;",
        "  before_message_write: () => void;",
        "  tool_result_persist: () => void;",
        "};",
        "",
      ].join("\n"),
    );
    writeFile(
      "dist/plugin-sdk/src/plugins/manifest.d.ts",
      "export type PluginManifestContracts = { staleContracts?: string[]\n};\n",
    );
    writeFile(
      "src/plugins/manifest.ts",
      "export type PluginManifestContracts = { legacyContracts?: string[]\n};\n",
    );
    writeFile(
      "src/plugins/manifest-types.ts",
      [
        "export type PluginManifestContracts = {",
        "  sourceContracts?: string[];",
        "  embeddingProviders?: string[];",
        "  memoryEmbeddingProviders?: string[];",
        "};",
        "",
      ].join("\n"),
    );

    const surface = readOpenClawSurface();

    assert.deepEqual(surface.registrars, ["registerEmbeddingProvider", "registerSourceSurface"]);
    assert.deepEqual(surface.hooks, [
      "before_message_write",
      "source_hook",
      "tool_result_persist",
    ]);
    assert.deepEqual(surface.syncHooks, ["before_message_write", "tool_result_persist"]);
    assert.deepEqual(surface.manifestContracts, ["embeddingProviders", "sourceContracts"]);
    assert.ok(surface.pluginSdkExports.includes("openclaw/plugin-sdk/source-only"));
    assert.ok(!surface.pluginSdkExports.includes("openclaw/plugin-sdk/codex-mcp-projection"));
    assert.ok(!surface.pluginSdkExports.includes("openclaw/plugin-sdk"));
  });

  withTempOpenClawPackage((writeFile) => {
    writeBasePackage(writeFile, "0.0.0-packed", {
      "./plugin-sdk/packed-only": "./dist/plugin-sdk/packed-only.d.ts",
    });
    writeFile(
      "dist/types-PACKED.d.ts",
      [
        "type OpenClawPluginApi = {",
        "  registerPackedSurface: () => void;",
        "  registerEmbeddingProvider: () => void;",
        "  registerMemoryEmbeddingProvider: () => void;",
        "};",
        "",
      ].join("\n"),
    );
    writeFile(
      "dist/hook-types-PACKED.d.ts",
      [
        'declare const PLUGIN_HOOK_NAMES: readonly ["packed_hook", "packed_deprecated_hook", "before_agent_start", "before_message_write", "tool_result_persist"];',
        "declare const DEPRECATED_PLUGIN_HOOKS: {",
        "  readonly packed_deprecated_hook: {",
        '    readonly replacement: "`packed_hook`";',
        '    readonly reason: "fixture";',
        "  };",
        "};",
        "type PluginHookHandlerMap = {",
        "  packed_hook: () => Promise<void> | void;",
        "  packed_deprecated_hook: () => Promise<void> | void;",
        "  before_agent_start: () => Promise<void> | void;",
        "  before_message_write: () => void;",
        "  tool_result_persist: () => void;",
        "};",
        "",
      ].join("\n"),
    );
    writeFile(
      "dist/manifest-registry-PACKED.d.ts",
      [
        "type PluginManifestContracts = {",
        "  packedContracts?: string[];",
        "  embeddingProviders?: string[];",
        "  memoryEmbeddingProviders?: string[];",
        "};",
        "",
      ].join("\n"),
    );

    const surface = readOpenClawSurface();

    assert.deepEqual(surface.registrars, ["registerEmbeddingProvider", "registerPackedSurface"]);
    assert.deepEqual(surface.hooks, [
      "before_message_write",
      "packed_hook",
      "tool_result_persist",
    ]);
    assert.deepEqual(surface.syncHooks, ["before_message_write", "tool_result_persist"]);
    assert.deepEqual(surface.manifestContracts, ["embeddingProviders", "packedContracts"]);
    assert.ok(surface.pluginSdkExports.includes("openclaw/plugin-sdk/packed-only"));
  });

  withTempOpenClawPackage((writeFile) => {
    writeBasePackage(writeFile, "0.0.0-empty", {});
    writeFile("dist/plugin-sdk/types-empty.d.ts", "export type Empty = {};\n");
    assert.throws(
      () => readOpenClawSurface(),
      /refusing to generate an empty kitchen-sink surface/,
    );
  });

  console.log("OpenClaw surface reader OK");
} finally {
  if (previousPackageRoot === undefined) {
    delete process.env.OPENCLAW_PACKAGE_ROOT;
  } else {
    process.env.OPENCLAW_PACKAGE_ROOT = previousPackageRoot;
  }
}

function withTempOpenClawPackage(run) {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "kitchen-surface-reader-"));
  try {
    process.env.OPENCLAW_PACKAGE_ROOT = tempRoot;
    run((relativePath, content) => writeFixtureFile(tempRoot, relativePath, content));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeBasePackage(writeFile, version, extraExports) {
  writeFile("package.json", JSON.stringify({
    name: "openclaw",
    version,
    exports: {
      ".": "./openclaw.mjs",
      "./plugin-sdk": "./dist/plugin-sdk/index.d.ts",
      ...extraExports,
    },
  }));
  writeFile("openclaw.mjs", "export {};\n");
}

function writeFixtureFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

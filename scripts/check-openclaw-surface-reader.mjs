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
    });
    writeFile(
      "dist/plugin-sdk/src/plugins/types.d.ts",
      "export type OpenClawPluginApi = {\n  registerStaleSurface: () => void;\n};\n",
    );
    writeFile(
      "src/plugins/types.ts",
      "export type OpenClawPluginApi = {\n  registerSourceSurface: () => void;\n};\n",
    );
    writeFile("dist/plugin-sdk/src/plugins/hook-types.d.ts", 'export const PLUGIN_HOOK_NAMES = ["stale_hook"];\n');
    writeFile("src/plugins/hook-types.ts", 'export const PLUGIN_HOOK_NAMES = ["source_hook"];\n');
    writeFile(
      "dist/plugin-sdk/src/plugins/manifest.d.ts",
      "export type PluginManifestContracts = { staleContracts?: string[]\n};\n",
    );
    writeFile("src/plugins/manifest.ts", "export type PluginManifestContracts = { sourceContracts?: string[]\n};\n");

    const surface = readOpenClawSurface();

    assert.deepEqual(surface.registrars, ["registerSourceSurface"]);
    assert.deepEqual(surface.hooks, ["source_hook"]);
    assert.deepEqual(surface.manifestContracts, ["sourceContracts"]);
    assert.ok(surface.pluginSdkExports.includes("openclaw/plugin-sdk/source-only"));
  });

  withTempOpenClawPackage((writeFile) => {
    writeBasePackage(writeFile, "0.0.0-packed", {
      "./plugin-sdk/packed-only": "./dist/plugin-sdk/packed-only.d.ts",
    });
    writeFile(
      "dist/plugin-sdk/types-packed.d.ts",
      "type OpenClawPluginApi = {\n  registerPackedSurface: () => void;\n};\n",
    );
    writeFile(
      "dist/plugin-sdk/hook-types-packed.d.ts",
      'declare const PLUGIN_HOOK_NAMES: readonly ["packed_hook", "packed_hook_two"];\n',
    );
    writeFile(
      "dist/plugin-sdk/manifest-registry-packed.d.ts",
      "type PluginManifestContracts = {\n  packedContracts?: string[];\n};\n",
    );

    const surface = readOpenClawSurface();

    assert.deepEqual(surface.registrars, ["registerPackedSurface"]);
    assert.deepEqual(surface.hooks, ["packed_hook", "packed_hook_two"]);
    assert.deepEqual(surface.manifestContracts, ["packedContracts"]);
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

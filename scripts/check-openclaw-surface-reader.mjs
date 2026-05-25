#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readOpenClawSurface } from "./openclaw-surface.mjs";

const tempRoot = mkdtempSync(path.join(tmpdir(), "kitchen-surface-reader-"));
const previousPackageRoot = process.env.OPENCLAW_PACKAGE_ROOT;

try {
  writeFile("package.json", JSON.stringify({
    name: "openclaw",
    version: "0.0.0-fixture",
    exports: {
      ".": "./openclaw.mjs",
      "./plugin-sdk": "./dist/plugin-sdk/index.d.ts",
      "./plugin-sdk/source-only": "./dist/plugin-sdk/source-only.d.ts",
    },
  }));
  writeFile("openclaw.mjs", "export {};\n");
  writeFile(
    "dist/plugin-sdk/src/plugins/api-builder.d.ts",
    "export type Api = { registerStaleSurface(): void };\n",
  );
  writeFile(
    "src/plugins/api-builder.ts",
    "export type Api = { registerSourceSurface(): void };\n",
  );
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
  writeFile("dist/plugin-sdk/src/plugins/manifest.d.ts", "export type PluginManifestContracts = { staleContracts?: string[]\n};\n");
  writeFile("src/plugins/manifest.ts", "export type PluginManifestContracts = { sourceContracts?: string[]\n};\n");

  process.env.OPENCLAW_PACKAGE_ROOT = tempRoot;
  const surface = readOpenClawSurface();

  assert.deepEqual(surface.registrars, ["registerSourceSurface"]);
  assert.deepEqual(surface.hooks, ["source_hook"]);
  assert.deepEqual(surface.manifestContracts, ["sourceContracts"]);
  assert.ok(surface.pluginSdkExports.includes("openclaw/plugin-sdk/source-only"));
  console.log("OpenClaw surface reader OK");
} finally {
  if (previousPackageRoot === undefined) {
    delete process.env.OPENCLAW_PACKAGE_ROOT;
  } else {
    process.env.OPENCLAW_PACKAGE_ROOT = previousPackageRoot;
  }
  rmSync(tempRoot, { recursive: true, force: true });
}

function writeFile(relativePath, content) {
  const filePath = path.join(tempRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

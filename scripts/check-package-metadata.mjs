#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { plugin } from "../src/index.js";

const rootDir = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const manifest = JSON.parse(readFileSync(path.join(rootDir, "openclaw.plugin.json"), "utf8"));

assert.equal(plugin.version, packageJson.version, "plugin.version must match package.json");
assert.equal(manifest.version, packageJson.version, "openclaw.plugin.json version must match package.json");
assert.deepEqual(manifest.syntheticAuthRefs, ["kitchen-sink-llm"]);
assert.deepEqual(manifest.modelCatalog.providers["kitchen-sink-llm"].models, [
  {
    id: "kitchen-sink-text-v1",
    name: "Kitchen Sink Text Fixture",
    input: ["text"],
    reasoning: false,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8192,
    maxTokens: 2048,
  },
]);

console.log(`Package metadata OK: ${packageJson.name}@${packageJson.version}`);

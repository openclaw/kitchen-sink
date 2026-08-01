#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";

const pack = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (pack.status !== 0) {
  process.stderr.write(pack.stdout);
  process.stderr.write(pack.stderr);
  process.exit(pack.status ?? 1);
}

let payload;
try {
  payload = JSON.parse(pack.stdout);
} catch (error) {
  console.error(`npm pack did not return JSON: ${String(error)}`);
  process.stderr.write(pack.stdout);
  process.exit(1);
}

const files = new Set(payload[0]?.files?.map((file) => file.path) ?? []);
const requiredFiles = [
  "package.json",
  "README.md",
  "openclaw.plugin.json",
  "plugin-inspector.config.json",
  "src/index.js",
  "src/assets/kitchen_sink_office.png",
  "src/constants.js",
  "src/fixtures/images.js",
  "src/fixtures/text.js",
  "src/kitchen-runtime.js",
  "src/personality.js",
  "src/runtime/channel.js",
  "src/runtime/commands.js",
  "src/runtime/platform.js",
  "src/runtime/providers.js",
  "src/runtime/tasks.js",
  "src/scenarios.js",
  "src/setup.js",
  "src/generated-hooks.js",
  "src/generated-registrars.js",
  "src/generated-sdk-imports.ts",
];
const missingFiles = requiredFiles.filter((file) => !files.has(file));

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const pluginManifest = JSON.parse(fs.readFileSync("openclaw.plugin.json", "utf8"));
const issues = [];

function sameStringArray(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function requireStringArray(name, actual, expected) {
  if (!sameStringArray(actual, expected)) {
    issues.push(`${name} must be ${JSON.stringify(expected)}`);
  }
}

if (missingFiles.length > 0) {
  issues.push(`missing packed files: ${missingFiles.join(", ")}`);
}

if (packageJson.name !== "@openclaw/kitchen-sink") {
  issues.push('package name must be "@openclaw/kitchen-sink"');
}

requireStringArray("openclaw.extensions", packageJson.openclaw?.extensions, ["./src/index.js"]);
requireStringArray("openclaw.runtimeExtensions", packageJson.openclaw?.runtimeExtensions, [
  "./src/index.js",
]);

if (packageJson.openclaw?.setupEntry !== "./src/setup.js") {
  issues.push('openclaw.setupEntry must be "./src/setup.js"');
}

const compatPluginApi = packageJson.openclaw?.compat?.pluginApi;
const buildOpenClawVersion = packageJson.openclaw?.build?.openclawVersion;
const buildPluginSdkVersion = packageJson.openclaw?.build?.pluginSdkVersion;

if (typeof compatPluginApi !== "string" || compatPluginApi.trim().length === 0) {
  issues.push("openclaw.compat.pluginApi must be a non-empty string");
}
if (typeof buildOpenClawVersion !== "string" || buildOpenClawVersion.trim().length === 0) {
  issues.push("openclaw.build.openclawVersion must be a non-empty string");
}
if (buildPluginSdkVersion !== buildOpenClawVersion) {
  issues.push("openclaw.build.pluginSdkVersion must match openclaw.build.openclawVersion");
}
if (packageJson.dependencies?.openclaw !== undefined) {
  issues.push("dependencies.openclaw must be omitted; OpenClaw injects the plugin SDK");
}
if (packageJson.devDependencies?.openclaw !== buildOpenClawVersion) {
  issues.push("devDependencies.openclaw must match openclaw.build.openclawVersion");
}
if (packageJson.peerDependencies?.openclaw !== undefined) {
  issues.push("peerDependencies.openclaw must be omitted; use openclaw.install.minHostVersion");
}
if (packageJson.peerDependenciesMeta?.openclaw !== undefined) {
  issues.push("peerDependenciesMeta.openclaw must be omitted with the host peer");
}
if (packageJson.openclaw?.install?.clawhubSpec !== "clawhub:@openclaw/kitchen-sink") {
  issues.push('openclaw.install.clawhubSpec must be "clawhub:@openclaw/kitchen-sink"');
}
if (packageJson.openclaw?.install?.npmSpec !== "@openclaw/kitchen-sink") {
  issues.push('openclaw.install.npmSpec must be "@openclaw/kitchen-sink"');
}
if (packageJson.openclaw?.install?.defaultChoice !== "clawhub") {
  issues.push('openclaw.install.defaultChoice must be "clawhub"');
}
const expectedMinHostVersion =
  typeof buildOpenClawVersion === "string" && buildOpenClawVersion.trim().length > 0
    ? `>=${buildOpenClawVersion}`
    : null;
if (expectedMinHostVersion && packageJson.openclaw?.install?.minHostVersion !== expectedMinHostVersion) {
  issues.push(`openclaw.install.minHostVersion must be ${expectedMinHostVersion}`);
}
const kitchenSinkChannelConfig = pluginManifest.channelConfigs?.["kitchen-sink-channel"];
if (!kitchenSinkChannelConfig?.schema || kitchenSinkChannelConfig.schema.type !== "object") {
  issues.push("openclaw.plugin.json must declare channelConfigs.kitchen-sink-channel.schema");
}
if (packageJson.openclaw?.release?.publishToClawHub !== true) {
  issues.push("openclaw.release.publishToClawHub must be true");
}
if (packageJson.openclaw?.release?.publishToNpm !== true) {
  issues.push("openclaw.release.publishToNpm must be true");
}
if (!packageJson.files?.includes("src/")) {
  issues.push("package files must include src/");
}
if (packageJson.exports?.["./runtime"] !== "./src/kitchen-runtime.js") {
  issues.push('package exports "./runtime" must point at "./src/kitchen-runtime.js"');
}
if (packageJson.exports?.["./scenarios"] !== "./src/scenarios.js") {
  issues.push('package exports "./scenarios" must point at "./src/scenarios.js"');
}

if (issues.length > 0) {
  console.error(`Package payload check failed:\n- ${issues.join("\n- ")}`);
  process.exit(1);
}

console.log(`Package payload OK: ${payload[0]?.entryCount ?? files.size} files, runtime ./src/index.js`);

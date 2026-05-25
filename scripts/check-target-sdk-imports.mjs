#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { readOpenClawSurface } from "./openclaw-surface.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const generatedSdkImports = readFileSync(path.join(rootDir, "src/generated-sdk-imports.ts"), "utf8");
const generatedHooks = readFileSync(path.join(rootDir, "src/generated-hooks.js"), "utf8");
const generatedRegistrars = readFileSync(path.join(rootDir, "src/generated-registrars.js"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(rootDir, "openclaw.plugin.json"), "utf8"));
const importedSdkSpecifiers = [
  ...generatedSdkImports.matchAll(/from\s+["'](openclaw\/plugin-sdk(?:\/[^"']+)?)["']/g),
].map((match) => match[1]);
const registeredHooks = [...generatedHooks.matchAll(/api\.on\((["'])([^"']+)\1/g)].map((match) => match[2]).sort();
const coveredRegistrars = [
  ...new Set([
    ...[...generatedRegistrars.matchAll(/safeRegister\((["'])(register[A-Za-z0-9]+)\1/g)].map((match) => match[2]),
    ...[...generatedRegistrars.matchAll(/api\.(register[A-Za-z0-9]+)\(/g)].map((match) => match[1]),
  ]),
].sort();
const manifestContracts = Object.keys(manifest.contracts ?? {}).sort();
const targetSurface = readOpenClawSurface();
const targetSdkExports = new Set(targetSurface.pluginSdkExports);
const importsMissingFromTarget = importedSdkSpecifiers.filter((specifier) => !targetSdkExports.has(specifier));
const targetSdkImportsMissingFromGenerated = targetSurface.pluginSdkExports.filter(
  (specifier) => !importedSdkSpecifiers.includes(specifier),
);
const hookDiff = compareExact("hooks", registeredHooks, targetSurface.hooks);
const registrarDiff = compareExact("registrars", coveredRegistrars, targetSurface.registrars);
const manifestContractDiff = compareExact("manifest contracts", manifestContracts, targetSurface.manifestContracts);
const failures = [];

if (importsMissingFromTarget.length > 0) {
  failures.push(
    `generated SDK imports missing from target OpenClaw ${targetSurface.packageVersion} exports:\n${importsMissingFromTarget.join("\n")}`,
  );
}
if (targetSdkImportsMissingFromGenerated.length > 0) {
  failures.push(
    `target OpenClaw ${targetSurface.packageVersion} SDK exports missing from generated imports:\n${targetSdkImportsMissingFromGenerated.join("\n")}`,
  );
}
for (const diff of [hookDiff, registrarDiff, manifestContractDiff]) {
  if (diff) {
    failures.push(diff);
  }
}

if (failures.length > 0) {
  throw new Error(failures.join("\n\n"));
}

console.log(
  `Generated surface is valid for OpenClaw ${targetSurface.packageVersion}: ${coveredRegistrars.length} registrars, ${registeredHooks.length} hooks, ${manifestContracts.length} manifest contracts, ${importedSdkSpecifiers.length} SDK exports`,
);

function compareExact(label, generated, target) {
  const generatedSet = new Set(generated);
  const targetSet = new Set(target);
  const extra = generated.filter((value) => !targetSet.has(value));
  const missing = target.filter((value) => !generatedSet.has(value));
  if (extra.length === 0 && missing.length === 0) {
    return null;
  }
  return [
    `generated ${label} do not match target OpenClaw ${targetSurface.packageVersion}`,
    extra.length > 0 ? `extra generated ${label}:\n${extra.join("\n")}` : null,
    missing.length > 0 ? `missing generated ${label}:\n${missing.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

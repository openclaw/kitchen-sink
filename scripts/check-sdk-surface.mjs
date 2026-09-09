import { readFileSync } from "node:fs";
import path from "node:path";
import { readOpenClawSurface, registrarProbeExclusions } from "./openclaw-surface.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const surface = readOpenClawSurface();
const hooksSource = read("src/generated-hooks.js");
const registrarsSource = read("src/generated-registrars.js");
const sdkImportsSource = read("src/generated-sdk-imports.ts");
const manifest = JSON.parse(read("openclaw.plugin.json"));

const errors = [];

for (const hook of surface.hooks) {
  if (!hooksSource.includes(`api.on(${JSON.stringify(hook)}`)) {
    errors.push(`missing hook coverage: ${hook}`);
  }
}

for (const registrar of surface.registrars) {
  const hasProbe = registrarsSource.includes(`api.${registrar}(`);
  if (Object.hasOwn(registrarProbeExclusions, registrar)) {
    if (hasProbe) {
      errors.push(`excluded registrar must not have a runtime probe: ${registrar}`);
    }
  } else if (!hasProbe) {
    errors.push(`missing registrar coverage: ${registrar}`);
  }
}

for (const specifier of surface.pluginSdkExports) {
  if (!sdkImportsSource.includes(`"${specifier}"`)) {
    errors.push(`missing SDK import coverage: ${specifier}`);
  }
}

for (const contract of surface.manifestContracts) {
  if (!Object.hasOwn(manifest.contracts ?? {}, contract)) {
    errors.push(`missing manifest contract coverage: ${contract}`);
  }
}

if (errors.length > 0) {
  throw new Error(errors.join("\n"));
}

console.log(
  `OpenClaw ${surface.packageVersion} surface checked: ${surface.registrars.length} discovered registrars, ${surface.runtimeRegistrars.length} runtime registrar probes, ${surface.hooks.length} hooks, ${surface.manifestContracts.length} manifest contracts, ${surface.pluginSdkExports.length} SDK exports`,
);
for (const registrar of surface.registrars) {
  if (Object.hasOwn(registrarProbeExclusions, registrar)) {
    console.log(`Not exercised on a live host: ${registrar}. ${registrarProbeExclusions[registrar]}`);
  }
}

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

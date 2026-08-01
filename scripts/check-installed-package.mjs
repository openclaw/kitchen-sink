#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(path.join(tmpdir(), "kitchen-sink-install-"));
const keepTemp = process.env.KEEP_KITCHEN_INSTALL_SMOKE === "1";
let lastStdout = "";
let failure;

try {
  const packDir = path.join(tempRoot, "pack");
  mkdirSync(packDir, { recursive: true });
  const kitchenSinkTarball = packPackage(repoRoot, packDir);
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const openClawVersion = packageJson.devDependencies?.openclaw;
  assert.equal(typeof openClawVersion, "string", "devDependencies.openclaw must be pinned");
  const localOpenClawTarball = packLocalOpenClawPackage(packDir, openClawVersion);

  const projectDir = path.join(tempRoot, "consumer");
  mkdirSync(projectDir, { recursive: true });
  const hostInstallSpec = localOpenClawTarball ?? `openclaw@${openClawVersion}`;
  const installSpecs = [hostInstallSpec, kitchenSinkTarball];
  run(
    "npm",
    [
      "install",
      "--prefix",
      projectDir,
      "--package-lock=false",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...installSpecs,
    ],
    { cwd: tempRoot },
  );

  const packageDir = path.join(projectDir, "node_modules", "@openclaw", "kitchen-sink");
  const installedPackageJson = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));
  assert.equal(installedPackageJson.name, "@openclaw/kitchen-sink");
  assert.equal(installedPackageJson.version, packageJson.version);

  const probeFile = path.join(projectDir, "probe.mjs");
  writeFileSync(probeFile, readFileSync(new URL("./fixtures/installed-consumer-probe.mjs", import.meta.url), "utf8"));
  run(process.execPath, [probeFile], { cwd: projectDir });

  const inspectorBin = path.join(repoRoot, "node_modules", ".bin", "plugin-inspector");
  run(inspectorBin, ["check", "--config", "plugin-inspector.config.json", "--no-openclaw", "--runtime", "--mock-sdk"], {
    cwd: packageDir,
    env: {
      ...process.env,
      PLUGIN_INSPECTOR_EXECUTE_ISOLATED: "1",
    },
  });

  console.log(`Installed package smoke OK: ${installedPackageJson.name}@${installedPackageJson.version}`);
} catch (error) {
  failure = error;
} finally {
  if (!keepTemp) {
    rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`Kept install smoke temp dir: ${tempRoot}`);
  }
}

if (failure) {
  process.stderr.write(`${failure instanceof Error ? failure.message : String(failure)}\n`);
  process.exitCode = Number.isInteger(failure?.exitCode) ? failure.exitCode : 1;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  lastStdout = result.stdout;
  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    const error = new Error(`${command} exited with status ${result.status ?? 1}`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

function packPackage(packageRoot, packDir, options = {}) {
  const args = ["pack", "--json", "--pack-destination", packDir];
  if (options.ignoreScripts) {
    args.push("--ignore-scripts");
  }
  run("npm", args, { cwd: packageRoot });
  const packOutput = JSON.parse(lastStdout);
  return path.join(packDir, packOutput[0].filename);
}

function packLocalOpenClawPackage(packDir, expectedVersion) {
  const packageRoot = process.env.OPENCLAW_PACKAGE_ROOT?.trim();
  if (!packageRoot) {
    return undefined;
  }
  const resolvedRoot = path.resolve(packageRoot);
  const packageJson = JSON.parse(readFileSync(path.join(resolvedRoot, "package.json"), "utf8"));
  assert.equal(packageJson.name, "openclaw");
  assert.equal(packageJson.version, expectedVersion);
  return packPackage(resolvedRoot, packDir, { ignoreScripts: true });
}

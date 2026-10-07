#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const scratch = mkdtempSync(path.join(tmpdir(), "kitchen-host-isolation-"));
const home = path.join(scratch, "home");
const state = path.join(scratch, "state");
const databaseDir = path.join(state, "state");
const databasePath = path.join(databaseDir, "openclaw.sqlite");
const configPath = path.join(scratch, "config.json");

try {
  mkdirSync(home);
  mkdirSync(databaseDir, { recursive: true });
  const database = new DatabaseSync(databasePath);
  // A future schema makes accidental caller-state reads visible in cleanup errors.
  database.exec("PRAGMA user_version = 2147483647");
  database.close();
  const originalDatabase = readFileSync(databasePath);
  writeFileSync(configPath, "{}\n");

  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./check-middleware-host.mjs", import.meta.url))],
    {
      env: {
        ...process.env,
        HOME: home,
        OPENCLAW_STATE_DIR: state,
        OPENCLAW_CONFIG_PATH: configPath,
      },
      encoding: "utf8",
    },
  );
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  assert.ifError(result.error);
  assert.equal(result.status, 0, "middleware host checks must pass");
  assert.equal(result.stderr.includes(databasePath), false, "host cleanup must not open caller state");
  assert.deepEqual(readFileSync(databasePath), originalDatabase, "caller database must stay unchanged");
  assert.equal(readFileSync(configPath, "utf8"), "{}\n", "caller config must stay unchanged");
  assert.deepEqual(readdirSync(scratch).sort(), ["config.json", "home", "state"]);
  assert.deepEqual(readdirSync(databaseDir), ["openclaw.sqlite"]);
  assert.deepEqual(readdirSync(home), [], "host cleanup must not write to the caller's home");
  console.log("Middleware host caller-state isolation OK");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

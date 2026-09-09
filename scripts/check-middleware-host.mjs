#!/usr/bin/env node

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLUGIN_ID } from "../src/constants.js";
import { KITCHEN_SINK_EXPECTED_DIAGNOSTICS } from "../src/personality.js";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const imageData = readFileSync(path.join(rootDir, "src/assets/kitchen_sink_office.png")).toString("base64");
const scratch = mkdtempSync(path.join(os.tmpdir(), "kitchen-middleware-host-"));
const isolatedEnv = {
  HOME: scratch,
  OPENCLAW_STATE_DIR: path.join(scratch, "state"),
  OPENCLAW_CONFIG_PATH: path.join(scratch, "config.json"),
};
const previousEnv = Object.fromEntries(Object.keys(isolatedEnv).map((key) => [key, process.env[key]]));
const runtimes = ["openclaw", "codex"];
const invalidHandler = "agent tool result middleware must be a function";
const cases = [
  { name: "conformance", personality: "conformance", accepted: true },
  { name: "full", personality: "full", accepted: true, diagnostic: invalidHandler },
  { name: "adversarial", personality: "adversarial", diagnostic: invalidHandler },
  {
    name: "undeclared",
    personality: "conformance",
    undeclared: true,
    diagnostic: "plugin must declare contracts.agentToolResultMiddleware for: openclaw, codex",
  },
  {
    name: "not-explicit",
    personality: "conformance",
    explicitlyEnabled: false,
    diagnostic: "plugin must be explicitly enabled to register agent tool result middleware",
  },
];

try {
  // Root activation stays inside this test process and its disposable state.
  Object.assign(process.env, isolatedEnv);
  const { loadAndActivateRootPluginRegistry } = await import(
    new URL("plugins/loader.js", import.meta.resolve("openclaw"))
  );
  const { createAgentToolResultMiddlewareRunner } = await import(
    "openclaw/plugin-sdk/agent-harness-runtime"
  );
  for (const testCase of cases) {
    const fixtureDir = path.join(scratch, testCase.name);
    cpSync(path.join(rootDir, "src"), path.join(fixtureDir, "src"), { recursive: true });
    cpSync(path.join(rootDir, "package.json"), path.join(fixtureDir, "package.json"));
    const manifest = JSON.parse(readFileSync(path.join(rootDir, "openclaw.plugin.json"), "utf8"));
    if (testCase.undeclared) {
      delete manifest.contracts.agentToolResultMiddleware;
    }
    writeFileSync(path.join(fixtureDir, "openclaw.plugin.json"), JSON.stringify(manifest));
    const config = {
      plugins: {
        load: { paths: [fixtureDir] },
        entries: {
          [PLUGIN_ID]: { enabled: true, config: { personality: testCase.personality } },
        },
      },
    };
    const registry = loadAndActivateRootPluginRegistry({
      config,
      // Model auto-enablement separately from an operator's explicit selection.
      activationSourceConfig:
        testCase.explicitlyEnabled === false ? { plugins: { load: config.plugins.load } } : config,
      onlyPluginIds: [PLUGIN_ID],
      installRecords: {},
      env: process.env,
      cache: false,
      logger: { debug() {}, info() {}, warn() {}, error() {} },
    });
    const record = registry.plugins.find((entry) => entry.id === PLUGIN_ID);
    assert.ok(record, `${testCase.name}: external fixture discovered`);
    assert.notEqual(record.origin, "bundled");
    assert.equal(record.enabled, true);
    assert.equal(record.explicitlyEnabled, testCase.explicitlyEnabled !== false);
    assert.deepEqual(
      registry.detachedTaskRuntimes.filter((entry) => entry.pluginId === PLUGIN_ID),
      [],
      `${testCase.name}: Kitchen Sink must not replace the host task lifecycle`,
    );
    const registrations = registry.agentToolResultMiddlewares.filter(
      (entry) => entry.pluginId === PLUGIN_ID,
    );
    const diagnostics = registry.diagnostics
      .filter(
        (entry) =>
          entry.pluginId === PLUGIN_ID &&
          /agent tool result middleware|agentToolResultMiddleware/.test(entry.message),
      )
      .map((entry) => entry.message);
    assert.deepEqual(
      diagnostics,
      testCase.diagnostic ? [testCase.diagnostic] : [],
      `${testCase.name}: middleware admission diagnostics`,
    );
    assert.equal(registrations.length, testCase.accepted ? 1 : 0, testCase.name);
    if (testCase.diagnostic === invalidHandler) {
      assert.ok(KITCHEN_SINK_EXPECTED_DIAGNOSTICS[testCase.personality].includes(invalidHandler));
    }
    if (!testCase.accepted) {
      continue;
    }
    const [registration] = registrations;
    assert.deepEqual(registration.runtimes, runtimes);
    for (const runtime of runtimes) {
      const event = {
        threadId: "fixture-thread",
        turnId: "fixture-turn",
        toolCallId: "fixture-call",
        toolName: "unrelated_tool",
        args: { query: "keep input" },
        isError: false,
        metadata: { unrelated: "keep metadata" },
        result: {
          content: [
            { type: "text", text: "unchanged\nresult bytes" },
            { type: "image", mimeType: "image/png", data: imageData },
          ],
          details: { unrelated: { count: 3, enabled: true } },
        },
      };
      const ctx = { runtime, agentId: "fixture-agent", sessionId: "fixture-session" };
      const originalEvent = structuredClone(event);
      const originalContext = structuredClone(ctx);
      const middlewareResult = await registration.handler(event, ctx);
      assert.equal(middlewareResult.metadata.kitchenSinkToolResultMiddleware, true);
      assert.equal(middlewareResult.metadata.unrelated, event.metadata.unrelated);
      assert.equal(middlewareResult.result, event.result);
      const runner = createAgentToolResultMiddlewareRunner(ctx, [registration.handler]);
      assert.equal(await runner.applyToolResultMiddleware(event), event.result);
      assert.deepEqual(event, originalEvent);
      assert.deepEqual(ctx, originalContext);
    }
    console.log(`Middleware host admission OK: ${testCase.name} (${runtimes.join(", ")})`);
  }
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  rmSync(scratch, { recursive: true, force: true });
}

console.log("Middleware and task-lifecycle installed-host checks OK");

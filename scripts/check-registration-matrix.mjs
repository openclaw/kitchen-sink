#!/usr/bin/env node

import assert from "node:assert/strict";
import { registerAllRegistrars, apiSurfaceProbeFailures } from "../src/generated-registrars.js";
import { registerKitchenSinkRuntime } from "../src/kitchen-runtime.js";
import { PLUGIN_ID } from "../src/constants.js";

function createRecorder({ throwOn } = {}) {
  const calls = [];
  const api = new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== "string" || !property.startsWith("register")) {
          return undefined;
        }
        return (...args) => {
          calls.push({ method: property, args });
          if (property === throwOn) {
            throw new Error(`unsupported ${property}`);
          }
        };
      },
    },
  );
  return { api, calls };
}

const full = createRecorder();
registerKitchenSinkRuntime(full.api, { includeAgentToolResultMiddleware: false });
const fullMethods = full.calls.map(({ method }) => method);
assert.ok(fullMethods.includes("registerEmbeddingProvider"));
assert.ok(fullMethods.includes("registerContextEngine"));
assert.ok(!fullMethods.includes("registerAgentToolResultMiddleware"));
const contextCall = full.calls.find(({ method }) => method === "registerContextEngine");
assert.equal(contextCall.args[0], PLUGIN_ID);
assert.equal(typeof contextCall.args[1], "function");
const resourceMethod = full.calls.find(({ method, args }) =>
  method === "registerGatewayMethod" && args[0] === "kitchen.resources",
)?.args[1];
assert.equal(typeof resourceMethod, "function");
const service = full.calls.find(({ method }) => method === "registerService").args[0];
try {
  await service.start();
  const responses = [];
  resourceMethod({ params: { action: "buffer", bytes: 1 }, respond: (...args) => responses.push(args) });
  assert.equal(responses[0][0], true);
  assert.equal(responses[0][1].bufferBytes, 1);
  await service.stop();
  resourceMethod({ params: {}, respond: (...args) => responses.push(args) });
  assert.equal(responses[1][1].active, false);
  assert.equal(responses[1][1].bufferBytes, 0);
} finally {
  await service.stop();
}

const withMiddleware = createRecorder();
registerKitchenSinkRuntime(withMiddleware.api);
assert.ok(withMiddleware.calls.some(({ method }) => method === "registerAgentToolResultMiddleware"));

const sparseCalls = [];
registerKitchenSinkRuntime({
  registerCommand: (...args) => sparseCalls.push(args),
});
assert.equal(sparseCalls.length, 2);

apiSurfaceProbeFailures.length = 0;
const failing = createRecorder({ throwOn: "registerAgentHarness" });
const failures = registerAllRegistrars(failing.api);
assert.deepEqual(failures, [
  { name: "registerAgentHarness", message: "unsupported registerAgentHarness" },
]);

console.log("Registration matrix OK");

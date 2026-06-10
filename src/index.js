import { PLUGIN_ID } from "./constants.js";
import { registerAllHooks } from "./generated-hooks.js";
import { registerAllRegistrars } from "./generated-registrars.js";
import { registerKitchenSinkRuntime } from "./kitchen-runtime.js";
import {
  KITCHEN_SINK_EXPECTED_DIAGNOSTICS,
  resolveKitchenSinkPersonality,
} from "./personality.js";

export const plugin = {
  id: PLUGIN_ID,
  name: "OpenClaw Kitchen Sink",
  version: "0.2.9",
  description: "Credential-free fixture covering OpenClaw plugin API seams.",
  expectedDiagnostics: KITCHEN_SINK_EXPECTED_DIAGNOSTICS,
  register(api) {
    const personality = resolveKitchenSinkPersonality(api);
    registerAllHooks(api);
    if (personality !== "conformance") {
      registerAllRegistrars(api);
    }
    if (personality !== "adversarial") {
      registerKitchenSinkRuntime(api, {
        includeAgentToolResultMiddleware: personality !== "conformance",
      });
    }
  },
};

export function register(api) {
  plugin.register(api);
}

export default plugin;

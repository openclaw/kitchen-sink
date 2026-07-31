import assert from "node:assert/strict";
import { plugin } from "@openclaw/kitchen-sink";
import { createKitchenSinkRuntime } from "@openclaw/kitchen-sink/runtime";
import { createKitchenSinkImageAsset, kitchenPromptGuidance } from "@openclaw/kitchen-sink/scenarios";
import setup from "@openclaw/kitchen-sink/setup";

const registrations = {};
const api = new Proxy(
  {
    id: "consumer-install-smoke",
    registrationMode: "full",
    config: {},
    pluginConfig: { personality: "conformance" },
    logger: console,
  },
  {
    get(target, property) {
      if (property in target) return target[property];
      if (property === "on") {
        return (...args) => {
          registrations.on ??= [];
          registrations.on.push(args);
        };
      }
      if (typeof property !== "string" || !property.startsWith("register")) return undefined;
      return (...args) => {
        registrations[property] ??= [];
        registrations[property].push(args);
      };
    },
  },
);

plugin.register(api);
assert.equal(plugin.id, "openclaw-kitchen-sink-fixture");
assert.ok(registrations.registerImageGenerationProvider?.some(([provider]) => provider.id === "kitchen-sink-image"));
assert.ok(registrations.registerProvider?.some(([provider]) => provider.id === "kitchen-sink-llm"));
assert.ok(registrations.registerWebSearchProvider?.some(([provider]) => provider.id === "kitchen-sink-search"));
const registeredChannel = registrations.registerChannel?.find(
  ([channel]) => channel.id === "kitchen-sink-channel",
)?.[0];
assert.ok(registeredChannel);

const runtime = createKitchenSinkRuntime({
  delayMs: 10_000,
  sleep: async () => {},
  now: (() => {
    let tick = 0;
    return () => new Date(Date.UTC(2026, 3, 29, 12, 0, tick++));
  })(),
});
const image = await runtime.runImageJob({ prompt: "generate an image with kitchen sink" });
assert.equal(image.job.status, "completed");
assert.equal(image.image.metadata.assetName, "kitchen_sink_office.png");
assert.equal(image.image.metadata.sha256, "e126064123bb13d8ee01a22c204e079bc22397c103ed1c3a191c60d5ae3319aa");

const directImage = createKitchenSinkImageAsset({
  prompt: "consumer import smoke",
  jobId: "ks_consumer_install_smoke",
});
assert.equal(directImage.mimeType, "image/png");
assert.ok(directImage.dataUrl.startsWith("data:image/png;base64,"));
assert.ok(kitchenPromptGuidance().some((line) => line.includes("kitchen_sink_image_job")));

assert.equal(setup.plugin.id, registeredChannel.id);

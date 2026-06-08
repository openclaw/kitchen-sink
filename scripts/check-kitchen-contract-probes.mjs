#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { plugin } from "../src/index.js";
import {
  capturePluginRegistration,
  createHookFinder,
  registrationSummary,
} from "./lib/plugin-registration-harness.mjs";

const registrations = capturePluginRegistration(plugin);
const findHook = createHookFinder(registrations);

const beforeToolCall = findHook("before_tool_call");
const replyPayloadSending = findHook("reply_payload_sending");
const resolveExecEnv = findHook("resolve_exec_env");
const llmInput = findHook("llm_input");
const llmOutput = findHook("llm_output");
const agentEnd = findHook("agent_end");

const probes = {
  beforeToolCall: {
    allow: await beforeToolCall(toolEvent("generate a kitchen image"), { providerId: "kitchen-sink-image" }),
    block: await beforeToolCall(toolEvent("kitchen block image generation"), { providerId: "kitchen-sink-image" }),
    approval: await beforeToolCall(toolEvent("kitchen image generation needs approval"), {
      providerId: "kitchen-sink-image",
    }),
  },
  replyPayloadSending: {
    rewrite: await replyPayloadSending(
      { payload: { text: "kitchen reply payload", presentation: { kind: "text" } } },
      { channelId: "kitchen-sink-channel", sessionKey: "kitchen:fixture-agent:kitchen-demo" },
    ),
    cancel: await replyPayloadSending(
      { payload: { text: "kitchen cancel reply payload" } },
      { channelId: "kitchen-sink-channel", sessionKey: "kitchen:fixture-agent:kitchen-demo" },
    ),
  },
  resolveExecEnv: await resolveExecEnv(
    { toolName: "exec", host: "gateway", sessionKey: "kitchen:fixture-agent:kitchen-demo" },
    { channelId: "kitchen-sink-channel", sessionKey: "kitchen:fixture-agent:kitchen-demo" },
  ),
  conversationPrivacy: {
    input: await llmInput(secretEvent("kitchen explain the fixture"), secretContext()),
    output: await llmOutput(secretEvent("kitchen image result"), secretContext()),
    end: await agentEnd(secretEvent("kitchen final answer"), secretContext()),
  },
  channel: await captureChannelProbe(),
  runtimeRegistrations: registrationSummary(registrations),
};

assert.equal(probes.beforeToolCall.allow.decision, "allow");
assert.equal(probes.beforeToolCall.allow.params.args.kitchenSinkScenario, "image.generate");
assert.equal(probes.beforeToolCall.block.block, true);
assert.equal(probes.beforeToolCall.block.terminal, true);
assert.equal(probes.beforeToolCall.approval.decision, "approval");
assert.equal(probes.beforeToolCall.approval.requireApproval.pluginId, "openclaw-kitchen-sink-fixture");
assert.match(probes.replyPayloadSending.rewrite.payload.text, /Kitchen Sink reply payload hook observed/);
assert.equal(probes.replyPayloadSending.cancel.cancel, true);
assert.equal(probes.replyPayloadSending.cancel.reason, "kitchen_sink_reply_payload_cancelled");
assert.deepEqual(probes.resolveExecEnv, {
  KITCHEN_SINK_HOOK: "resolve_exec_env",
  KITCHEN_SINK_PLUGIN_ID: "openclaw-kitchen-sink-fixture",
  KITCHEN_SINK_SCENARIO: "observe",
});

for (const result of Object.values(probes.conversationPrivacy)) {
  assert.equal(result.privacy.boundary, "conversation-observer");
  assert.equal(result.privacy.storesRawPayload, false);
  assert.equal(result.privacy.exposesRawPayload, false);
  assert.ok(result.privacy.redactedFields.length >= 2);
  assert.ok(result.privacy.secretPatternCount >= 1);
}

for (const method of [
  "registerChannel",
  "registerCommand",
  "registerGatewayMethod",
  "registerHttpRoute",
  "registerInteractiveHandler",
  "registerService",
  "registerContextEngine",
]) {
  assert.ok(probes.runtimeRegistrations[method]?.count > 0, `${method} was not captured`);
}

assert.equal(probes.channel.account.statusState, "ready");
assert.equal(probes.channel.delivery.deliveryStatus, "sent");
assert.equal(probes.channel.route.peer.kind, "direct");

mkdirSync("reports", { recursive: true });
writeFileSync("reports/kitchen-contract-probes.json", `${JSON.stringify(probes, null, 2)}\n`);
writeFileSync("reports/kitchen-contract-probes.md", renderMarkdown(probes));

console.log(
  `Kitchen contract probes OK: ${Object.keys(probes.runtimeRegistrations).length} registration methods, before_tool_call allow/block/approval, reply_payload_sending, resolve_exec_env, conversation privacy, channel envelope`,
);

async function captureChannelProbe() {
  const channel = registrations.registerChannel?.map(([value]) => value).find((value) => value.id === "kitchen-sink-channel");
  assert.ok(channel, "kitchen-sink-channel registered");
  return {
    account: channel.config.resolveAccount({}, "local"),
    delivery: await channel.outbound.sendText({ to: "kitchen demo", text: "kitchen generate image" }),
    route: await channel.messaging.resolveOutboundSessionRoute({
      agentId: "fixture-agent",
      target: "kitchen demo",
      threadId: "thread-1",
    }),
  };
}

function toolEvent(prompt) {
  return {
    toolId: "kitchen_sink_image_job",
    args: { prompt },
  };
}

function secretEvent(prompt) {
  return {
    prompt,
    apiKey: "sk-local-secret-not-stored",
    token: "fixture-token-not-stored",
  };
}

function secretContext() {
  return {
    providerId: "kitchen-sink-llm",
    authorization: "Bearer fixture-secret-not-stored",
  };
}

function renderMarkdown(report) {
  const methods = Object.entries(report.runtimeRegistrations)
    .map(([method, summary]) => `| ${method} | ${summary.count} | ${summary.ids.join(", ")} |`)
    .join("\n");
  return [
    "# Kitchen Sink Contract Probes",
    "",
    "Generated: deterministic",
    "Status: PASS",
    "",
    "## Covered Inspector Gaps",
    "",
    "- before_tool_call allow/block/approval semantics",
    "- reply_payload_sending rewrite/cancel semantics",
    "- resolve_exec_env string-only environment contributions",
    "- llm_input, llm_output, and agent_end privacy-boundary probes",
    "- runtime registrar capture for service, route, gateway, command, interactive handler, and channel surfaces",
    "- context-engine registration for active memory/context slot coverage",
    "- channel account, envelope, and outbound route probes",
    "",
    "## Runtime Registrations",
    "",
    "| Method | Count | IDs |",
    "| ------ | ----- | --- |",
    methods,
    "",
  ].join("\n");
}

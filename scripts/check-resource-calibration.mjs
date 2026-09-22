#!/usr/bin/env node

import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createKitchenResourceOwner } from "../src/runtime/resources.js";
import { buildKitchenResourceMethod, buildKitchenService } from "../src/runtime/platform.js";

const empty = {
  active: false,
  bufferBytes: 0,
  timerActive: false,
  timerIntervalMs: 0,
  timerTicks: 0,
  lastCpu: null,
};
const baselineTimers = timerCount();
const resources = createKitchenResourceOwner();
const service = buildKitchenService(resources);
const rpc = buildKitchenResourceMethod(resources);
const second = createKitchenResourceOwner();
const secondService = buildKitchenService(second);
const secondRpc = buildKitchenResourceMethod(second);

try {
  assert.deepEqual(call(rpc), empty);
  assert.deepEqual(call(secondRpc), empty);
  assert.equal(timerCount(), baselineTimers, "registration/status must not create a timer");
  for (const request of [
    { action: "cpu", iterations: 1 },
    { action: "buffer", bytes: 1 },
    { action: "timer", intervalMs: 10 },
  ]) {
    reject(rpc, request, "UNAVAILABLE");
  }
  assert.equal((await service.probe()).state, "ready");
  assert.equal((await service.start()).state, "started");
  assert.deepEqual(call(rpc), { ...empty, active: true });

  const cpuBefore = process.cpuUsage();
  assert.deepEqual(call(rpc, { action: "cpu", iterations: 1000 }).lastCpu, {
    iterations: 1000,
    checksum: 2691360765,
  });
  const longCpu = call(rpc, { action: "cpu", iterations: 10_000_000 });
  const cpu = process.cpuUsage(cpuBefore);
  assert.ok(cpu.user + cpu.system > 0, "CPU control performs observable work");
  assert.deepEqual(call(rpc, { action: "cpu", iterations: 10_000_000 }), longCpu);
  longCpu.lastCpu.checksum = -1;
  assert.notEqual(call(rpc).lastCpu.checksum, -1, "status must not expose mutable owner state");

  const bytes = 64 * 1024 * 1024;
  assert.equal(call(rpc, { action: "buffer", bytes }).bufferBytes, bytes);
  assert.ok(process.memoryUsage().arrayBuffers >= bytes,
    "held Buffer must be observable as ArrayBuffer memory");
  reject(rpc, { action: "buffer", bytes: 1 }, "INVALID_REQUEST");
  assert.equal(call(rpc).bufferBytes, bytes);

  call(rpc, { action: "timer", intervalMs: 10 });
  assert.equal(timerCount(), baselineTimers + 1, "timer must keep the process alive");
  reject(rpc, { action: "timer", intervalMs: 60_000 }, "INVALID_REQUEST");
  const deadline = Date.now() + 2000;
  while (call(rpc).timerTicks === 0 && Date.now() < deadline) await delay(10);
  assert.ok(call(rpc).timerTicks > 0, "timer must actually run");

  const invalid = [
    null, [], "cpu", { unexpected: true }, { action: "unknown" }, { action: "__proto__" },
    { action: "cpu" }, { action: "cpu", iterations: "1" },
    { action: "cpu", iterations: 0 }, { action: "cpu", iterations: 10_000_001 },
    { action: "cpu", iterations: 1.1 }, { action: "cpu", iterations: NaN },
    { action: "cpu", iterations: Infinity }, { action: "cpu", iterations: 1, extra: true },
    { action: "buffer", bytes: 0 }, { action: "buffer", bytes: bytes + 1 },
    { action: "buffer", bytes: -1 }, { action: "buffer", bytes: 1.1 },
    { action: "timer", intervalMs: 9 }, { action: "timer", intervalMs: 60_001 },
    { action: "timer", intervalMs: 10.5 }, { action: "release", resource: "all" },
    { action: "release" }, { action: "reset", bytes: 0 },
  ];
  for (const request of invalid) {
    const before = call(rpc);
    reject(rpc, request, "INVALID_REQUEST");
    assert.deepEqual(call(rpc), before, "invalid requests must not mutate resources");
  }

  await service.start();
  assert.equal(call(rpc).bufferBytes, bytes, "repeated start must not orphan live resources");
  assert.equal(timerCount(), baselineTimers + 1);
  assert.deepEqual(call(secondRpc), empty, "registrations must not share resources");
  await secondService.start();
  call(secondRpc, { action: "buffer", bytes: 1 });
  call(secondRpc, { action: "timer", intervalMs: 60_000 });
  assert.equal(timerCount(), baselineTimers + 2);

  call(rpc, { action: "release", resource: "buffer" });
  call(rpc, { action: "release", resource: "buffer" });
  assert.equal(call(rpc).bufferBytes, 0);
  assert.equal(call(rpc).timerActive, true);
  call(rpc, { action: "release", resource: "timer" });
  call(rpc, { action: "release", resource: "timer" });
  assert.equal(timerCount(), baselineTimers + 1);
  assert.equal(call(rpc).timerTicks, 0);
  assert.deepEqual(call(rpc, { action: "reset" }), { ...empty, active: true });

  // Exercise service stop with both resources still held, then a fresh cycle.
  for (let cycle = 0; cycle < 2; cycle++) {
    await service.start();
    call(rpc, { action: "buffer", bytes: 1 });
    call(rpc, { action: "timer", intervalMs: 10 });
    assert.equal((await service.stop()).state, "stopped");
    assert.deepEqual(call(rpc), empty);
    assert.equal(timerCount(), baselineTimers + 1);
  }
  assert.equal(call(secondRpc).bufferBytes, 1, "stopping one owner must preserve the other");
  assert.equal(call(secondRpc).timerActive, true);
  await service.stop();
  assert.deepEqual(call(rpc, { action: "reset" }), empty);
  assert.deepEqual(call(rpc, { action: "release", resource: "timer" }), empty);
  reject(rpc, { action: "buffer", bytes: 1 }, "UNAVAILABLE");
  call(secondRpc, { action: "reset" });
  assert.equal(timerCount(), baselineTimers);
  assert.deepEqual(call(secondRpc), { ...empty, active: true });

  assert.throws(() => buildKitchenResourceMethod({ execute() { throw new Error("unexpected"); } })({
    params: {}, respond() { assert.fail("unexpected failures must not be reported as successful"); },
  }), /unexpected/);
} finally {
  await service.stop();
  await secondService.stop();
}
assert.equal(timerCount(), baselineTimers, "no owned timer survives cleanup");
console.log("Resource calibration OK: bounded CPU/ArrayBuffer/timer signals, RPC validation, release/reset, service stop/restart, owner isolation");

function invoke(rpc, params) {
  const responses = [];
  rpc({ params, respond: (...args) => responses.push(args) });
  assert.equal(responses.length, 1, "RPC must respond exactly once");
  return responses[0];
}

function call(rpc, params = {}) {
  const [ok, payload, error] = invoke(rpc, params);
  assert.equal(ok, true, error?.message);
  assert.equal(error, undefined);
  return payload;
}

function reject(rpc, params, code) {
  const [ok, payload, error] = invoke(rpc, params);
  assert.equal(ok, false);
  assert.equal(payload, undefined);
  assert.equal(error.code, code);
  assert.ok(error.message.length > 0);
}

function timerCount() {
  return process.getActiveResourcesInfo().filter((type) => type === "Timeout").length;
}

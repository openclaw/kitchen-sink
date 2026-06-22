import { PLUGIN_ID } from "../constants.js";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "timed_out", "cancelled", "lost"]);
const MAX_RETAINED_TERMINAL_TASKS = 100;

export function buildKitchenDetachedTaskRuntime() {
  const tasks = new Map();
  const terminalTaskIds = [];
  let nextImplicitTaskId = 0;

  function create(params = {}, status) {
    const now = Date.now();
    const runId = params.runId || `ks_task_${++nextImplicitTaskId}`;
    const task = {
      taskId: runId,
      runId,
      runtime: params.runtime || "cli",
      taskKind: params.taskKind || "kitchen-sink",
      sourceId: params.sourceId || PLUGIN_ID,
      requesterSessionKey: params.requesterSessionKey || "kitchen-sink",
      ownerKey: params.ownerKey || PLUGIN_ID,
      scopeKind: params.scopeKind || "session",
      childSessionKey: params.childSessionKey,
      parentFlowId: params.parentFlowId,
      parentTaskId: params.parentTaskId,
      agentId: params.agentId,
      label: params.label || "Kitchen Sink task",
      task: params.task,
      status,
      deliveryStatus: params.deliveryStatus || "not_applicable",
      notifyPolicy: params.notifyPolicy || "done_only",
      createdAt: now,
      startedAt: status === "running" ? params.startedAt || now : params.startedAt,
      lastEventAt: params.lastEventAt || now,
      progressSummary: params.progressSummary || undefined,
    };
    store(runId, task);
    return task;
  }

  function store(runId, task) {
    tasks.set(runId, task);
    if (!TERMINAL_STATUSES.has(task.status) || terminalTaskIds.includes(runId)) {
      return;
    }
    terminalTaskIds.push(runId);
    while (terminalTaskIds.length > MAX_RETAINED_TERMINAL_TASKS) {
      tasks.delete(terminalTaskIds.shift());
    }
  }

  function update(runId, patch) {
    const current = tasks.get(runId);
    if (!current) {
      return [];
    }
    if (
      TERMINAL_STATUSES.has(current.status) &&
      patch.status !== undefined &&
      patch.status !== current.status
    ) {
      return [current];
    }
    const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const next = { ...current, ...cleanPatch };
    store(runId, next);
    return [next];
  }

  return {
    createQueuedTaskRun: (params) => create(params, "queued"),
    createRunningTaskRun: (params) => create(params, "running"),
    startTaskRunByRunId: (params) =>
      update(params.runId, {
        status: "running",
        runtime: params.runtime,
        requesterSessionKey: params.sessionKey,
        startedAt: params.startedAt || Date.now(),
        lastEventAt: params.lastEventAt || Date.now(),
        progressSummary: params.progressSummary || params.eventSummary || "Kitchen Sink task started.",
      }),
    recordTaskRunProgressByRunId: (params) =>
      update(params.runId, {
        runtime: params.runtime,
        requesterSessionKey: params.sessionKey,
        lastEventAt: params.lastEventAt || Date.now(),
        progressSummary: params.progressSummary || params.eventSummary || "Kitchen Sink task progressed.",
      }),
    finalizeTaskRunByRunId: (params) =>
      update(params.runId, {
        runtime: params.runtime,
        requesterSessionKey: params.sessionKey,
        status: params.status,
        endedAt: params.endedAt,
        lastEventAt: params.lastEventAt || params.endedAt,
        error: params.error,
        progressSummary: params.progressSummary || undefined,
        terminalSummary: params.terminalSummary || undefined,
        terminalOutcome: params.terminalOutcome || undefined,
      }),
    completeTaskRunByRunId: (params) =>
      update(params.runId, {
        runtime: params.runtime,
        requesterSessionKey: params.sessionKey,
        status: "succeeded",
        endedAt: params.endedAt,
        lastEventAt: params.lastEventAt || params.endedAt,
        progressSummary: params.progressSummary || undefined,
        terminalSummary: params.terminalSummary || "Kitchen Sink task completed.",
        terminalOutcome: params.terminalOutcome || "succeeded",
      }),
    failTaskRunByRunId: (params) =>
      update(params.runId, {
        runtime: params.runtime,
        requesterSessionKey: params.sessionKey,
        status: params.status || "failed",
        endedAt: params.endedAt,
        lastEventAt: params.lastEventAt || params.endedAt,
        error: params.error,
        progressSummary: params.progressSummary || undefined,
        terminalSummary: params.terminalSummary || "Kitchen Sink task failed.",
      }),
    setDetachedTaskDeliveryStatusByRunId: (params) =>
      update(params.runId, {
        runtime: params.runtime,
        requesterSessionKey: params.sessionKey,
        deliveryStatus: params.deliveryStatus,
        error: params.error,
      }),
    cancelDetachedTaskRunById: async ({ taskId }) => {
      const current = tasks.get(taskId);
      if (!current) {
        return { found: false, cancelled: false, reason: "not owned by Kitchen Sink" };
      }
      if (TERMINAL_STATUSES.has(current.status)) {
        return { found: true, cancelled: false, reason: "task is already terminal", task: current };
      }
      const task = {
        ...current,
        status: "cancelled",
        endedAt: Date.now(),
        lastEventAt: Date.now(),
        terminalSummary: "Kitchen Sink task cancelled.",
      };
      store(taskId, task);
      return { found: true, cancelled: true, task };
    },
    tryRecoverTaskBeforeMarkLost: ({ task }) => ({
      recovered: Boolean(task?.taskId && tasks.has(task.taskId)),
    }),
  };
}

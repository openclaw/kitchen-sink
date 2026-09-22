// Calibration belongs to one service registration. Nothing is allocated until
// an explicit RPC after start; stop drops every owned resource before returning.
export function createKitchenResourceOwner() {
  let active = false;
  let buffer;
  let timer;
  let timerIntervalMs = 0;
  let timerTicks = 0;
  let lastCpu = null;

  const status = () => ({
    active,
    bufferBytes: buffer?.byteLength ?? 0,
    timerActive: timer !== undefined,
    timerIntervalMs,
    timerTicks,
    lastCpu: lastCpu && { ...lastCpu },
  });
  const release = (resource) => {
    if (resource === "buffer") {
      buffer = undefined;
    } else {
      clearInterval(timer);
      timer = undefined;
      timerIntervalMs = 0;
      timerTicks = 0;
    }
  };
  const reset = () => {
    release("buffer");
    release("timer");
    lastCpu = null;
  };

  return {
    start() {
      active = true;
    },
    stop() {
      active = false;
      reset();
    },
    execute(params) {
      validateRequest(params);
      if (Object.keys(params).length === 0) {
        return status();
      }
      const { action } = params;
      if (action === "release") {
        release(params.resource);
      } else if (action === "reset") {
        reset();
      } else {
        if (!active) {
          throw new KitchenResourceError("UNAVAILABLE", "Start kitchen-sink-service before acquiring resources or running CPU work.");
        }
        if (action === "cpu") {
          let checksum = 2166136261;
          for (let i = 0; i < params.iterations; i++) {
            checksum = Math.imul(checksum ^ i, 16777619) >>> 0;
          }
          lastCpu = { iterations: params.iterations, checksum };
        } else if (action === "buffer") {
          if (buffer !== undefined) {
            throw new KitchenResourceError("INVALID_REQUEST", "Release the held buffer before acquiring another.");
          }
          // Touch the allocation so the held-memory control is observable beyond
          // virtual address reservation. Release does not promise an RSS decrease.
          buffer = Buffer.alloc(params.bytes, 0x5a);
        } else {
          if (timer !== undefined) {
            throw new KitchenResourceError("INVALID_REQUEST", "Release the running timer before acquiring another.");
          }
          timerIntervalMs = params.intervalMs;
          // Keep the timer referenced: a missing service stop must remain visible
          // to lifecycle observers instead of being hidden by unref().
          timer = setInterval(() => { timerTicks++; }, timerIntervalMs);
        }
      }
      return status();
    },
  };
}

export class KitchenResourceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function validateRequest(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    invalid("Resource parameters must be an object.");
  }
  const keys = Object.keys(params);
  if (keys.length === 0) return;
  const { action } = params;
  const fields = {
    cpu: "iterations",
    buffer: "bytes",
    timer: "intervalMs",
    release: "resource",
    reset: null,
  };
  if (typeof action !== "string" || !Object.hasOwn(fields, action)) {
    invalid("Use empty parameters for status or an action: cpu, buffer, timer, release, reset.");
  }
  const field = fields[action];
  if (keys.length !== (field === null ? 1 : 2) || keys.some((key) => key !== "action" && key !== field)) {
    invalid(`Action ${action} accepts only action${field ? ` and ${field}` : ""}.`);
  }
  if (action === "release") {
    if (params.resource !== "buffer" && params.resource !== "timer") {
      invalid("Release resource must be buffer or timer.");
    }
  } else if (field !== null) {
    const [minimum, maximum] = action === "cpu" ? [1, 10_000_000]
      : action === "buffer" ? [1, 64 * 1024 * 1024] : [10, 60_000];
    if (!Number.isSafeInteger(params[field]) || params[field] < minimum || params[field] > maximum) {
      invalid(`${field} must be an integer from ${minimum} through ${maximum}.`);
    }
  }
}

function invalid(message) {
  throw new KitchenResourceError("INVALID_REQUEST", message);
}

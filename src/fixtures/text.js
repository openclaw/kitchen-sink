import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MEDIA_MODEL,
  DEFAULT_TEXT_MODEL,
  IMAGE_PROVIDER_ID,
  TEXT_PROVIDER_ID,
  WEB_FETCH_PROVIDER_ID,
  WEB_SEARCH_PROVIDER_ID,
} from "../constants.js";

export function kitchenTextProviderConfig() {
  // Looks like a real provider config, but stays credential-free and local so
  // installs can use it in CI, Crabpot, and plugin-inspector.
  return {
    baseUrl: "kitchen-sink://local",
    apiKey: "kitchen-sink-local-fixture",
    auth: "token",
    api: "kitchen-sink",
    models: [kitchenTextModelDefinition()],
  };
}

export function kitchenTextModelDefinition() {
  return {
    id: DEFAULT_TEXT_MODEL,
    name: "Kitchen Sink Text Fixture",
    api: "kitchen-sink",
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8192,
    maxTokens: 2048,
    description: "Deterministic OpenClaw plugin text-provider fixture.",
  };
}

export function kitchenTextRuntimeModelDefinition() {
  return {
    ...kitchenTextModelDefinition(),
    provider: TEXT_PROVIDER_ID,
    baseUrl: "kitchen-sink://local",
    reasoning: false,
  };
}

export function createKitchenTextStream(model, context) {
  // Emit the same coarse lifecycle events a streaming text provider would emit;
  // consumers can test stream handling without a live model.
  const stream = createAssistantMessageEventStream();
  queueMicrotask(() => {
    const prompt = extractLastUserPrompt(context);
    const text = kitchenTextResponse(prompt);
    const message = {
      role: "assistant",
      content: [{ type: "text", text }],
      api: model?.api || "kitchen-sink",
      provider: TEXT_PROVIDER_ID,
      model: model?.id || DEFAULT_TEXT_MODEL,
      usage: estimateUsage(prompt, text),
      stopReason: "stop",
      timestamp: Date.now(),
    };
    stream.push({ type: "start", partial: { ...message, content: [] } });
    stream.push({ type: "text_start", contentIndex: 0, partial: { ...message, content: [] } });
    stream.push({ type: "text_delta", contentIndex: 0, delta: text, partial: message });
    stream.push({ type: "text_end", contentIndex: 0, content: text, partial: message });
    stream.push({ type: "done", reason: "stop", message });
    stream.end(message);
  });
  return stream;
}

export function kitchenTextResponse(prompt) {
  const normalized = normalizePrompt(prompt, "kitchen sink text inference");
  if (/\b(image|picture|draw|generate)\b/i.test(normalized)) {
    return [
      "Kitchen Sink text fixture:",
      `prompt="${normalized}"`,
      `I would route this to ${IMAGE_PROVIDER_ID}/${DEFAULT_IMAGE_MODEL}, create a queued image job, wait for completion, then return the bundled kitchen_sink_office.png asset with PNG metadata.`,
    ].join(" ");
  }
  if (/\b(search|find|lookup|web)\b/i.test(normalized)) {
    return [
      "Kitchen Sink text fixture:",
      `prompt="${normalized}"`,
      `I would call ${WEB_SEARCH_PROVIDER_ID} for ranked fixture results and ${WEB_FETCH_PROVIDER_ID} for deterministic document fetches.`,
    ].join(" ");
  }
  if (/\b(rate limit|timeout|fail|error)\b/i.test(normalized)) {
    return [
      "Kitchen Sink text fixture:",
      `prompt="${normalized}"`,
      "Failure fixtures are available: rate limit returns 429 with retry metadata, timeout returns 504, and fail returns a deterministic provider error.",
    ].join(" ");
  }
  return [
    "Kitchen Sink text fixture:",
    `prompt="${normalized}"`,
    "Available realistic surfaces: direct prefix, registered tools, image provider lifecycle, media understanding, web search, web fetch, channel health, hooks, detached tasks, and text provider catalog.",
  ].join(" ");
}

export function kitchenImageDescription(prompt, count) {
  return [
    `Kitchen Sink media fixture described ${count || 1} image${count === 1 ? "" : "s"}.`,
    `Prompt: ${normalizePrompt(prompt, "describe kitchen sink image")}.`,
    "Visible content: the bundled kitchen_sink_office PNG: an office lobby scene with a lobster-costumed figure holding a real sink.",
  ].join(" ");
}

export function estimateUsage(prompt = "", text = "") {
  const input = estimateTokens(prompt);
  const output = estimateTokens(text);
  return {
    input,
    output,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: input + output,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

function createAssistantMessageEventStream() {
  const queue = [];
  const waiters = [];
  let done = false;
  let finalResult;
  let resolveResult;
  const resultPromise = new Promise((resolve) => {
    resolveResult = resolve;
  });

  return {
    push(event) {
      if (done) {
        return;
      }
      if (event.type === "done" || event.type === "error") {
        finalResult = event.type === "done" ? event.message : event.error;
        done = true;
        resolveResult(finalResult);
      }
      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value: event, done: false });
      } else {
        queue.push(event);
      }
    },
    end(result) {
      if (result !== undefined && finalResult === undefined) {
        finalResult = result;
        resolveResult(result);
      }
      done = true;
      while (waiters.length > 0) {
        waiters.shift()({ value: undefined, done: true });
      }
    },
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift();
        } else if (done) {
          return;
        } else {
          const next = await new Promise((resolve) => waiters.push(resolve));
          if (next.done) {
            return;
          }
          yield next.value;
        }
      }
    },
    result() {
      return resultPromise;
    },
  };
}

function extractLastUserPrompt(context) {
  const messages = Array.isArray(context?.messages) ? context.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }
    if (typeof message.content === "string") {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      const text = message.content
        .filter((item) => item?.type === "text" && typeof item.text === "string")
        .map((item) => item.text)
        .join(" ")
        .trim();
      if (text) {
        return text;
      }
    }
  }
  return "kitchen sink text inference";
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text).trim().split(/\s+/).filter(Boolean).length * 1.35));
}

function normalizePrompt(value, fallback) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

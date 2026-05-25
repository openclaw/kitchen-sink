import assert from "node:assert/strict";

export function capturePluginRegistration(plugin, config = {}) {
  // The harness captures every register* call through one proxy, which lets
  // scripts inspect new SDK registrars without updating bespoke mocks first.
  const captured = {};
  const api = new Proxy(
    {
      id: "openclaw-kitchen-sink-fixture",
      registrationMode: "full",
      config,
      logger: console,
    },
    {
      get(target, property) {
        if (property in target) {
          return target[property];
        }
        if (property === "on") {
          return (...args) => capture(captured, "on", args);
        }
        if (typeof property !== "string" || !property.startsWith("register")) {
          return undefined;
        }
        return (...args) => capture(captured, property, args);
      },
    },
  );
  plugin.register(api);
  return captured;
}

export function createRegistrationFinder(registrations) {
  return (method, id) => {
    const entry = registrations[method]?.map(([value]) => value).find((value) => value?.id === id);
    assert.ok(entry, `${method} ${id} registered`);
    return entry;
  };
}

export function createHookFinder(registrations) {
  return (name) => {
    const entry = registrations.on?.find(([hookName]) => hookName === name);
    assert.ok(entry, `hook ${name} registered`);
    return entry[1];
  };
}

export function registrationSummary(registrations) {
  return Object.fromEntries(
    Object.entries(registrations)
      .filter(([method]) => method !== "on")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([method, entries]) => [
        method,
        {
          count: entries.length,
          ids: entries.map((args) => idForRegistration(method, args)).filter(Boolean).sort(),
        },
      ]),
  );
}

export function fixedNow(start = Date.UTC(2026, 3, 28, 12, 0, 0)) {
  let tick = 0;
  return () => new Date(start + tick++ * 1000);
}

function capture(registrations, method, args) {
  registrations[method] ??= [];
  registrations[method].push(args);
}

function idForRegistration(method, args) {
  const [value, second] = args;
  if (method === "registerGatewayMethod" && typeof value === "string") {
    return value;
  }
  if ((method === "registerCli" || method === "registerNodeCliFeature") && second?.descriptors?.length > 0) {
    return second.descriptors.map((descriptor) => descriptor.name).join(", ");
  }
  if (value?.id || value?.name) {
    return value.id || value.name;
  }
  if (typeof second === "string") {
    return second;
  }
  const slug = method.slice("register".length).replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return `kitchen-sink-${slug}`;
}

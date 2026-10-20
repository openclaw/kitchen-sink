# Changelog

## Unreleased

## 0.4.1 - 2026-10-20

**Highlights:** Restore OpenClaw SDK update compatibility and ship development-dependency security fixes.

- Fix SDK updates to OpenClaw 2026.10.5 by recognizing the intentionally invalid agent-executor controller probe only when that registrar is present.
- Update bundled development npm and the CI/release toolchain to 12.2.1, fixing seven transitive dependency security alerts; add a release validation dry run that never publishes.
- Update development dependencies to `brace-expansion` 5.0.12, the Anthropic SDK 0.131.0, and MCP SDK 1.32.1 with its OAuth client security fix. Thanks @dependabot for the brace-expansion update.
- Refresh the OpenClaw 2026.10.5 surface and development dependencies to Anthropic SDK 0.136.0 and uuid 14.0.3.
- Update the fixture to OpenClaw 2026.10.1, read its tuple-based manifest contracts, adapt host checks to asynchronous activation and owned views, and cover storage-provider diagnostics. Update bundled development npm and the CI lane to 12.2.0.
- Keep asynchronous middleware-host test cleanup isolated from the caller's OpenClaw home and state.
- Keep installed-host checks compatible with OpenClaw 2026.9.7 by handling the retired detached-task registry and deriving new registrar diagnostics from the generated SDK surface.

[npm version](https://www.npmjs.com/package/@openclaw/kitchen-sink/v/0.4.1) · [Registry tarball](https://registry.npmjs.org/@openclaw/kitchen-sink/-/kitchen-sink-0.4.1.tgz) · [Integrity metadata](https://registry.npmjs.org/@openclaw/kitchen-sink/0.4.1) · [CI](https://github.com/openclaw/kitchen-sink/actions/runs/39475804890) · [Release validation](https://github.com/openclaw/kitchen-sink/actions/runs/39475812917)

## 0.4.0 - 2026-09-25

- Add the authenticated `kitchen.resources` Gateway method with bounded CPU, Buffer, and timer calibration controls. Service stop releases held resources.
- Require OpenClaw `2026.9.5` or newer and refresh the generated plugin surface for that SDK.
- Fix realtime transcription retaining all audio until close and losing byte counts when callers transfer the input buffer.

# Changelog

## Unreleased

- Keep installed-host checks compatible with OpenClaw 2026.9.7 by handling the retired detached-task registry and deriving new registrar diagnostics from the generated SDK surface.

## 0.4.0 - 2026-09-25

- Add the authenticated `kitchen.resources` Gateway method with bounded CPU, Buffer, and timer calibration controls. Service stop releases held resources.
- Require OpenClaw `2026.9.5` or newer and refresh the generated plugin surface for that SDK.
- Fix realtime transcription retaining all audio until close and losing byte counts when callers transfer the input buffer.

# Security Policy

## Reporting

Report suspected vulnerabilities privately through GitHub Security Advisories for
this repository. If GHSA is unavailable to you, email security@openclaw.ai.

Do not open public issues for vulnerabilities or include secrets, private plugin
artifacts, credentials, or exploit details in public reports.

## Scope

In scope:

- Kitchen Sink plugin package, manifest, runtime, and setup entrypoints
- plugin-inspector configuration and package integrity checks
- release workflows that publish to npm or ClawHub
- dependency or workflow behavior that can affect fixture integrity

Out of scope:

- vulnerabilities in the OpenClaw host outside this fixture package
- intentionally mocked plugin behavior that does not cross a real boundary
- compromise of a trusted local account, shell, filesystem, or maintainer device
- scanner-only findings without a reachable exploit path in supported usage

## Expectations

We prioritize reachable issues that affect package integrity, release
publishing, plugin fixture behavior, or safe execution. Include the affected
commit, minimal reproduction steps, and sanitized impact details.

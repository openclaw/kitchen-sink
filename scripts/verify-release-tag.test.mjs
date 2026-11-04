import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const release = readFileSync(join(root, ".github/workflows/release.yml"), "utf8");
const draft = readFileSync(join(root, ".github/workflows/draft-release.yml"), "utf8");
const tag = "v1.2.3";

function stepBody(workflow, name) {
  const step = workflow.split(`      - name: ${name}\n`)[1]?.split(/\n      - |\n  \S/)[0];
  const body = step?.split("        run: |\n")[1];
  assert.ok(body, `Missing workflow shell step: ${name}`);
  return body.split("\n").map((line) => line.replace(/^          /, "")).join("\n");
}

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "kitchen-release-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !key.startsWith("GIT_") && key !== "SSH_AUTH_SOCK" && key !== "GITHUB_OUTPUT"));
  const config = join(dir, "empty-git-config");
  writeFileSync(config, "");
  Object.assign(env, { GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" });
  const repo = join(dir, "repo");
  const remote = join(dir, "remote.git");
  const run = (command, args, options = {}) => execFileSync(command, args, {
    cwd: repo, env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options,
  }).trim();
  mkdirSync(repo);
  run("git", ["-c", "init.templateDir=", "init", "--initial-branch=main"]);
  run("git", ["-c", "init.templateDir=", "init", "--bare", remote]);
  const git = (...args) => run("git", args);
  git("config", "user.name", "Release Fixture");
  git("config", "user.email", "release@example.invalid");
  for (const name of ["trusted", "unknown"]) {
    run("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", join(dir, name)]);
  }
  mkdirSync(join(repo, ".github"));
  writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "release-fixture", version: "1.2.3" }));
  writeFileSync(join(repo, ".github/release-allowed-signers"),
    `fixture namespaces="git" ${readFileSync(join(dir, "trusted.pub"), "utf8")}`);
  git("add", ".");
  git("commit", "-m", "fixture");
  git("remote", "add", "origin", remote);
  git("push", "origin", "HEAD:refs/heads/main");
  const source = git("rev-parse", "HEAD");
  // Historical source tags contain policy but need not contain the workflow's verifier.
  mkdirSync(join(repo, ".release-tools/scripts"), { recursive: true });
  copyFileSync(join(root, "scripts/verify-release-tag.mjs"), join(repo, ".release-tools/scripts/verify-release-tag.mjs"));
  const sign = (key = "trusted", target = "HEAD", message = "release") => {
    git("-c", "gpg.format=ssh", "-c", "gpg.ssh.program=ssh-keygen", "-c", `user.signingkey=${join(dir, key)}`,
      "tag", "-s", "-f", tag, target, "-m", message);
    git("push", "--force", "origin", `refs/tags/${tag}`);
    return git("rev-parse", `refs/tags/${tag}`);
  };
  const verify = (...args) => spawnSync(process.execPath, [".release-tools/scripts/verify-release-tag.mjs", tag, ...args], {
    cwd: repo, env, encoding: "utf8",
  });
  const bin = join(dir, "bin");
  mkdirSync(bin);
  // Only external mutations are stubbed. Signature, ref and remote checks use real Git/SSH.
  writeFileSync(join(bin, "npm"), '#!/bin/sh\nprintf "npm %s\\n" "$*" >> "$MUTATION_LOG"\n', { mode: 0o755 });
  writeFileSync(join(bin, "gh"), '#!/bin/sh\nif [ "$2" = view ]; then exit "${DRAFT_EXISTS:-1}"; fi\nprintf "gh %s\\n" "$*" >> "$MUTATION_LOG"\n', { mode: 0o755 });
  const mutations = join(dir, "mutations");
  const output = join(dir, "output");
  const shell = (body, variables = {}) => spawnSync("/bin/bash", ["-e", "-o", "pipefail", "-c", body], {
    cwd: repo, encoding: "utf8", env: { ...env, PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH}`,
      MUTATION_LOG: mutations, GITHUB_OUTPUT: output, TAG_NAME: tag, INPUT_PRERELEASE: "false", ...variables },
  });
  return { repo, dir, git, run, source, sign, verify, shell, mutations, output };
}

test("allowed SSH tag freezes both identities and permits publish and draft paths", (t) => {
  const f = fixture(t);
  assert.equal(existsSync(join(f.repo, "scripts/verify-release-tag.mjs")), false);
  const object = f.sign();
  const validation = f.shell(stepBody(release, "Validate release tag and source"));
  assert.equal(validation.status, 0, validation.stderr);
  assert.match(readFileSync(f.output, "utf8"), new RegExp(`tag_object=${object}\\nsource_sha=${f.source}`));
  const variables = { TAG_OBJECT: object, SOURCE_SHA: f.source, TARBALL_NAME: "fixture.tgz", NPM_TAG: "latest" };
  const publish = f.shell(stepBody(release, "Publish to npm"), variables);
  assert.equal(publish.status, 0, publish.stderr);
  const noOp = f.shell(stepBody(release, "Report already-published release state"), variables);
  assert.equal(noOp.status, 0, noOp.stderr);
  for (const existing of ["1", "0"]) {
    const result = f.shell(stepBody(draft, "Draft GitHub release"), { DRAFT_EXISTS: existing });
    assert.equal(result.status, 0, result.stderr);
  }
  const calls = readFileSync(f.mutations, "utf8");
  assert.match(calls, /npm publish/);
  assert.match(calls, /gh release create .*--generate-notes/);
  assert.match(calls, /gh release edit/);
  assert.doesNotMatch(calls.split("\n").find((line) => line.includes("release edit")), /--generate-notes/);
  assert.equal(f.git("rev-parse", `refs/tags/${tag}`), object);
});

test("workflow tooling is pinned and ignores a source-tree verifier decoy", (t) => {
  const f = fixture(t);
  mkdirSync(join(f.repo, "scripts"));
  writeFileSync(join(f.repo, "scripts/verify-release-tag.mjs"), 'throw new Error("source decoy executed");\n');
  f.git("add", "scripts");
  f.git("commit", "-m", "historical source verifier");
  const object = f.sign();
  const frozen = { TAG_OBJECT: object, SOURCE_SHA: f.git("rev-parse", "HEAD") };
  for (const [workflow, name] of [[release, "Validate release tag and source"],
    [release, "Publish to npm"], [release, "Report already-published release state"],
    [draft, "Draft GitHub release"]]) {
    const result = f.shell(stepBody(workflow, name), frozen);
    assert.equal(result.status, 0, result.stderr);
  }
  const tooling = /ref: \$\{\{ github\.workflow_sha \}\}\n          path: \.release-tools\n          sparse-checkout: scripts\/verify-release-tag\.mjs\n          sparse-checkout-cone-mode: false\n          persist-credentials: false/g;
  assert.equal([...release.matchAll(tooling)].length, 2);
  assert.equal([...draft.matchAll(tooling)].length, 1);
});

for (const kind of ["missing", "lightweight", "unsigned", "unknown", "tampered", "wrong-target"]) {
  test(`${kind} tag blocks validation, npm and draft mutation`, (t) => {
    const f = fixture(t);
    if (kind === "lightweight") f.git("tag", tag);
    if (kind === "unsigned") f.git("tag", "-a", tag, "-m", "release");
    if (kind === "unknown") {
      f.sign("unknown");
      // A dirty trust file must not authorize a signer absent from the committed policy.
      writeFileSync(join(f.repo, ".github/release-allowed-signers"),
        `fixture ${readFileSync(join(f.dir, "unknown.pub"), "utf8")}`);
    }
    if (kind === "tampered") {
      f.sign();
      const contents = f.git("cat-file", "tag", `refs/tags/${tag}`).replace("\nrelease\n", "\ntampered\n") + "\n";
      const object = f.run("git", ["hash-object", "-t", "tag", "-w", "--stdin"], { input: contents });
      f.git("update-ref", `refs/tags/${tag}`, object);
    }
    if (kind === "wrong-target") {
      f.git("commit", "--allow-empty", "-m", "new source");
      f.sign("trusted", f.source);
    }
    if (!["missing", "unknown", "wrong-target"].includes(kind)) {
      f.git("push", "--force", "origin", `refs/tags/${tag}`);
    }
    const frozen = {
      TAG_OBJECT: kind === "missing" ? "0".repeat(40) : f.git("rev-parse", `refs/tags/${tag}`),
      SOURCE_SHA: f.git("rev-parse", "HEAD"),
    };
    for (const [workflow, name] of [[release, "Validate release tag and source"],
      [release, "Publish to npm"], [draft, "Draft GitHub release"]]) {
      const result = f.shell(stepBody(workflow, name), frozen);
      assert.notEqual(result.status, 0, `${kind}: ${name} unexpectedly passed`);
      assert.doesNotMatch(result.stderr, /Usage: verify-release-tag/, "Exercise tag verification, not argument rejection");
    }
    assert.equal(existsSync(f.mutations), false, "No npm or GitHub mutation may run");
    if (kind === "missing") assert.equal(f.git("tag", "--list"), "", "Draft must not create a tag");
  });
}

test("same-target replacement fails frozen publish and already-published paths", (t) => {
  const f = fixture(t);
  const original = f.sign();
  const replacement = f.sign("trusted", "HEAD", "replacement");
  assert.notEqual(replacement, original);
  // Keep the validated local object while replacing only the remote tag.
  f.git("update-ref", `refs/tags/${tag}`, original);
  for (const name of ["Publish to npm", "Report already-published release state"]) {
    const result = f.shell(stepBody(release, name), { TAG_OBJECT: original, SOURCE_SHA: f.source });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Remote release tag object or source differs/);
  }
  assert.equal(existsSync(f.mutations), false);
  f.git("update-ref", `refs/tags/${tag}`, replacement);
  assert.match(f.verify(original, f.source).stderr, /changed since validation/);
});

test("wrong frozen source and tag/version mismatch fail closed", (t) => {
  const f = fixture(t);
  const object = f.sign();
  assert.notEqual(f.verify(object, "0".repeat(40)).status, 0);
  const result = f.shell(stepBody(release, "Validate release tag and source"), { TAG_NAME: "v9.9.9" });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Tag\/version mismatch/);
});

test("branch dry run validates metadata without a tag and cannot enter publishing", (t) => {
  const f = fixture(t);
  const result = f.shell(stepBody(release, "Validate release tag and source"), { DRY_RUN: "true" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(f.output, "utf8"), new RegExp(`source_sha=${f.source}`));
  assert.doesNotMatch(readFileSync(f.output, "utf8"), /tag_object=/);
  const exists = f.shell(stepBody(release, "Check if this version is already published to npm"), { DRY_RUN: "true" });
  assert.equal(exists.status, 0, exists.stderr);
  assert.match(readFileSync(f.output, "utf8"), /already_published=false/);
  assert.equal(f.git("tag", "--list"), "");
  assert.equal(existsSync(f.mutations), false);
  assert.match(release, /name: Report already-published release state\n        if: steps\.npm_exists\.outputs\.already_published == 'true'/);
  assert.match(release, /if: inputs\.dry_run != true && needs\.validate\.outputs\.npm_already_published != 'true'/);
  assert.match(release, /ref: \$\{\{ inputs\.dry_run && github\.sha \|\| inputs\.tag \|\| github\.event\.release\.tag_name \}\}/);
  assert.ok(release.indexOf("name: Validate release tag and source") < release.indexOf("name: Install dependencies"));
  assert.match(release, /ref: \$\{\{ needs\.validate\.outputs\.source_sha \}\}/);
});

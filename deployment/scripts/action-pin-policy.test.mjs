import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const workflowsDirectory = ".github/workflows";
const workflowNames = (await readdir(workflowsDirectory)).filter((name) =>
  /\.ya?ml$/i.test(name),
);
const workflows = await Promise.all(
  workflowNames.map(async (name) => ({
    name,
    content: await readFile(`${workflowsDirectory}/${name}`, "utf8"),
  })),
);

test("all external GitHub Actions use immutable commit SHAs with version comments", () => {
  const externalUses = [];
  for (const workflow of workflows) {
    for (const [index, line] of workflow.content.split(/\r?\n/).entries()) {
      const match = line.match(/^\s*(?:-\s*)?uses:\s*["']?([^\s"'#]+)["']?/);
      if (!match || match[1].startsWith("./")) continue;
      externalUses.push(`${workflow.name}:${index + 1}`);
      const separator = match[1].lastIndexOf("@");
      assert.notEqual(separator, -1, `${workflow.name}:${index + 1} has no ref`);
      const ref = match[1].slice(separator + 1);
      assert.match(
        ref,
        /^[0-9a-f]{40}$/,
        `${workflow.name}:${index + 1} must use a full commit SHA`,
      );
      assert.match(
        line,
        /#\s+v\d+(?:\.\d+){1,2}\s*$/,
        `${workflow.name}:${index + 1} must document the pinned version`,
      );
    }
  }
  assert.ok(externalUses.length > 0, "no external Actions were inspected");
});

test("workflow token permissions default to read-only and release write is scoped", () => {
  const ci = workflows.find(({ name }) => name === "ci.yml")?.content ?? "";
  const release =
    workflows.find(({ name }) => name === "release.yml")?.content ?? "";
  assert.match(ci, /^permissions:\r?\n  contents: read$/m);
  assert.match(release, /^permissions:\r?\n  contents: read$/m);
  assert.equal(
    (release.match(/^\s+contents: write$/gm) ?? []).length,
    1,
    "only the release publication job may write repository contents",
  );
  assert.equal((ci.match(/^\s+contents: write$/gm) ?? []).length, 0);
});

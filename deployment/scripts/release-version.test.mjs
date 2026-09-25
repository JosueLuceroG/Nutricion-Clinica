import assert from "node:assert/strict";
import test from "node:test";
import { isReleaseVersion, releaseVersionFromTag } from "./release-version.mjs";

test("accepts strict release versions and normalizes a v-prefixed tag", () => {
  for (const version of ["0.1.0", "1.2.3-rc.2", "2.0.0-alpha-1.3"]) {
    assert.equal(isReleaseVersion(version), true, version);
  }
  assert.equal(releaseVersionFromTag("v0.1.0-rc.2"), "0.1.0-rc.2");
});

test("rejects malformed, partial, and build-metadata release versions", () => {
  for (const version of [
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "1.2.3-01",
    "1.2.3-alpha.",
    "1.2.3+build.1",
    " 1.2.3",
  ]) {
    assert.equal(isReleaseVersion(version), false, version);
  }
  assert.throws(() => releaseVersionFromTag("1.2.3"), /release tag/);
});

import { pathToFileURL } from "node:url";

// SemVer without build metadata. Release filenames and component-version
// derivation intentionally use only the core version plus prerelease.
export const RELEASE_VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;

export function isReleaseVersion(value) {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    RELEASE_VERSION_PATTERN.test(value)
  );
}

export function assertReleaseVersion(value) {
  if (!isReleaseVersion(value)) {
    throw new Error("release version must be strict semantic versioning");
  }
  return value;
}

export function releaseVersionFromTag(tag) {
  if (typeof tag !== "string" || !tag.startsWith("v")) {
    throw new Error("release tag must be v<semantic-version>");
  }
  return assertReleaseVersion(tag.slice(1));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    console.log(releaseVersionFromTag(process.argv[2] ?? ""));
  } catch (error) {
    console.error(`[release-version] ${error.message}`);
    process.exitCode = 1;
  }
}

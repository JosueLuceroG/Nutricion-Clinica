import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertReleaseVersion } from "./release-version.mjs";

function unsafeRemoteHostname(hostname) {
  const host = hostname.toLowerCase();
  return (
    host.endsWith(".") ||
    /(?:^|\.)(?:example|invalid|test)$/.test(host) ||
    /^(?:.+\.)?example\.(?:com|net|org)$/.test(host) ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    /^127\./.test(host) ||
    host === "[::]" ||
    host === "[::1]" ||
    /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(host)
  );
}

function exactRemoteHttpsOrigin(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      unsafeRemoteHostname(url.hostname)
    ) {
      throw new Error("invalid origin");
    }
    return url.origin;
  } catch {
    throw new Error("Desktop API target must be an exact remote HTTPS origin");
  }
}

export function withDesktopVersion(config, version) {
  assertReleaseVersion(version);
  return { ...config, version };
}

export function withDesktopApiOrigin(config, value) {
  const origin = exactRemoteHttpsOrigin(value);
  const websocketOrigin = origin.replace(/^https:/, "wss:");
  const csp = config?.app?.security?.csp;
  if (typeof csp !== "string" || !csp.trim()) {
    throw new Error("Tauri config must contain a string CSP");
  }

  const directives = csp
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean);
  let replaced = false;
  const nextDirectives = directives.map((directive) => {
    const [name, ...sources] = directive.split(/\s+/);
    if (name?.toLowerCase() !== "connect-src") return directive;
    replaced = true;
    const localSources = sources.filter((source) =>
      ["'self'", "self", "ipc:", "http://ipc.localhost"].includes(source),
    );
    return [
      "connect-src",
      ...new Set([...localSources, origin, websocketOrigin]),
    ].join(" ");
  });
  if (!replaced) {
    nextDirectives.push(`connect-src 'self' ${origin} ${websocketOrigin}`);
  }

  return {
    ...config,
    app: {
      ...config.app,
      security: {
        ...config.app.security,
        csp: nextDirectives.join("; "),
      },
    },
  };
}

function replaceVersionLine(section, version, sourceName) {
  const versionLines =
    section.match(/^\s*version\s*=\s*"[^"\r\n]+"\s*$/gm) ?? [];
  if (versionLines.length !== 1) {
    throw new Error(`${sourceName} must contain exactly one package version`);
  }
  return section.replace(
    /^(\s*version\s*=\s*")[^"\r\n]+("\s*)$/m,
    (_, prefix, suffix) => `${prefix}${version}${suffix}`,
  );
}

export function withCargoPackageVersion(cargoToml, version) {
  assertReleaseVersion(version);
  const sections = cargoToml.split(/(?=^\[[^\r\n]+\]\s*$)/m);
  const packageIndexes = sections.flatMap((section, index) =>
    /^\[package\]\s*$/m.test(section) ? [index] : [],
  );
  if (packageIndexes.length !== 1) {
    throw new Error("Cargo.toml must contain exactly one [package] section");
  }
  const index = packageIndexes[0];
  sections[index] = replaceVersionLine(sections[index], version, "Cargo.toml");
  return sections.join("");
}

export function withCargoLockPackageVersion(cargoLock, version) {
  assertReleaseVersion(version);
  const blocks = cargoLock.split(/(?=^\[\[package\]\]\s*$)/m);
  const packageIndexes = blocks.flatMap((block, index) =>
    /^name\s*=\s*"nutriclinica"\s*$/m.test(block) ? [index] : [],
  );
  if (packageIndexes.length !== 1) {
    throw new Error(
      'Cargo.lock must contain exactly one package named "nutriclinica"',
    );
  }
  const index = packageIndexes[0];
  blocks[index] = replaceVersionLine(blocks[index], version, "Cargo.lock");
  return blocks.join("");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const version = process.argv[2] ?? process.env.RELEASE_VERSION ?? "";
  const apiOrigin = process.argv[3] ?? process.env.DESKTOP_API_ORIGIN ?? "";
  const configPath = resolve("src-tauri/tauri.conf.json");
  const cargoTomlPath = resolve("src-tauri/Cargo.toml");
  const cargoLockPath = resolve("src-tauri/Cargo.lock");
  const [configJson, cargoToml, cargoLock] = await Promise.all([
    readFile(configPath, "utf8"),
    readFile(cargoTomlPath, "utf8"),
    readFile(cargoLockPath, "utf8"),
  ]);
  const config = withDesktopApiOrigin(
    withDesktopVersion(JSON.parse(configJson), version),
    apiOrigin,
  );
  const nextCargoToml = withCargoPackageVersion(cargoToml, version);
  const nextCargoLock = withCargoLockPackageVersion(cargoLock, version);
  await Promise.all([
    writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8"),
    writeFile(cargoTomlPath, nextCargoToml, "utf8"),
    writeFile(cargoLockPath, nextCargoLock, "utf8"),
  ]);
  console.log(`desktop-version: ${version}`);
}

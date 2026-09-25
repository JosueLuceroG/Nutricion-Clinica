import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isReleaseVersion } from "./release-version.mjs";

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

function cspSources(csp, directiveName) {
  const directive = csp
    .split(";")
    .map((value) => value.trim().split(/\s+/))
    .find(([name]) => name?.toLowerCase() === directiveName);
  return new Set(
    (directive?.slice(1) ?? []).map((token) =>
      token.replace(/^['"]|['"]$/g, ""),
    ),
  );
}

function cargoPackageVersion(cargoToml) {
  const section = String(cargoToml ?? "")
    .split(/(?=^\[[^\r\n]+\]\s*$)/m)
    .find((value) => /^\[package\]\s*$/m.test(value));
  return section?.match(/^\s*version\s*=\s*"([^"\r\n]+)"\s*$/m)?.[1];
}

function cargoLockPackageVersion(cargoLock) {
  const block = String(cargoLock ?? "")
    .split(/(?=^\[\[package\]\]\s*$)/m)
    .find((value) => /^name\s*=\s*"nutriclinica"\s*$/m.test(value));
  return block?.match(/^\s*version\s*=\s*"([^"\r\n]+)"\s*$/m)?.[1];
}

function cargoHasUpdaterDependency(cargoToml) {
  const dependencies = String(cargoToml ?? "")
    .split(/(?=^\[[^\r\n]+\]\s*$)/m)
    .find((value) => /^\[dependencies\]\s*$/m.test(value));
  return /^\s*tauri-plugin-updater\s*=\s*(?:"[^"\r\n]+"|\{[^}\r\n]+\})\s*(?:#.*)?$/m.test(
    dependencies ?? "",
  );
}

function rustCodeOnly(source) {
  const input = String(source ?? "");
  let output = "";
  let index = 0;
  while (index < input.length) {
    if (input.startsWith("//", index)) {
      const end = input.indexOf("\n", index + 2);
      if (end === -1) break;
      output += "\n";
      index = end + 1;
      continue;
    }
    if (input.startsWith("/*", index)) {
      let depth = 1;
      index += 2;
      while (index < input.length && depth > 0) {
        if (input.startsWith("/*", index)) {
          depth += 1;
          index += 2;
        } else if (input.startsWith("*/", index)) {
          depth -= 1;
          index += 2;
        } else {
          if (input[index] === "\n") output += "\n";
          index += 1;
        }
      }
      continue;
    }
    const rawString = input.slice(index).match(/^(?:br|r)(#{0,16})"/);
    if (rawString) {
      const terminator = `"${rawString[1]}`;
      index += rawString[0].length;
      const end = input.indexOf(terminator, index);
      if (end === -1) break;
      output += " ";
      index = end + terminator.length;
      continue;
    }
    const stringStart = input[index] === '"' ? 1 : input.startsWith('b"', index) ? 2 : 0;
    if (stringStart > 0) {
      index += stringStart;
      while (index < input.length) {
        if (input[index] === "\\") index += 2;
        else if (input[index++] === '"') break;
      }
      output += " ";
      continue;
    }
    output += input[index];
    index += 1;
  }
  return output;
}

export function hasUpdaterImplementation(cargoToml, rustLib) {
  const activeRust = rustCodeOnly(rustLib);
  return (
    cargoHasUpdaterDependency(cargoToml) &&
    /\.plugin\s*\(\s*tauri_plugin_updater::Builder::new\(\)\.build\(\)\s*\)/.test(
      activeRust,
    )
  );
}

export function verifyDesktopRelease(env, tauriConfig, implementation = {}) {
  const failures = [];
  if (env.DESKTOP_RELEASE_AUTHORIZED !== "true") {
    failures.push("DESKTOP_RELEASE_AUTHORIZED=true is required");
  }
  if (env.DESKTOP_SIGNING_STATUS !== "CONFIGURED") {
    failures.push("desktop signing must be CONFIGURED");
  }
  if (env.DESKTOP_UPDATER_STATUS !== "IMPLEMENTED") {
    failures.push("desktop updater must be IMPLEMENTED");
  }
  if (
    !isReleaseVersion(env.DESKTOP_RELEASE_VERSION ?? "") ||
    tauriConfig?.version !== env.DESKTOP_RELEASE_VERSION
  ) {
    failures.push("Tauri version must exactly match DESKTOP_RELEASE_VERSION");
  }

  let apiOrigin = "";
  try {
    const api = new URL(env.DESKTOP_PUBLIC_API_URL ?? "");
    if (
      api.protocol !== "https:" ||
      api.username ||
      api.password ||
      api.pathname !== "/" ||
      api.search ||
      api.hash ||
      unsafeRemoteHostname(api.hostname)
    ) {
      throw new Error("invalid API origin");
    }
    apiOrigin = api.origin;
  } catch {
    failures.push("DESKTOP_PUBLIC_API_URL must be an exact HTTPS origin");
  }

  const csp = String(tauriConfig?.app?.security?.csp ?? "");
  const connectSources = cspSources(csp, "connect-src");
  const allowedConnectSources = new Set([
    "self",
    "ipc:",
    apiOrigin,
    apiOrigin.replace(/^https:/, "wss:"),
    "http://ipc.localhost",
  ]);
  const unexpectedConnectSources = Array.from(connectSources).filter(
    (source) => !allowedConnectSources.has(source),
  );
  if (
    !apiOrigin ||
    !connectSources.has(apiOrigin) ||
    !connectSources.has(apiOrigin.replace(/^https:/, "wss:")) ||
    unexpectedConnectSources.length > 0
  ) {
    failures.push(
      "Tauri connect-src CSP must contain only the exact HTTPS and WSS target origins",
    );
  }
  if (csp.includes("*"))
    failures.push("Tauri release CSP cannot contain wildcards");
  const updaterEndpoints = tauriConfig?.plugins?.updater?.endpoints;
  const updaterPubkey = String(
    tauriConfig?.plugins?.updater?.pubkey ?? "",
  ).trim();
  const validUpdaterEndpoints =
    Array.isArray(updaterEndpoints) &&
    updaterEndpoints.length > 0 &&
    updaterEndpoints.every((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !unsafeRemoteHostname(url.hostname) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    });
  if (
    tauriConfig?.bundle?.createUpdaterArtifacts !== true ||
    !validUpdaterEndpoints ||
    updaterPubkey.length < 32 ||
    /change|replace|example|placeholder|todo/i.test(updaterPubkey)
  ) {
    failures.push(
      "Tauri updater artifacts, endpoint, and public key must be configured",
    );
  }
  if (
    cargoPackageVersion(implementation.cargoToml) !==
      env.DESKTOP_RELEASE_VERSION ||
    cargoLockPackageVersion(implementation.cargoLock) !==
      env.DESKTOP_RELEASE_VERSION
  ) {
    failures.push(
      "Cargo package and lock versions must exactly match DESKTOP_RELEASE_VERSION",
    );
  }
  if (
    !hasUpdaterImplementation(
      implementation.cargoToml,
      implementation.rustLib,
    )
  ) {
    failures.push(
      "Tauri updater dependency and runtime plugin must be implemented",
    );
  }
  return failures;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [configJson, cargoToml, cargoLock, rustLib] = await Promise.all([
    readFile("src-tauri/tauri.conf.json", "utf8"),
    readFile("src-tauri/Cargo.toml", "utf8"),
    readFile("src-tauri/Cargo.lock", "utf8"),
    readFile("src-tauri/src/lib.rs", "utf8"),
  ]);
  const failures = verifyDesktopRelease(process.env, JSON.parse(configJson), {
    cargoToml,
    cargoLock,
    rustLib,
  });
  if (failures.length > 0) {
    for (const failure of failures)
      console.error(`[desktop-release] ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("desktop-release: PASS");
  }
}

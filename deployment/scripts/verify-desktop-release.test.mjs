import assert from "node:assert/strict";
import test from "node:test";
import {
  hasUpdaterImplementation,
  verifyDesktopRelease,
} from "./verify-desktop-release.mjs";

test("desktop updater implementation cannot be satisfied by comments", () => {
  const cargo = '[dependencies]\ntauri-plugin-updater = "2"';
  assert.equal(
    hasUpdaterImplementation(
      cargo,
      "// .plugin(tauri_plugin_updater::Builder::new().build())",
    ),
    false,
  );
  assert.equal(
    hasUpdaterImplementation(
      cargo,
      "fn noop() {} // .plugin(tauri_plugin_updater::Builder::new().build())",
    ),
    false,
  );
  assert.equal(
    hasUpdaterImplementation(
      cargo,
      'let example = ".plugin(tauri_plugin_updater::Builder::new().build())";',
    ),
    false,
  );
  assert.equal(
    hasUpdaterImplementation(
      '[package]\nname = "tauri-plugin-updater"\nversion = "2"',
      ".plugin(tauri_plugin_updater::Builder::new().build())",
    ),
    false,
  );
  assert.equal(
    hasUpdaterImplementation(
      cargo,
      "/* tauri_plugin_updater::Builder::new().build() */",
    ),
    false,
  );
  assert.equal(
    hasUpdaterImplementation(
      cargo,
      ".plugin(tauri_plugin_updater::Builder::new().build())",
    ),
    true,
  );
});

test("desktop release fails closed without target, signing, updater, and CSP", () => {
  const failures = verifyDesktopRelease(
    {},
    { app: { security: { csp: "default-src 'self'" } } },
  );
  assert.ok(failures.length >= 4);
});

test("desktop release accepts only an explicitly authorized exact target", () => {
  const origin = "https://api.nutriclinica.mx";
  const failures = verifyDesktopRelease(
    {
      DESKTOP_RELEASE_AUTHORIZED: "true",
      DESKTOP_SIGNING_STATUS: "CONFIGURED",
      DESKTOP_UPDATER_STATUS: "IMPLEMENTED",
      DESKTOP_PUBLIC_API_URL: origin,
      DESKTOP_RELEASE_VERSION: "0.1.0-rc.2",
    },
    {
      app: {
        security: {
          csp: `default-src 'self'; connect-src 'self' ${origin} wss://api.nutriclinica.mx`,
        },
      },
      bundle: { createUpdaterArtifacts: true },
      version: "0.1.0-rc.2",
      plugins: {
        updater: {
          endpoints: [
            `${origin}/updates/{{target}}/{{arch}}/{{current_version}}`,
          ],
          pubkey: "A".repeat(64),
        },
      },
    },
    {
      cargoToml:
        '[package]\nname = "nutriclinica"\nversion = "0.1.0-rc.2"\n\n[dependencies]\ntauri-plugin-updater = "2"',
      cargoLock:
        'version = 4\n\n[[package]]\nname = "nutriclinica"\nversion = "0.1.0-rc.2"',
      rustLib: ".plugin(tauri_plugin_updater::Builder::new().build())",
    },
  );
  assert.deepEqual(failures, []);
});

test("desktop release rejects a config-only updater declaration", () => {
  const origin = "https://api.nutriclinica.mx";
  const failures = verifyDesktopRelease(
    {
      DESKTOP_RELEASE_AUTHORIZED: "true",
      DESKTOP_SIGNING_STATUS: "CONFIGURED",
      DESKTOP_UPDATER_STATUS: "IMPLEMENTED",
      DESKTOP_PUBLIC_API_URL: origin,
      DESKTOP_RELEASE_VERSION: "0.1.0",
    },
    {
      version: "0.1.0",
      app: {
        security: {
          csp: `connect-src ${origin} wss://api.nutriclinica.mx`,
        },
      },
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        updater: {
          endpoints: ["https://updates.nutriclinica.mx/latest.json"],
          pubkey: "A".repeat(64),
        },
      },
    },
  );

  assert.match(failures.join("\n"), /dependency and runtime plugin/);
});

test("desktop release rejects Cargo version drift and CSP in the wrong directive", () => {
  const origin = "https://api.nutriclinica.mx";
  const failures = verifyDesktopRelease(
    {
      DESKTOP_RELEASE_AUTHORIZED: "true",
      DESKTOP_SIGNING_STATUS: "CONFIGURED",
      DESKTOP_UPDATER_STATUS: "IMPLEMENTED",
      DESKTOP_PUBLIC_API_URL: origin,
      DESKTOP_RELEASE_VERSION: "0.1.0-rc.2",
    },
    {
      version: "0.1.0-rc.2",
      app: {
        security: {
          csp: `img-src ${origin} wss://api.nutriclinica.mx; connect-src 'self'`,
        },
      },
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        updater: {
          endpoints: ["https://updates.nutriclinica.mx/latest.json"],
          pubkey: "A".repeat(64),
        },
      },
    },
    {
      cargoToml:
        '[package]\nname = "nutriclinica"\nversion = "0.1.0"\n\n[dependencies]\ntauri-plugin-updater = "2"',
      cargoLock:
        'version = 4\n\n[[package]]\nname = "nutriclinica"\nversion = "0.1.0"',
      rustLib: ".plugin(tauri_plugin_updater::Builder::new().build())",
    },
  );

  assert.match(failures.join("\n"), /connect-src CSP/);
  assert.match(failures.join("\n"), /Cargo package and lock versions/);
});

test("desktop release rejects CSP substring matches and insecure updater endpoints", () => {
  const failures = verifyDesktopRelease(
    {
      DESKTOP_RELEASE_AUTHORIZED: "true",
      DESKTOP_SIGNING_STATUS: "CONFIGURED",
      DESKTOP_UPDATER_STATUS: "IMPLEMENTED",
      DESKTOP_PUBLIC_API_URL: "https://api.nutriclinica.mx",
      DESKTOP_RELEASE_VERSION: "0.1.0",
    },
    {
      app: {
        security: {
          csp: "connect-src https://api.nutriclinica.mx.evil wss://api.nutriclinica.mx.evil",
        },
      },
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        updater: {
          endpoints: ["http://updates.nutriclinica.mx/latest.json"],
          pubkey: "A".repeat(64),
        },
      },
    },
  );
  assert.match(failures.join("\n"), /exact HTTPS and WSS/);
  assert.match(failures.join("\n"), /updater artifacts/);
});

test("desktop release rejects stale remote connect-src targets", () => {
  const origin = "https://api.nutriclinica.mx";
  const failures = verifyDesktopRelease(
    {
      DESKTOP_RELEASE_AUTHORIZED: "true",
      DESKTOP_SIGNING_STATUS: "CONFIGURED",
      DESKTOP_UPDATER_STATUS: "IMPLEMENTED",
      DESKTOP_PUBLIC_API_URL: origin,
      DESKTOP_RELEASE_VERSION: "0.1.0",
    },
    {
      version: "0.1.0",
      app: {
        security: {
          csp: `connect-src ${origin} wss://api.nutriclinica.mx https://old.nutriclinica.mx`,
        },
      },
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        updater: {
          endpoints: ["https://updates.nutriclinica.mx/latest.json"],
          pubkey: "A".repeat(64),
        },
      },
    },
    {
      cargoToml:
        '[package]\nname = "nutriclinica"\nversion = "0.1.0"\n\n[dependencies]\ntauri-plugin-updater = "2"',
      cargoLock:
        'version = 4\n\n[[package]]\nname = "nutriclinica"\nversion = "0.1.0"',
      rustLib: ".plugin(tauri_plugin_updater::Builder::new().build())",
    },
  );

  assert.match(failures.join("\n"), /only the exact HTTPS and WSS/);
});

test("desktop release rejects bare CSP host sources", () => {
  const origin = "https://api.nutriclinica.mx";
  const failures = verifyDesktopRelease(
    {
      DESKTOP_RELEASE_AUTHORIZED: "true",
      DESKTOP_SIGNING_STATUS: "CONFIGURED",
      DESKTOP_UPDATER_STATUS: "IMPLEMENTED",
      DESKTOP_PUBLIC_API_URL: origin,
      DESKTOP_RELEASE_VERSION: "0.1.0",
    },
    {
      version: "0.1.0",
      app: {
        security: {
          csp: `connect-src 'self' ipc: http://ipc.localhost ${origin} wss://api.nutriclinica.mx evil.example.org`,
        },
      },
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        updater: {
          endpoints: ["https://updates.nutriclinica.mx/latest.json"],
          pubkey: "A".repeat(64),
        },
      },
    },
    {
      cargoToml:
        '[package]\nname = "nutriclinica"\nversion = "0.1.0"\n\n[dependencies]\ntauri-plugin-updater = "2"',
      cargoLock:
        'version = 4\n\n[[package]]\nname = "nutriclinica"\nversion = "0.1.0"',
      rustLib: ".plugin(tauri_plugin_updater::Builder::new().build())",
    },
  );

  assert.match(failures.join("\n"), /only the exact HTTPS and WSS/);
});

test("desktop release rejects API credentials, paths, and loopback targets", () => {
  const config = {
    app: {
      security: {
        csp: "connect-src https://api.nutriclinica.mx wss://api.nutriclinica.mx",
      },
    },
    bundle: { createUpdaterArtifacts: true },
    version: "0.1.0",
    plugins: {
      updater: {
        endpoints: ["https://localhost/updates.json"],
        pubkey: "A".repeat(64),
      },
    },
  };
  const failures = verifyDesktopRelease(
    {
      DESKTOP_RELEASE_AUTHORIZED: "true",
      DESKTOP_SIGNING_STATUS: "CONFIGURED",
      DESKTOP_UPDATER_STATUS: "IMPLEMENTED",
      DESKTOP_PUBLIC_API_URL:
        "https://user:password@api.nutriclinica.mx/path",
      DESKTOP_RELEASE_VERSION: "0.1.0",
    },
    config,
  );

  assert.match(failures.join("\n"), /exact HTTPS origin/);
  assert.match(failures.join("\n"), /updater artifacts/);
});

test("desktop release rejects reserved documentation targets", () => {
  const failures = verifyDesktopRelease(
    {
      DESKTOP_RELEASE_AUTHORIZED: "true",
      DESKTOP_SIGNING_STATUS: "CONFIGURED",
      DESKTOP_UPDATER_STATUS: "IMPLEMENTED",
      DESKTOP_PUBLIC_API_URL: "https://api.example.test",
      DESKTOP_RELEASE_VERSION: "0.1.0",
    },
    {
      app: {
        security: {
          csp: "connect-src https://api.example.test wss://api.example.test",
        },
      },
      bundle: { createUpdaterArtifacts: true },
      version: "0.1.0",
      plugins: {
        updater: {
          endpoints: ["https://updates.invalid/latest.json"],
          pubkey: "A".repeat(64),
        },
      },
    },
  );

  assert.match(failures.join("\n"), /exact HTTPS origin/);
  assert.match(failures.join("\n"), /updater artifacts/);
});

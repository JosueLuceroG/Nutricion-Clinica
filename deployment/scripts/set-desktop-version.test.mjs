import assert from "node:assert/strict";
import test from "node:test";
import {
  withCargoLockPackageVersion,
  withCargoPackageVersion,
  withDesktopApiOrigin,
  withDesktopVersion,
} from "./set-desktop-version.mjs";

test("applies the complete release version to Desktop and Rust metadata", () => {
  assert.deepEqual(
    withDesktopVersion({ productName: "NutriClinica" }, "0.1.0-rc.2"),
    {
      productName: "NutriClinica",
      version: "0.1.0-rc.2",
    },
  );
  assert.match(
    withCargoPackageVersion(
      '[package]\nname = "nutriclinica"\nversion = "0.1.0"\n\n[dependencies]\ntauri = "2"\n',
      "0.1.0-rc.2",
    ),
    /\[package\][\s\S]*version = "0\.1\.0-rc\.2"[\s\S]*\[dependencies\]/,
  );
  assert.match(
    withCargoLockPackageVersion(
      'version = 4\n\n[[package]]\nname = "dependency"\nversion = "9.0.0"\n\n[[package]]\nname = "nutriclinica"\nversion = "0.1.0"\n',
      "0.1.0-rc.2",
    ),
    /name = "nutriclinica"\nversion = "0\.1\.0-rc\.2"/,
  );
  assert.throws(() => withDesktopVersion({}, "latest"), /strict semantic/);
});

test("materializes only the approved Desktop HTTPS/WSS API target", () => {
  const config = withDesktopApiOrigin(
    {
      app: {
        security: {
          csp: "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost https://old.nutriclinica.mx wss://old.nutriclinica.mx evil.example.org",
        },
      },
    },
    "https://api.nutriclinica.mx",
  );

  assert.match(config.app.security.csp, /https:\/\/api\.nutriclinica\.mx/);
  assert.match(config.app.security.csp, /wss:\/\/api\.nutriclinica\.mx/);
  assert.doesNotMatch(config.app.security.csp, /old\.nutriclinica/);
  assert.doesNotMatch(config.app.security.csp, /evil\.example/);
  assert.match(config.app.security.csp, /http:\/\/ipc\.localhost/);
  assert.throws(
    () => withDesktopApiOrigin(config, "https://[::ffff:127.0.0.1]"),
    /remote HTTPS origin/,
  );
  assert.throws(
    () => withDesktopApiOrigin(config, "https://api.example.test"),
    /remote HTTPS origin/,
  );
});

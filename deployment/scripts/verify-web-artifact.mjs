import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const dist = resolve(process.argv[2] ?? "dist");
const failures = [];
const files = [];

async function visit(directory) {
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    if ((await stat(path)).isDirectory()) await visit(path);
    else files.push(path);
  }
}

await visit(dist);
for (const required of ["index.html", "sw.js", "manifest.webmanifest"]) {
  if (!files.some((file) => file === join(dist, required))) {
    failures.push(`missing ${required}`);
  }
}
const serviceWorkerPath = join(dist, "sw.js");
if (files.includes(serviceWorkerPath)) {
  const serviceWorker = await readFile(serviceWorkerPath, "utf8");
  if (
    !serviceWorker.includes("isVersionedBuildAsset") ||
    !serviceWorker.includes("networkFirstStaticAsset")
  ) {
    failures.push("service worker cache versioning contract missing");
  }
}
if (files.some((file) => file.endsWith(".map")))
  failures.push("source maps present");

let artifactText = "";
for (const file of files.filter((path) =>
  /\.(?:html|js|css|json|webmanifest)$/i.test(path),
)) {
  artifactText += `\n${await readFile(file, "utf8")}`;
}

if (
  /https?:\/\/(?:localhost|127\.0\.0\.1):(?:3000|1433|11434)/i.test(
    artifactText,
  )
) {
  failures.push("local API/SQL/AI endpoint embedded");
}
if (
  /BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}/.test(
    artifactText,
  )
) {
  failures.push("secret marker embedded");
}
if (/VITE_(?:STUN|TURN)|TURN_CREDENTIAL/.test(artifactText)) {
  failures.push("client-side ICE credential configuration embedded");
}
if (artifactText.includes("PHI_DEPLOYMENT_MARKER_6f6db2")) {
  failures.push("synthetic PHI marker embedded");
}
if (!artifactText.includes("/api"))
  failures.push("same-origin /api endpoint missing");

const nginx = await readFile(resolve("nginx.conf"), "utf8");
const nginxSecurityHeaders = await readFile(
  resolve("nginx-security-headers.conf"),
  "utf8",
);
for (const required of [
  "try_files $uri /index.html",
  "proxy_pass ${API_UPSTREAM}/",
  "proxy_set_header Upgrade $http_upgrade",
  'Cache-Control "public, immutable"',
  'Cache-Control "no-cache"',
]) {
  if (!nginx.includes(required))
    failures.push(`nginx contract missing: ${required}`);
}
for (const header of [
  "X-Content-Type-Options",
  "Content-Security-Policy",
  "default-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
]) {
  if (!nginxSecurityHeaders.includes(header)) {
    failures.push(`nginx security header contract missing: ${header}`);
  }
}
if (/connect-src[^;]*(?:\*|\bws:|\bhttp:)/i.test(nginxSecurityHeaders)) {
  failures.push("nginx connect-src permits wildcard or insecure origins");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[web-artifact] ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`web-deployment-artifact: PASS (${files.length} files)`);
}

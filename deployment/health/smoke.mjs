import { connect } from "node:net";

const apiUrl = (process.env.API_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const webUrl = (process.env.WEB_URL ?? "http://127.0.0.1:8080").replace(
  /\/$/,
  "",
);
const marker = "PHI_DEPLOYMENT_MARKER_6f6db2";

async function expectResponse(name, url, expectedStatuses, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "unreachable";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `${url}${url.includes("?") ? "&" : "?"}probe=${marker}`,
      );
      const body = await response.text();
      lastStatus = String(response.status);
      if (body.includes(marker))
        throw new Error(`${name}: synthetic PHI marker echoed`);
      if (expectedStatuses.includes(response.status)) return body;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("synthetic PHI marker")
      )
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `${name}: expected HTTP ${expectedStatuses.join("/")}, last=${lastStatus}`,
  );
}

async function expectWebSocketUpgradePath(timeoutMs = 30_000) {
  const target = new URL(webUrl);
  if (target.protocol !== "http:") {
    throw new Error(
      "local WebSocket smoke requires an HTTP simulation endpoint",
    );
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const statusLine = await new Promise((resolve) => {
      const socket = connect(Number(target.port || 80), target.hostname);
      let response = "";
      socket.setTimeout(2_000);
      socket.once("connect", () => {
        socket.write(
          `GET /api/ws/telemedicina HTTP/1.1\r\n` +
            `Host: ${target.host}\r\n` +
            `Origin: ${target.origin}\r\n` +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            "Sec-WebSocket-Key: ZGVwbG95bWVudC1zbW9rZQ==\r\n" +
            "Sec-WebSocket-Version: 13\r\n\r\n",
        );
      });
      socket.on("data", (chunk) => {
        response += chunk.toString();
        if (response.includes("\r\n")) socket.destroy();
      });
      socket.once("close", () => resolve(response.split("\r\n", 1)[0] ?? ""));
      socket.once("error", () => resolve(""));
      socket.once("timeout", () => socket.destroy());
    });
    if (statusLine.includes("401 Unauthorized")) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    "web-wss-proxy: upgrade did not reach authenticated API gateway",
  );
}

await expectResponse("api-liveness", `${apiUrl}/health/live`, [200]);
await expectResponse("api-readiness", `${apiUrl}/health/ready`, [503]);
await expectResponse("web-liveness", `${webUrl}/healthz`, [200]);
await expectResponse("web-api-proxy", `${webUrl}/api/health/live`, [200]);
await expectWebSocketUpgradePath();
console.log("local-deployment-simulation-smoke: PASS");

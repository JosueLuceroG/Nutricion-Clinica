import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@assets/css/globals.css";
import "./i18n/config";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Elemento #root no encontrado en el DOM");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (shouldRegisterServiceWorker()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn("Service worker registration failed", error);
    });
  });
}

function shouldRegisterServiceWorker(): boolean {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;
  return (
    window.location.protocol === "https:" ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
  );
}

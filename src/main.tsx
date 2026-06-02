import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@assets/css/globals.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Elemento #root no encontrado en el DOM");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

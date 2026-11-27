import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./editor/fontFaces";
import "./design/tokens.css";
import "./design/base.css";
import "./design/components.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

// Installable, offline-capable app. Only in production builds: a worker would cache dev files.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Installing is optional; the app works the same without it.
    });
  });
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

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

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

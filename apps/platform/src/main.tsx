import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "@pbdh/platform-auth/provider";

import { PlatformApp } from "./PlatformApp.tsx";
import "./styles.css";
import "@pbdh/platform-auth/styles.css";

window.name = "pbdh-platform";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider><PlatformApp /></AuthProvider>
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@pbdh/platform-auth/provider";

import { CreatorWorkspacePrototype } from "./workspace-prototype/CreatorWorkspacePrototype.tsx";
import "./styles.css";
import "./workspace-prototype/workspace.css";
import "@pbdh/platform-auth/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider><CreatorWorkspacePrototype /></AuthProvider>
  </StrictMode>,
);

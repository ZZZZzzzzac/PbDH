import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { CreatorWorkspacePrototype } from "./workspace-prototype/CreatorWorkspacePrototype.tsx";
import "./styles.css";
import "./workspace-prototype/workspace.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CreatorWorkspacePrototype />
  </StrictMode>,
);

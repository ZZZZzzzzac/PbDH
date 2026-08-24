import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@pbdh/platform-auth/provider";

import { PlayerAppPrototype } from "./PlayerAppPrototype.tsx";
import "./styles.css";
import "@pbdh/platform-auth/styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><AuthProvider><PlayerAppPrototype /></AuthProvider></StrictMode>);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PlayerAppPrototype } from "./PlayerAppPrototype.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><PlayerAppPrototype /></StrictMode>);

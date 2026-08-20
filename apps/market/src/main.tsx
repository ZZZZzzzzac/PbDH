import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MarketApp } from "./MarketApp.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><MarketApp /></StrictMode>);

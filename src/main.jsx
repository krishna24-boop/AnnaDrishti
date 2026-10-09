import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

createRoot(document.getElementById("root")).render(<App />);
registerSW({ immediate: true });

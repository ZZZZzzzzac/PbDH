import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBasePath(value: string | undefined): string {
  const basePath = value ?? "/";
  const normalized = `/${basePath.split("/").filter(Boolean).join("/")}/`;
  return normalized === "//" ? "/" : normalized;
}

function releaseVersionPlugin(version: string): Plugin {
  return {
    name: "pbdh-release-version",
    transformIndexHtml() {
      return [{
        tag: "meta",
        attrs: { name: "pbdh-version", content: version },
        injectTo: "head",
      }];
    },
  };
}

export default defineConfig({
  base: normalizeBasePath(process.env.PBDH_BASE_PATH),
  build: {
    outDir: process.env.PBDH_OUT_DIR ?? "dist",
  },
  plugins: [
    react(),
    releaseVersionPlugin(process.env.PBDH_RELEASE_VERSION ?? "development"),
  ],
  publicDir: "../player/public",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8001" },
  },
});

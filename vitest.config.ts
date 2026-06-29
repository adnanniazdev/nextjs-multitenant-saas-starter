import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Load environment variables from .env file for tests
function loadEnvFile() {
  try {
    const envPath = path.resolve(__dirname, ".env");
    const envContent = readFileSync(envPath, "utf-8");
    const envVars: Record<string, string> = {};

    envContent.split("\n").forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith("#")) {
        const [key, ...valueParts] = trimmedLine.split("=");
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join("=").trim();
        }
      }
    });

    return envVars;
  } catch (error) {
    console.warn("Could not load .env file for tests:", error);
    return {};
  }
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./__tests__/setup.ts",
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/*.e2e.spec.ts"],
    env: loadEnvFile(),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

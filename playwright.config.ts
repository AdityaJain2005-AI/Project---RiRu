import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      DEMO_MODE: process.env.DEMO_MODE ?? "true",
      LLM_PROVIDER: process.env.LLM_PROVIDER ?? "mock",
      EMBEDDINGS_PROVIDER: process.env.EMBEDDINGS_PROVIDER ?? "mock",
    },
  },
});

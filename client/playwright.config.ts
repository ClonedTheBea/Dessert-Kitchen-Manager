import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  use: {
    actionTimeout: 10000,
    baseURL: "http://127.0.0.1:5081",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "dotnet run --project ../server --no-build -- --urls http://127.0.0.1:5081",
    url: "http://127.0.0.1:5081/api/auth",
    timeout: 60000,
    reuseExistingServer: false,
    env: {
      DatabasePath: path.resolve("test-results", `kitchen-${Date.now()}.db`),
    },
  },
});

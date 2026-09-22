import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 20000, // Neon free tier can be slow to wake from idle
    fileParallelism: false,
  },
});
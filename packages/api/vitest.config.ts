import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@motory/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
});

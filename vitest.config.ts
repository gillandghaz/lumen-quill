import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@/server": fileURLToPath(new URL("./server", import.meta.url)),
      "@/shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "@/client": fileURLToPath(new URL("./client", import.meta.url)),
    },
  },
  test: { include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], environment: "node" },
});

import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  server: {
    port: 5173,
    fs: {
      allow: [resolve(here, "..", "..")],
    },
  },
});

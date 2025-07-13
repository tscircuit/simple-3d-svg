import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: {
      lib: "/lib",
      tests: "/tests",
    },
  },
})

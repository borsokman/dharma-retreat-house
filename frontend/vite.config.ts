import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev:api` talks to the Go backend through this proxy, so the site and
// the API share one origin and the staff session cookie just works.
// Start the backend first: cd backend && go run ./cmd/drh serve -dev
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: false },
    },
  },
});

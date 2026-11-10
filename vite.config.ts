import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative paths work both at the site root and under GitHub Pages /somenail/.
  base: "./",
});

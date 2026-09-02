import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Que Vite no limpie la terminal: si lo hace, se comen los errores de Rust
  // que `tauri dev` imprime en la misma consola.
  clearScreen: false,

  server: {
    // Tauri apunta a este puerto fijo desde `devUrl`. Si esta ocupado queremos
    // que falle, no que Vite se mude a otro puerto y la ventana quede en blanco.
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});

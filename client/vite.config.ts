import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allows access from network IP
    port: 3000, // Ensure this matches your package.json script if you want a specific port
    open: true, // This line will automatically open the browser
  },
});
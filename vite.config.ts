import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function excludeNonImageAiStudioAssets(): Plugin {
  const allowedImageExt = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
  return {
    name: 'exclude-non-image-aistudio-assets',
    closeBundle() {
      const targetDir = path.resolve(__dirname, 'dist', 'assets', 'aistudio');
      if (!fs.existsSync(targetDir)) return;
      for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
        const fullPath = path.join(targetDir, entry.name);
        if (entry.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else if (!allowedImageExt.test(entry.name)) {
          fs.rmSync(fullPath, { force: true });
        }
      }
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  plugins: [react(), excludeNonImageAiStudioAssets()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});

// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // 忽略翻译运行时产生的所有文件变化，避免 HMR 整页刷新
        ignored: [
          '**/public/translate-progress.json',
          '**/public/translate-log.json',
          '**/public/workers/**',
          '**/data/runtime/**',
          '**/public/content/lessons/**',
          '**/.translate_progress.json',
        ]
      }
    }
  },

  integrations: [react()]
});

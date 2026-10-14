import { defineConfig, type Plugin } from 'vite';
import { statSync } from 'node:fs';

// In the built page the boot script in index.html downloads the game script itself (so its bytes count in
// the progress bar, and it downloads at the same time as the models). This plugin writes the file sizes
// into the page and takes out the normal <script> tag.
function bootManifest(): Plugin {
  return {
    name: 'boot-manifest',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const entry = Object.values(ctx.bundle || {}).find((c) => c.type === 'chunk' && c.isEntry);
        if (!entry || entry.type !== 'chunk') throw new Error('no entry chunk');
        const js = Buffer.byteLength(entry.code);
        const core = statSync('public/assets/core.glb').size;
        const manifest = `<script>window.__MANIFEST=${JSON.stringify({ js: ['./' + entry.fileName, js], core })}</script>`;
        return html
          .replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>\s*/g, '')
          .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
          .replace('<!--BOOT-MANIFEST-->', manifest);
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [bootManifest()],
  build: {
    target: 'es2020',
    modulePreload: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
  },
  server: { port: 5173 },
});

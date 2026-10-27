import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { PWA_MANIFEST } from './src/pwa/manifest.js'

function pwaServiceWorkerPlugin(): Plugin {
  return {
    name: 'tutorly-pwa-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const icon of PWA_MANIFEST.icons) {
        const bytes = readFileSync(resolve('public', icon.src.slice(1)))
        const expectedSize = Number(icon.sizes.slice(0, icon.sizes.indexOf('x')))
        const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        if (!isPng || bytes.readUInt32BE(16) !== expectedSize || bytes.readUInt32BE(20) !== expectedSize) {
          this.error(`PWA icon ${icon.src} is missing, invalid, or does not match ${icon.sizes}`)
        }
      }

      const publicFiles = [
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/offline.html',
        '/favicon.svg',
        '/icons.svg',
        '/icons/apple-touch-icon.png',
        '/icons/tutorly-192.png',
        '/icons/tutorly-512.png',
        '/icons/tutorly-maskable-512.png',
      ]
      const buildAssets = Object.keys(bundle).map((fileName) => `/${fileName}`)
      const precacheUrls = [...new Set([...publicFiles, ...buildAssets])]
      const template = readFileSync(new URL('./src/pwa/sw.template.js', import.meta.url), 'utf8')
      const buildHash = createHash('sha256').update(precacheUrls.join('\n')).update(template).update(JSON.stringify(PWA_MANIFEST))
      for (const fileName of Object.keys(bundle)) {
        const output = bundle[fileName]
        if (output.type === 'asset') buildHash.update(output.source)
      }
      for (const publicPath of publicFiles.filter((path) => path !== '/' && path !== '/index.html' && path !== '/manifest.webmanifest')) {
        buildHash.update(readFileSync(resolve('public', publicPath.slice(1))))
      }
      const buildId = buildHash.digest('hex').slice(0, 12)
      const source = template
        .replace('__TUTORLY_BUILD_ID__', buildId)
        .replace('__TUTORLY_PRECACHE_URLS__', JSON.stringify(precacheUrls))

      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(PWA_MANIFEST, null, 2) })
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pwaServiceWorkerPlugin()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})

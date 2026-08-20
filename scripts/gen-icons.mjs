/**
 * Génère les icônes PNG du PWA à partir des SVG sources.
 * Lancement : npm run icons
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const icons = resolve(__dirname, '../public/icons')

const jobs = [
  { src: 'icon.svg', out: 'icon-192.png', size: 192 },
  { src: 'icon.svg', out: 'icon-512.png', size: 512 },
  { src: 'icon.svg', out: 'apple-touch-icon.png', size: 180 },
  { src: 'icon-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
]

for (const j of jobs) {
  await sharp(resolve(icons, j.src))
    .resize(j.size, j.size)
    .png()
    .toFile(resolve(icons, j.out))
  console.log(`✓ ${j.out} (${j.size}×${j.size})`)
}
console.log('✔ Icônes générées.')

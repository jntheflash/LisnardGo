/**
 * OPTIONNEL — Génère des icônes PWA à partir d'un portrait (rond) sur fond
 * bleu nuit. Source : public/markers/portrait.png (non fourni, hors dépôt).
 *
 * Par défaut, les icônes du dépôt sont générées depuis les SVG génériques
 * (`npm run icons`). N'utilisez ce script que si vous avez les droits sur le
 * portrait, et sachez qu'il ÉCRASE les icônes génériques dans public/icons/.
 *
 * Lancement : npm run appicons
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const icons = resolve(__dirname, '../public/icons')
const SRC = resolve(__dirname, '../public/markers/portrait.png')
const NAVY = { r: 15, g: 23, b: 42, alpha: 1 } // #0f172a

async function makeIcon(size, out, faceRatio) {
  const d = Math.round(size * faceRatio)
  const mask = Buffer.from(
    `<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`,
  )
  const face = await sharp(SRC)
    .resize(d, d, { fit: 'cover', position: 'top' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const off = Math.round((size - d) / 2)
  await sharp({
    create: { width: size, height: size, channels: 4, background: NAVY },
  })
    .composite([{ input: face, top: off, left: off }])
    .png()
    .toFile(resolve(icons, out))
  console.log(`✓ ${out} (${size}×${size})`)
}

await makeIcon(192, 'icon-192.png', 0.78)
await makeIcon(512, 'icon-512.png', 0.78)
await makeIcon(180, 'apple-touch-icon.png', 0.78)
await makeIcon(512, 'icon-maskable-512.png', 0.6) // zone de sécurité maskable
console.log('✔ Icônes générées depuis le portrait.')

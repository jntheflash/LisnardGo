/**
 * Transforme public/markers/portrait.png (portrait du candidat) en marqueur de
 * carte : visage rond + contour + pointe vers le bas (style "pin photo").
 *
 * OPTIONNEL : le dépôt fournit un marqueur générique (marqueur-fait.svg).
 * Ce script ne sert que si vous souhaitez y substituer une photo. Le portrait
 * et les images générées sont exclus du dépôt (cf. .gitignore) : à vous de
 * vérifier que vous disposez des droits sur l'image utilisée.
 *
 * Lancement : npm run marker
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const markers = resolve(__dirname, '../public/markers')
const SRC = resolve(markers, 'portrait.png')

const W = 88 // largeur (2× pour écrans retina ; affiché en 44px)
const H = 110
const D = 76 // diamètre du visage
const OFF = (W - D) / 2 // centrage horizontal/vertical du visage

// Masque circulaire pour le visage
const mask = Buffer.from(
  `<svg width="${D}" height="${D}"><circle cx="${D / 2}" cy="${D / 2}" r="${D / 2}" fill="#fff"/></svg>`,
)
const face = await sharp(SRC)
  .resize(D, D, { fit: 'cover', position: 'top' }) // garde la tête
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer()

// Fond du pin : pointe ambre + anneau (cercle blanc + contour ambre)
const pin = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <polygon points="30,76 58,76 44,108" fill="#2563eb"/>
    <circle cx="44" cy="44" r="41" fill="#ffffff" stroke="#2563eb" stroke-width="4"/>
  </svg>`,
)

await sharp({
  create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: pin, top: 0, left: 0 },
    { input: face, top: OFF, left: OFF },
  ])
  .png()
  .toFile(resolve(markers, 'portrait-marker.png'))

console.log('✔ portrait-marker.png généré (88×110, affiché en 44×55).')

// --- Version RONDE (sans pointe) pour les clusters 100% collés -------------
const R = 88 // canvas carré
const ring = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${R}" height="${R}" viewBox="0 0 ${R} ${R}">
    <circle cx="44" cy="44" r="42" fill="#ffffff" stroke="#2563eb" stroke-width="4"/>
  </svg>`,
)
await sharp({
  create: { width: R, height: R, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: ring, top: 0, left: 0 },
    { input: face, top: OFF, left: OFF },
  ])
  .png()
  .toFile(resolve(markers, 'portrait-round.png'))

console.log('✔ portrait-round.png généré (88×88, pour les clusters).')

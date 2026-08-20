/**
 * Import des panneaux d'affichage libre dans Supabase.
 *
 * - Lit data/panneaux.geojson (FeatureCollection, géométries Point).
 * - Ne garde QUE les panneaux statut = "Monté" (les autres n'existent pas
 *   physiquement : Démonté / Supprimé / Projet sont ignorés).
 * - Respecte l'ordre GeoJSON [longitude, latitude] (ne PAS inverser).
 * - Upsert idempotent sur la clé primaire (globalid) : ré-exécutable sans doublon.
 *
 * Lancement :  npm run import
 * Requiert dans .env :  SUPABASE_URL  et  SUPABASE_SERVICE_ROLE_KEY
 * (la clé service_role ignore la RLS — NE JAMAIS l'exposer côté client).
 */

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '✖ Variables manquantes. Renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env (cf. .env.example).',
  )
  process.exit(1)
}

// --- Types du GeoJSON source -------------------------------------------------
interface PanneauProps {
  globalid: string
  id_inventaire_nm: string
  commune: string
  quartier: string | null
  secteur: string | null
  pole: string | null
  nom_voie: string | null
  complement_adresse: string | null
  ral: string | null
  statut: 'Monté' | 'Démonté' | 'Supprimé' | 'Projet'
}
interface Feature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] } // [lng, lat]
  properties: PanneauProps
}
interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

// --- Lecture du fichier ------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url))
const geojsonPath = resolve(__dirname, '../data/panneaux.geojson')

const fc = JSON.parse(readFileSync(geojsonPath, 'utf8')) as FeatureCollection
console.log(`→ ${fc.features.length} features lues depuis ${geojsonPath}`)

// --- Filtrage + transformation ----------------------------------------------
const rows = fc.features
  .filter((f) => f.properties.statut === 'Monté')
  .map((f) => {
    const [lng, lat] = f.geometry.coordinates // ordre GeoJSON : [lng, lat]
    return {
      id: f.properties.globalid,
      id_inventaire: f.properties.id_inventaire_nm,
      commune: f.properties.commune,
      quartier: f.properties.quartier,
      secteur: f.properties.secteur,
      nom_voie: f.properties.nom_voie,
      complement_adresse: f.properties.complement_adresse,
      lat,
      lng,
    }
  })

console.log(`→ ${rows.length} panneaux "Monté" à importer (les autres ignorés).`)

// --- Insertion par lots (upsert idempotent sur la PK) ------------------------
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const BATCH = 200
let imported = 0

for (let i = 0; i < rows.length; i += BATCH) {
  const slice = rows.slice(i, i + BATCH)
  const { error } = await supabase
    .from('panneaux')
    .upsert(slice, { onConflict: 'id' })
  if (error) {
    console.error(`✖ Échec lot ${i}-${i + slice.length} :`, error.message)
    process.exit(1)
  }
  imported += slice.length
  console.log(`  ✓ ${imported}/${rows.length}`)
}

console.log(`✔ Import terminé : ${imported} panneaux dans Supabase.`)

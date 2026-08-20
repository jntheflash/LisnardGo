import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  BLOC_COLORS,
  BLOC_LABELS,
  BLOC_NEUTRE,
  ORDRE_BLOCS,
  opaciteBloc,
  opaciteDroites,
  type BlocKey,
  type PartiMeta,
  type ScoreBureau,
  type Scrutin,
} from '../data/blocsElectoraux'

const AUTRE_COLOR = '#94a3b8'
const AUTRE_LABEL = 'Autre'

// Le GeoJSON est chargé UNE fois (à la première activation), puis mémorisé.
let geoCache: Promise<{ parties: Record<Scrutin, PartiMeta[]> } & GeoJSON.FeatureCollection> | null = null
let partiesMeta: Record<Scrutin, PartiMeta[]> | null = null
function chargerGeo() {
  if (!geoCache) {
    geoCache = fetch('/data/bureaux-vote-44.geojson')
      .then((r) => r.json())
      .then((g) => {
        partiesMeta = g.parties
        return g
      })
  }
  return geoCache
}

const blocColor = (b: BlocKey | 'AUTRE') =>
  b === 'AUTRE' ? AUTRE_COLOR : BLOC_COLORS[b]
const blocLabel = (b: BlocKey | 'AUTRE') =>
  b === 'AUTRE' ? AUTRE_LABEL : BLOC_LABELS[b]

function popupHtml(
  props: Record<string, unknown>,
  scrutin: Scrutin,
  droitesOnly: boolean,
): string {
  const s = props[scrutin] as ScoreBureau | null
  const head =
    `<div style="font-weight:700;color:#0f172a">${props.com ?? ''}</div>` +
    `<div style="font-size:11px;color:#64748b">Bureau ${props.bv ?? ''}</div>`
  if (!s) {
    return head + `<div style="margin-top:6px;color:#94a3b8;font-size:12px">Pas de résultat pour ce scrutin</div>`
  }
  const meta = partiesMeta?.[scrutin] ?? []
  let html = head

  // Mode droites : part au sein des droites (C+D+ED ramenés à 100 %).
  if (droitesOnly) {
    const sum = s.C + s.D + s.ED
    html += `<div style="margin-top:8px;font-size:11px;font-weight:700;color:#334155">Au sein des droites <span style="font-weight:400;color:#94a3b8">(C+D+Ext. droite ramenés à 100 %)</span></div>`
    if (sum > 0) {
      const lead = (['C', 'D', 'ED'] as BlocKey[]).reduce((a, b) => (s[b] > s[a] ? b : a), 'C')
      html += (['C', 'D', 'ED'] as BlocKey[]).map((b) => {
        const part = Math.round((s[b] / sum) * 1000) / 10
        const w = b === lead ? 'font-weight:700' : ''
        return `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;${w}"><span style="width:9px;height:9px;border-radius:2px;background:${BLOC_COLORS[b]}"></span><span style="flex:1;color:#334155">${BLOC_LABELS[b]}</span><span style="font-variant-numeric:tabular-nums;color:#0f172a">${part}%</span></div>`
      }).join('')
    } else {
      html += `<div style="font-size:12px;color:#94a3b8">Aucune voix de droite</div>`
    }
  }

  // Détail parti par parti (% des exprimés), regroupé par bloc.
  html += `<div style="margin-top:8px;font-size:11px;font-weight:700;color:#334155">Détail par bloc <span style="font-weight:400;color:#94a3b8">(% des exprimés)</span></div>`
  let detail = ''
  const blocsOrdre: (BlocKey | 'AUTRE')[] = [...ORDRE_BLOCS, 'AUTRE']
  for (const bloc of blocsOrdre) {
    const items = meta
      .map((m, i) => ({ l: m.l, b: m.b, pct: s.v[i] ?? 0 }))
      .filter((x) => x.b === bloc && x.pct > 0)
      .sort((a, b) => b.pct - a.pct)
    if (items.length === 0) continue
    const total =
      bloc === 'AUTRE'
        ? Math.max(0, Math.round((100 - s.G - s.C - s.D - s.ED) * 10) / 10)
        : s[bloc]
    detail += `<div style="display:flex;align-items:center;gap:6px;margin-top:6px"><span style="width:9px;height:9px;border-radius:2px;background:${blocColor(bloc)}"></span><span style="flex:1;font-weight:700;color:${blocColor(bloc)}">${blocLabel(bloc)}</span><span style="font-weight:700;font-variant-numeric:tabular-nums;color:#0f172a">${total}%</span></div>`
    detail += items.map((x) =>
      `<div style="display:flex;gap:6px;margin-top:1px;padding-left:15px"><span style="flex:1;color:#475569;font-size:12px">${x.l}</span><span style="font-variant-numeric:tabular-nums;color:#64748b;font-size:12px">${x.pct}%</span></div>`,
    ).join('')
  }
  html += `<div style="margin-top:2px;max-height:38vh;overflow-y:auto">${detail}</div>`
  return html
}

/**
 * Calque électoral (choroplèthe des bureaux de vote du 44) dans un pane dédié,
 * AU-DESSUS du fond de carte mais SOUS les marqueurs (qui restent cliquables).
 */
export default function ElectoralLayer({
  enabled,
  scrutin,
  droitesOnly,
}: {
  enabled: boolean
  scrutin: Scrutin
  droitesOnly: boolean
}) {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)

  useEffect(() => {
    if (!map.getPane('electoral')) {
      const pane = map.createPane('electoral')
      pane.style.zIndex = '250'
    }
  }, [map])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const renderer = L.canvas({ pane: 'electoral' })
    const grey = { color: '#ffffff', weight: 0.4, fillColor: BLOC_NEUTRE, fillOpacity: 0.25 }

    chargerGeo().then((geo) => {
      if (cancelled) return
      const options: L.GeoJSONOptions = {
        pane: 'electoral',
        style: (feature) => {
          const s = feature?.properties?.[scrutin] as ScoreBureau | null
          if (!s) return grey
          if (droitesOnly) {
            const sum = s.C + s.D + s.ED
            if (sum <= 0) return grey
            const lead = (['C', 'D', 'ED'] as BlocKey[]).reduce((a, b) => (s[b] > s[a] ? b : a), 'C')
            return {
              color: '#ffffff',
              weight: 0.4,
              fillColor: BLOC_COLORS[lead],
              fillOpacity: opaciteDroites((s[lead] / sum) * 100),
            }
          }
          return {
            color: '#ffffff',
            weight: 0.4,
            fillColor: BLOC_COLORS[s.lead],
            fillOpacity: opaciteBloc(s.leadPct),
          }
        },
        onEachFeature: (feature, lyr) => {
          lyr.on('click', (e: L.LeafletMouseEvent) => {
            L.popup({ closeButton: true, autoPan: true, maxWidth: 300 })
              .setLatLng(e.latlng)
              .setContent(popupHtml(feature.properties ?? {}, scrutin, droitesOnly))
              .openOn(map)
          })
        },
      }
      ;(options as { renderer?: L.Renderer }).renderer = renderer
      const layer = L.geoJSON(geo, options)
      layer.addTo(map)
      layerRef.current = layer
    })

    return () => {
      cancelled = true
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
      map.closePopup()
    }
  }, [enabled, scrutin, droitesOnly, map])

  return null
}

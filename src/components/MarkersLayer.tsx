import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { iconPourEtat, ICONE_FAIT_RONDE_URL } from '../lib/markers'
import { COLORS, DIFFUSION_RADIUS_M } from '../config'
import type { PanneauAvecEtat } from '../types'

interface Props {
  panneaux: PanneauAvecEtat[]
  onSelect: (p: PanneauAvecEtat) => void
}

const SVGNS = 'http://www.w3.org/2000/svg'

/**
 * Injecte un dégradé radial bleu (plein au centre → transparent au bord) dans
 * le SVG de Leaflet. Les halos l'utilisent via la classe CSS `.halo-diffusion`.
 */
function ensureHaloGradient(map: L.Map) {
  const svg = map.getPanes().overlayPane.querySelector('svg')
  if (!svg || svg.querySelector('#haloGradient')) return
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS(SVGNS, 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }
  const grad = document.createElementNS(SVGNS, 'radialGradient')
  grad.setAttribute('id', 'haloGradient')
  grad.setAttribute('cx', '50%')
  grad.setAttribute('cy', '50%')
  grad.setAttribute('r', '50%')
  const stops: [string, string][] = [
    ['0%', '0.4'],
    ['55%', '0.22'],
    ['100%', '0'],
  ]
  for (const [offset, opacity] of stops) {
    const s = document.createElementNS(SVGNS, 'stop')
    s.setAttribute('offset', offset)
    s.setAttribute('stop-color', COLORS.fait)
    s.setAttribute('stop-opacity', opacity)
    grad.appendChild(s)
  }
  defs.appendChild(grad)
}

/**
 * Affiche les marqueurs des panneaux dans un cluster Leaflet.
 * Géré impérativement (hors React) pour les performances avec ~468 points.
 */
export default function MarkersLayer({ panneaux, onSelect }: Props) {
  const map = useMap()
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    // Halos de "diffusion" autour des panneaux faits (sous les marqueurs)
    const halos = L.layerGroup()
    for (const p of panneaux) {
      if (p.etat !== 'fait') continue
      L.circle([p.lat, p.lng], {
        radius: DIFFUSION_RADIUS_M,
        stroke: false, // pas de contour
        fillOpacity: 1, // l'opacité réelle est portée par le dégradé
        className: 'halo-diffusion', // fill = dégradé radial (cf. index.css)
        interactive: false, // ne bloque pas le clic sur les marqueurs
      }).addTo(halos)
    }
    map.addLayer(halos)
    ensureHaloGradient(map)

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => {
        const count = c.getChildCount()
        const size = count < 10 ? 40 : count < 100 ? 48 : 56
        // Si TOUS les panneaux du cluster sont collés → marqueur « fait » + badge.
        const enfants = c.getAllChildMarkers()
        const tousFaits =
          enfants.length > 0 &&
          enfants.every((m) => (m.options as { panneauEtat?: string }).panneauEtat === 'fait')
        if (tousFaits) {
          return L.divIcon({
            html: `<div class="cluster-lisnard" style="width:${size}px;height:${size}px"><img src="${ICONE_FAIT_RONDE_URL}" alt=""/><span class="cluster-lisnard-badge">${count}</span></div>`,
            className: 'cluster-wrapper',
            iconSize: L.point(size, size),
          })
        }
        // Sinon : rond neutre (bleu nuit), distinct des couleurs d'état.
        return L.divIcon({
          html: `<div class="cluster-bubble" style="width:${size}px;height:${size}px">${count}</div>`,
          className: 'cluster-wrapper',
          iconSize: L.point(size, size),
        })
      },
    })

    for (const p of panneaux) {
      const marker = L.marker([p.lat, p.lng], {
        icon: iconPourEtat(p.etat),
        panneauEtat: p.etat, // lu par iconCreateFunction du cluster
      } as L.MarkerOptions & { panneauEtat: string })
      marker.on('click', () => onSelect(p))
      cluster.addLayer(marker)
    }

    map.addLayer(cluster)
    clusterRef.current = cluster

    return () => {
      map.removeLayer(cluster)
      map.removeLayer(halos)
      clusterRef.current = null
    }
  }, [map, panneaux, onSelect])

  return null
}

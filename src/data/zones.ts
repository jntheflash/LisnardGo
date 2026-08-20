/** Zones prédéfinies du sélecteur de recentrage manuel (centre + zoom adaptés). */
export interface Zone {
  key: string
  label: string
  center: [number, number]
  zoom: number
}

export const ZONES: Zone[] = [
  { key: 'nantes', label: 'Nantes', center: [47.2184, -1.5536], zoom: 12 },
  { key: 'labaule', label: 'La Baule', center: [47.286, -2.3933], zoom: 13 },
  { key: 'rennes', label: 'Rennes', center: [48.1173, -1.6778], zoom: 12 },
]

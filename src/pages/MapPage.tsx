import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { MAP } from '../config'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { usePanneaux } from '../hooks/usePanneaux'
import MarkersLayer from '../components/MarkersLayer'
import LocateButton from '../components/LocateButton'
import LongPressCreate from '../components/LongPressCreate'
import PanneauSheet from '../components/PanneauSheet'
import ElectoralLayer from '../components/ElectoralLayer'
import ElectoralControl from '../components/ElectoralControl'
import MapAutoView from '../components/MapAutoView'
import type { Scrutin } from '../data/blocsElectoraux'
import { readSavedView } from '../lib/mapView'
import { Spinner } from '../components/ui'
import type { PanneauAvecEtat } from '../types'

/**
 * Fond de carte CARTO Voyager.
 *
 * CARTO exige désormais une clé sur ses tuiles : sans elle, les tuiles sont
 * toujours servies (HTTP 200) mais avec un filigrane « API KEY REQUIRED »
 * incrusté dans l'image. La clé est gratuite jusqu'à 5 M de requêtes/mois
 * (https://carto.com/basemaps/apikey/) et se renseigne dans VITE_MAP_TILES_KEY
 * — jamais en dur dans le code, ce fichier partant tel quel dans le navigateur.
 *
 * Sans clé configurée, on sert quand même la carte (filigranée) plutôt que de
 * casser l'affichage.
 */
const TILES_KEY = import.meta.env.VITE_MAP_TILES_KEY

const TILES_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' +
  (TILES_KEY ? `?key=${encodeURIComponent(TILES_KEY)}` : '')

if (!TILES_KEY) {
  console.warn(
    '[Carte] VITE_MAP_TILES_KEY absente : les tuiles CARTO afficheront le ' +
      'filigrane « API KEY REQUIRED ». Clé gratuite : https://carto.com/basemaps/apikey/',
  )
}

export default function MapPage() {
  const { user, profile } = useAuth()
  const {
    panneaux,
    loading,
    error,
    refresh,
    marquerFait,
    rafraichirPanneau,
    ajouterPanneau,
    retirerPanneau,
  } = usePanneaux()
  const [selected, setSelected] = useState<PanneauAvecEtat | null>(null)
  // Calque électoral (désactivé par défaut ; données chargées à l'activation)
  const [calqueElectoral, setCalqueElectoral] = useState(false)
  const [scrutin, setScrutin] = useState<Scrutin>('p22')
  const [droitesOnly, setDroitesOnly] = useState(false)
  // Vue initiale mémorisée (lue une seule fois) — priorité n°1 de la cascade.
  const savedView = useMemo(() => readSavedView(), [])

  const [busy, setBusy] = useState(false)
  const [actionErreur, setActionErreur] = useState<string | null>(null)
  // Création manuelle par appui long
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [creationBusy, setCreationBusy] = useState(false)
  const [creationErreur, setCreationErreur] = useState<string | null>(null)
  const [suppressionBusy, setSuppressionBusy] = useState(false)

  // Réinitialise l'erreur à chaque ouverture de fiche.
  useEffect(() => {
    setActionErreur(null)
  }, [selected])

  // Bouton "annuler" si le dernier collage est le mien — calculé instantanément
  // depuis les données (dernier_collage_par), donc plus de bascule/flicker.
  const annulerMode =
    selected?.etat === 'fait' && selected?.dernier_collage_par === user?.id

  // Enregistre le collage (comme avant) + les participants sélectionnés.
  // NB : ne change PAS les points — seul l'utilisateur courant marque (collages).
  // Renvoie true si succès (la sheet passe alors à l'étape de confirmation).
  async function validerCollage(partnerIds: string[]): Promise<boolean> {
    if (!selected || !user || busy) return false // anti double-clic
    setBusy(true)
    setActionErreur(null)
    const { data, error } = await supabase
      .from('collages')
      .insert({ panneau_id: selected.id, user_id: user.id })
      .select('id, created_at')
      .single()
    if (error || !data) {
      setBusy(false)
      // 45001 : déclencheur limite_collage_par_panneau (un collage / panneau /
      // 14 j). Ce n'est pas une panne réseau, il ne faut pas le dire.
      setActionErreur(
        error?.code === '45001'
          ? 'Vous avez déjà collé ce panneau il y a moins de 14 jours.'
          : 'Échec de l’enregistrement. Vérifiez votre connexion.',
      )
      return false
    }
    // Participants (suivi uniquement, best-effort)
    if (partnerIds.length > 0) {
      await supabase
        .from('collage_participants')
        .insert(partnerIds.map((uid) => ({ collage_id: data.id, user_id: uid })))
    }
    setBusy(false)
    const collageur = {
      id: user.id,
      nom: profile?.display_name ?? null,
      twitter: profile?.twitter ?? null,
      linkedin: profile?.linkedin ?? null,
    }
    marquerFait(selected.id, data.created_at, collageur)
    setSelected((p) =>
      p
        ? {
            ...p,
            dernier_collage: data.created_at,
            dernier_collage_par: collageur.id,
            dernier_collage_par_nom: collageur.nom,
            dernier_collage_par_twitter: collageur.twitter,
            dernier_collage_par_linkedin: collageur.linkedin,
            etat: 'fait',
          }
        : p,
    )
    return true
  }

  async function annuler() {
    if (!selected || !user || busy) return
    setBusy(true)
    setActionErreur(null)
    // Retrouve mon dernier collage sur ce panneau (pour le supprimer)
    const { data: latest, error: qErr } = await supabase
      .from('collages')
      .select('id')
      .eq('panneau_id', selected.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (qErr || !latest) {
      setBusy(false)
      setActionErreur('Annulation impossible. Réessayez.')
      return
    }
    const { data: del, error } = await supabase
      .from('collages')
      .delete()
      .eq('id', latest.id)
      .select('id')
    if (error) {
      setBusy(false)
      setActionErreur('Annulation impossible. Réessayez.')
      return
    }
    // RLS sans policy delete → suppression silencieuse (0 ligne). On le signale.
    if (!del || del.length === 0) {
      setBusy(false)
      setActionErreur(
        'Suppression bloquée. La policy SQL « collages_delete_own » est-elle bien créée dans Supabase ?',
      )
      return
    }
    const updated = await rafraichirPanneau(selected.id)
    setBusy(false)
    if (updated) setSelected(updated)
  }

  // Appui long → mémorise les coordonnées et ouvre la modale de confirmation.
  const onLongPress = useCallback((lat: number, lng: number) => {
    setPendingLatLng({ lat, lng })
  }, [])

  // Crée un panneau manuel aux coordonnées de l'appui long.
  async function creerPanneau() {
    if (!pendingLatLng || !user || creationBusy) return
    setCreationBusy(true)
    setCreationErreur(null)
    const { data, error } = await supabase
      .from('panneaux')
      .insert({
        source: 'manuel',
        created_by: user.id,
        lat: pendingLatLng.lat,
        lng: pendingLatLng.lng,
      })
      .select('*')
      .single()
    setCreationBusy(false)
    if (error || !data) {
      // 45002 : déclencheur limite_panneaux_manuels (15 / membre / 24 h).
      setCreationErreur(
        error?.code === '45002'
          ? 'Vous avez déjà ajouté 15 panneaux aujourd’hui. Réessayez demain.'
          : 'Création impossible. Réessayez.',
      )
      return
    }
    // Affiche immédiatement le panneau (neuf → « à faire »).
    ajouterPanneau({
      ...(data as PanneauAvecEtat),
      dernier_collage: null,
      dernier_collage_par: null,
      dernier_collage_par_nom: null,
      dernier_collage_par_twitter: null,
      dernier_collage_par_linkedin: null,
      etat: 'a_faire',
    })
    setPendingLatLng(null)
  }

  // Suppression douce d'un panneau manuel (par son créateur).
  async function supprimerPanneau() {
    if (!selected || !user || suppressionBusy) return
    setSuppressionBusy(true)
    setActionErreur(null)
    const { data, error } = await supabase
      .from('panneaux')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', selected.id)
      .select('id')
    setSuppressionBusy(false)
    if (error || !data || data.length === 0) {
      setActionErreur('Suppression impossible. Réessayez.')
      return
    }
    retirerPanneau(selected.id)
    setSelected(null)
  }

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={savedView?.center ?? MAP.center}
        zoom={savedView?.zoom ?? MAP.zoom}
        minZoom={MAP.minZoom}
        maxZoom={MAP.maxZoom}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={TILES_URL}
          subdomains="abcd"
        />
        <ElectoralLayer
          enabled={calqueElectoral}
          scrutin={scrutin}
          droitesOnly={droitesOnly}
        />
        {!loading && !error && (
          <MarkersLayer panneaux={panneaux} onSelect={setSelected} />
        )}
        <LocateButton />
        <MapAutoView
          panneaux={panneaux}
          departement={profile?.departement ?? null}
          hasSavedView={!!savedView}
        />
        <LongPressCreate onLongPress={onLongPress} />
      </MapContainer>

      <ElectoralControl
        on={calqueElectoral}
        setOn={setCalqueElectoral}
        scrutin={scrutin}
        setScrutin={setScrutin}
        droitesOnly={droitesOnly}
        setDroitesOnly={setDroitesOnly}
      />

      {/* État de chargement */}
      {loading && (
        <div className="absolute inset-x-0 top-24 z-[1000] flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-md">
            <Spinner className="h-4 w-4 text-brand" />
            Chargement des panneaux…
          </div>
        </div>
      )}

      {/* Erreur réseau */}
      {error && (
        <div className="absolute inset-x-0 top-24 z-[1000] flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm shadow-md">
            <span className="text-perime">{error}</span>
            <button
              onClick={refresh}
              className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Panneau : surface unique multi-étapes (détails → partenaires → confirmation) */}
      {selected && (
        <PanneauSheet
          key={selected.id}
          panneau={selected}
          onClose={() => setSelected(null)}
          onValiderCollage={validerCollage}
          onAnnuler={annuler}
          peutAnnuler={annulerMode}
          busy={busy}
          erreur={actionErreur}
          onSupprimer={supprimerPanneau}
          peutSupprimer={
            selected.source === 'manuel' && selected.created_by === user?.id
          }
          suppressionBusy={suppressionBusy}
        />
      )}

      {/* Modale de confirmation — création par appui long */}
      {pendingLatLng && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onClick={() => {
            setPendingLatLng(null)
            setCreationErreur(null)
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900">
              Validez-vous la création d'un panneau à cet endroit ?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {pendingLatLng.lat.toFixed(5)}, {pendingLatLng.lng.toFixed(5)}
            </p>
            {creationErreur && (
              <p className="mt-3 text-sm text-perime">{creationErreur}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setPendingLatLng(null)
                  setCreationErreur(null)
                }}
                disabled={creationBusy}
                className="flex-1 rounded-xl bg-slate-200 px-4 py-3 font-semibold text-slate-700 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={creerPanneau}
                disabled={creationBusy}
                className="flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {creationBusy ? 'Création…' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

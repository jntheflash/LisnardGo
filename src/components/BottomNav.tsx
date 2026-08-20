import { NavLink } from 'react-router-dom'

type Item = {
  to: string
  label: string
  icon: React.ReactNode
}

const MapIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
    <path
      d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Zm0 0v16m6-14v16"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const StatsIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
    <path
      d="M4 20V10m5 10V4m5 16v-7m5 7V8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const TrophyIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
    <path
      d="M6 4h12v3a6 6 0 0 1-12 0V4Zm0 1H3v2a4 4 0 0 0 4 4m11-6h3v2a4 4 0 0 1-4 4M9 17h6m-3-3v3m-3 4h6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const UserIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
    <path
      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const items: Item[] = [
  { to: '/', label: 'Carte', icon: MapIcon },
  { to: '/stats', label: 'Stats', icon: StatsIcon },
  { to: '/classement', label: 'Classement', icon: TrophyIcon },
  { to: '/profil', label: 'Profil', icon: UserIcon },
]

export default function BottomNav() {
  return (
    <nav
      className="z-[1000] flex shrink-0 items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigation principale"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            [
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
              isActive ? 'text-brand' : 'text-slate-400',
            ].join(' ')
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

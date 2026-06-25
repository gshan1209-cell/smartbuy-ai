import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',           label: '🏠 首頁'     },
  { to: '/search',     label: '🔍 搜尋菜價' },
  { to: '/solar-term', label: '🌿 節氣指南' },
  { to: '/report',     label: '📝 回報菜價' },
  { to: '/basket',     label: '🧺 我的菜籃' },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[var(--border)] shadow-sm">
      <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
        <NavLink to="/" className="text-lg font-extrabold text-[var(--green-dark)] tracking-tight">
          🥦 便宜買 AI
        </NavLink>
        <nav className="flex items-center gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--cream-dark)] text-[var(--green-dark)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--green-dark)] hover:bg-[var(--cream-dark)]'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
